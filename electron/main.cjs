const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const ICON_PATH = path.join(__dirname, '..', 'build', 'icon.ico');
const DEFAULT_REMOTE_APP_URL = 'https://quick-ims.vercel.app';
const DEFAULT_STATIC_PORT = 47821;
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

let mainWindow = null;
let staticServer = null;
let activeAppUrl = '';
let lastSyncSource = 'offline-bundle';
let autoUpdaterRef = null;
let updateInitialCheckTimer = null;
let updateCheckTimer = null;
let lastPromptedUpdateVersion = null;
let rawWorkerProc = null;
let rawWorkerReadyPromise = null;
let rawWorkerStdoutBuf = '';
let rawWorkerReqCounter = 0;
const rawWorkerPending = new Map();
let cachedPrintersList = [];
let cachedPrintersAt = 0;
let cachedPrintersPromise = null;
let printWorkerWindow = null;
let printWorkerReadyPromise = null;
let htmlPrintQueue = Promise.resolve();
let isQuitting = false;
let creatingWindowPromise = null;
let ipcHandlersRegistered = false;
let autoUpdaterInitialized = false;
let currentAppMode = 'offline-bundle';
let currentRemoteBaseUrl = '';
let updateState = {
  status: 'idle',
  version: app.getVersion(),
  message: 'Not checked yet.',
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

function getCacheDir() {
  return path.join(app.getPath('userData'), 'vercel-offline-cache');
}

function isOfflineOnlyFlag() {
  return process.argv.includes('--offline-only') || process.env.QUICKIMS_OFFLINE_ONLY === '1';
}

function getConfiguredRemoteUrl() {
  if (isOfflineOnlyFlag()) return '';
  const argMatch = process.argv.find((arg) => arg.startsWith('--live-url='));
  if (argMatch) {
    const val = argMatch.slice('--live-url='.length).trim().replace(/\/+$/, '');
    if (/^https?:\/\//i.test(val)) return val;
  }
  const envUrl = (process.env.QUICKIMS_APP_URL || '').trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(envUrl)) return envUrl;
  return DEFAULT_REMOTE_APP_URL;
}

function safeResolveUnder(baseDir, relPath) {
  const cleaned = relPath.replace(/^\/+/, '');
  const resolved = path.resolve(baseDir, cleaned);
  if (!resolved.startsWith(path.resolve(baseDir) + path.sep) && resolved !== path.resolve(baseDir)) {
    return null;
  }
  return resolved;
}

function writeCacheFile(cacheDir, relPath, buffer) {
  try {
    const target = safeResolveUnder(cacheDir, relPath);
    if (!target) return;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, buffer);
    fs.renameSync(tmp, target);
  } catch {
    /* ignore cache write errors */
  }
}

async function fetchRemoteWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function extractReferencedAssets(htmlText) {
  const urls = new Set();
  const attrRegex = /(?:src|href)=["'](\/assets\/[^"'?#]+|\/manifest\.json|\/pwa-icon\.svg)["']/gi;
  let match;
  while ((match = attrRegex.exec(htmlText)) !== null) {
    urls.add(match[1]);
  }
  return Array.from(urls);
}

async function prewarmAssetsFromHtml(remoteBaseUrl, cacheDir, htmlText) {
  const assetPaths = extractReferencedAssets(htmlText);
  await Promise.all(
    assetPaths.map(async (assetPath) => {
      const cacheTarget = safeResolveUnder(cacheDir, assetPath);
      const distTarget = safeResolveUnder(DIST_DIR, assetPath);
      if ((cacheTarget && fs.existsSync(cacheTarget)) || (distTarget && fs.existsSync(distTarget))) {
        return;
      }
      try {
        const res = await fetchRemoteWithTimeout(`${remoteBaseUrl}${assetPath}`, 6000);
        if (!res.ok) return;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 0) {
          writeCacheFile(cacheDir, assetPath, buf);
        }
      } catch {
        /* ignore prewarm failures */
      }
    })
  );
}

function cacheHasCoreBundleForHtml(cacheDir, htmlText) {
  const scriptMatch = htmlText.match(/<script[^>]+src=["'](\/assets\/[^"'?#]+)["']/i);
  if (!scriptMatch) return true;
  const mainScript = scriptMatch[1];
  const inCache = safeResolveUnder(cacheDir, mainScript);
  const inDist = safeResolveUnder(DIST_DIR, mainScript);
  return Boolean(
    (inCache && fs.existsSync(inCache)) ||
    (inDist && fs.existsSync(inDist))
  );
}

