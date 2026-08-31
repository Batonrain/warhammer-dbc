// tools/_j1nc-skill-bonus-detect.mjs — wdbc-j1nc, разведка №3: среди 496
// нерешённых Черт ищем текстовые паттерны «+NN <Навык>» / «перебрасывает
// <Навык>» / «+NN к <Характеристике>», где имя совпадает с реальным ключом
// SKILLS_DEF/GROUP_SKILLS_DEF/CHARACTERISTICS движка — кандидаты на testMod/
// reroll. Каждый хит проверяется мной вручную перед применением (не вслепую),
// но так быстрее найти чистые случаи среди сотен записей. Одноразовый.
import fs from "node:fs";
import { SKILLS_DEF, GROUP_SKILLS_DEF } from "../module/constants/skills.mjs";
import { CHARACTERISTICS } from "../module/constants/characteristics.mjs";

const allSkills = { ...SKILLS_DEF, ...GROUP_SKILLS_DEF };
const skillLabels = Object.entries(allSkills).map(([key, def]) => ({ key, label: def.label }));
const charLabels = Object.entries(CHARACTERISTICS).map(([key, def]) => ({ key, label: def.label }));

const lines = fs.readFileSync("tools/_j1nc-undecided.jsonl", "utf8").trim().split("\n");
let hits = 0;
for (const line of lines) {
  const o = JSON.parse(line);
  const txt = `${o.benefit || ""} ${o.description || ""}`;
  const found = [];
  for (const { key, label } of skillLabels) {
    if (txt.includes(label)) found.push(`skill:${key}(${label})`);
  }
  for (const { key, label } of charLabels) {
    // короткие метки характеристик (Ловкость, Сила...) часто ложно совпадают
    // с другими словами — оставляем как подсказку, не автоприменение.
    if (label && txt.includes(label)) found.push(`char:${key}(${label})`);
  }
  if (found.length) {
    hits++;
    console.log(`${o.name} :: ${found.join(", ")} :: ${(o.benefit||o.description||"").slice(0,140)}`);
  }
}
console.log(`\nВсего с текстовым совпадением по имени навыка/характеристики: ${hits}/${lines.length}`);
