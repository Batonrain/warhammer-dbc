// tools/races-to-pack.mjs
// ════════════════════════════════════════════════════════════════════════
//  Расы и субрасы из констант в компендиум packs-src/races.
//
//  Черты В ДОКУМЕНТ НЕ КОПИРУЮТСЯ: раса несёт записи Конструктора
//  (kind:"trait") со ссылкой на библиотеку Черт по имени и рейтингу. Так
//  «Проворный» правится один раз для четырёх рас, а рейтинг доезжает до
//  эффекта пересчётом при выдаче (см. rescaleTraitByRating в mechanics.mjs).
//
//  Числа характеристик в записи Конструктора НЕ кладутся: их несут сами Черты.
//  Одна и та же прибавка, записанная в двух местах, сложилась бы дважды.
//
//  Запуск:  node tools/races-to-pack.mjs [--write]
// ════════════════════════════════════════════════════════════════════════

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { RACES, SUBRACES, SUBRACE_DATA, RACE_GROUPS } from "../module/constants/races.mjs";
import { libraryTrait } from "./race-traits.mjs";

const ROOT = "packs-src/races";
const NS   = "warhammer-dbc";

const stableId = seed => createHash("sha1").update(seed).digest("base64")
  .replace(/[^A-Za-z0-9]/g, "").slice(0, 16);

const fileName = (name, id) =>
  `${name.replace(/[^A-Za-zА-Яа-яЁё0-9]+/g, "_").slice(0, 40)}_${id}.json`;

/** Группа расы по RACE_GROUPS; она же отвечает на вопрос «аэльдари ли это». */
const groupOf = key => RACE_GROUPS.find(g => g.races.includes(key))?.label || "";

/**
 * Пустая запись Конструктора. Повторяет blankMechEntry из apps/mechanics.mjs —
 * позвать его нельзя: там foundry.utils.randomID, а инструменты работают вне
 * Foundry. Поля, которых нет, ломают вкладку МЕХАНИКА при открытии: лист читает
 * их для ЛЮБОГО вида записи (dropdown ещё не знает, что вид — «trait»), поэтому
 * скопирован весь набор умолчаний blankMechEntry, а не только поля trait/talent.
 */
const blankEntry = id => ({
  id, kind: "trait", group: null,
  corruptionValue: "1",
  woundsValue: "1",
  cohesionRole: "any", cohesionValue: "1",
  charKey: "s", field: "total", op: "add", value: 1,
  sourceUuid: "", sourceName: "", sourceImg: "", sourceHasRating: false, rating: "", specialization: "",
  skillScope: "plain", skillKey: "", specKey: "", specialty: "", specChoiceKeys: [], rank: "untrained",
  weightScope: "all", weightMode: "kg", weightValue: 1,
  movementTarget: "spd", movementValue: 1,
  ignoreTerrainProps: [],
  equipMode: "direct", equipQty: 1,
  equipSourceUuid: "", equipSourceName: "", equipSourceImg: "",
  equipCategoryPack: "weapons", equipWeaponType: "", equipWeaponProp: "",
  equipArmorType: "", equipMaxAvailability: 5,
  weaponPropAction: "add",
  weaponPropKey: "", weaponPropLabel: "", weaponPropHasRating: false, weaponPropHasRating2: false,
  weaponPropValue: "1", weaponPropValue2: "0",
  weaponPropNewKey: "", weaponPropNewLabel: "", weaponPropNewHasRating: false, weaponPropNewHasRating2: false,
  weaponPropNewValue: "1", weaponPropNewValue2: "0",
  label: "", code: ""
});

/**
 * Черты расы или субрасы → записи Конструктора.
 *
 * Ссылка идёт по UUID документа библиотеки, а НЕ по имени. Рантайм ищет
 * источник в `resolveMechSource` (module/apps/mechanics.mjs), и там имена
 * сравниваются без отбрасывания скобок: «Unnatural Strength (4) / Сверхъест.
 * Сила (4)» никогда не совпало бы с шаблоном «Unnatural Strength /
 * Сверхъестественная Сила (X)» — ни целиком, ни по английской части. Поиск
 * вернул бы null, Черта пришла бы пустышкой без эффектов, и Астартес получил
 * бы +0 вместо +4. Молча.
 *
 * UUID снимает вопрос нормализации вовсе — `resolveMechSource` пробует его
 * первым. Тем же приёмом уже связаны Предсказания (см. `sourceUuid` в
 * packs-src/divinations). Точное имя документа пишется рядом как запасной
 * путь, если пак когда-нибудь пересоберут с другими идентификаторами.
 */
