// tools/autoanimations-draft.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Черновой автопроход: расставляет flags.autoanimations (Automated Animations,
//  module id "autoanimations", установленная версия 7.0.22) на Оружие
//  (packs-src/weapons, packs-src/vehicle-weapons), Психосилы
//  (packs-src/psychic-powers) и Техночудеса (packs-src/tech-powers) — по
//  system.weaponType / system.discipline. Черновой проход, который пользователь
//  правит вручную дальше через кнопку "Automated Animations" в шапке листа
//  предмета (module/sheets/item-sheet.mjs — мост к getItemSheetHeaderButtons,
//  см. module/integrations/autoanimations.mjs).
//
//  Форма объекта и КАЖДАЯ пара animation+variant+color ниже сняты вживую через
//  штатное меню AA (Foundry v14.367, autoanimations 7.0.22, JB2A_DnD5e Free) —
//  не придуманы. dbSection primary.video ВСЕГДА равен верхнему menu ("melee"
//  или "range"), независимо от menuType (weapon/generic/spell) — подтверждено
//  submit+read, а не предположено.
//
//  Запуск: node tools/autoanimations-draft.mjs
//  После — обычный npm run packs:build.
// ═══════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");

// ── Шаблон — точная структура реального flags.autoanimations (снята с живого
//    Item после Submit and Close в "A-A Item Menu"). Меняются только menu и
//    primary.video.{dbSection,menuType,animation,variant,color}; всё
//    остальное — как AA сама генерирует для простого назначения без
//    Secondary/Target/Source и без Macro/3D/Sound.
function buildAnimation(label, { menu, menuType, animation, variant, color }) {
  return {
    id: crypto.randomUUID(),
    label,
    levels3d: {
      type: "explosion",
      data: { color01: "#FFFFFF", color02: "#FFFFFF", spritePath: "modules/levels-3d-preview/assets/particles/dust.png" },
      sound: { enable: false },
      secondary: { enable: false, data: { color01: "#FFFFFF", color02: "#FFFFFF", spritePath: "modules/levels-3d-preview/assets/particles/dust.png" } }
    },
    macro: { enable: false, playWhen: "0" },
    menu,
    primary: {
      video: { dbSection: menu, menuType, animation, variant, color, enableCustom: false, customPath: "" },
      sound: { enable: false, delay: 0, repeat: 1, repeatDelay: 250, startTime: 0, volume: 0.75 },
      options: { contrast: 0, delay: 0, elevation: 1000, isWait: false, opacity: 1, playbackRate: 1, repeat: 1, repeatDelay: 250, saturate: 0, size: 1, tint: false, tintColor: "#FFFFFF", zIndex: 1 }
    },
    secondary: {
      enable: false,
      video: { dbSection: "static", menuType: "spell", animation: "curewounds", variant: "01", color: "blue", enableCustom: false, customPath: "" },
      sound: { enable: false, delay: 0, repeat: 1, repeatDelay: 250, startTime: 0, volume: 0.75 },
      options: { addTokenWidth: false, anchor: "0.5", contrast: 0, delay: 0, elevation: 1000, fadeIn: 250, fadeOut: 500, isMasked: false, isRadius: true, isWait: false, opacity: 1, repeat: 1, repeatDelay: 250, saturate: 0, size: 1.5, tint: false, tintColor: "#FFFFFF", zIndex: 1 }
    },
    soundOnly: { sound: { enable: false, delay: 0, repeat: 1, repeatDelay: 250, startTime: 0, volume: 0.75 } },
    source: {
      enable: false,
      video: { dbSection: "static", menuType: "spell", animation: "curewounds", variant: "01", color: "blue", enableCustom: false, customPath: "" },
      sound: { enable: false, delay: 0, repeat: 1, repeatDelay: 250, startTime: 0, volume: 0.75 },
      options: { addTokenWidth: false, anchor: "0.5", contrast: 0, delay: 0, elevation: 1000, fadeIn: 250, fadeOut: 500, isMasked: false, isRadius: false, isWait: true, opacity: 1, repeat: 1, repeatDelay: 250, saturate: 0, size: 1, tint: false, tintColor: "#FFFFFF", zIndex: 1 }
    },
    target: {
      enable: false,
      video: { dbSection: "static", menuType: "spell", animation: "curewounds", variant: "01", color: "blue", enableCustom: false, customPath: "" },
      sound: { enable: false, delay: 0, repeat: 1, repeatDelay: 250, startTime: 0, volume: 0.75 },
      options: { addTokenWidth: false, anchor: "0.5", contrast: 0, delay: 0, elevation: 1000, fadeIn: 250, fadeOut: 500, isMasked: false, isRadius: false, opacity: 1, persistent: false, repeat: 1, repeatDelay: 250, saturate: 0, size: 1, tint: false, tintColor: "#FFFFFF", unbindAlpha: false, unbindVisibility: false, zIndex: 1 }
    },
    isEnabled: true,
    isCustomized: true,
    fromAmmo: false,
    version: 5,
    meleeSwitch: {
      video: { dbSection: "range", menuType: "weapon", animation: "arrow", variant: "regular", color: "regular" },
      sound: { enable: false, delay: 0, repeat: 1, repeatDelay: 250, startTime: 0, volume: 0.75 },
      options: { detect: "automatic", range: 2, returning: false, switchType: "on" }
    }
  };
}

