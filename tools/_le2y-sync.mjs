// tools/_le2y-sync.mjs — wdbc-le2y, синхронизация embedded-Талантов/Черт на
// NPC Бестиария с уже решённой Механикой в packs-src/talents и
// packs-src/traits (марафоны wdbc-g53k/wdbc-j1nc). Одноразовый скрипт.
//
// Метод: сопоставление по английской части названия (точно, либо с допуском
// на "+"/пробелы вокруг рейтинга — "Unnatural WS (2)" ~ "Unnatural WS (+2)").
// НЕ используется грубое сопоставление по имени без скобок ("Daemonic (6)" ~
// "Daemonic (4)") — там разные канонические записи, риск подставить чужую
// механику. Такие случаи остаются нетронутыми (см. tools/_le2y-survey.mjs).
//
// Для каждого embedded Таланта/Черты без собственного эффекта:
//   - если канонический аналог реально механизирован (native effects[] и/или
//     flags["warhammer-dbc"]) — копируется тот же канал, с новым _id/_key
//     под этого актора (Foundry требует уникальный _key на слой эффекта);
//   - если канонический аналог решён честной причиной (system.notes) —
//     причина копируется в NPC-копию, если там notes пуст (не тронуть текст,
//     если он уже чем-то заполнен).
// Уже работающие записи (что-то в system.effects/effects[]/flags.mechanics)
// не трогаются.
import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith(".json") && entry.name !== "_Folder.json") out.push(p);
  }
  return out;
}

function englishName(fullName) {
  const idx = fullName.indexOf(" / ");
  return (idx === -1 ? fullName : fullName.slice(0, idx)).trim();
}

function normName(name) {
  return name.replace(/\(\s*\+?\s*(-?\d+)\s*\)/g, "($1)").replace(/\s+/g, " ").trim();
}

function canonicalStatus(doc) {
  const hasNativeEffect = Array.isArray(doc.effects) && doc.effects.length > 0;
  const hasMechanics = Array.isArray(doc.flags?.["warhammer-dbc"]?.mechanics) && doc.flags["warhammer-dbc"].mechanics.length > 0;
  const hasNotes = typeof doc.system?.notes === "string" && doc.system.notes.trim().length > 0;
  return { hasNativeEffect, hasMechanics, hasNotes, automated: hasNativeEffect || hasMechanics };
}

function bestiaryItemHasEffect(item) {
  const hasNativeEffect = Array.isArray(item.effects) && item.effects.length > 0;
  const hasMechanics = Array.isArray(item.flags?.["warhammer-dbc"]?.mechanics) && item.flags["warhammer-dbc"].mechanics.length > 0;
  const e = item.system?.effects;
  let hasLegacyEffect = false;
  if (e && typeof e === "object") {
    hasLegacyEffect = !!(
      (e.charBonusStat && e.charBonusStat !== "") ||
      (e.charBonusValue && e.charBonusValue !== 0) ||
      (Array.isArray(e.charBonuses) && e.charBonuses.length > 0) ||
      (Array.isArray(e.charValueBonuses) && e.charValueBonuses.length > 0) ||
      (e.armourAll && e.armourAll !== 0) ||
      (e.fearRating && e.fearRating !== 0) ||
      (e.sizeMod && e.sizeMod !== 0) ||
      (e.initMod && e.initMod !== 0) ||
      (e.speedMod && e.speedMod !== 0)
    );
  }
  return hasNativeEffect || hasMechanics || hasLegacyEffect;
}