async function resolveHtmlDocument(remoteBaseUrl, cacheDir) {
  if (remoteBaseUrl) {
    try {
      const res = await fetchRemoteWithTimeout(`${remoteBaseUrl}/index.html`, 3500);
      if (res.ok) {
        const htmlText = await res.text();
        // Verify it is the real Quick IMS shell and not a captive portal / error page
        if (htmlText.includes('id="root"') || htmlText.includes("id='root'")) {
          writeCacheFile(cacheDir, 'index.html', Buffer.from(htmlText, 'utf8'));
          prewarmAssetsFromHtml(remoteBaseUrl, cacheDir, htmlText).catch(() => {});
          lastSyncSource = 'vercel-live';
          return htmlText;
        }
      }
    } catch {
      /* offline or unreachable -> fall back cleanly */
    }
  }

  const cachedIndex = safeResolveUnder(cacheDir, 'index.html');
  if (cachedIndex && fs.existsSync(cachedIndex)) {
    const cachedHtml = fs.readFileSync(cachedIndex, 'utf8');
    if (cacheHasCoreBundleForHtml(cacheDir, cachedHtml)) {
      lastSyncSource = 'vercel-offline-cache';
      return cachedHtml;
    }
  }

  const bundledIndex = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(bundledIndex)) {
    lastSyncSource = 'offline-bundle';
    return fs.readFileSync(bundledIndex, 'utf8');
  }

  return null;
}

function startStaticServer(preferredPort, remoteBaseUrl, cacheDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
        const rawPath = decodeURIComponent(reqUrl.pathname || '/');
        const ext = path.extname(rawPath).toLowerCase();
        const isHtmlOrRoute = rawPath === '/' || ext === '' || ext === '.html';

        if (isHtmlOrRoute) {
          const html = await resolveHtmlDocument(remoteBaseUrl, cacheDir);
          if (!html) {
            res.writeHead(404);
            res.end('Offline bundle not found');
            return;
          }
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          });
          res.end(html);
          return;
        }

        // Static asset (/assets/*, /manifest.json, /pwa-icon.svg, etc.)
        const relPath = rawPath.replace(/^\/+/, '');
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const isImmutableAsset = rawPath.startsWith('/assets/');

        // 1. For immutable Vite hashed /assets/*, serve instantly from local cache or bundled dist
        const cachedFile = safeResolveUnder(cacheDir, relPath);
        const distFile = safeResolveUnder(DIST_DIR, relPath);

        if (isImmutableAsset) {
          if (cachedFile && fs.existsSync(cachedFile) && fs.statSync(cachedFile).isFile()) {
            res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' });
            fs.createReadStream(cachedFile).pipe(res);
            return;
          }
          if (distFile && fs.existsSync(distFile) && fs.statSync(distFile).isFile()) {
            res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' });
            fs.createReadStream(distFile).pipe(res);
            return;
          }
        }

        // 2. Fetch from Vercel live deployment when online (required for newly deployed hashes or mutable files)
        if (remoteBaseUrl) {
          try {
            const remoteRes = await fetchRemoteWithTimeout(`${remoteBaseUrl}${rawPath}`, 6000);
            if (remoteRes.ok) {
              const remoteType = (remoteRes.headers.get('content-type') || '').toLowerCase();
              const buf = Buffer.from(await remoteRes.arrayBuffer());
              // Guard against HTML rewrite responses being cached as JS/CSS
              const isExpectedNonHtml = ext === '.js' || ext === '.mjs' || ext === '.css' || ext === '.svg' || ext === '.png';
              if (!isExpectedNonHtml || !remoteType.includes('text/html')) {
                if (buf.length > 0) {
                  writeCacheFile(cacheDir, relPath, buf);
                }
                res.writeHead(200, {
                  'Content-Type': contentType,
                  'Cache-Control': isImmutableAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
                });
                res.end(buf);
                return;
              }
            }
          } catch {
            /* offline -> fall through to local cache / dist */
          }
        }

        // 3. Offline fallback to local cache then bundled dist
        if (cachedFile && fs.existsSync(cachedFile) && fs.statSync(cachedFile).isFile()) {
          res.writeHead(200, { 'Content-Type': contentType });
          fs.createReadStream(cachedFile).pipe(res);
          return;
        }
        if (distFile && fs.existsSync(distFile) && fs.statSync(distFile).isFile()) {
          res.writeHead(200, { 'Content-Type': contentType });
          fs.createReadStream(distFile).pipe(res);
          return;
        }

        res.writeHead(404);
        res.end('Not found');
      } catch (err) {
        res.writeHead(500);
        res.end('Internal server error');
      }
    });

    server.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE' && preferredPort !== 0) {
        startStaticServer(0, remoteBaseUrl, cacheDir).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });

    server.listen(preferredPort, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : preferredPort;
      resolve({ server, port });
    });
  });
}

function resetRawWorkerState(reason) {
  rawWorkerReadyPromise = null;
  rawWorkerStdoutBuf = '';
  for (const [id, pending] of rawWorkerPending.entries()) {
    clearTimeout(pending.timer);
    pending.resolve({ success: false, message: reason || 'Spooler worker restarted.' });
    rawWorkerPending.delete(id);
  }
  if (rawWorkerProc) {
    const proc = rawWorkerProc;
    rawWorkerProc = null;
    try {
      if (proc.stdin && !proc.stdin.destroyed) {
        proc.stdin.end();
      }
    } catch {
      /* ignore */
    }
    try {
      if (!proc.killed) {
        proc.kill();
      }
    } catch {
      /* ignore */
    }
  }
}

