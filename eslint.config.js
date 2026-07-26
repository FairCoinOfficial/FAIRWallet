// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "android/*", "ios/*"],
  },
  {
    // The Electron main/preload processes are CommonJS Node, not the Expo
    // bundle: they legitimately use `__dirname`, `Buffer` and friends.
    files: ["electron/**/*.js"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        process: "readonly",
        module: "writable",
        require: "readonly",
      },
    },
  },
]);
