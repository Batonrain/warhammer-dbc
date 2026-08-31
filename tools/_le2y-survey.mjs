// tools/_le2y-survey.mjs — wdbc-le2y, разведка: сколько embedded-Талантов/Черт
// на NPC Бестиария можно синхронизировать с уже решённой Механикой в
// packs-src/talents и packs-src/traits (после марафонов wdbc-g53k/wdbc-j1nc).
// Одноразовый скрипт.
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
  // "Cold Fury / Холодная Ярость" -> "Cold Fury"
  const idx = fullName.indexOf(" / ");
  return (idx === -1 ? fullName : fullName.slice(0, idx)).trim();
}

function baseName(name) {
  // "Unnatural WS (2)" -> "Unnatural WS"; "Daemonic (X)" -> "Daemonic"
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function normName(name) {
  // "Unnatural WS (+2)" / "Unnatural WS(2)" -> "Unnatural WS (2)" — tolerate
  // "+" sign and spacing differences around the rating, keep the number.
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

function buildIndex(dir) {
  const files = walk(dir);
  const byFull = new Map();
  const byNorm = new Map();
  const byBase = new Map();
  for (const f of files) {
    const doc = JSON.parse(fs.readFileSync(f, "utf8"));
    const en = englishName(doc.name);
    const norm = normName(en);
    const base = baseName(en);
    const rec = { file: f, doc, ...canonicalStatus(doc) };
    if (!byFull.has(en)) byFull.set(en, []);
    byFull.get(en).push(rec);
    if (!byNorm.has(norm)) byNorm.set(norm, []);
    byNorm.get(norm).push(rec);
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(rec);
  }
  return { files, byFull, byNorm, byBase };
}

const talentsIdx = buildIndex("packs-src/talents");
const traitsIdx = buildIndex("packs-src/traits");

const bestiaryFiles = walk("packs-src/bestiary");

const stats = {
  talent: { total: 0, alreadyHasEffect: 0, matchedExact: 0, matchedBase: 0, noMatch: 0, fixableAutomated: 0, fixableNotesOnly: 0 },
  trait: { total: 0, alreadyHasEffect: 0, matchedExact: 0, matchedBase: 0, noMatch: 0, fixableAutomated: 0, fixableNotesOnly: 0 },
};
const noMatchNames = { talent: new Map(), trait: new Map() };
const ambiguous = { talent: new Map(), trait: new Map() };

for (const f of bestiaryFiles) {
  const actor = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const item of actor.items ?? []) {
    if (item.type !== "talent" && item.type !== "trait") continue;
    const idx = item.type === "talent" ? talentsIdx : traitsIdx;
    const s = stats[item.type];
    s.total++;

    const already = bestiaryItemHasEffect(item);
    if (already) s.alreadyHasEffect++;

    const itemEn = englishName(item.name);
    let matches = idx.byFull.get(itemEn);
    let matchKind = "exact";
    if (!matches) {
      matches = idx.byNorm.get(normName(itemEn));
      matchKind = "norm";
    }
    if (!matches) {
      matches = idx.byBase.get(baseName(itemEn));
      matchKind = "base";
    }
    if (!matches || matches.length === 0) {
      s.noMatch++;
      const m = noMatchNames[item.type];
      m.set(item.name, (m.get(item.name) ?? 0) + 1);
      continue;
    }
    if (matchKind === "exact") s.matchedExact++;
    else if (matchKind === "norm") s.matchedNorm = (s.matchedNorm ?? 0) + 1;
    else s.matchedBase++;

    if (matches.length > 1 && matchKind !== "base") {
      const anyDiffer = matches.some((m, i) => i > 0 && (m.automated !== matches[0].automated));
      if (anyDiffer) {
        const m = ambiguous[item.type];
        m.set(item.name, (m.get(item.name) ?? 0) + 1);
      }
    }

    if (!already && matchKind !== "base") {
      const bestMatch = matches.find((m) => m.automated) ?? matches[0];
      if (bestMatch.automated) s.fixableAutomated++;
      else if (bestMatch.hasNotes) s.fixableNotesOnly++;
    }
  }
}

console.log(JSON.stringify(stats, null, 2));
console.log("\n=== No-match talent names (top 30) ===");
console.log([...noMatchNames.talent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30));
console.log("\n=== No-match trait names (top 30) ===");
console.log([...noMatchNames.trait.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30));
console.log("\n=== Ambiguous talent names (top 15) ===");
console.log([...ambiguous.talent.entries()].slice(0, 15));
console.log("\n=== Ambiguous trait names (top 15) ===");
console.log([...ambiguous.trait.entries()].slice(0, 15));
