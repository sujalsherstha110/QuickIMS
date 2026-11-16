const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const ICON_PATH = path.join(__dirname, '..', 'build', 'icon.ico');
const DEFAULT_STATIC_PORT = 47821;

let mainWindow = null;
let staticServer = null;
let activeAppUrl = '';

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

function getLiveUrlOverride() {
  const argMatch = process.argv.find((arg) => arg.startsWith('--live-url='));
  if (argMatch) {
    const val = argMatch.slice('--live-url='.length).trim();
    if (/^https?:\/\//i.test(val)) return val;
  }
  const envUrl = (process.env.QUICKIMS_APP_URL || '').trim();
  if (/^https?:\/\//i.test(envUrl)) return envUrl;
  return '';
}

function startStaticServer(preferredPort) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
        let urlPath = decodeURIComponent(reqUrl.pathname || '/');
        if (urlPath === '/') {
          urlPath = '/index.html';
        }

        const safeRel = urlPath.replace(/^\/+/, '');
        let filePath = path.resolve(DIST_DIR, safeRel);

        if (!filePath.startsWith(path.resolve(DIST_DIR))) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          // Serve SPA index.html for client-side routes, 404 only for missing asset files
          const hasExt = path.extname(filePath).length > 0 && path.extname(filePath) !== '.html';
          if (hasExt) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          filePath = path.join(DIST_DIR, 'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const headers = { 'Content-Type': contentType };
        if (ext === '.html') {
          headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        } else {
          headers['Cache-Control'] = 'public, max-age=31536000, immutable';
        }

        res.writeHead(200, headers);
        fs.createReadStream(filePath).pipe(res);
      } catch (err) {
        res.writeHead(500);
        res.end('Internal server error');
      }
    });

    server.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE' && preferredPort !== 0) {
        startStaticServer(0).then(resolve).catch(reject);
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
  const liveOverride = getLiveUrlOverride();
  if (liveOverride) {
    return { url: liveOverride, mode: 'live-url' };
  }

  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    throw new Error(`Offline bundle not found at ${DIST_DIR}. Run "npm run build" first.`);
  }

  const started = await startStaticServer(DEFAULT_STATIC_PORT);
  staticServer = started.server;
  return { url: `http://127.0.0.1:${started.port}`, mode: 'offline-bundle' };
}

function registerIpcHandlers(appMode) {
  ipcMain.handle('desktop:app-info', async () => ({
    version: app.getVersion(),
    mode: appMode,
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

    const tempFile = path.join(
      os.tmpdir(),
      `quickims-slip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`
    );

    let printWindow = null;
    try {
      fs.writeFileSync(tempFile, html, 'utf8');

      printWindow = new BrowserWindow({
        show: false,
        width: 420,
        height: 900,
        backgroundColor: '#ffffff',
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });

      await printWindow.loadFile(tempFile);
      await new Promise((r) => setTimeout(r, 90));

      let targetDeviceName = '';
      if (requestedDevice && mainWindow && !mainWindow.isDestroyed()) {
        try {
          const installed = await mainWindow.webContents.getPrintersAsync();
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
        } catch {
          targetDeviceName = requestedDevice;
        }
      }

      const printResult = await new Promise((resolve) => {
        const printOptions = {
          silent,
          printBackground: true,
          copies,
          margins: { marginType: 'none' },
        };
        if (targetDeviceName) {
          printOptions.deviceName = targetDeviceName;
        }

        printWindow.webContents.print(printOptions, (success, failureReason) => {
          if (success) {
            resolve({
              success: true,
              message: targetDeviceName
                ? `Silently printed to Windows printer "${targetDeviceName}"`
                : 'Silently printed to Windows default thermal printer',
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
  const { url, mode } = await resolveStartUrl();
  activeAppUrl = url;

  registerIpcHandlers(mode);
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