function destroyPrintWorkerWindow() {
  printWorkerReadyPromise = null;
  const win = printWorkerWindow;
  printWorkerWindow = null;
  if (win && !win.isDestroyed()) {
    try {
      win.destroy();
    } catch {
      /* ignore */
    }
  }
}

function ensurePrintWorkerWindow() {
  if (isQuitting) {
    return Promise.resolve(null);
  }
  if (printWorkerWindow && !printWorkerWindow.isDestroyed() && printWorkerReadyPromise) {
    return printWorkerReadyPromise;
  }

  printWorkerWindow = new BrowserWindow({
    show: false,
    width: 320,
    height: 900,
    useContentSize: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  const worker = printWorkerWindow;
  worker.on('closed', () => {
    if (printWorkerWindow === worker) {
      printWorkerWindow = null;
      printWorkerReadyPromise = null;
    }
  });

  printWorkerReadyPromise = worker
    .loadURL('about:blank')
    .then(() => (isQuitting || worker.isDestroyed() ? null : worker))
    .catch(() => {
      if (printWorkerWindow === worker) {
        printWorkerWindow = null;
        printWorkerReadyPromise = null;
      }
      return null;
    });

  return printWorkerReadyPromise;
}

function cleanupBackgroundResources() {
  if (updateInitialCheckTimer) {
    clearTimeout(updateInitialCheckTimer);
    updateInitialCheckTimer = null;
  }
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }
  destroyPrintWorkerWindow();
  resetRawWorkerState('Application closing.');
  if (staticServer) {
    const srv = staticServer;
    staticServer = null;
    activeAppUrl = '';
    try {
      if (typeof srv.closeAllConnections === 'function') {
        srv.closeAllConnections();
      }
    } catch {
      /* ignore */
    }
    try {
      srv.close();
    } catch {
      /* ignore */
    }
  }
}

async function resolveStartUrl() {
  const remoteBaseUrl = getConfiguredRemoteUrl();
  if (staticServer && staticServer.listening && activeAppUrl) {
    return {
      url: activeAppUrl,
      mode: remoteBaseUrl ? 'vercel-live-sync' : 'offline-bundle',
      remoteBaseUrl,
    };
  }

  const cacheDir = getCacheDir();
  fs.mkdirSync(cacheDir, { recursive: true });

  if (!remoteBaseUrl && !fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    throw new Error(`Offline bundle not found at ${DIST_DIR}. Run "npm run build" first.`);
  }

  const started = await startStaticServer(DEFAULT_STATIC_PORT, remoteBaseUrl, cacheDir);
  staticServer = started.server;
  return {
    url: `http://127.0.0.1:${started.port}`,
    mode: remoteBaseUrl ? 'vercel-live-sync' : 'offline-bundle',
    remoteBaseUrl,
  };
}

function registerIpcHandlers(appMode, remoteBaseUrl) {
  currentAppMode = appMode;
  currentRemoteBaseUrl = remoteBaseUrl;

  if (ipcHandlersRegistered) {
    return;
  }
  ipcHandlersRegistered = true;

  ipcMain.handle('desktop:app-info', async () => ({
    version: app.getVersion(),
    mode: currentAppMode,
    source: lastSyncSource,
    remoteUrl: currentRemoteBaseUrl || null,
    url: activeAppUrl,
  }));

  ipcMain.handle('desktop:check-for-updates', async () => {
    if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR || !autoUpdaterRef) {
      return {
        checked: false,
        status: updateState.status,
        version: updateState.version,
        message: updateState.message,
      };
    }
    try {
      await autoUpdaterRef.checkForUpdates();
      return {
        checked: true,
        status: updateState.status,
        version: updateState.version,
        message: updateState.message,
      };
    } catch (err) {
      return {
        checked: false,
        status: 'error',
        version: app.getVersion(),
        message: err && err.message ? err.message : 'Unable to check for desktop updates right now.',
      };
    }
  });

  ipcMain.handle('desktop:install-update', async () => {
    if (!autoUpdaterRef || updateState.status !== 'downloaded') {
      return {
        started: false,
        message: 'No downloaded desktop update is waiting to install.',
      };
    }
    setImmediate(() => {
      autoUpdaterRef.quitAndInstall(true, true);
    });
    return {
      started: true,
      message: `Installing Quick IMS ${updateState.version} and restarting...`,
    };
  });

  ipcMain.handle('desktop:refresh-app', async () => {
    if (app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR && autoUpdaterRef) {
      if (updateState.status === 'downloaded') {
        setImmediate(() => {
          autoUpdaterRef.quitAndInstall(true, true);
        });
        return {
          refreshed: false,
          installingUpdate: true,
          message: `Installing Quick IMS ${updateState.version} and restarting...`,
        };
      }
      autoUpdaterRef.checkForUpdates().catch(() => {});
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        await mainWindow.webContents.session.clearCache();
      } catch {
        /* ignore */
      }
      mainWindow.webContents.reloadIgnoringCache();
      return {
        refreshed: true,
        installingUpdate: false,
        message: 'Application refreshed and update check triggered.',
      };
    }

    return {
      refreshed: false,
      installingUpdate: false,
      message: 'Main window unavailable.',
    };
  });

  async function refreshPrintersCache(force = false) {
    if (!mainWindow || mainWindow.isDestroyed()) return cachedPrintersList;
    const now = Date.now();
    if (!force && cachedPrintersList.length > 0 && now - cachedPrintersAt < 60000) {
      return cachedPrintersList;
    }
    if (cachedPrintersPromise) {
      return cachedPrintersPromise;
    }
    cachedPrintersPromise = mainWindow.webContents
      .getPrintersAsync()
      .then((printers) => {
        cachedPrintersList = (printers || []).map((p) => ({
          name: p.name,
          displayName: p.displayName || p.name,
          isDefault: Boolean(p.isDefault),
          status: typeof p.status === 'number' ? p.status : 0,
        }));
        cachedPrintersAt = Date.now();
        return cachedPrintersList;
      })
      .catch((err) => {
        console.error('Failed to list printers:', err);
        return cachedPrintersList;
      })
      .finally(() => {
        cachedPrintersPromise = null;
      });
    return cachedPrintersPromise;
  }

  ipcMain.handle('desktop:list-printers', async () => {
    return refreshPrintersCache(true);
  });

  async function resolveTargetPrinterName(requestedDevice) {
    const cleanRequested = typeof requestedDevice === 'string' ? requestedDevice.trim() : '';
    if (!mainWindow || mainWindow.isDestroyed()) return cleanRequested;
    try {
      const now = Date.now();
      let installed = cachedPrintersList;
      if (installed.length === 0 || now - cachedPrintersAt > 60000) {
        installed = await refreshPrintersCache(installed.length === 0);
      } else if (now - cachedPrintersAt > 15000) {
        refreshPrintersCache(true).catch(() => {});
      }

      if (cleanRequested) {
        const lowerReq = cleanRequested.toLowerCase();
        const exact = installed.find(
          (p) =>
            p.name.toLowerCase() === lowerReq ||
            (p.displayName && p.displayName.toLowerCase() === lowerReq)
        );
        const partial =
          exact ||
          installed.find(
            (p) =>
              p.name.toLowerCase().includes(lowerReq) ||
              (p.displayName && p.displayName.toLowerCase().includes(lowerReq))
          );
        return partial ? partial.name : cleanRequested;
      }
      const defaultPrinter = installed.find((p) => p.isDefault);
      return defaultPrinter ? defaultPrinter.name : '';
    } catch {
      return cleanRequested;
    }
  }

  function isVirtualOrOfficePrinterName(printerName) {
    if (!printerName) return false;
    return /onenote|microsoft print to pdf|microsoft xps|fax|send to onenote|adobe pdf|cutepdf|foxit|pdfcreator|laserjet|deskjet|officejet|inkjet|ecotank|pixma/i.test(
      printerName
    );
  }

  const RAW_SPOOLER_WORKER_PS1 = `[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$code = @'
using System;
using System.Runtime.InteropServices;

public class QuickImsWinSpoolRaw {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFOW {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }

  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern int StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW di);

  [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

  public static string SendBytes(string printerName, byte[] bytes) {
    if (bytes == null || bytes.Length == 0) return "ERR:EmptyPayload";
    IntPtr hPrinter = IntPtr.Zero;
    DOCINFOW di = new DOCINFOW();
    di.pDocName = "Quick IMS Thermal Receipt";
    di.pDataType = "RAW";

    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
      return "ERR:OpenPrinter:" + Marshal.GetLastWin32Error();
    }
    try {
      int jobId = StartDocPrinter(hPrinter, 1, di);
      if (jobId <= 0) {
        return "ERR:StartDocPrinter:" + Marshal.GetLastWin32Error();
      }
      try {
        if (!StartPagePrinter(hPrinter)) {
          return "ERR:StartPagePrinter:" + Marshal.GetLastWin32Error();
        }
        IntPtr pUnmanaged = Marshal.AllocCoTaskMem(bytes.Length);
        try {
          Marshal.Copy(bytes, 0, pUnmanaged, bytes.Length);
          int written = 0;
          if (!WritePrinter(hPrinter, pUnmanaged, bytes.Length, out written)) {
            return "ERR:WritePrinter:" + Marshal.GetLastWin32Error();
          }
          if (written != bytes.Length) {
            return "ERR:PartialWrite:" + written + "/" + bytes.Length;
          }
        } finally {
          Marshal.FreeCoTaskMem(pUnmanaged);
          EndPagePrinter(hPrinter);
        }
      } finally {
        EndDocPrinter(hPrinter);
      }
    } finally {
      ClosePrinter(hPrinter);
    }
    return "OK";
  }
}
'@
if (-not ([System.Management.Automation.PSTypeName]'QuickImsWinSpoolRaw').Type) {
  Add-Type -TypeDefinition $code -Language CSharp
}
[Console]::Out.WriteLine("READY")
[Console]::Out.Flush()
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $parts = $line.Split('|', 3)
  if ($parts.Length -lt 3) { continue }
  $reqId = $parts[0]
  try {
    $printerName = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($parts[1]))
    $bytes = [System.Convert]::FromBase64String($parts[2])
    $res = [QuickImsWinSpoolRaw]::SendBytes($printerName, $bytes)
    [Console]::Out.WriteLine("$reqId|$res")
  } catch {
    [Console]::Out.WriteLine("$reqId|ERR:$($_.Exception.Message)")
  }
  [Console]::Out.Flush()
}
`;

  function ensureRawSpoolerWorker() {
    if (isQuitting || process.platform !== 'win32') {
      return Promise.resolve(false);
    }
    if (rawWorkerReadyPromise && rawWorkerProc && !rawWorkerProc.killed) {
      return rawWorkerReadyPromise;
    }

    rawWorkerReadyPromise = new Promise((resolveReady) => {
      let settled = false;
      const finishReady = (ok) => {
        if (settled) return;
        settled = true;
        if (!ok) rawWorkerReadyPromise = null;
        resolveReady(ok);
      };

      try {
        const scriptPath = path.join(app.getPath('userData'), 'quickims-raw-worker.ps1');
        if (!fs.existsSync(scriptPath) || fs.readFileSync(scriptPath, 'utf8') !== RAW_SPOOLER_WORKER_PS1) {
          fs.writeFileSync(scriptPath, RAW_SPOOLER_WORKER_PS1, 'utf8');
        }

        const child = spawn(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
          { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }
        );
        rawWorkerProc = child;
        rawWorkerStdoutBuf = '';

        const warmTimer = setTimeout(() => finishReady(false), 15000);

        child.stdout.on('data', (chunk) => {
          rawWorkerStdoutBuf += chunk.toString('utf8');
          let nlIdx;
          while ((nlIdx = rawWorkerStdoutBuf.indexOf('\n')) !== -1) {
            const line = rawWorkerStdoutBuf.slice(0, nlIdx).replace(/\r$/, '').trim();
            rawWorkerStdoutBuf = rawWorkerStdoutBuf.slice(nlIdx + 1);
            if (!line) continue;

            if (line === 'READY') {
              clearTimeout(warmTimer);
              finishReady(true);
              continue;
            }

            const sep = line.indexOf('|');
            if (sep > 0) {
              const reqId = line.slice(0, sep);
              const statusMsg = line.slice(sep + 1);
              const pending = rawWorkerPending.get(reqId);
              if (pending) {
                clearTimeout(pending.timer);
                rawWorkerPending.delete(reqId);
                if (statusMsg === 'OK') {
                  pending.resolve({
                    success: true,
                    message: `RAW ESC/POS receipt (${pending.byteLen} bytes) printed silently via "${pending.printerName}"`,
                  });
                } else {
                  pending.resolve({
                    success: false,
                    message: `Windows Spooler RAW rejected (${pending.printerName}): ${statusMsg}`,
                  });
                }
              }
            }
          }
        });

        child.once('error', () => {
          clearTimeout(warmTimer);
          finishReady(false);
          resetRawWorkerState('Windows Spooler worker failed to launch.');
        });

        child.once('exit', () => {
          clearTimeout(warmTimer);
          finishReady(false);
          resetRawWorkerState('Windows Spooler worker exited.');
        });
      } catch {
        finishReady(false);
      }
    });

    return rawWorkerReadyPromise;
  }

  // Warm the Windows Spooler RAW worker immediately so first printout is instant
  if (process.platform === 'win32') {
    ensureRawSpoolerWorker().catch(() => {});
  }

  async function sendRawBytesToWindowsSpooler(printerName, buffer) {
    if (process.platform !== 'win32') {
      return { success: false, skipToHtml: true, message: 'Windows RAW Spooler is only available on Windows.' };
    }
    const ready = await ensureRawSpoolerWorker();
    if (!ready || !rawWorkerProc || rawWorkerProc.killed || !rawWorkerProc.stdin.writable) {
      return { success: false, message: 'Windows Spooler RAW worker is unavailable.' };
    }

    const reqId = String(++rawWorkerReqCounter);
    const printerB64 = Buffer.from(printerName, 'utf8').toString('base64');
    const dataB64 = buffer.toString('base64');

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        rawWorkerPending.delete(reqId);
        resolve({ success: false, message: `Windows Spooler RAW print timed out for "${printerName}".` });
      }, 10000);

      rawWorkerPending.set(reqId, {
        resolve,
        timer,
        printerName,
        byteLen: buffer.length,
      });

      try {
        rawWorkerProc.stdin.write(`${reqId}|${printerB64}|${dataB64}\n`);
      } catch (err) {
        clearTimeout(timer);
        rawWorkerPending.delete(reqId);
        resolve({
          success: false,
          message: err && err.message ? err.message : 'Failed writing to Windows Spooler worker.',
        });
      }
    });
  }

  ipcMain.handle('desktop:print-raw-spooler', async (_event, payload = {}) => {
    const rawData = Array.isArray(payload.data) ? payload.data : [];
    if (rawData.length === 0) {
      return { success: false, skipToHtml: true, message: 'No ESC/POS byte payload provided.' };
    }

    const targetDeviceName = await resolveTargetPrinterName(payload.deviceName);
    if (!targetDeviceName) {
      return { success: false, skipToHtml: true, message: 'No Windows printer selected or set as default.' };
    }

    if (isVirtualOrOfficePrinterName(targetDeviceName)) {
      return {
        success: false,
        skipToHtml: true,
        message: `"${targetDeviceName}" is a document/office printer; using HTML print instead.`,
      };
    }

    return sendRawBytesToWindowsSpooler(targetDeviceName, Buffer.from(rawData));
  });

  // Pre-warm printer cache and persistent HTML print worker window in background
  if (!isQuitting) {
    refreshPrintersCache(true).catch(() => {});
    ensurePrintWorkerWindow().catch(() => {});
  }

  async function executeHtmlSilentJob(payload = {}) {
    const html = typeof payload.html === 'string' ? payload.html : '';
    if (!html.trim()) {
      return { success: false, message: 'No receipt HTML content provided to print.' };
    }

    const requestedDevice = typeof payload.deviceName === 'string' ? payload.deviceName.trim() : '';
    const copies = Math.max(1, Math.min(10, Number(payload.copies) || 1));
    const silent = payload.silent !== false;
    const is58 = payload.paperWidth === '58mm';
    const widthMm = is58 ? 58 : 80;
    const printableWidthMm = is58 ? 48 : 72;
    const viewportPx = Math.round((widthMm * 96) / 25.4);

    // Strip any "@page { size: 80mm auto }" rule so Chromium never slices into tiny pages
    const sanitizedHtml = html.replace(/@page\s*\{[\s\S]*?\}/gi, '');

    try {
      const [workerWin, targetDeviceName] = await Promise.all([
        ensurePrintWorkerWindow(),
        resolveTargetPrinterName(requestedDevice),
      ]);

      if (!workerWin || workerWin.isDestroyed()) {
        return { success: false, message: 'Silent print worker window unavailable.' };
      }

      workerWin.setContentSize(viewportPx, 900);

      // Write HTML in-memory and normalize layout + measure single-page receipt height in ONE pass
      const measured = await workerWin.webContents.executeJavaScript(`
        (async () => {
          document.open();
          document.write(${JSON.stringify(sanitizedHtml)});
          document.close();
          const styleEl = document.createElement('style');
          styleEl.id = '__quickims_electron_print_fix';
          styleEl.textContent = \`
            html, body {
              margin: 0 !important;
              max-width: ${printableWidthMm}mm !important;
              background: #ffffff !important;
              color: #000000 !important;
              overflow: visible !important;
            }
            .no-print { display: none !important; }
            #quickims-thermal-print-target {
              margin: 0 !important;
            }
            @media print {
              html, body {
                margin: 0 !important;
              }
              .no-print { display: none !important; }
            }
          \`;
          (document.head || document.documentElement).appendChild(styleEl);
          await new Promise((resolve) => requestAnimationFrame(resolve));
          const rect = document.body ? document.body.getBoundingClientRect() : null;
          const hPx = Math.max(
            document.body ? document.body.scrollHeight : 0,
            document.documentElement ? document.documentElement.scrollHeight : 0,
            Math.ceil(rect ? rect.height : 0)
          );
          const rawHeightMm = Math.ceil(((Number(hPx) || 320) * 25.4) / 96);
          const heightMm = Math.max(80, Math.min(2000, rawHeightMm + 14));
          const pageStyle = document.createElement('style');
          pageStyle.id = '__quickims_electron_page_size';
          pageStyle.textContent = '@page { size: ${widthMm}mm ' + heightMm + 'mm; margin: 0 !important; }';
          (document.head || document.documentElement).appendChild(pageStyle);
          return { heightMm };
        })();
      `);

      const heightMm = Math.max(80, Math.min(2000, Number(measured?.heightMm) || 140));

      return await new Promise((resolve) => {
        const printOptions = {
          silent,
          printBackground: true,
          copies,
          margins: { marginType: 'none' },
          pageSize: {
            width: widthMm * 1000,
            height: heightMm * 1000,
          },
        };
        if (targetDeviceName) {
          printOptions.deviceName = targetDeviceName;
        }

        workerWin.webContents.print(printOptions, (success, failureReason) => {
          if (success) {
            resolve({
              success: true,
              message: targetDeviceName
                ? `Silently printed (${widthMm}×${heightMm}mm) to "${targetDeviceName}"`
                : `Silently printed (${widthMm}×${heightMm}mm) to Windows default printer`,
            });
          } else {
            resolve({
              success: false,
              message: `Windows print error${failureReason ? `: ${failureReason}` : ''}`,
            });
          }
        });
      });
    } catch (err) {
      return {
        success: false,
        message: err && err.message ? err.message : 'Silent print execution failed.',
      };
    }
  }

  ipcMain.handle('desktop:print-html-silent', async (_event, payload = {}) => {
    const jobPromise = htmlPrintQueue.then(
      () => executeHtmlSilentJob(payload),
      () => executeHtmlSilentJob(payload)
    );
    htmlPrintQueue = jobPromise.catch(() => null);
    return jobPromise;
  });

  ipcMain.handle('desktop:send-raw-tcp', async (_event, payload = {}) => {
    const ip = typeof payload.ip === 'string' ? payload.ip.trim() : '';
    const port = Number(payload.port) || 9100;
    const rawData = Array.isArray(payload.data) ? payload.data : [];

    if (!ip || rawData.length === 0) {
      return { success: false, message: 'Missing LAN IP address or ESC/POS byte payload.' };
    }

    return new Promise((resolve) => {
      const socket = new net.Socket();
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        try {
          socket.destroy();
        } catch {
          /* ignore */
        }
        resolve(result);
      };

      socket.setTimeout(1500);
      socket.once('timeout', () => done({ success: false, message: `LAN printer ${ip}:${port} timed out.` }));
      socket.once('error', (err) =>
        done({ success: false, message: `TCP send failed (${ip}:${port}): ${err.message}` })
      );

      socket.connect(port, ip, () => {
        const buffer = Buffer.from(rawData);
        socket.write(buffer, () => {
          socket.end(() => {
            done({
              success: true,
              message: `Raw ESC/POS command (${buffer.length} bytes) sent to ${ip}:${port}`,
            });
          });
        });
      });
    });
  });

  ipcMain.handle('desktop:test-tcp', async (_event, payload = {}) => {
    const ip = typeof payload.ip === 'string' ? payload.ip.trim() : '';
    const port = Number(payload.port) || 9100;

    if (!ip) {
      return { success: false, message: 'Please enter a valid IP address.' };
    }

    const start = Date.now();
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        try {
          socket.destroy();
        } catch {
          /* ignore */
        }
        resolve(result);
      };

      socket.setTimeout(2500);
      socket.once('timeout', () =>
        done({ success: false, message: `Connection to ${ip}:${port} timed out.` })
      );
      socket.once('error', (err) =>
        done({ success: false, message: `Cannot reach ${ip}:${port} (${err.code || err.message}).` })
      );

      socket.connect(port, ip, () => {
        const latencyMs = Date.now() - start;
        done({
          success: true,
          latencyMs,
          message: `LAN printer ${ip}:${port} reachable (${latencyMs}ms). Ready for direct RAW TCP & silent printing!`,
        });
      });
    });
  });
}

