const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const path = require('path');
const net = require('net');
const dns = require('dns');

let mainWindow = null;
const peerConnections = new Map();

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

  // In development, load the Expo web dev server
  // In production, load the exported web build
  const isDev = process.argv.includes('--dev');
  if (isDev) {
    mainWindow.loadURL('http://localhost:8081');
    mainWindow.webContents.openDevTools();
  } else {
    const distPath = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(distPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Close all peer connections on window close
    for (const [id, socket] of peerConnections) {
      socket.destroy();
    }
    peerConnections.clear();
  });
}

app.whenReady().then(createWindow);

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
