const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
// 웹의 순수 도메인만 공유하고 React와 네이티브 모듈은 앱의 한 버전으로 고정한다.
config.watchFolders = [path.resolve(__dirname, "../src")];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
module.exports = config;
