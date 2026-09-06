// Переводит вызовы вида
//   !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Frenzy"))
// на hasAbility(actor, "ability.frenzy", "Frenzy", "talent") — wdbc-iadw.
import { readFileSync, writeFileSync } from "node:fs";
const { ABILITIES } = await import("./_iadw-table.mjs");

const DRY = !process.argv.includes("--write");
const byFile = new Map();
for (const ab of ABILITIES) {
  const file = ab.reader.split(" ")[0];
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push(ab);
}

const q = s => JSON.stringify(s);
const typesArg = t => (Array.isArray(t) ? `[${t.map(q).join(", ")}]` : q(t));
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

let done = 0;
const unmatched = [];
for (const [file, list] of byFile) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch { unmatched.push(`${file} — файла нет`); continue; }
  const before = text;
  for (const ab of list) {
    const kinds = Array.isArray(ab.types) ? ab.types : [ab.types];
    const typeAlt = kinds.map(k => `"${k}"`).join("|");
    const re = new RegExp(
      String.raw`!!\s*(?:actor|a)\??\.items\??\.some\??\(\s*(\w+)\s*=>\s*\1\??\.type === (?:` +
      typeAlt + String.raw`)\s*&&\s*itemHasName\(\1, "` + escapeRe(ab.name) + String.raw`"\)\s*\)`,
      "g");
    const next = text.replace(re, `hasAbility(actor, "${ab.key}", "${ab.name}", ${typesArg(ab.types)})`);
    if (next === text) { unmatched.push(`${file} — «${ab.name}» не совпало`); continue; }
    text = next;
    done++;
  }
  if (text === before) continue;
  if (!/from "[^"]*ability-by-key\.mjs"/.test(text)) {
    const depth = file.split("/").length - 2;
    const rel = file.startsWith("module/rules/")
      ? "./ability-by-key.mjs"
      : `${"../".repeat(depth)}rules/ability-by-key.mjs`;
    const line = `import { hasAbility } from "${rel}";\n`;
    const m = text.match(/^import .*\n/m);
    text = m ? text.replace(m[0], m[0] + line) : line + text;
  }
  if (!DRY) writeFileSync(file, text, "utf8");
  console.log(`${DRY ? "[сухой] " : ""}${file}`);
}
console.log(`\nпереведено вызовов: ${done}, не совпало: ${unmatched.length}`);
unmatched.forEach(u => console.log("  " + u));
