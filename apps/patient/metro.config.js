// Expo Metro config with npm workspaces support.
// Watches the monorepo root so @medical-ai/shared resolves correctly.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// Exclude heavy / irrelevant directories from the watcher to avoid EMFILE on macOS.
config.resolver.blockList = exclusionList([
  /\/backend\/.*/,
  /\/apps\/doctor\/.*/,
  /\/.git\/.*/,
  /\/android\/build\/.*/,
  /\/android\/\.gradle\/.*/,
  /\/ios\/build\/.*/,
  /\/ios\/Pods\/.*/,
]);

module.exports = config;
