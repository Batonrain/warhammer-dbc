// Переводит предикаты вида
//   item?.type === "mutation" && itemHasName(item, NAME)
// на itemIs(item, "mutation", "ключ", NAME) — wdbc-wdlw.
import { readFileSync, writeFileSync } from "node:fs";
const { ITEM_MARKERS } = await import("./_wdlw-table.mjs");

const DRY = !process.argv.includes("--write");
let done = 0;
const unmatched = [];

for (const m of ITEM_MARKERS) {
  let text;
  try { text = readFileSync(m.file, "utf8"); } catch { unmatched.push(`${m.file} — нет файла`); continue; }

  const re = new RegExp(
    String.raw`item\?\.type === "` + m.type + String.raw`" && itemHasName\(item, ([A-Za-z_$][\w$]*)\)`, "g");
  const next = text.replace(re, (_, constName) =>
    `itemIs(item, "${m.type}", "${m.key}", ${constName})`);
  if (next === text) { unmatched.push(`${m.file} — не совпало`); continue; }
  text = next;

  if (!/from "[^"]*item-marker\.mjs"/.test(text)) {
    const depth = m.file.split("/").length - 2;
    const rel = m.file.startsWith("module/rules/")
      ? "./item-marker.mjs"
      : `${"../".repeat(depth)}rules/item-marker.mjs`;
    const first = text.match(/^import .*\n/m);
    const line = `import { itemIs } from "${rel}";\n`;
    text = first ? text.replace(first[0], first[0] + line) : line + text;
  }

  if (!DRY) writeFileSync(m.file, text, "utf8");
  console.log(`${DRY ? "[сухой] " : ""}${m.file}  →  ${m.key}`);
  done++;
}

console.log(`\nпереведено: ${done}, не совпало: ${unmatched.length}`);
unmatched.forEach(u => console.log("  " + u));