// ── Оружие: system.weaponType → анимация. menu берётся из weaponClass
//    ("melee" → melee, всё остальное — thrown/pistol/basic/heavy/launcher/
//    stationary → range) отдельно от этой таблицы.
const WEAPON_TYPE_ANIM = {
  // Рукопашные типы (весь ассортимент проверен в melee/weapon и melee/generic)
  chain:        { menuType: "generic", animation: "slashing",   variant: "01",       color: "orange" },
  power:        { menuType: "weapon",  animation: "lasersword", variant: "01",       color: "blue" },
  primitive:    { menuType: "weapon",  animation: "club",       variant: "01",       color: "white" },
  wraithbone:   { menuType: "weapon",  animation: "lasersword", variant: "01",       color: "blue" },
  psychic:      { menuType: "weapon",  animation: "lasersword", variant: "01",       color: "blue" },
  shock:        { menuType: "weapon",  animation: "mace",       variant: "01",       color: "white" },
  monofilament: { menuType: "weapon",  animation: "rapier",     variant: "01",       color: "white" },
  exotic:       { menuType: "weapon",  animation: "sword",      variant: "01",       color: "white" },
  // Дальнобойные типы (весь ассортимент проверен в range/weapon, range/generic, range/spell)
  laser:        { menuType: "weapon",  animation: "lasershot",  variant: "01",       color: "red" },
  solid:        { menuType: "weapon",  animation: "bullet",     variant: "1",        color: "orange" },
  bolt:         { menuType: "weapon",  animation: "bolt",       variant: "physical", color: "orange" },
  melta:        { menuType: "spell",   animation: "fireballbeam", variant: "01",     color: "orange" },
  plasma:       { menuType: "generic", animation: "energybeam", variant: "01",       color: "blue" },
  flame:        { menuType: "spell",   animation: "fireballbeam", variant: "01",     color: "orange" },
  lowtech:      { menuType: "weapon",  animation: "arrow",      variant: "regular",  color: "random" },
  launcher:     { menuType: "weapon",  animation: "missile",    variant: "01",       color: "blue" },
  explosive:    { menuType: "weapon",  animation: "bomb",       variant: "01",       color: "black" },
  splinter:     { menuType: "weapon",  animation: "dagger",     variant: "01",       color: "white" },
  darklight:    { menuType: "generic", animation: "energystrand", variant: "01",     color: "purple" },
  shuriken:     { menuType: "weapon",  animation: "bullet",     variant: "2",        color: "orange" },
  fusion:       { menuType: "spell",   animation: "firebolt",   variant: "01",       color: "orange" },
  prisma:       { menuType: "generic", animation: "energybeam", variant: "01",       color: "blue" },
  rocket:       { menuType: "weapon",  animation: "missile",    variant: "01",       color: "blue" },
  grenade:      { menuType: "weapon",  animation: "bomb",       variant: "01",       color: "black" },
  acid:         { menuType: "spell",   animation: "disintegrate", variant: "01",     color: "green" },
  needler:      { menuType: "weapon",  animation: "dagger",     variant: "01",       color: "white" },
  grav:         { menuType: "generic", animation: "energystrand", variant: "01",     color: "purple" }
};
const WEAPON_TYPE_FALLBACK_MELEE = { menuType: "weapon", animation: "sword",   variant: "01", color: "white" };
const WEAPON_TYPE_FALLBACK_RANGE = { menuType: "weapon", animation: "bullet", variant: "1",  color: "orange" };

