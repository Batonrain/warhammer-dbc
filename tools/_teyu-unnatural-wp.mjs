// tools/_teyu-unnatural-wp.mjs (одноразовый, wdbc-teyu)
// Переименование "Unnatural WP" -> "Unnatural Willpower" (книга, core.json,
// дословно: "Он получает Трейт Unnatural Willpower (+2)") + правка всех
// cross-ref sourceName/упоминаний по всем пакам.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const NAME_LIMIT = 40;
const safe = (name) => String(name).replace(/[^a-zA-Z0-9А-я]/g, "_");
const packFileName = (name, id) => `${safe(name).slice(0, NAME_LIMIT)}_${id}.json`;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith(".json")) out.push(p);
  }
  return out;
}

const files = walk(path.join(ROOT, "packs-src"));

const replacements = [
  ["Unnatural WP (+2)", "Unnatural Willpower (+2)"],
  ["Unnatural WP (4)", "Unnatural Willpower (4)"],
];

let touched = 0;
for (const file of files) {
  let text = fs.readFileSync(file, "utf8");
  const orig = text;
  for (const [from, to] of replacements) {
    text = text.split(from).join(to);
  }
  if (text !== orig) {
    fs.writeFileSync(file, text, "utf8");
    touched++;
    console.log("updated:", path.relative(ROOT, file));
  }
}
console.log("files touched:", touched);

const renames = [
  path.join(ROOT, "packs-src/traits/Unnatural_WP___2____Сверхъест__Воля_0A12TcD79wynam9l.json"),
  path.join(ROOT, "packs-src/aeldari-traits/Элитные_архетипы_Эльдар/Высший_Провидец/Unnatural_WP__4____Сверхъест__Воля_VdUmGZovbiU1tIXN.json"),
];
for (const file of renames) {
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const newFileName = packFileName(doc.name, doc._id);
  const newPath = path.join(path.dirname(file), newFileName);
  fs.renameSync(file, newPath);
  console.log("renamed:", path.relative(ROOT, file), "->", path.relative(ROOT, newPath));
}
