// tools/_gift-mechanics-batch4.mjs — «Оракул Стали»: разблокировано новой
// capability weapon.trained.allRanged (зеркало allMelee/Arms Master), см.
// module/rules/weapon-training.mjs + constants/capabilities.mjs. Одноразовый.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

function capabilityEntry({ id, key }) {
  const e = blankMechEntry("capability");
  e.id = id; e.capabilityKey = key;
  return e;
}

const patches = [
  {
    file: "packs-src/mutations/Дары_Богов/Кхорн/Oracle_of_Steel___Оракул_Стали_WuLRLc3YQSXGlZaD.json",
    // «Владение всеми видами оружия» — allMelee (уже существовал, Arms Master)
    // + новый allRanged. «Включая экзотические» не покрыто: настоящая
    // экзотика (weaponType:"exotic") этой системой вообще не проверяется, ни
    // у кого. Авто-опознание оружия (как Критический Успех в тесте Знания) —
    // живой запрос за пределами видов записи, не кодируется.
    groups: [{ entries: [
      capabilityEntry({ id: "oracle-melee", key: "weapon.trained.allMelee" }),
      capabilityEntry({ id: "oracle-ranged", key: "weapon.trained.allRanged" })
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
