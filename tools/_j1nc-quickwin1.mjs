// tools/_j1nc-quickwin1.mjs — wdbc-j1nc, партия точечных находок вне семейства
// Unnatural: The Quick and The Dead (initMod), Warpforged Plate (armourAll),
// The Guard Blade (testMod skill:parry). Одноразовый скрипт, можно удалить.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { legacyEffectsToChanges } from "../module/constants/effect-keys.mjs";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

function addLegacyEffect(file) {
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const changes = legacyEffectsToChanges(doc.system.effects);
  if (!changes.length) throw new Error(`Нет legacy-эффектов у ${file}`);
  const effId = foundry.utils.randomID();
  doc.effects = doc.effects || [];
  doc.effects.push({
    name: `${doc.name} (перенесено)`,
    system: { changes },
    _id: effId,
    img: doc.img,
    type: "base",
    disabled: false,
    start: null,
    duration: { value: null, units: "seconds", expiry: null, expired: false },
    description: "",
    origin: null,
    tint: "#ffffff",
    transfer: true,
    statuses: [],
    showIcon: 1,
    folder: null,
    sort: 0,
    flags: {},
    _stats: {
      coreVersion: "14.365", systemId: "warhammer-dbc", systemVersion: "0.1.0",
      createdTime: Date.now(), modifiedTime: Date.now(), lastModifiedBy: null,
      compendiumSource: null, duplicateSource: null, exportSource: null
    },
    _key: `!items.effects!${doc._id}.${effId}`
  });
  doc.flags ??= {};
  doc.flags["warhammer-dbc"] ??= {};
  doc.flags["warhammer-dbc"].migratedEffect = true;
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  console.log("OK (legacy effect):", file, "->", changes.map(c => `${c.key}:${c.value}`).join(", "));
}

addLegacyEffect("packs-src/traits/The_Quick_and_The_Dead___Быстрые_и_М_ртв_Iqc2Fn8gX8USBY3D.json");
addLegacyEffect("packs-src/traits/Элитные_архетипы/Варп_Кузнец/Warpforged_Plate___Закал_нные_Варпом_Лат_gjtQQj1JT1qmI7r0.json");

// The Guard Blade — testMod, живой запрос в момент броска (item-rules.mjs),
// не характеристика/AP: сюда легаси-конвертер не годится, нужна запись Механики.
{
  const file = "packs-src/traits/Элитные_архетипы_Эльдар/Авангард_Связанных_Душами/The_Guard_Blade___Охранный_Клинок_oUdaIbRJTj8TANpB.json";
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const entry = blankMechEntry("testMod");
  entry.modScope = "skill";
  entry.skillKey = "parry";
  entry.modValueMode = "flat";
  entry.value = 10;
  entry.label = "Охранный Клинок (Парирование)";
  const group = blankMechGroup("AND");
  group.entries = [entry];
  doc.flags ??= {};
  doc.flags["warhammer-dbc"] ??= {};
  doc.flags["warhammer-dbc"].mechanics = [group];
  doc.system.notes = "Механикой пока не выражено: дополнительная Реакция на парирования, парирование стрелкового при Blade Shield, парирование за союзника, двойная контратака.";
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  console.log("OK (testMod):", file);
}
