const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Inject crypto polyfill AFTER the default pre-main modules.
const originalGetModules =
  config.serializer?.getModulesRunBeforeMainModule ??
  (() => []);

config.serializer = {
  ...config.serializer,
  getModulesRunBeforeMainModule() {
    const defaults = originalGetModules();
    return [
      ...defaults,
      path.resolve(__dirname, "src/crypto-polyfill.ts"),
    ];
  },
};

// Support .wasm files as assets (needed for expo-sqlite web support).
// Redirect native-only modules to shims when bundling for web.
const TCP_SHIM = path.resolve(__dirname, "src/shims/react-native-tcp-socket.ts");

const originalResolveRequest = config.resolver?.resolveRequest;

config.resolver = {
  ...config.resolver,
  assetExts: [...(config.resolver?.assetExts ?? []), "wasm"],
  resolveRequest(context, moduleName, platform) {
    // On web, replace react-native-tcp-socket with an empty shim
    if (platform === "web" && moduleName === "react-native-tcp-socket") {
      return {
        type: "sourceFile",
        filePath: TCP_SHIM,
      };
    }
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = withNativeWind(config, { input: "./global.css" });
