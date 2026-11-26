require("dotenv").config();
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required in backend/.env");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, "../../backups"));
  const destination = path.join(backupRoot, `eventsphere-${stamp}`);
  fs.mkdirSync(backupRoot, { recursive: true });
  await new Promise((resolve, reject) => {
    const child = spawn(process.env.MONGODUMP_BIN || "mongodump", ["--uri", process.env.MONGO_URI, "--out", destination], { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`mongodump exited with code ${code}`)));
  });
  const retentionDays = Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS) || 14);
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const entry of fs.readdirSync(backupRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("eventsphere-")) continue;
    const fullPath = path.join(backupRoot, entry.name);
    if (fs.statSync(fullPath).mtimeMs < cutoff) fs.rmSync(fullPath, { recursive: true, force: true });
  }
  console.log(`MongoDB backup created at: ${destination}`);
}

main().catch((error) => { console.error("Backup failed:", error.message); process.exitCode = 1; });
