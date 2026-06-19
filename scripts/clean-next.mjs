import {
  getLegacyAppDataCache,
  getLegacyNodeModulesCache,
  killDevPorts,
  removeDir,
  removeProjectNext,
} from "./next-cache-dir.mjs";

killDevPorts();
removeProjectNext();
removeDir(getLegacyNodeModulesCache());
const appData = getLegacyAppDataCache();
if (appData) removeDir(appData);
console.log("Cache .next supprimé.");
