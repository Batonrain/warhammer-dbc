// tools/_mutation-mechanics-batch3.mjs — третья партия Механики для Мутаций
// (продолжение batch2, см. чат: «оформи в механику все мутации»).
// Одноразовый — можно удалить после запуска.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

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
  e.rating = String(rating);
  return e;
}

function moveEntry({ id, target, op, value }) {
  const e = blankMechEntry("movement");
  e.id = id; e.movementTarget = target; e.op = op; e.movementValue = String(value);
  return e;
}

const patches = [
  {
    file: "packs-src/mutations/Общие_мутации/Mechanoid___Механоид_ZIeATYGzGUBUpkCY.json",
    // Machine (+1) — фиксированный рейтинг из текста.
    groups: [{ entries: [
      traitEntry({ id: "mechanoid-machine", uuid: "a9uOuJE4oCOisx8d", name: "Machine / Машина (X)", rating: 1 })
    ] }]
  },
  {
    file: "packs-src/mutations/Общие_мутации/Strange_Gait___Странная_Походка_NXU4GyxhhsQL5CrZ.json",
    // «Его SPD пешком уменьшается на 2» — прямое число, формула не нужна.
    groups: [{ entries: [
      moveEntry({ id: "gait-spd", target: "spd", op: "subtract", value: 2 })
    ] }]
  },
  {
    file: "packs-src/mutations/Общие_мутации/Dark_Soul___Т_мная_Душа_i6UYOvh8Vl1yFyuI.json",
    // «Рейтинг Страха 1, или +1 к существующему, до максимума 4» —
    // кодируется базовый случай (Страх 1); наращивание при повторном
    // получении и потолок в 4 Конструктор не выразит (нет «текущего
    // значения предмета» для сравнения) — не кодируется, только текстом.
    groups: [{ entries: [
      traitEntry({ id: "darksoul-fear", uuid: "ntYh2fH5Tv8GH4qA", name: "Fear / Страх (X)", rating: 1 })
    ] }]
  },
  {
    file: "packs-src/mutations/Общие_мутации/Fusion___Слияние_5ptME0bBf9Co4XoQ.json",
    // Trait Possession — без рейтинга, простая выдача.
    groups: [{ entries: [
      traitEntry({ id: "fusion-possession", uuid: "NJwdh4ecHSYK3wkY", name: "Possession / Одержимость" })
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
