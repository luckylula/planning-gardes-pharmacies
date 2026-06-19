import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function getProjectNextDir() {
  return path.join(projectRoot, ".next");
}

export function getLegacyNodeModulesCache() {
  return path.join(projectRoot, "node_modules", ".cache", "planning-gardes-next");
}

export function getLegacyAppDataCache() {
  const base = process.env.LOCALAPPDATA;
  return base ? path.join(base, "planning-gardes-pharmacies-next") : null;
}

export function removeDir(dir) {
  if (!dir || !fs.existsSync(dir)) return;
  try {
    execSync(`cmd /c rmdir /s /q "${dir}"`, { stdio: "pipe" });
  } catch {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }
}

/** Supprime .next (dossier ou jonction Windows cassée). */
export function removeProjectNext() {
  const dir = getProjectNextDir();
  if (!fs.existsSync(dir)) return;
  try {
    execSync(`cmd /c rmdir "${dir}"`, { stdio: "pipe" });
    return;
  } catch {
    // pas une jonction
  }
  removeDir(dir);
}

/** Arrête les serveurs Next orphelins (ports 3000–3002). */
export function killDevPorts(ports = [3000, 3001, 3002]) {
  for (const port of ports) {
    try {
      const out = execSync(
        `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique"`,
        { encoding: "utf8" }
      );
      const pids = [...new Set(out.trim().split(/\s+/).map(Number).filter((p) => p > 0))];
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: "pipe" });
          console.log(`Port ${port} libéré (PID ${pid}).`);
        } catch {
          // déjà arrêté
        }
      }
    } catch {
      // aucun processus
    }
  }
}
