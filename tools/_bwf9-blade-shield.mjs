// tools/_bwf9-blade-shield.mjs
//
// Одноразовая правка паков под wdbc-bwf9: Талант «Щит Клинков» выдаёт свою
// возможность, а оружие, которым книга разрешает отбивать психосилы, помечает
// себя как инструмент такого Парирования.
//
//   node tools/_bwf9-blade-shield.mjs
//
// Кого помечаем и почему (Книга Аэльдари, Путь Варлока — «Если персонаж
// использует силовое оружие эльдар или психосиловое психокостяное оружие, он
// может парировать вражеские психосилы при помощи таланта Blade Shield»):
//   • packs-src/weapons/Азуриане/Рукопашное/Силовое — эльдарское силовое целиком;
//   • .../Психокостяное — только те, у кого есть свойство force (Психосиловое):
//     книга просит «психосиловое психокостяное», а не всякое психокостяное.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const id16 = () => Array.from({ length: 16 },
  () => ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)]).join("");

const TOOL = "defence.psychicParryTool";
const TALENT = "packs-src/talents/Избегание/Blade_Shield___Щит_Клинков_xF5sKlmjpjmxWv6g.json";

/** Добавляет запись Конструктора «Возможность», если такой ещё нет. */
function grant(doc, capability, label) {
  const ns = (doc.flags ??= {})["warhammer-dbc"] ??= {};
  const mechanics = ns.mechanics ??= [];
  const has = mechanics.some(g => (g.entries ?? [])
    .some(e => e.kind === "capability" && e.capabilityKey === capability));
  if (has) return false;
  mechanics.push({
    id: id16(), operator: "AND",
    entries: [{ id: id16(), kind: "capability", group: null, capabilityKey: capability, label }]
  });
  return true;
}

const write = (abs, doc) => fs.writeFileSync(abs, `${JSON.stringify(doc, null, 2)}\n`, "utf8");

// ── Сам Талант ──────────────────────────────────────────────────────────────
{
  const abs = path.join(ROOT, TALENT);
  const doc = JSON.parse(fs.readFileSync(abs, "utf8"));
  const added = grant(doc, "dodge.core.bladeShield", "Щит Клинков");
  doc.system.description = doc.system.description
    || "<p>Реакция персонажа столь стремительна, что он способен перехватывать клинком пули и лучи.</p>";
  doc.system.notes =
    "МЕХАНИЗИРОВАНО ЧАСТИЧНО (wdbc-bwf9): Талант выдаёт возможность "
    + "dodge.core.bladeShield. Читается пока ОДНИМ путём — Парирование психосил "
    + "(module/combat/blade-shield.mjs): на карточке манифестации психосилы "
    + "появляется кнопка «Парировать психосилу», доступная носителю этого Таланта "
    + "с подходящим предметом в руках (силовое эльдарское или психосиловое "
    + "психокостяное оружие — Книга Аэльдари, Путь Варлока; ноктиковый щит — "
    + "Книга Жаб-Псайкеров). Успех нивелирует эффекты силы целиком. "
    + "НЕ механизировано: собственно книжное действие Таланта — Парирование "
    + "СТРЕЛКОВОЙ атаки. Кнопка Парирования на карточке стрелковой атаки в системе "
    + "и так показывается всем (module/combat/attack-card.mjs::defenseSection не "
    + "различает рукопашную и стрельбу), то есть система сейчас ЩЕДРЕЕ книги, а не "
    + "скупее; заужать её до носителей Таланта — отдельная правка боевой карточки, "
    + "затрагивающая всех персонажей, и делать её заодно нельзя. Также не "
    + "механизированы «один успех = одно попадание независимо от числа Успехов» и "
    + "«Pen 6+ считается Power Field при парировании».";
  write(abs, doc);
  console.log(`${added ? "добавлено" : "уже было"}: dodge.core.bladeShield — Талант «Щит Клинков»`);
}

// ── Оружие-инструмент ───────────────────────────────────────────────────────
const forceProp = doc => (doc.system?.weaponProps ?? [])
  .some(p => (typeof p === "string" ? p : p?.key) === "force");

const TARGETS = [
  { dir: "packs-src/weapons/Азуриане/Рукопашное/Силовое", pick: () => true,
    why: "силовое оружие эльдар" },
  { dir: "packs-src/weapons/Азуриане/Рукопашное/Психокостяное", pick: forceProp,
    why: "психосиловое психокостяное оружие" }
];

for (const target of TARGETS) {
  const dir = path.join(ROOT, target.dir);
  let touched = 0, skipped = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json") || name === "_Folder.json") continue;
    const abs = path.join(dir, name);
    const doc = JSON.parse(fs.readFileSync(abs, "utf8"));
    if (!target.pick(doc)) { skipped++; continue; }
    if (grant(doc, TOOL, "Парирует психосилы (Щит Клинков)")) { write(abs, doc); touched++; }
  }
  console.log(`${target.why}: помечено ${touched}, пропущено ${skipped} (${target.dir})`);
}
