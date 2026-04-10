const { contextBridge, ipcRenderer } = require('electron');

// Expose a secure, sandboxed API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // P2P TCP connections (handled by main process via Node.js net module)
  p2p: {
    connect: (host, port) => ipcRenderer.invoke('p2p:connect', host, port),
    send: (connectionId, data) => ipcRenderer.invoke('p2p:send', connectionId, data),
    disconnect: (connectionId) => ipcRenderer.invoke('p2p:disconnect', connectionId),
    onData: (callback) => {
      const handler = (_event, connectionId, data) => callback(connectionId, data);
      ipcRenderer.on('p2p:data', handler);
      return () => ipcRenderer.removeListener('p2p:data', handler);
    },
    onClose: (callback) => {
      const handler = (_event, connectionId) => callback(connectionId);
      ipcRenderer.on('p2p:close', handler);
      return () => ipcRenderer.removeListener('p2p:close', handler);
    },
    onError: (callback) => {
      const handler = (_event, connectionId, error) => callback(connectionId, error);
      ipcRenderer.on('p2p:error', handler);
      return () => ipcRenderer.removeListener('p2p:error', handler);
    },
  },

  // DNS resolution (native, via main process)
  dns: {
    resolve: (hostname) => ipcRenderer.invoke('dns:resolve', hostname),
  },

  // Secure storage (via Electron safeStorage)
  secure: {
    encrypt: (plaintext) => ipcRenderer.invoke('secure:encrypt', plaintext),
    decrypt: (encrypted) => ipcRenderer.invoke('secure:decrypt', encrypted),
    isAvailable: () => ipcRenderer.invoke('secure:isAvailable'),
  },

  // Platform identification
  platform: {
    isElectron: true,
    os: process.platform,
  },
});
