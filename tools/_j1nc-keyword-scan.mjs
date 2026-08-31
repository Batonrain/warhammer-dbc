// tools/_j1nc-keyword-scan.mjs — wdbc-j1nc, разведка №4: ищем среди 496
// нерешённых Черт упоминания механик с ГОТОВЫМ каналом на уровне kind
// (wounds/corruption — «раз при выдаче + откат», legacy-поля armourAll/
// initMod/sizeMod/speedMod/fearRating) — по ключевым словам рядом с числом.
// Каждый хит проверяется вручную. Одноразовый.
import fs from "node:fs";

const KEYWORDS = [
  [/\bРан[а-я]*\b/i, "wounds?"],
  [/[Пп]орч[а-я]*/, "corruption?"],
  [/[Ии]нициатив[а-я]*/, "initMod?"],
  [/[Рр]азмер/, "sizeMod?"],
  [/SPD|[Сс]корост[а-я]*/, "speedMod?"],
  [/[Сс]трах|[Уу]жас/, "fearRating?"],
  [/[Пп]оглощени[а-я]*|[Бб]рон[а-я]* [+\-−]?\d/, "armour?"],
];

const lines = fs.readFileSync("tools/_j1nc-undecided.jsonl", "utf8").trim().split("\n");
let hits = 0;
for (const line of lines) {
  const o = JSON.parse(line);
  const txt = `${o.benefit || ""} ${o.description || ""}`;
  const tags = KEYWORDS.filter(([re]) => re.test(txt)).map(([, t]) => t);
  if (tags.length) {
    hits++;
    console.log(`${o.name} :: ${tags.join(",")} :: ${txt.replace(/\s+/g," ").slice(0,150)}`);
  }
}
console.log(`\nВсего: ${hits}/${lines.length}`);