async function createWindow() {
  if (isQuitting) return null;

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  if (creatingWindowPromise) {
    return creatingWindowPromise;
  }

  creatingWindowPromise = (async () => {
    const { url, mode, remoteBaseUrl } = await resolveStartUrl();
    if (isQuitting) return null;

    activeAppUrl = url;

    registerIpcHandlers(mode, remoteBaseUrl);
    Menu.setApplicationMenu(null);

    const windowOptions = {
      width: 1366,
      height: 840,
      minWidth: 1024,
      minHeight: 680,
      title: 'Quick IMS — Restaurant POS & Inventory',
      autoHideMenuBar: true,
      backgroundColor: '#f8fafc',
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    };

    if (fs.existsSync(ICON_PATH)) {
      windowOptions.icon = ICON_PATH;
    }

    const win = new BrowserWindow(windowOptions);
    mainWindow = win;

    // Attach 'closed' immediately before awaiting loadURL so even an early close cleans up workers.
    win.on('closed', () => {
      if (mainWindow === win) {
        mainWindow = null;
      }
      // Hidden background print worker MUST be destroyed when the main window closes,
      // otherwise its invisible BrowserWindow keeps Electron alive and blocks relaunches.
      destroyPrintWorkerWindow();
      if (process.platform !== 'darwin') {
        for (const otherWin of BrowserWindow.getAllWindows()) {
          if (otherWin !== win && !otherWin.isDestroyed() && !otherWin.isVisible()) {
            try {
              otherWin.destroy();
            } catch {
              /* ignore */
            }
          }
        }
      }
    });

    win.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
      if (
        targetUrl.startsWith('blob:') ||
        targetUrl.startsWith('about:blank') ||
        targetUrl.includes('accounts.google.com') ||
        targetUrl.includes('firebaseapp.com')
      ) {
        return { action: 'allow' };
      }
      if (/^https?:\/\//i.test(targetUrl)) {
        shell.openExternal(targetUrl);
      }
      return { action: 'deny' };
    });

    await win.loadURL(url);

    if (!isQuitting && !win.isDestroyed()) {
      ensurePrintWorkerWindow().catch(() => {});
    }

    return win;
  })().finally(() => {
    creatingWindowPromise = null;
  });

  return creatingWindowPromise;
}

