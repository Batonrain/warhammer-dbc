// tools/_le2y-apply-decisions.mjs — wdbc-le2y, применяет tools/_le2y-decisions.mjs
// к embedded-записям Бестиария, перечисленным в tools/_le2y-nomatch-{talent,trait}.json
// (записи без канонического аналога — то, что осталось после tools/_le2y-sync.mjs).
// Одноразовый скрипт.
import fs from "node:fs";
import { TALENT_DECISIONS, TRAIT_DECISIONS } from "./_le2y-decisions.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function randomId(len = 16) {
  let s = "";
  for (let i = 0; i < len; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return s;
}

const TERRAIN_KEYS = ["smoke", "mud", "bloodPool", "dark", "deepSnow", "thicket", "ice", "crowd", "corpses", "rubble", "earthquake"];

function terrainIgnoreEntry(label) {
  return {
    id: randomId(),
    kind: "terrainIgnore",
    group: null,
    corruptionValue: "1", woundsValue: "1", cohesionRole: "any", cohesionValue: "1",
    charKey: "s", field: "total", op: "add", value: 1,
    sourceUuid: "", sourceName: "", sourceImg: "", sourceHasRating: false, rating: "",
    specialization: "", minionGroup: "", minionTier: "",
    skillScope: "plain", skillKey: "", specKey: "", specialty: "", specChoiceKeys: [], specChoiceCount: 1,
    rank: "untrained", weightScope: "all", weightMode: "kg", weightValue: 1,
    movementTarget: "spd", movementValue: 1, armourLocation: "body", armourValue: 1,
    ignoreTerrainProps: [...TERRAIN_KEYS],
    fatigueAction: "threshold", fatigueThresholdChar: "t",
    equipMode: "direct", equipQty: 1, equipSourceUuid: "", equipSourceName: "", equipSourceImg: "",
    equipCategoryPack: "weapons", equipWeaponType: "", equipWeaponProp: "", equipArmorType: "",
    equipMaxAvailability: 5, equipQuality: "common", equipTalentTier: "", equipMaxPsyRating: "", equipImplantCategory: "",
    equipBudgetMode: "count", equipBudgetValue: 1,
    loyaltyMinionType: "", loyaltyOp: "add", loyaltyValue: 1,
    weaponPropAction: "add", weaponPropKey: "", weaponPropLabel: "", weaponPropHasRating: false, weaponPropHasRating2: false,
    weaponPropValue: "1", weaponPropValue2: "0", weaponPropNewKey: "", weaponPropNewLabel: "",
    weaponPropNewHasRating: false, weaponPropNewHasRating2: false, weaponPropNewValue: "1", weaponPropNewValue2: "0",
    label, code: "",
    when: { negate: false, conditions: [] },
  };
}

function makeMechanicsFlag(entry) {
  return { migratedEffect: true, mechanics: [{ id: randomId(), operator: "AND", entries: [entry] }] };
}

function nativeEffectDoc(name, key, value, phase, actorId, itemId) {
  const effId = randomId();
  return {
    name: `${name} (перенесено)`,
    system: { changes: [{ key, type: "add", value, phase, priority: 0 }] },
    _id: effId,
    img: "systems/warhammer-dbc/assets/item-icons/trait.svg",
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
      createdTime: null, modifiedTime: null, lastModifiedBy: null,
      compendiumSource: null, duplicateSource: null,
    },
    _key: `!actors.items.effects!${actorId}.${itemId}.${effId}`,
  };
}

function applyDecision(actor, item, decision) {
  if (decision.action === "note") {
    const cur = (item.system.notes ?? "").trim();
    if (!cur) item.system.notes = decision.note;
    return true;
  }
  if (decision.action === "terrainIgnore") {
    let changed = false;
    if (!(Array.isArray(item.flags?.["warhammer-dbc"]?.mechanics) && item.flags["warhammer-dbc"].mechanics.length > 0)) {
      item.flags = item.flags ?? {};
      item.flags["warhammer-dbc"] = makeMechanicsFlag(terrainIgnoreEntry(item.name));
      changed = true;
    }
    if (decision.note) {
      const cur = (item.system.notes ?? "").trim();
      if (!cur) { item.system.notes = decision.note; changed = true; }
    }
    return changed;
  }
  if (decision.action === "nativeEffect") {
    if (Array.isArray(item.effects) && item.effects.length > 0) return false;
    item.effects = [nativeEffectDoc(item.name, decision.key, decision.value, decision.phase, actor._id, item._id)];
    return true;
  }
  return false;
}

function run(dumpFile, decisions, typeLabel) {
  const groups = JSON.parse(fs.readFileSync(dumpFile, "utf8"));
  const filesTouched = new Set();
  let applied = 0, missingDecision = 0;
  const missingNames = [];

  // Группируем по файлу, чтобы читать/писать каждый актор-файл один раз.
  const byFile = new Map();
  for (const g of groups) {
    const decision = decisions[g.name];
    if (!decision) { missingDecision++; missingNames.push(g.name); continue; }
    for (const f of g.files) {
      if (!byFile.has(f)) byFile.set(f, []);
      byFile.get(f).push({ name: g.name, decision });
    }
  }

  for (const [f, entries] of byFile) {
    const actor = JSON.parse(fs.readFileSync(f, "utf8"));
    let changed = false;
    for (const { name, decision } of entries) {
      for (const item of actor.items ?? []) {
        if (item.type !== (typeLabel === "talent" ? "talent" : "trait")) continue;
        if (item.name !== name) continue;
        // Не трогать, если у записи уже что-то есть (на случай повторного запуска).
        const already = (Array.isArray(item.effects) && item.effects.length > 0)
          || (Array.isArray(item.flags?.["warhammer-dbc"]?.mechanics) && item.flags["warhammer-dbc"].mechanics.length > 0)
          || (item.system.notes && item.system.notes.trim());
        if (already) continue;
        if (applyDecision(actor, item, decision)) { applied++; changed = true; }
      }
    }
    if (changed) {
      fs.writeFileSync(f, JSON.stringify(actor, null, 2) + "\n", "utf8");
      filesTouched.add(f);
    }
  }

  console.log(`${typeLabel}: применено к ${applied} записям в ${filesTouched.size} файлах; без решения: ${missingDecision}`);
  if (missingNames.length) console.log("  без решения:", missingNames);
}

run("tools/_le2y-nomatch-talent.json", TALENT_DECISIONS, "talent");
run("tools/_le2y-nomatch-trait.json", TRAIT_DECISIONS, "trait");
