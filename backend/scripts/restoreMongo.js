require("dotenv").config();
const { spawn } = require("node:child_process");
const path = require("node:path");

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error("Usage: npm run restore -- <backup-folder>");
  if (process.env.RESTORE_CONFIRM !== "YES") {
    throw new Error("Restore overwrites matching collections. Set RESTORE_CONFIRM=YES after verifying the backup and target database.");
  }
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required in backend/.env");
  const absoluteSource = path.resolve(source);
  await new Promise((resolve, reject) => {
    const child = spawn(process.env.MONGORESTORE_BIN || "mongorestore", ["--uri", process.env.MONGO_URI, "--drop", absoluteSource], {
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`mongorestore exited with code ${code}`)));
  });
  console.log(`MongoDB restore completed from: ${absoluteSource}`);
}

main().catch((error) => { console.error("Restore failed:", error.message); process.exitCode = 1; });