export function traitEntries(def) {
  return (def?.traits || []).flatMap((t, i) => {
    const doc = libraryTrait(t.name);
    // Пары нет — сборка обязана упасть, а не тихо выдать расу без этой Черты:
    // молча пустая ссылка означала бы обнулённый бонус, замеченный только в игре.
    if (!doc) throw new Error(`Расовая Черта без пары в библиотеке Черт: «${t.name}» (${def.label})`);
    return [{
      ...blankEntry(stableId(`${def.label}:trait:${i}:${t.name}`)),
      sourceUuid: `Compendium.warhammer-dbc.traits.Item.${doc._id}`,
      sourceName: doc.name,
      sourceImg: doc.img || "",
      sourceHasRating: !!(doc.system?.hasRating || t.hasRating),
      rating: t.hasRating ? (t.rating ?? 0) : ""
    }];
  });
}

/** Одна И-группа со всеми Чертами; пусто — пустой массив, а не группа без записей. */
const mechanics = (def, seed) => {
  const entries = traitEntries(def);
  return entries.length ? [{ id: stableId(`${seed}:mech`), operator: "AND", entries }] : [];
};

const wrap = (name, type, key, system, mech, folder) => {
  const id = stableId(`${type}:${key}`);
  return {
    name, type, img: "icons/svg/oak.svg", folder,
    system: { key, ...system },
    _id: id, effects: [], sort: 0,
    flags: { [NS]: { mechanics: mech } },
    _key: `!items!${id}`
  };
};

/** Документы папок: четыре группы рас и одна для субрас. */
export function folderDocs() {
  const labels = [...RACE_GROUPS.map(g => g.label), "Субрасы"];
  return labels.map(label => {
    const id = stableId(`folder:${label}`);
    return {
      path: join(ROOT, label.replace(/\s+/g, "_"), "_Folder.json"),
      doc: {
        name: label, type: "Item", sorting: "m", _id: id,
        description: "", folder: null, sort: 0, color: null, flags: {},
        _key: `!folders!${id}`
      }
    };
  });
}

/** Документы рас и субрас: [{ path, doc }]. */
export function raceDocs() {
  const out = [];
  const folderId = label => stableId(`folder:${label}`);

  for (const [key, r] of Object.entries(RACES)) {
    const group = groupOf(key);
    const doc = wrap(r.label, "race", key, {
      group,
      chars: { ...(r.chars || {}) },
      bonusRolls: r.bonusRolls || 0,
      skills: r.skills || "", gear: r.gear || "",
      // talents в константах — массив имён; в схеме строка, как у Архетипа.
      talents: Array.isArray(r.talents) ? r.talents.join(", ") : (r.talents || ""),
      description: r.desc || "", notes: "",
      hasGeneSeed: !!r.hasGeneSeed,
      pastRaces: [...(r.pastRaces || [])],
      size: r.size || 0, bonusPoints: r.bonusPoints || 0, charShift: r.charShift || 0,
      fateRoll: r.fateRoll || "", skillsNote: r.skillsNote || "",
      adaptations: r.adaptations || "",
      bookSource: "DoomBC — Основная книга"
    }, mechanics(r, `race:${key}`), folderId(group));
    out.push({ path: join(ROOT, group.replace(/\s+/g, "_"), fileName(r.label, doc._id)), doc });
  }

  // Родитель субрасы — раса, в списке subraces которой она названа.
  const parentOf = sub => Object.entries(RACES)
    .find(([, r]) => (r.subraces || []).includes(sub))?.[0] || "";

  for (const [key, label] of Object.entries(SUBRACES)) {
    const s = SUBRACE_DATA[key] || {};
    const doc = wrap(label, "subrace", key, {
      parent: parentOf(key),
      cost: s.cost || 0, effect: s.effect || "", god: s.god || "",
      charMods: { ...(s.charMods || {}) },
      talents: Array.isArray(s.talents) ? s.talents.join(", ") : (s.talents || ""),
      removesTraits: [...(s.removesTraits || [])],
      description: s.effect || "", notes: "",
      bookSource: "DoomBC — Основная книга"
    }, mechanics(s, `subrace:${key}`), folderId("Субрасы"));
    out.push({ path: join(ROOT, "Субрасы", fileName(label, doc._id)), doc });
  }

  return out;
}

export function run({ write = false } = {}) {
  const all = [...folderDocs(), ...raceDocs()];
  if (write) {
    for (const { path, doc } of all) {
      mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
      writeFileSync(path, JSON.stringify(doc, null, 2) + "\n");
    }
  }
  const races = all.filter(d => d.doc.type === "race").length;
  const subs  = all.filter(d => d.doc.type === "subrace").length;
  return { races, subraces: subs, folders: all.length - races - subs };
}

if (process.argv[1]?.endsWith("races-to-pack.mjs")) {
  const res = run({ write: process.argv.includes("--write") });
  console.log(`Рас: ${res.races}, субрас: ${res.subraces}, папок: ${res.folders}`);
}