function baseName(name) {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function buildIndex(dir) {
  const files = walk(dir);
  const byFull = new Map();
  const byNorm = new Map();
  const byBareTemplate = new Map();
  for (const f of files) {
    const doc = JSON.parse(fs.readFileSync(f, "utf8"));
    const en = englishName(doc.name);
    const norm = normName(en);
    const rec = { file: f, doc, ...canonicalStatus(doc) };
    if (!byFull.has(en)) byFull.set(en, []);
    byFull.get(en).push(rec);
    if (!byNorm.has(norm)) byNorm.set(norm, []);
    byNorm.get(norm).push(rec);
    // "Bare template" — канонический документ, чьё АНГЛИЙСКОЕ имя само не
    // несёт хвостовой "(рейтинг/специализация)" (в отличие от "Daemonic
    // (+2)" — у него хвост ЕСТЬ, он не шаблон). Такие безопасно сопоставлять
    // с bestiary-записью "Имя (специализация)" один-к-одному: разночтения
    // вроде "Daemonic (+2)/(+3)/(+4)" в byBareTemplate не попадают вовсе,
    // так что коллизия того типа, что была у byBase, здесь не возникает.
    if (baseName(en) === en) {
      if (!byBareTemplate.has(en)) byBareTemplate.set(en, []);
      byBareTemplate.get(en).push(rec);
    }
  }
  return { byFull, byNorm, byBareTemplate };
}

/** Извлекает числовой рейтинг из имени embedded-записи: "Daemonic (6)" -> 6. */
function parseRatingFromName(name) {
  const m = name.match(/\((-?\d+)(?:\/-?\d+)?\)\s*$/);
  return m ? Number(m[1]) : null;
}

/**
 * Масштабирует числовые change.value в клонированных ActiveEffect по
 * отношению рейтингов bestiary-записи и канонического шаблона — нужен для
 * записей вроде "Daemonic (X)" (canonical: rating=1 → +1 T.b), где само
 * число зависит от рейтинга конкретного экземпляра, а не фиксировано.
 */
function scaledEffects(effects, canonRating, itemRating) {
  if (!canonRating || !itemRating || canonRating === itemRating) return effects;
  const factor = itemRating / canonRating;
  return effects.map((eff) => {
    const c = structuredClone(eff);
    if (c.system?.changes) {
      c.system.changes = c.system.changes.map((ch) => (
        typeof ch.value === "number" ? { ...ch, value: Math.round(ch.value * factor) } : ch
      ));
    }
    return c;
  });
}

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function randomId(len = 16) {
  let s = "";
  for (let i = 0; i < len; i++) s += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return s;
}

function cloneEffect(eff, actorId, itemId) {
  const c = structuredClone(eff);
  const newId = randomId();
  c._id = newId;
  c._key = `!actors.items.effects!${actorId}.${itemId}.${newId}`;
  if (c._stats) {
    c._stats.createdTime = null;
    c._stats.modifiedTime = null;
    c._stats.lastModifiedBy = null;
    c._stats.compendiumSource = null;
    c._stats.duplicateSource = null;
  }
  return c;
}

const talentsIdx = buildIndex("packs-src/talents");
const traitsIdx = buildIndex("packs-src/traits");

const bestiaryFiles = walk("packs-src/bestiary");

let filesChanged = 0;
const counters = {
  talent: { automated: 0, notes: 0, ambiguousSkipped: 0 },
  trait: { automated: 0, notes: 0, ambiguousSkipped: 0 },
};
const ambiguousLog = [];

for (const f of bestiaryFiles) {
  const actor = JSON.parse(fs.readFileSync(f, "utf8"));
  const actorId = actor._id;
  let changed = false;

  for (const item of actor.items ?? []) {
    if (item.type !== "talent" && item.type !== "trait") continue;
    if (bestiaryItemHasEffect(item)) continue;

    const idx = item.type === "talent" ? talentsIdx : traitsIdx;
    const itemEn = englishName(item.name);
    let matches = idx.byFull.get(itemEn);
    if (!matches) matches = idx.byNorm.get(normName(itemEn));
    if (!matches) matches = idx.byBareTemplate.get(baseName(itemEn));
    if (!matches || matches.length === 0) continue;

    const automatedMatches = matches.filter((m) => m.automated);
    if (automatedMatches.length > 1) {
      // Разные канонические записи под одним именем реально автоматизированы
      // по-разному — не гадать, пропустить и отметить для ручной сверки.
      const distinct = new Set(automatedMatches.map((m) => JSON.stringify({
        eff: m.hasNativeEffect ? m.doc.effects : null,
        mech: m.hasMechanics ? m.doc.flags["warhammer-dbc"].mechanics : null,
      })));
      if (distinct.size > 1) {
        counters[item.type].ambiguousSkipped++;
        ambiguousLog.push({ file: f, name: item.name, candidates: automatedMatches.map((m) => m.file) });
        continue;
      }
    }

    const best = automatedMatches[0] ?? matches[0];

    if (best.automated) {
      let applied = false;
      if (Array.isArray(best.doc.effects) && best.doc.effects.length > 0) {
        const canonRating = best.doc.system?.hasRating ? Number(best.doc.system.rating) : null;
        const itemRating = item.system?.hasRating
          ? Number(item.system.rating)
          : parseRatingFromName(item.name);
        const scaled = scaledEffects(best.doc.effects, canonRating, itemRating);
        item.effects = scaled.map((eff) => cloneEffect(eff, actorId, item._id));
        applied = true;
      }
      const dbcFlags = best.doc.flags?.["warhammer-dbc"];
      if (dbcFlags && Object.keys(dbcFlags).length > 0) {
        item.flags = item.flags ?? {};
        item.flags["warhammer-dbc"] = structuredClone(dbcFlags);
        applied = true;
      }
      if (applied) {
        counters[item.type].automated++;
        changed = true;
      }
    } else if (best.hasNotes) {
      const curNotes = (item.system.notes ?? "").trim();
      if (!curNotes) {
        item.system.notes = best.doc.system.notes;
        counters[item.type].notes++;
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(f, JSON.stringify(actor, null, 2) + "\n", "utf8");
    filesChanged++;
  }
}

console.log("Файлов изменено:", filesChanged);
console.log(JSON.stringify(counters, null, 2));
if (ambiguousLog.length) {
  fs.writeFileSync("tools/_le2y-ambiguous.jsonl", ambiguousLog.map((o) => JSON.stringify(o)).join("\n") + "\n");
  console.log("Неоднозначные (пропущены) ->", "tools/_le2y-ambiguous.jsonl", ambiguousLog.length);
}
