// test/tools/weapon-property-text-sync.test.mjs
//
// Каждое свойство оружия существует в двух копиях: движковой константе
// (module/constants/weapon-properties.mjs — читает тултип/расчёт боя) и
// витринном документе packs-src/weapon-properties (его видит Обозреватель
// компендиумов, module/apps/compendium-browser.mjs). Ничто не мешает править
// только одну копию — так разошёлся текст Blast (desc/reminder короче в паке,
// без описания розы смещения), пока обе копии не сверили и не досинхронизировали
// вручную. Этот тест ловит такое расхождение по ВСЕМ свойствам, не только Blast.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { abs } from "../../tools/packs.mjs";
import { WEAPON_PROPERTIES } from "../../module/constants/weapon-properties.mjs";

function packFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (e.isDirectory() || !e.name.endsWith(".json") || e.name.startsWith("_")) continue;
    const file = path.join(e.parentPath ?? e.path, e.name);
    out.push({ file, doc: JSON.parse(fs.readFileSync(file, "utf8")) });
  }
  return out;
}

describe("текст Свойств оружия не расходится между движком и витриной пака", () => {
  const engineKeys = Object.keys(WEAPON_PROPERTIES);
  const packEntries = packFiles(abs("packs-src/weapon-properties"))
    .filter(({ doc }) => doc.system?.autoKey);

  it("витрина находится и не выродилась в пустышку", () => {
    expect(packEntries.length).toBeGreaterThan(50);
  });

  it("у каждого движкового свойства есть ровно один документ витрины с тем же autoKey", () => {
    const problems = [];
    const byKey = new Map();
    for (const { file, doc } of packEntries) {
      const key = doc.system.autoKey;
      if (byKey.has(key)) problems.push(`autoKey "${key}" задвоен: ${byKey.get(key)} и ${file}`);
      else byKey.set(key, file);
    }
    for (const key of engineKeys) {
      if (!byKey.has(key)) problems.push(`движковое свойство "${key}" не найдено в packs-src/weapon-properties`);
    }
    expect(problems).toEqual([]);
  });

  it("desc/reminder витрины дословно совпадают с движковыми", () => {
    const byKey = new Map(packEntries.map(({ file, doc }) => [doc.system.autoKey, { file, doc }]));
    const mismatches = [];
    for (const key of engineKeys) {
      const entry = byKey.get(key);
      if (!entry) continue; // отсутствие — предыдущая проверка
      const engine = WEAPON_PROPERTIES[key];
      const { file, doc } = entry;
      if (doc.system.description !== engine.desc)
        mismatches.push(`${file}: description расходится с desc "${key}"\n  движок: ${engine.desc}\n  пак:    ${doc.system.description}`);
      if ((doc.system.reminder ?? undefined) !== (engine.reminder ?? undefined))
        mismatches.push(`${file}: reminder расходится с "${key}"\n  движок: ${engine.reminder}\n  пак:    ${doc.system.reminder}`);
    }
    expect(mismatches).toEqual([]);
  });
});
