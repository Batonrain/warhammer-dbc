// tools/_le2y-nomatch-dump.mjs — wdbc-le2y, вторая фаза: полный список
// embedded Талантов/Черт без канонического аналога в packs-src/talents|traits
// и без собственного эффекта — то, что осталось после tools/_le2y-sync.mjs.
// Группировка по уникальному имени (одна и та же способность встречается на
// нескольких NPC) — решение принимается один раз, применяется скриптом-правкой
// по всем вхождениям. Одноразовый скрипт.
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
    if (!byFull.has(en)) byFull.set(en, []);
    byFull.get(en).push(doc);
    if (!byNorm.has(norm)) byNorm.set(norm, []);
    byNorm.get(norm).push(doc);
    if (baseName(en) === en) {
      if (!byBareTemplate.has(en)) byBareTemplate.set(en, []);
      byBareTemplate.get(en).push(doc);
    }
  }
  return { byFull, byNorm, byBareTemplate };
}

const talentsIdx = buildIndex("packs-src/talents");
const traitsIdx = buildIndex("packs-src/traits");

const bestiaryFiles = walk("packs-src/bestiary");

const groups = { talent: new Map(), trait: new Map() };

for (const f of bestiaryFiles) {
  const actor = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const item of actor.items ?? []) {
    if (item.type !== "talent" && item.type !== "trait") continue;
    if (bestiaryItemHasEffect(item)) continue;
    const idx = item.type === "talent" ? talentsIdx : traitsIdx;
    const itemEn = englishName(item.name);
    let matches = idx.byFull.get(itemEn);
    if (!matches) matches = idx.byNorm.get(normName(itemEn));
    if (!matches) matches = idx.byBareTemplate.get(baseName(itemEn));
    if (matches && matches.length > 0) continue; // has canonical match, handled by sync

    const g = groups[item.type];
    if (!g.has(item.name)) {
      g.set(item.name, {
        name: item.name,
        benefit: item.system?.benefit ?? "",
        description: item.system?.description ?? "",
        hasRating: item.system?.hasRating ?? null,
        rating: item.system?.rating ?? null,
        occurrences: [],
      });
    }
    g.get(item.name).occurrences.push({ file: f, actor: actor.name, itemId: item._id });
  }
}

for (const type of ["talent", "trait"]) {
  const arr = [...groups[type].values()].sort((a, b) => b.occurrences.length - a.occurrences.length);
  const out = arr.map((g) => ({
    name: g.name,
    count: g.occurrences.length,
    benefit: g.benefit,
    description: g.description,
    hasRating: g.hasRating,
    rating: g.rating,
    files: g.occurrences.map((o) => o.file),
  }));
  fs.writeFileSync(`tools/_le2y-nomatch-${type}.json`, JSON.stringify(out, null, 2) + "\n");
  console.log(`${type}: ${arr.length} уникальных имён, ${arr.reduce((n, g) => n + g.occurrences.length, 0)} записей -> tools/_le2y-nomatch-${type}.json`);
}
