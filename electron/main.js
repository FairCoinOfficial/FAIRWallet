const { app, BrowserWindow, Menu, ipcMain, safeStorage, protocol, shell, dialog } = require('electron');
const path = require('path');
const net = require('net');
const dns = require('dns');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Register the app:// scheme as a standard, secure origin BEFORE the app is
// ready. Without this, Chromium treats app:// as an opaque path scheme (like
// data: / javascript:) and `new URL(relative, 'app://local/index.html')`
// throws "Invalid base URL" — which breaks expo-router and React Native for
// Web asset resolution.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'fairwallet',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow = null;
const peerConnections = new Map();

/**
 * Resolve the dist directory path.
 * In production (electron-builder), files are in extraResources/dist.
 * In development, they are in the project root dist/.
 */
function getDistPath() {
  if (process.resourcesPath) {
    const resourceDist = path.join(process.resourcesPath, 'dist');
    if (fs.existsSync(resourceDist)) {
      return resourceDist;
    }
  }
  return path.join(__dirname, '..', 'dist');
}

/**
 * Register a custom app:// protocol to serve the Expo web export.
 *
 * Expo Router expects to be served from a root URL (e.g. http://host/).
 * Loading via file:// gives a path like file:///C:/Users/.../dist/index.html
 * which breaks route matching. A custom protocol maps app://. to the dist
 * directory so the router sees clean paths starting from /.
 */
function registerAppProtocol() {
  const distPath = getDistPath();

  protocol.registerFileProtocol('fairwallet', (request, callback) => {
    // The page is loaded via app://local/index.html so relative asset
    // requests from the HTML (e.g. /_expo/static/js/entry.js) resolve to
    // app://local/_expo/static/... — a valid URL we can parse.
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      pathname = '/index.html';
    }

    // Strip leading slash so path.join doesn't interpret as absolute
    if (pathname.startsWith('/')) {
      pathname = pathname.slice(1);
    }

    if (!pathname) {
      pathname = 'index.html';
    }

    const filePath = path.join(distPath, pathname);

    // Only serve the file if it exists AND is a real file. Fall back to
    // index.html for SPA routing (expo-router) so unknown routes still load.
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      callback({ path: filePath });
    } else {
      callback({ path: path.join(distPath, 'index.html') });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 740,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: '#1b1e09',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const isDev = process.argv.includes('--dev');
  if (isDev) {
    mainWindow.loadURL('http://localhost:8081');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('fairwallet://local/');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    for (const [, socket] of peerConnections) {
      socket.destroy();
    }
    peerConnections.clear();
  });
}

/**
 * Safely forward a menu action to the renderer via IPC.
 * Guards against sending when the window has been closed or destroyed.
 */
function sendMenuAction(channel) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel);
  }
}

/**
 * Build the application menu template.
 * Returns an array suitable for Menu.buildFromTemplate().
 */
function buildAppMenu() {
  const isMac = process.platform === 'darwin';

  const template = [];

  if (isMac) {
    template.push({
      label: 'FAIRWallet',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  template.push({
    label: 'File',
    submenu: [
      {
        label: 'New Wallet',
        accelerator: 'CommandOrControl+N',
        click: () => sendMenuAction('menu:new-wallet'),
      },
      {
        label: 'Open Wallet...',
        accelerator: 'CommandOrControl+O',
        click: () => sendMenuAction('menu:open-wallet'),
      },
      { type: 'separator' },
      { role: 'close' },
      ...(isMac ? [] : [{ role: 'quit' }]),
    ],
  });

  template.push({
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectAll' },
    ],
  });

  template.push({
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  });

  template.push({
    label: 'Wallet',
    submenu: [
      {
        label: 'Send',
        accelerator: 'CommandOrControl+S',
        click: () => sendMenuAction('menu:send'),
      },
      {
        label: 'Receive',
        accelerator: 'CommandOrControl+Shift+S',
        click: () => sendMenuAction('menu:receive'),
      },
      { type: 'separator' },
      {
        label: 'Contacts',
        accelerator: 'CommandOrControl+Shift+C',
        click: () => sendMenuAction('menu:contacts'),
      },
      {
        label: 'Transaction History',
        accelerator: 'CommandOrControl+H',
        click: () => sendMenuAction('menu:history'),
      },
      { type: 'separator' },
      {
        label: 'Lock Wallet',
        accelerator: 'CommandOrControl+L',
        click: () => sendMenuAction('menu:lock'),
      },
    ],
  });

  template.push({
    label: 'Help',
    submenu: [
      {
        label: 'Learn More about FairCoin',
        click: () => {
          shell.openExternal('https://fairco.in');
        },
      },
      {
        label: 'Report Issue',
        click: () => {
          shell.openExternal('https://github.com/FairCoinOfficial/FAIRWallet/issues');
        },
      },
      ...(isMac
        ? []
        : [
            { type: 'separator' },
            {
              label: 'About FAIRWallet',
              click: () => {
                dialog.showMessageBox({
                  type: 'info',
                  title: 'About FAIRWallet',
                  message: 'FAIRWallet',
                  detail: 'Lightweight SPV wallet for FairCoin\n\nVersion ' + app.getVersion(),
                });
              },
            },
          ]),
    ],
  });

  return template;
}

app.whenReady().then(() => {
  registerAppProtocol();
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildAppMenu()));
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ---- IPC Handlers: TCP P2P Networking ----

let connectionIdCounter = 0;

ipcMain.handle('p2p:connect', (_event, host, port) => {
  return new Promise((resolve, reject) => {
    const id = String(++connectionIdCounter);
    const socket = new net.Socket();

    socket.connect(port, host, () => {
      peerConnections.set(id, socket);
      resolve(id);
    });

    socket.on('data', (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('p2p:data', id, new Uint8Array(data));
      }
    });

    socket.on('close', () => {
      peerConnections.delete(id);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('p2p:close', id);
      }
    });

    socket.on('error', (err) => {
      peerConnections.delete(id);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('p2p:error', id, err.message);
      }
      reject(err);
    });

    socket.setTimeout(30000, () => {
      socket.destroy();
      reject(new Error('Connection timeout'));
    });
  });
});

ipcMain.handle('p2p:send', (_event, connectionId, data) => {
  const socket = peerConnections.get(connectionId);
  if (!socket) {
    throw new Error(`No connection with id ${connectionId}`);
  }
  socket.write(Buffer.from(data));
});

ipcMain.handle('p2p:disconnect', (_event, connectionId) => {
  const socket = peerConnections.get(connectionId);
  if (socket) {
    socket.destroy();
    peerConnections.delete(connectionId);
  }
});

// ---- IPC Handlers: DNS Resolution ----

ipcMain.handle('dns:resolve', (_event, hostname) => {
  return new Promise((resolve, reject) => {
    dns.resolve4(hostname, (err, addresses) => {
      if (err) {
        reject(err);
      } else {
        resolve(addresses);
      }
    });
  });
});

// ---- IPC Handlers: Secure Storage ----

ipcMain.handle('secure:encrypt', (_event, plaintext) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available on this system');
  }
  const encrypted = safeStorage.encryptString(plaintext);
  return new Uint8Array(encrypted);
});

ipcMain.handle('secure:decrypt', (_event, encrypted) => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available on this system');
  }
  return safeStorage.decryptString(Buffer.from(encrypted));
});

ipcMain.handle('secure:isAvailable', () => {
  return safeStorage.isEncryptionAvailable();
});
