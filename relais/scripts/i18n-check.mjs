// Vérifie que chaque texte passé à t(), tn() ou msg() a une traduction anglaise.
// Usage : node scripts/i18n-check.mjs [--unused]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../src/", import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name) && !p.includes("/i18n/en/") && !p.includes("/types/")) files.push(p);
  }
})(root);

const STR = String.raw`(["'])((?:\\.|(?!\1).)*?)\1`;
const reT = new RegExp(String.raw`(?<![\w$.])(?:t|msg)\(\s*` + STR, "g");
const reTn = new RegExp(String.raw`(?<![\w$.])tn\(\s*[^,()]+(?:\([^()]*\))?\s*,\s*` + STR + String.raw`\s*,\s*(["'])((?:\\.|(?!\3).)*?)\3`, "g");
const unescape = (s) => s.replace(/\\(["'\\])/g, "$1");

const used = new Map();
for (const file of files) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(reT)) used.set(unescape(m[2]), file);
  for (const m of src.matchAll(reTn)) {
    used.set(unescape(m[2]), file);
    used.set(unescape(m[4]), file);
  }
}

const dict = {};
for (const name of readdirSync(join(root, "i18n/en"))) {
  if (name === "index.ts") continue;
  const src = readFileSync(join(root, "i18n/en", name), "utf8");
  const re = /^\s*(["'])((?:\\.|(?!\1).)*?)\1\s*:\s*(["'`])((?:\\.|(?!\3).)*?)\3,?\s*$/gm;
  for (const m of src.matchAll(re)) dict[unescape(m[2])] = unescape(m[4]);
}

const missing = [...used.entries()].filter(([k]) => !(k in dict) && !(k.replace(/\d+(?:[.,]\d+)?/g, "{n}") in dict));
for (const [k, f] of missing) console.log(`MISSING  ${f.replace(root, "")}  ${JSON.stringify(k)}`);
if (process.argv.includes("--unused")) {
  for (const k of Object.keys(dict)) if (!used.has(k)) console.log(`UNUSED   ${JSON.stringify(k)}`);
}
console.log(`${used.size} textes, ${Object.keys(dict).length} traductions, ${missing.length} manquantes`);
process.exit(missing.length ? 1 : 0);
