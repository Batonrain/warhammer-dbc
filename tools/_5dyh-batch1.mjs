// tools/_5dyh-batch1.mjs — wdbc-5dyh, первая партия: 10 записей Gear/Tools с
// чистым текстовым обещанием числа в system.effect, переносим в
// flags.warhammer-dbc.mechanics (kind:"testMod") — тот же живой конвейер, что
// уже несёт Locus of Chains/Chaotic Pattern/The Guard Blade. Схему менять не
// понадобилось: testMod читается из flags, а не из system, и уже подключён в
// диалог броска Навыка/Характеристики (module/rules/resolve-test.mjs,
// module/sheets/actor-sheet.mjs::_ruleRollModsHtml).
//
// Групповые Навыки (Ремесло/Навигация) заработали только после починки
// effectAppliesTo (resolve-test.mjs) в этой же сессии — раньше ctx.group не
// проверялся вовсе, testMod по groupSkills молчал бы.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

function testMod({ label, modScope, skillKey, charKey, value }) {
  const e = blankMechEntry("testMod");
  e.modScope = modScope;
  e.modValueMode = "flat";
  e.value = value;
  e.label = label;
  if (modScope === "skill") e.skillKey = skillKey;
  if (modScope === "char") e.charKey = charKey;
  return e;
}

