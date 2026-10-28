// Minimal .env loader for scripts (Next.js loads .env itself).
import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), ".env");
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    const v = m[2].trim();
    process.env[m[1]] = /^".*"$/.test(v) ? v.slice(1, -1) : v.replace(/\s+#.*$/, "");
  }
}
