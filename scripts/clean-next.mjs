import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";

const nextDir = path.join(process.cwd(), ".next");
const legacyCache = path.join(
  process.env.LOCALAPPDATA || os.tmpdir(),
  "planning-gardes-pharmacies-next"
);

function removeDir(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    execSync(`cmd /c rmdir /s /q "${dir}"`, { stdio: "pipe" });
  } catch {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }
}

removeDir(nextDir);
removeDir(legacyCache);
console.log("Cache .next supprimé.");
