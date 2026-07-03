/**
 * Simula atividade no Cursor: cria um arquivo, "digita" código nele
 * e move o mouse aleatoriamente de vez em quando.
 *
 * Uso: node scripts/cursor-activity.js
 * Parar: Ctrl+C
 */

const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const os = require("os");

const WORKSPACE = path.resolve(__dirname, "..");
const OUT_DIR = path.join(WORKSPACE, ".cursor-activity");
const COUNTDOWN_SEC = 5;

const CODE_BLOCKS = [
  `// utilitário de cache simples\nconst cache = new Map();\n\nfunction memoize(fn) {\n  return (...args) => {\n    const key = JSON.stringify(args);\n    if (!cache.has(key)) cache.set(key, fn(...args));\n    return cache.get(key);\n  };\n}\n`,
  `\n// fetch com timeout\nasync function fetchWithTimeout(url, ms = 5000) {\n  const ctrl = new AbortController();\n  const id = setTimeout(() => ctrl.abort(), ms);\n  try {\n    const res = await fetch(url, { signal: ctrl.signal });\n    return await res.json();\n  } finally {\n    clearTimeout(id);\n  }\n}\n`,
  `\n// debounce para eventos\nfunction debounce(fn, wait = 300) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), wait);\n  };\n}\n`,
  `\n// validação básica\nfunction isEmail(value) {\n  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);\n}\n\nfunction isNonEmpty(str) {\n  return typeof str === "string" && str.trim().length > 0;\n}\n`,
  `\n// classe leve de eventos\nclass Emitter {\n  #handlers = new Map();\n  on(event, fn) {\n    if (!this.#handlers.has(event)) this.#handlers.set(event, []);\n    this.#handlers.get(event).push(fn);\n  }\n  emit(event, ...args) {\n    (this.#handlers.get(event) || []).forEach((fn) => fn(...args));\n  }\n}\n`,
  `\n// ordenação por campo\nfunction sortBy(arr, key, dir = "asc") {\n  const mul = dir === "desc" ? -1 : 1;\n  return [...arr].sort((a, b) => {\n    if (a[key] < b[key]) return -1 * mul;\n    if (a[key] > b[key]) return 1 * mul;\n    return 0;\n  });\n}\n`,
  `\n// retry com backoff\nasync function retry(fn, attempts = 3, delay = 200) {\n  let lastErr;\n  for (let i = 0; i < attempts; i++) {\n    try {\n      return await fn();\n    } catch (err) {\n      lastErr = err;\n      await new Promise((r) => setTimeout(r, delay * (i + 1)));\n    }\n  }\n  throw lastErr;\n}\n`,
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function moveMouseRandom() {
  const { width, height } = getScreenSize();
  const x = rand(100, Math.max(200, width - 100));
  const y = rand(100, Math.max(200, height - 100));
  try {
    execSync(
      `powershell -NoProfile -Command "[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})"`,
      { stdio: "ignore", windowsHide: true }
    );
  } catch {
    // ignora se PowerShell falhar
  }
}

let screenSize;
function getScreenSize() {
  if (screenSize) return screenSize;
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $s = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; Write-Output ($s.Width); Write-Output ($s.Height)"`,
      { encoding: "utf8", windowsHide: true }
    );
    const [w, h] = out.trim().split(/\r?\n/).map(Number);
    screenSize = { width: w || 1920, height: h || 1080 };
  } catch {
    screenSize = { width: 1920, height: 1080 };
  }
  return screenSize;
}

function openInCursor(filePath) {
  const cursorCmd =
    process.env.CURSOR_PATH ||
    path.join(
      os.homedir(),
      "AppData",
      "Local",
      "Programs",
      "cursor",
      "resources",
      "app",
      "bin",
      "cursor.cmd"
    );

  if (!fs.existsSync(cursorCmd)) return;

  spawn(cursorCmd, [filePath], {
    detached: true,
    stdio: "ignore",
    shell: true,
  }).unref();
}

async function typeText(filePath, text) {
  for (const ch of text) {
    fs.appendFileSync(filePath, ch, "utf8");
    await sleep(rand(25, 120));
    if (Math.random() < 0.04) moveMouseRandom();
    if (Math.random() < 0.02) await sleep(rand(400, 1200));
  }
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filePath = path.join(OUT_DIR, `scratch-${stamp}.js`);

  fs.writeFileSync(filePath, "", "utf8");
  openInCursor(filePath);

  console.log("");
  console.log("  cursor-activity — simulador leve de digitação");
  console.log("  ─────────────────────────────────────────────");
  console.log(`  Arquivo: ${path.relative(WORKSPACE, filePath)}`);
  console.log(`  Foque o Cursor em ${COUNTDOWN_SEC}s (deixe o arquivo aberto).`);
  console.log("  Parar: Ctrl+C");
  console.log("");

  for (let i = COUNTDOWN_SEC; i > 0; i--) {
    process.stdout.write(`  ${i}...\r`);
    await sleep(1000);
  }
  console.log("  Iniciando...        \n");

  let blockIndex = 0;
  while (true) {
    const block = CODE_BLOCKS[blockIndex % CODE_BLOCKS.length];
    await typeText(filePath, block);
    blockIndex++;

    if (Math.random() < 0.6) moveMouseRandom();
    await sleep(rand(800, 2500));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
