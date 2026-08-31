// tools/_mutation-mechanics-pilot.mjs — ОДНОРАЗОВЫЙ скрипт пилотной партии
// Механики для трёх Мутаций (см. чат: «оформи в механику все мутации»).
// Строит записи через blankMechEntry/blankMechGroup (module/apps/mechanics.mjs),
// чтобы формат совпадал 1:1 с тем, что кладёт сама вкладка Конструктора, и
// дописывает их в flags["warhammer-dbc"].mechanics соответствующих JSON
// packs-src. Одноразовый — можно удалить после использования.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

// Стенд отдаёт литеральный "stubid" (нужен только для сравнений в тестах) —
// реальному контенту нужны настоящие 16-символьные id (см. foundry-id-length.md).
const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

const TRAIT_ICON = "systems/warhammer-dbc/assets/item-icons/trait.svg";

function traitEntry({ id, uuid, name, rating = "" }) {
  const e = blankMechEntry("trait");
  e.id = id;
  e.sourceUuid = `Compendium.warhammer-dbc.traits.Item.${uuid}`;
  e.sourceName = name;
  e.sourceImg = TRAIT_ICON;
  e.sourceHasRating = rating !== "";
  e.rating = rating;
  return e;
}

function charEntry({ id, charKey, field, op, value }) {
  const e = blankMechEntry("characteristic");
  e.id = id; e.charKey = charKey; e.field = field; e.op = op; e.value = value;
  return e;
}

function woundsEntry({ id, op, value }) {
  const e = blankMechEntry("wounds");
  e.id = id; e.op = op; e.woundsValue = String(value);
  return e;
}

const patches = [
  {
    file: "packs-src/mutations/Общие_мутации/Thick_Skinned___Толстокожий_Ykn3EuGI4w2cUs7n.json",
    // +5 Ран, A (total) −10 — оба фиксированные числа из текста, без формул.
    // Штраф −1 SPD, действующий только «пока персонаж здоров или легко ранен»,
    // Конструктор выразить не может (нет гейта по состоянию Ран) — не кодируется,
    // остаётся только в тексте.
    groups: [
      { entries: [
        woundsEntry({ id: "thick-wounds", op: "add", value: 5 }),
        charEntry({ id: "thick-ag", charKey: "ag", field: "total", op: "subtract", value: 10 })
      ] }
    ]
  },
  {
    file: "packs-src/mutations/Общие_мутации/Extra_Arm___Дополнительная_Рука_xoWlsrVgPgeN8Ptp.json",
    // Multiple Arms (X) — параметрическая Черта, здесь фиксированный рейтинг
    // +1 из базового текста мутации (без учёта повторного получения).
    groups: [
      { entries: [
        traitEntry({ id: "extra-arm-trait", uuid: "b2B8zxbhoK961wEf", name: "Multiple Arms / Многорукий (X)", rating: 1 })
      ] }
    ]
  },
  {
    file: "packs-src/mutations/Общие_мутации/Animal_Hybrid___Животный_Гибрид_pPO5CvN42bCeLVOo.json",
    // Базовый укус (Bite + Deadly Natural Weapons ½Cor.b) — формула и к тому же
    // отменяется у субмутации «8 — Бык», которая укуса не даёт вовсе (даёт рога
    // вместо него) — пока не кодируется (см. отчёт в чате). Пилот демонстрирует
    // только гейт «Когда субмутация»: строка «4 — Кошка» даёт две ЧИСТЫЕ,
    // не завязанные на характеристику Черты.
    groups: [
      { entries: [
        traitEntry({ id: "hybrid-cat-sight", uuid: "MlSi5w3BAFj20nYV", name: "Dark Sight / Ночное Зрение" }),
        traitEntry({ id: "hybrid-cat-claws", uuid: "izr4BASd4MVkw3Cm", name: "Deadly Natural Weapons / Смертельное Естественное Оружие" })
      ], when: { negate: false, conditions: [], submutations: ["4"], negateSub: false } }
    ]
  }
];

for (const patch of patches) {
  const raw = fs.readFileSync(patch.file, "utf8");
  const doc = JSON.parse(raw);
  const groups = patch.groups.map(g => {
    const grp = blankMechGroup("AND");
    grp.entries = g.entries;
    if (g.when) for (const e of grp.entries) e.when = g.when;
    return grp;
  });
  doc.flags ??= {};
  doc.flags["warhammer-dbc"] ??= {};
  doc.flags["warhammer-dbc"].mechanics = groups;
  fs.writeFileSync(patch.file, JSON.stringify(doc, null, 2) + "\n");
  console.log("OK:", patch.file);
}
