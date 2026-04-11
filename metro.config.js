const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// ---------------------------------------------------------------------------
// Crypto polyfill: inject before all other modules so globalThis.crypto
// is available when @noble/hashes captures it at import time.
// ---------------------------------------------------------------------------

const originalGetModules =
  config.serializer?.getModulesRunBeforeMainModule ?? (() => []);

config.serializer = {
  ...config.serializer,
  getModulesRunBeforeMainModule() {
    const defaults = originalGetModules();
    return [...defaults, path.resolve(__dirname, "src/crypto-polyfill.ts")];
  },
};

// ---------------------------------------------------------------------------
// Resolver configuration
// ---------------------------------------------------------------------------

const TCP_SHIM = path.resolve(
  __dirname,
  "src/shims/react-native-tcp-socket.ts",
);

const originalResolveRequest = config.resolver?.resolveRequest;

config.resolver = {
  ...config.resolver,
  assetExts: [...(config.resolver?.assetExts ?? []), "wasm"],

  // Enable Node.js package "exports" field resolution.
  // Required by @noble/hashes which uses the exports map to expose
  // subpath imports like "@noble/hashes/crypto", "@noble/hashes/sha256".
  // Without this, Metro warns about unresolvable subpaths and falls back
  // to file-based resolution (which works but produces noisy warnings).
  unstable_enablePackageExports: true,

  resolveRequest(context, moduleName, platform) {
    // On web, replace react-native-tcp-socket with an empty shim
    // (TCP sockets are not available in browsers; Electron uses IPC instead)
    if (platform === "web" && moduleName === "react-native-tcp-socket") {
      return { type: "sourceFile", filePath: TCP_SHIM };
    }
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = withNativeWind(config, { input: "./global.css" });
