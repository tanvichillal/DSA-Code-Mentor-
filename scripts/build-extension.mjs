import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

mkdirSync(path.join(distDir, "background"), { recursive: true });
mkdirSync(path.join(distDir, "content"), { recursive: true });

const env = loadEnv("production", rootDir, "VITE_");
const envDefines = {
  "process.env.NODE_ENV": '"production"',
  "import.meta.env.VITE_API_BASE_URL": JSON.stringify(
    env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"
  ),
  "import.meta.env.VITE_FIREBASE_API_KEY": JSON.stringify(
    env.VITE_FIREBASE_API_KEY ?? ""
  ),
  "import.meta.env.VITE_FIREBASE_PROJECT_ID": JSON.stringify(
    env.VITE_FIREBASE_PROJECT_ID ?? ""
  ),
  "import.meta.env.VITE_GOOGLE_CLIENT_ID": JSON.stringify(
    env.VITE_GOOGLE_CLIENT_ID ?? ""
  ),
};

// Bundle background service worker as self-contained ESM with Vite env defines
await build({
  entryPoints: [path.join(rootDir, "src/background/service-worker.ts")],
  outfile: path.join(distDir, "background/service-worker.js"),
  bundle: true,
  format: "esm",
  target: "chrome120",
  sourcemap: false,
  define: envDefines,
});

// Bundle content script as IIFE so Chrome MV3 executes it without ES module loader issues
await build({
  entryPoints: [path.join(rootDir, "src/content/content.ts")],
  outfile: path.join(distDir, "content/content.js"),
  bundle: true,
  format: "iife",
  target: "chrome120",
  sourcemap: false,
  define: envDefines,
});

// Ensure public assets (manifest.json + icons) are copied cleanly
const publicDir = path.join(rootDir, "public");
if (existsSync(publicDir)) {
  cpSync(publicDir, distDir, { recursive: true });
}

console.log("Built Chrome Extension background, content, and public assets into dist/.");
