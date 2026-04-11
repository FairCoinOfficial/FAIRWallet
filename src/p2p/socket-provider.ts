/**
 * Platform-specific TCP socket providers for P2P connections.
 *
 * - NativeSocketProvider: iOS/Android via react-native-tcp-socket
 * - ElectronSocketProvider: Electron via IPC preload bridge
 * - FallbackSocketProvider: Web without Electron (throws, TCP unavailable)
 *
 * Uses conditional require to avoid web bundling issues with native modules.
 */

import { Platform } from "react-native";
import type { SocketConnection, SocketProvider } from "./peer";

// ---------------------------------------------------------------------------
// Electron IPC bridge type
// ---------------------------------------------------------------------------

interface ElectronP2PBridge {
  connect(host: string, port: number): {
    onData(callback: (data: Uint8Array) => void): void;
    onClose(callback: () => void): void;
    onError(callback: (err: Error) => void): void;
    write(data: Uint8Array): void;
    destroy(): void;
  };
}

interface ElectronAPI {
  p2p: ElectronP2PBridge;
}

// ---------------------------------------------------------------------------
// Native TCP socket types (react-native-tcp-socket)
// Defined here to avoid requiring type declarations for the native module.
// ---------------------------------------------------------------------------

interface NativeTcpSocket {
  on(event: "data", callback: (data: Uint8Array) => void): void;
  on(event: "close", callback: () => void): void;
  on(event: "error", callback: (err: Error) => void): void;
  write(data: Uint8Array | Buffer): void;
  destroy(): void;
}

interface NativeTcpModule {
  createConnection(
    options: { host: string; port: number },
    callback: () => void,
  ): NativeTcpSocket;
}

// ---------------------------------------------------------------------------
// Window with Electron API
// ---------------------------------------------------------------------------

function getElectronAPI(): ElectronAPI | undefined {
  if (typeof window === "undefined") return undefined;
  const win = window as unknown as Record<string, unknown>;
  const api = win.electronAPI;
  if (api == null) return undefined;
  return api as ElectronAPI;
}

// ---------------------------------------------------------------------------
// NativeSocketProvider (iOS / Android)
// ---------------------------------------------------------------------------

class NativeSocketProvider implements SocketProvider {
  connect(host: string, port: number): SocketConnection {
    const TcpSocket = require("react-native-tcp-socket") as NativeTcpModule;

    let connectCallback: (() => void) | undefined;

    const socket = TcpSocket.createConnection({ host, port }, () => {
      if (connectCallback) {
        connectCallback();
      }
    });

    return {
      onConnect: (cb: () => void) => {
        connectCallback = cb;
      },
      onData: (cb: (data: Uint8Array) => void) => {
        socket.on("data", (data: Uint8Array) => {
          cb(new Uint8Array(data));
        });
      },
      onClose: (cb: () => void) => {
        socket.on("close", cb);
      },
      onError: (cb: (err: Error) => void) => {
        socket.on("error", cb);
      },
      write: (data: Uint8Array) => {
        socket.write(data);
      },
      destroy: () => {
        socket.destroy();
      },
    };
  }
}

// ---------------------------------------------------------------------------
// ElectronSocketProvider (Desktop via IPC bridge)
// ---------------------------------------------------------------------------

class ElectronSocketProvider implements SocketProvider {
  connect(host: string, port: number): SocketConnection {
    const electronAPI = getElectronAPI();
    if (!electronAPI?.p2p) {
      throw new Error(
        "Electron P2P bridge not available. Ensure preload.js exposes window.electronAPI.p2p.",
      );
    }

    const socket = electronAPI.p2p.connect(host, port);

    // Electron's IPC p2p:connect resolves when the TCP connection is established,
    // so we fire onConnect immediately after setup.
    let connectCallback: (() => void) | undefined;
    setTimeout(() => {
      if (connectCallback) connectCallback();
    }, 0);

    return {
      onConnect: (cb: () => void) => {
        connectCallback = cb;
      },
      onData: (cb: (data: Uint8Array) => void) => {
        socket.onData(cb);
      },
      onClose: (cb: () => void) => {
        socket.onClose(cb);
      },
      onError: (cb: (err: Error) => void) => {
        socket.onError(cb);
      },
      write: (data: Uint8Array) => {
        socket.write(data);
      },
      destroy: () => {
        socket.destroy();
      },
    };
  }
}

// ---------------------------------------------------------------------------
// FallbackSocketProvider (Web without Electron)
// ---------------------------------------------------------------------------

class FallbackSocketProvider implements SocketProvider {
  connect(_host: string, _port: number): never {
    throw new Error(
      "TCP connections are not available in web browsers. " +
      "Run FAIRWallet as a native app (iOS/Android) or via Electron for P2P connectivity.",
    );
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the appropriate SocketProvider for the current platform.
 *
 * - iOS/Android: NativeSocketProvider (react-native-tcp-socket)
 * - Web + Electron: ElectronSocketProvider (IPC bridge)
 * - Web (browser): FallbackSocketProvider (throws on connect)
 */
export function createSocketProvider(): SocketProvider {
  if (Platform.OS === "web") {
    if (getElectronAPI() != null) {
      return new ElectronSocketProvider();
    }
    return new FallbackSocketProvider();
  }
  return new NativeSocketProvider();
}
