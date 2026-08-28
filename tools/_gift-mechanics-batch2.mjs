// tools/_gift-mechanics-batch2.mjs — «Массивный Интеллект»: пользователь
// поправил, что «Unnatural I (X)» — это общий шаблон «Unnatural Characteristic»
// с Интеллектом как Характеристикой, и в паке он есть под полным именем
// «Unnatural Intelligence (X)» (я искал по сокращению «Unnatural I», которое
// совпадает только со старыми фиксированными копиями). Одноразовый.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

const TRAIT_ICON = "systems/warhammer-dbc/assets/item-icons/trait.svg";

function traitEntry({ id, uuid, name, rating }) {
  const e = blankMechEntry("trait");
  e.id = id;
  e.sourceUuid = `Compendium.warhammer-dbc.traits.Item.${uuid}`;
  e.sourceName = name;
  e.sourceImg = TRAIT_ICON;
  e.sourceHasRating = true;
  e.rating = String(rating);
  return e;
}

const patches = [
  {
    file: "packs-src/mutations/Дары_Богов/Тзинч/Massive_Intellect___Массивный_Интеллект_nVS5HfCDMmCSC2Jl.json",
    // Unnatural Intelligence (+Cor.b) — формула, точное совпадение с текстом.
    // Удвоение Успехов на Logic/Lore и совмещённое Усиление+Переброс —
    // условная механика теста, не статичная выдача, не кодируется.
    groups: [{ entries: [
      traitEntry({ id: "massint-unnatural", uuid: "9l8axsmvmGXt5lsE", name: "Unnatural Intelligence (X) / Сверхъестественный Интеллект (X)", rating: "cor" })
    ] }]
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