const patches = [
  {
    file: "packs-src/gear/Мобильность/Flip_Belt___Ремень_Кувырков_95K5DMSTGPC7ik9N.json",
    entries: [testMod({ label: "Ремень Кувырков", modScope: "skill", skillKey: "acrobatics", value: 30 })],
    notes: "Оговорка не смоделирована: +30 — только для прыжков/вольтов (Acrobatics), не любого теста Навыка."
  },
  {
    file: "packs-src/gear/Разное/Chameleoline_Cloak___Хамелеолиновый_Плащ_PGGiRjrTcvlvOqPA.json",
    entries: [testMod({ label: "Хамелеолиновый Плащ", modScope: "skill", skillKey: "stealth", value: 20 })],
    notes: "Не смоделирован второй эффект: −30 по носителю стрелковым атакам, если он не совершал физических действий с начала прошлого Хода."
  },
  {
    file: "packs-src/gear/Разное/Narthecium___Нартеций_wMbrIoB7cBitlLrJ.json",
    entries: [testMod({ label: "Нартеций (лечение)", modScope: "skill", skillKey: "medicae", value: 20 })],
    notes: "Оговорка не смоделирована: +20 — на лечение, не любой тест Medicae; не складывается с аптечкой. Остальное (I.b×2 при Первой помощи, авто-лечение Кровотечения, рентген) не смоделировано."
  },
  {
    file: "packs-src/gear/Головное/Pacifier_Helm___Шлем_Усмиритель_T4oGaDg9RuxAiKCk.json",
    entries: [testMod({ label: "Шлем Усмиритель", modScope: "skill", skillKey: "awareness", value: 10 })],
    notes: "Оговорка не смоделирована: +10 — для обнаружения врагов, не любой тест Awareness."
  },
  {
    file: "packs-src/tools/Наборы_инструментов/Forgery_Kit___Подделочный_Комплект_TkKPyeSz8VNBEG7J.json",
    entries: [testMod({ label: "Подделочный Комплект", modScope: "skill", skillKey: "trade", value: 20 })],
    notes: "Групповой Навык Ремесло — движок не умеет сузить до конкретной специализации подделок; +20 сработает на ЛЮБУЮ специализацию Ремесла."
  },
  {
    file: "packs-src/tools/Наборы_инструментов/Medkit___Аптечка_LyLVOIQEl2TXpe9M.json",
    entries: [testMod({ label: "Аптечка (лечение)", modScope: "skill", skillKey: "medicae", value: 20 })],
    notes: "Оговорка не смоделирована: +20 — на лечение/диагностику, не любой тест Medicae; не складывается с Нартецием."
  },
  {
    file: "packs-src/tools/Наборы_инструментов/Multi_Key___Мульти_Ключ_Jt9L6Db9UgNmSElz.json",
    entries: [testMod({ label: "Мульти-Ключ", modScope: "skill", skillKey: "security", value: 20 })],
    notes: "Оговорка не смоделирована: +20 — на вскрытие замков, не любой тест Security."
  },
  {
    file: "packs-src/tools/Наборы_инструментов/Torture_Tools___Пыточные_Инструменты_JiLAZo12j1rXCW28.json",
    entries: [testMod({ label: "Пыточные Инструменты", modScope: "skill", skillKey: "interrogate", value: 20 })],
    notes: "Оговорка не смоделирована: +20 — на пытки, не любой тест Interrogate. Урон от проваленного теста (1d5−1) не смоделирован."
  },
  {
    file: "packs-src/tools/Общие/Cartograph___Картограф_6mtOOeIH1M13mXsR.json",
    entries: [testMod({ label: "Картограф", modScope: "skill", skillKey: "navigation", value: 10 })],
    notes: "Групповой Навык Навигация — движок не умеет сузить до специализации; +10 в тексте только для Navigation (Surface), здесь сработает на любую специализацию."
  },
  {
    file: "packs-src/tools/Общие/Hololith___Гололит_5hnhGiS6MqExjPFS.json",
    entries: [testMod({ label: "Гололит (брифинг)", modScope: "skill", skillKey: "command", value: 10 })],
    notes: "Не смоделирован условный бонус +20 (вместо +10) для операций на местности с 3D-ориентированием — взят только базовый +10."
  },
  {
    file: "packs-src/gear/Головное/Damper_Earplugs___Глушащие_Беруши_oYFaeAHDbFfCyBYc.json",
    entries: [testMod({ label: "Глушащие Беруши", modScope: "char", charKey: "t", value: 20 })],
    notes: "Оговорка не смоделирована: +20 T — только против оглушительно громких звуков, не любой тест Стойкости."
  },
  {
    file: "packs-src/gear/Головное/Filtration_Plugs___Фильтрационные_Затычк_xOMOeiowkWcIhe1N.json",
    entries: [testMod({ label: "Фильтрационные Затычки", modScope: "char", charKey: "t", value: 20 })],
    notes: "Оговорка не смоделирована: +20 T — только против вдыхаемых газов, не любой тест Стойкости. Не складывается с респиратором/противогазом; засоряются через 1 час — не смоделировано."
  },
  {
    file: "packs-src/gear/Головное/Gas_Mask___Противогаз_AQLQSuvuH2LWm1sU.json",
    entries: [testMod({ label: "Противогаз", modScope: "char", charKey: "t", value: 30 })],
    notes: "Оговорка не смоделирована: +30 T — только против вдыхаемых газов, не любой тест Стойкости. Замена фильтров/надевание не смоделированы."
  },
  {
    file: "packs-src/gear/Головное/Respirator___Респиратор_GfZO3KqGHbEBRWfK.json",
    entries: [testMod({ label: "Респиратор", modScope: "char", charKey: "t", value: 30 })],
    notes: "Оговорка не смоделирована: +30 T — только против вдыхаемых газов, не любой тест Стойкости. Запасные фильтры/надевание не смоделированы."
  }
];

for (const p of patches) {
  const doc = JSON.parse(fs.readFileSync(p.file, "utf8"));
  const group = blankMechGroup("AND");
  group.entries = p.entries;
  doc.flags ??= {};
  doc.flags["warhammer-dbc"] ??= {};
  doc.flags["warhammer-dbc"].mechanics = [group];
  if (p.notes) doc.system.notes = p.notes;
  fs.writeFileSync(p.file, JSON.stringify(doc, null, 2) + "\n");
  console.log("OK:", doc.name);
}
