const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const ICON_PATH = path.join(__dirname, '..', 'build', 'icon.ico');
const DEFAULT_REMOTE_APP_URL = 'https://quick-ims.vercel.app';
const DEFAULT_STATIC_PORT = 47821;

let mainWindow = null;
let staticServer = null;
let activeAppUrl = '';
let lastSyncSource = 'offline-bundle';

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

async function resolveStartUrl() {
  const remoteBaseUrl = getConfiguredRemoteUrl();
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
  ipcMain.handle('desktop:app-info', async () => ({
    version: app.getVersion(),
    mode: appMode,
    source: lastSyncSource,
    remoteUrl: remoteBaseUrl || null,
    url: activeAppUrl,
  }));

  ipcMain.handle('desktop:list-printers', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return [];
    try {
      const printers = await mainWindow.webContents.getPrintersAsync();
      return (printers || []).map((p) => ({
        name: p.name,
        displayName: p.displayName || p.name,
        isDefault: Boolean(p.isDefault),
        status: typeof p.status === 'number' ? p.status : 0,
      }));
    } catch (err) {
      console.error('Failed to list printers:', err);
      return [];
    }
  });

  ipcMain.handle('desktop:print-html-silent', async (_event, payload = {}) => {
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

    const tempFile = path.join(
      os.tmpdir(),
      `quickims-slip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`
    );

    let printWindow = null;
    try {
      fs.writeFileSync(tempFile, sanitizedHtml, 'utf8');

      printWindow = new BrowserWindow({
        show: false,
        width: viewportPx,
        height: 900,
        useContentSize: true,
        backgroundColor: '#ffffff',
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });

      await printWindow.loadFile(tempFile);
      await new Promise((r) => setTimeout(r, 80));

      // Normalize layout for exact thermal roll width and measure true single-page receipt height
      const measured = await printWindow.webContents.executeJavaScript(`
        (async () => {
          const prev = document.getElementById('__quickims_electron_print_fix');
          if (prev) prev.remove();
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
          document.head.appendChild(styleEl);
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const rect = document.body.getBoundingClientRect();
          const hPx = Math.max(
            document.body.scrollHeight || 0,
            document.documentElement.scrollHeight || 0,
            Math.ceil(rect ? rect.height : 0)
          );
          return { hPx };
        })();
      `);

      const rawHeightMm = Math.ceil(((Number(measured?.hPx) || 320) * 25.4) / 96);
      // Keep minimum 80mm & add 14mm bottom feed buffer so thermal cutter never clips the footer
      const heightMm = Math.max(80, Math.min(2000, rawHeightMm + 14));

      await printWindow.webContents.executeJavaScript(`
        (() => {
          const pageStyle = document.createElement('style');
          pageStyle.id = '__quickims_electron_page_size';
          pageStyle.textContent = '@page { size: ${widthMm}mm ${heightMm}mm; margin: 0 !important; }';
          document.head.appendChild(pageStyle);
        })();
      `);

      let targetDeviceName = '';
      if (mainWindow && !mainWindow.isDestroyed()) {
        try {
          const installed = await mainWindow.webContents.getPrintersAsync();
          if (requestedDevice) {
            const exact = installed.find(
              (p) =>
                p.name.toLowerCase() === requestedDevice.toLowerCase() ||
                (p.displayName && p.displayName.toLowerCase() === requestedDevice.toLowerCase())
            );
            const partial =
              exact ||
              installed.find(
                (p) =>
                  p.name.toLowerCase().includes(requestedDevice.toLowerCase()) ||
                  (p.displayName && p.displayName.toLowerCase().includes(requestedDevice.toLowerCase()))
              );
            targetDeviceName = partial ? partial.name : requestedDevice;
          } else {
            const defaultPrinter = installed.find((p) => p.isDefault);
            if (defaultPrinter) {
              targetDeviceName = defaultPrinter.name;
            }
          }
        } catch {
          targetDeviceName = requestedDevice;
        }
      } else {
        targetDeviceName = requestedDevice;
      }

      const printResult = await new Promise((resolve) => {
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

        printWindow.webContents.print(printOptions, (success, failureReason) => {
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

      return printResult;
    } catch (err) {
      return {
        success: false,
        message: err && err.message ? err.message : 'Silent print execution failed.',
      };
    } finally {
      if (printWindow && !printWindow.isDestroyed()) {
        try {
          printWindow.close();
        } catch {
          /* ignore */
        }
      }
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      } catch {
        /* ignore */
      }
    }
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

      socket.setTimeout(4000);
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
  const { url, mode, remoteBaseUrl } = await resolveStartUrl();
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

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
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

  await mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow).catch((err) => {
    console.error('Quick IMS Desktop failed to start:', err);
    app.quit();
  });

  app.on('window-all-closed', () => {
    if (staticServer) {
      try {
        staticServer.close();
      } catch {
        /* ignore */
      }
      staticServer = null;
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(console.error);
    }
  });
}