// ── Психосилы: system.discipline → анимация (только для menu="range";
//    "touch"/"psychicBlade" идут по MELEE_FALLBACK ниже — единого рукопашного
//    стиля на все дисциплины хватает для черновика).
const PSY_DISCIPLINE_RANGE_ANIM = {
  thaumaturgy:     { menuType: "spell",   animation: "magicmissile",  variant: "01",      color: "purple" },
  sorcery:         { menuType: "spell",   animation: "witchbolt",     variant: "01",      color: "blue" },
  highSorcery:     { menuType: "spell",   animation: "eldritchblast", variant: "01",      color: "purple" },
  daemonology:     { menuType: "spell",   animation: "witchbolt",     variant: "01",      color: "blue" },
  telekinesis:     { menuType: "generic", animation: "energybeam",    variant: "01",      color: "blue" },
  telepathy:       { menuType: "spell",   animation: "eldritchblast", variant: "01",      color: "purple" },
  divination:      { menuType: "spell",   animation: "guidingbolt",   variant: "01",      color: "yellowblue" },
  biomancy:        { menuType: "spell",   animation: "scorchingray",  variant: "01",      color: "orange" },
  pyromancy:       { menuType: "spell",   animation: "fireballbeam",  variant: "01",      color: "orange" },
  slaanesh:        { menuType: "spell",   animation: "magicmissile",  variant: "01",      color: "purple" },
  nurgle:          { menuType: "spell",   animation: "disintegrate",  variant: "01",      color: "green" },
  tzeentch:        { menuType: "spell",   animation: "chainlightning", variant: "primary", color: "blue" },
  chronomancy:     { menuType: "generic", animation: "energystrand",  variant: "01",      color: "purple" },
  cryomancy:       { menuType: "spell",   animation: "rayoffrost",    variant: "01",      color: "blue" },
  technomancy:     { menuType: "generic", animation: "energybeam",    variant: "01",      color: "blue" },
  geomancy:        { menuType: "generic", animation: "energybeam",    variant: "01",      color: "blue" },
  fulmination:     { menuType: "spell",   animation: "chainlightning", variant: "primary", color: "blue" },
  umbramancy:      { menuType: "generic", animation: "energystrand",  variant: "01",      color: "purple" },
  librarium:       { menuType: "spell",   animation: "magicmissile",  variant: "01",      color: "purple" },
  bloodMagic:      { menuType: "weapon",  animation: "lasershot",     variant: "01",      color: "red" },
  farseer:         { menuType: "spell",   animation: "guidingbolt",   variant: "01",      color: "yellowblue" },
  voidDreamer:     { menuType: "generic", animation: "energystrand",  variant: "01",      color: "purple" },
  runesFateBattle: { menuType: "spell",   animation: "magicmissile",  variant: "01",      color: "purple" }
  // warlock, spiritSeer, revenant — не заданы: обычно рукопашные (клинки силы),
  // если встретятся с powerType "attack"/"psychicShoot" — уйдут в DEFAULT ниже.
};
const PSY_DISCIPLINE_DEFAULT_RANGE = { menuType: "spell", animation: "magicmissile", variant: "01", color: "purple" };
const MELEE_FALLBACK = { menuType: "weapon", animation: "lasersword", variant: "01", color: "blue" };

