const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Inject crypto polyfill AFTER the default pre-main modules.
// The default includes React Native's InitializeCore which MUST come first.
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

module.exports = withNativeWind(config, { input: "./global.css" });