function setupAutoUpdater() {
  if (autoUpdaterInitialized) return;
  autoUpdaterInitialized = true;

  if (!app.isPackaged) {
    updateState = {
      status: 'unsupported',
      version: app.getVersion(),
      message: 'Auto-updater runs only in installed packaged builds.',
    };
    return;
  }

  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    updateState = {
      status: 'unsupported',
      version: app.getVersion(),
      message: 'Portable .exe does not auto-update. Install via Quick-IMS-Setup for auto-updates.',
    };
    return;
  }

  const updateConfigPath = path.join(process.resourcesPath, 'app-update.yml');
  if (!fs.existsSync(updateConfigPath)) {
    updateState = {
      status: 'unsupported',
      version: app.getVersion(),
      message: 'Update feed metadata (app-update.yml) not found in this installation.',
    };
    return;
  }

  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdaterRef = autoUpdater;

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.disableWebInstaller = true;
    autoUpdater.allowPrerelease = false;

    autoUpdater.on('checking-for-update', () => {
      updateState = {
        status: 'checking',
        version: app.getVersion(),
        message: 'Checking for desktop app updates...',
      };
    });

    autoUpdater.on('update-available', (info) => {
      const nextVersion = (info && info.version) || app.getVersion();
      updateState = {
        status: 'available',
        version: nextVersion,
        message: `Downloading desktop update v${nextVersion} in background...`,
      };
    });

    autoUpdater.on('update-not-available', () => {
      updateState = {
        status: 'up-to-date',
        version: app.getVersion(),
        message: `Quick IMS v${app.getVersion()} is up to date.`,
      };
    });

    autoUpdater.on('update-downloaded', async (info) => {
      const nextVersion = (info && info.version) || 'new';
      updateState = {
        status: 'downloaded',
        version: nextVersion,
        message: `Desktop update v${nextVersion} downloaded and ready to install.`,
      };

      if (lastPromptedUpdateVersion === nextVersion) return;
      lastPromptedUpdateVersion = nextVersion;

      const dialogOptions = {
        type: 'info',
        buttons: ['Restart & Update Now', 'Install When Closed'],
        defaultId: 0,
        cancelId: 1,
        title: 'Quick IMS Desktop Update Ready',
        message: `Quick IMS v${nextVersion} has been downloaded in the background.`,
        detail:
          'Restart now to apply the native desktop update, or keep billing and it will install automatically when you close Quick IMS.',
      };

      try {
        const result =
          mainWindow && !mainWindow.isDestroyed()
            ? await dialog.showMessageBox(mainWindow, dialogOptions)
            : await dialog.showMessageBox(dialogOptions);

        if (result.response === 0) {
          setImmediate(() => {
            autoUpdater.quitAndInstall(true, true);
          });
        }
      } catch (err) {
        console.error('Auto-update prompt failed:', err);
      }
    });

    autoUpdater.on('error', (err) => {
      updateState = {
        status: 'error',
        version: app.getVersion(),
        message: err && err.message ? err.message : 'Auto-update check failed.',
      };
      console.warn('Auto-updater warning (non-fatal):', updateState.message);
    });

    if (updateInitialCheckTimer) clearTimeout(updateInitialCheckTimer);
    updateInitialCheckTimer = setTimeout(() => {
      updateInitialCheckTimer = null;
      if (!isQuitting) {
        autoUpdater.checkForUpdates().catch(() => {});
      }
    }, 6000);

    if (updateCheckTimer) clearInterval(updateCheckTimer);
    updateCheckTimer = setInterval(() => {
      if (!isQuitting) {
        autoUpdater.checkForUpdates().catch(() => {});
      }
    }, UPDATE_CHECK_INTERVAL_MS);
  } catch (err) {
    console.warn('Could not initialize auto-updater:', err);
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (isQuitting) return;
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
      return;
    }
    app.whenReady()
      .then(() => createWindow())
      .catch((err) => {
        console.error('Quick IMS Desktop failed to reopen window:', err);
      });
  });

  app.whenReady()
    .then(async () => {
      await createWindow();
      setupAutoUpdater();
    })
    .catch((err) => {
      console.error('Quick IMS Desktop failed to start:', err);
      app.quit();
    });

  app.on('before-quit', () => {
    isQuitting = true;
    cleanupBackgroundResources();
  });

  app.on('window-all-closed', () => {
    cleanupBackgroundResources();
    if (process.platform !== 'darwin') {
      isQuitting = true;
      app.quit();
    }
  });

  app.on('will-quit', () => {
    isQuitting = true;
    cleanupBackgroundResources();
  });

  app.on('activate', () => {
    if (!isQuitting && (!mainWindow || mainWindow.isDestroyed())) {
      createWindow().catch(console.error);
    }
  });
}