// ── Техночудеса: system.discipline → анимация (всегда menu="range" — среди
//    активных Техночудес с уроном рукопашных практически нет).
const TECH_DISCIPLINE_ANIM = {
  motivotheurgy: { menuType: "generic", animation: "energybeam",   variant: "01", color: "blue" },
  cybertheurgy:  { menuType: "spell",   animation: "witchbolt",    variant: "01", color: "blue" },
  nootheurgy:    { menuType: "spell",   animation: "eldritchblast", variant: "01", color: "purple" },
  animatheurgy:  { menuType: "generic", animation: "energystrand", variant: "01", color: "purple" }
};

// Типы powerType психосил, которые считаем «боевыми» (остальные — Аура/
// Вливание/Длительная/Изменение/Непрямое/Призыв/Концентрация/Цикл/Прочее —
// в этот черновой проход не входят, под них нужен другой шаблон анимации).
const PSY_MELEE_POWER_TYPES = new Set(["touch", "psychicBlade"]);
const PSY_RANGE_POWER_TYPES = new Set(["attack", "psychicShoot"]);

let stats = { weapons: 0, psychic: 0, tech: 0, skippedPsychic: 0, skippedTech: 0 };

function walk(dir, cb) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, cb);
    else if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== "_Folder.json") cb(full);
  }
}

function readJSON(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8"); }

function tagWeapon(file) {
  const doc = readJSON(file);
  const sys = doc.system || {};
  const isMelee = sys.weaponClass === "melee";
  const spec = WEAPON_TYPE_ANIM[sys.weaponType] || (isMelee ? WEAPON_TYPE_FALLBACK_MELEE : WEAPON_TYPE_FALLBACK_RANGE);
  const menu = isMelee ? "melee" : "range";
  doc.flags = doc.flags || {};
  doc.flags.autoanimations = buildAnimation(doc.name, { menu, ...spec });
  writeJSON(file, doc);
  stats.weapons++;
}

function tagPsychicPower(file) {
  const doc = readJSON(file);
  const sys = doc.system || {};
  let menu = null;
  if (PSY_MELEE_POWER_TYPES.has(sys.powerType)) menu = "melee";
  else if (PSY_RANGE_POWER_TYPES.has(sys.powerType)) menu = "range";
  if (!menu) { stats.skippedPsychic++; return; }

  const spec = menu === "melee"
    ? MELEE_FALLBACK
    : (PSY_DISCIPLINE_RANGE_ANIM[sys.discipline] || PSY_DISCIPLINE_DEFAULT_RANGE);
  doc.flags = doc.flags || {};
  doc.flags.autoanimations = buildAnimation(doc.name, { menu, ...spec });
  writeJSON(file, doc);
  stats.psychic++;
}

function tagTechPower(file) {
  const doc = readJSON(file);
  const sys = doc.system || {};
  if (!sys.damage) { stats.skippedTech++; return; }
  const spec = TECH_DISCIPLINE_ANIM[sys.discipline] || PSY_DISCIPLINE_DEFAULT_RANGE;
  doc.flags = doc.flags || {};
  doc.flags.autoanimations = buildAnimation(doc.name, { menu: "range", ...spec });
  writeJSON(file, doc);
  stats.tech++;
}

walk(path.join(ROOT, "packs-src/weapons"), tagWeapon);
walk(path.join(ROOT, "packs-src/vehicle-weapons"), tagWeapon);
walk(path.join(ROOT, "packs-src/psychic-powers"), tagPsychicPower);
walk(path.join(ROOT, "packs-src/tech-powers"), tagTechPower);

console.log(`Оружие: ${stats.weapons}`);
console.log(`Психосилы: ${stats.psychic} размечено, ${stats.skippedPsychic} пропущено (не Атака/Психострельба/Касание/Псих.клинок)`);
console.log(`Техночудеса: ${stats.tech} размечено, ${stats.skippedTech} пропущено (нет урона)`);
