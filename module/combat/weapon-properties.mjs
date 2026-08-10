// module/combat/weapon-properties.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  ДВИЖОК АВТОМАТИЗАЦИИ ОСОБЫХ СВОЙСТВ ОРУЖИЯ
//  Читает system.weaponProps[] оружия, сопоставляет с реестром WEAPON_PROPERTIES
//  и предоставляет помощники для диалога атаки, броска, урона и защиты.
// ─────────────────────────────────────────────────────────────────────────────

import { WEAPON_PROPERTIES } from "../constants/weapon-properties.mjs";

/** Разрешает массив записей {key,rating,rating2} в список с .def из реестра. */
export function resolveWeaponPropsList(list) {
  return (list ?? [])
    .map(p => ({ ...p, def: WEAPON_PROPERTIES[p.key] }))
    .filter(p => p.def);
}

/** Разрешает system.weaponProps[] оружия (без учёта модификаций). */
export function resolveWeaponProps(item) {
  return resolveWeaponPropsList(item?.system?.weaponProps);
}

export function findProp(props, key) {
  return props.find(p => p.key === key) || null;
}

export function hasProp(props, key) {
  return props.some(p => p.key === key);
}

/**
 * Сворачивает все директивы auto.* свойств в один плоский объект,
 * который потребляют диалог атаки и бросок.
 */
export function aggregateAuto(props) {
  const a = {
    attackMod: 0, noAim: false, noCalledShot: false, calledShotMod: 0,
    accurate: false, tearing: false, provenRating: 0, extremeThreshold: 10,
    razorSharp: false, meltaShort: false, mightySB: false, containedSB: false,
    fellingRating: 0, primitive: false, flexible: false, defensive: false,
    powerField: false, reinforced: false, reliabilityScore: 0, recharge: false,
    extraHits: null, multiStrikeRating: 0, ammoMult: 1, scatter: false,
    maximal: false, ignoreShield: false, lance: false, taintedCorB: false,
    spray: false, forcePR: false, deflagrate: false, deflagrateRating: 0,
    warpSoak: false, sanctified: false,
    // Свойства, автоматизированные позже (стр. 166-170): раньше были только
    // текстовыми напоминаниями и на расчёты не влияли.
    ordnance: false, otherAttacksMod: 0, doubleDamageRoll: false,
    devastatingRating: 0, wreckerRating: 0, hefty: false, heftyType: "",
    recoilRating: 0, carbine: false, antiAir: false, gyroStabilized: false,
    independent: false, wrist: false, crunch: false, cheapShot: false,
    smokeRating: 0, lingerRating: 0, lingerDrift: 0, revolver: false,
    combi: false, cognis: false, arcing: false, arcRating: 0, arcDamage: 0,
    shrinkTemplate: 0, difficultTerrain: 0
  };

  for (const p of props) {
    const au = p.def.auto;
    if (!au) continue;
    const r = p.rating || 0;

    if (au.attackMod)     a.attackMod += au.attackMod;
    if (au.noAim)         a.noAim = true;
    if (au.noCalledShot)  a.noCalledShot = true;
    if (au.calledShotMod) a.calledShotMod += au.calledShotMod;
    if (au.accurate)      a.accurate = true;
    if (au.tearing)       a.tearing = true;
    if (au.proven)        a.provenRating = Math.max(a.provenRating, r);
    if (au.extreme)       a.extremeThreshold = Math.min(a.extremeThreshold, r || 10);
    if (au.razorSharp)    a.razorSharp = true;
    if (au.meltaShort)    a.meltaShort = true;
    if (au.mightySB)      a.mightySB = true;
    if (au.containedSB)   a.containedSB = true;
    if (au.felling)       a.fellingRating += r;
    if (au.primitive)     a.primitive = true;
    if (au.flexible)      a.flexible = true;
    if (au.defensive)     a.defensive = true;
    if (au.powerField)    a.powerField = true;
    if (au.reinforced)    a.reinforced = true;
    if (typeof au.reliability === "number") a.reliabilityScore += au.reliability;
    if (au.recharge)      a.recharge = true;
    if (au.extraHits) {
      a.extraHits = au.extraHits;
      if (au.extraHits === "multiStrike") a.multiStrikeRating = Math.max(a.multiStrikeRating, r);
    }
    if (au.ammoMult === null)            a.ammoMult *= Math.max(1, r || 1);
    else if (typeof au.ammoMult === "number") a.ammoMult *= au.ammoMult;
    if (au.scatter)       a.scatter = true;
    if (au.maximal)       a.maximal = true;
    if (au.ignoreShield)  a.ignoreShield = true;
    if (au.lance)         a.lance = true;
    if (au.taintedCorB)   a.taintedCorB = true;
    if (au.spray)         a.spray = true;
    if (au.forcePR)       a.forcePR = true;
    if (au.deflagrate) { a.deflagrate = true; a.deflagrateRating = Math.max(a.deflagrateRating, r); }
    if (au.warpSoak)      a.warpSoak = true;
    if (au.sanctified)    a.sanctified = true;
    // ── Свойства с числовыми/флаговыми эффектами (стр. 166-170) ──
    if (au.ordnance)         a.ordnance = true;
    if (au.otherAttacksMod)  a.otherAttacksMod += au.otherAttacksMod;
    if (au.doubleDamageRoll) a.doubleDamageRoll = true;
    if (au.devastating !== undefined) a.devastatingRating = Math.max(a.devastatingRating, r);
    if (au.wrecker !== undefined)     a.wreckerRating    = Math.max(a.wreckerRating, r);
    if (au.recoil !== undefined)      a.recoilRating     = Math.max(a.recoilRating, r);
    if (au.smoke !== undefined)       a.smokeRating      = Math.max(a.smokeRating, r);
    if (au.linger !== undefined) {
      a.lingerRating = Math.max(a.lingerRating, r);
      a.lingerDrift  = Math.max(a.lingerDrift, p.rating2 || 0);
    }
    if (au.arc !== undefined) { a.arcRating = Math.max(a.arcRating, r); a.arcDamage = Math.max(a.arcDamage, p.rating2 || 0); }
    if (au.hefty) { a.hefty = true; if (typeof au.hefty === "string") a.heftyType = au.hefty; }
    if (au.carbine)        a.carbine = true;
    if (au.antiAir)        a.antiAir = true;
    if (au.gyroStabilized) a.gyroStabilized = true;
    if (au.independent)    a.independent = true;
    if (au.wrist)          a.wrist = true;
    if (au.crunch)         a.crunch = true;
    if (au.cheapShot)      a.cheapShot = true;
    if (au.revolver)       a.revolver = true;
    if (au.combi)          a.combi = true;
    if (au.cognis)         a.cognis = true;
    if (au.arcing)         a.arcing = true;
    if (au.shrinkTemplate) a.shrinkTemplate = Math.max(a.shrinkTemplate, au.shrinkTemplate);
    if (au.difficultTerrain) a.difficultTerrain = Math.min(a.difficultTerrain, au.difficultTerrain);
    // Hefty/Ogrynized снимают Primitive при рукопашном применении.
    if (au.hefty) a.primitive = false;
  }
  return a;
}

/**
 * Преобразует формулу урона с учётом Рвущего и Проверенного.
 * Tearing  → +1 куб, оставить наибольшие N (khN).
 * Proven X → каждый куб не ниже X (minX).
 * Mighty/Contained обрабатываются вызывающей стороной (изменение S.b).
 */
export function applyDamageDiceMods(formula, auto) {
  let f = String(formula || "");
  const m = f.match(/(\d+)d(\d+)/);
  if (!m) return f;
  if (!auto.tearing && !(auto.provenRating > 0)) return f;

  const n     = parseInt(m[1], 10);
  const faces = parseInt(m[2], 10);
  const dice  = auto.tearing ? n + 1 : n;
  let term = `${dice}d${faces}`;
  if (auto.provenRating > 0) term += `min${Math.min(auto.provenRating, faces)}`;
  if (auto.tearing)          term += `kh${n}`;
  return f.replace(/\d+d\d+/, term);
}

/** Порог заклинивания по числовой Надёжности. null → клина нет. */
export function jamThreshold(auto) {
  const s = auto.reliabilityScore || 0;
  if (s >=  2) return null;   // Очень надёжное — никогда
  if (s ===  1) return 100;   // Надёжное — только 100
  if (s ===  0) return null;  // обычное (без свойства) — клин не моделируется
  if (s === -1) return 91;    // Ненадёжное — 91+
  return 81;                  // Очень ненадёжное и хуже — 81+
}

// ─── Отображение в чате ───────────────────────────────────────────────────────

/** Подставляет рейтинги X/Y в текст напоминания. */
function fillRating(text, p) {
  let t = String(text || "");
  if (p.def.rating)  t = t.replace(/\bX\b/g, String(p.rating ?? 0));
  if (p.def.rating2) t = t.replace(/\bY\b/g, String(p.rating2 ?? 0));
  return t;
}

/** Блок «Свойства оружия» для сообщения о броске. */
export function buildPropertyChatBlock(props) {
  if (!props.length) return "";
  const lines = props.map(p => {
    const txt = fillRating(p.def.reminder || p.def.label, p);
    return `<div class="roll-wprop">${txt}</div>`;
  }).join("");
  // Свёрнуто по умолчанию: напоминалки по свойствам занимают половину карточки,
  // а нужны не каждый бросок. В заголовке — перечень свойств одной строкой.
  const names = props.map(p => fillRating(p.def.label, p)).join(", ");
  return `
    <details class="roll-collapsible roll-note-collapsible">
      <summary class="roll-section-head"><span class="roll-sum-title">Свойства оружия</span><span class="roll-sum-hint">${names}</span></summary>
      ${lines}
    </details>`;
}

// ─── Эффекты на цель (кнопки в чате) ───────────────────────────────────────────

/**
 * Кнопки «Применить эффект к цели» для свойств с auto.targetEffect.
 * onlyUnsoaked=true означает, что был непоглощённый урон (для Toxic/Rad).
 * Возвращает HTML или "".
 */
export function buildTargetEffectButtons(props, { hit, netDamageKnown = false, hadUnsoaked = false } = {}) {
  if (!hit) return "";
  const btns = [];

  for (const p of props) {
    const te = p.def.auto?.targetEffect;
    if (!te) continue;

    const r       = p.rating || 0;
    const testMod = (te.testMod ?? 0) + (te.testPerRating ? te.testPerRating * r : 0);

    // Особые «зональные» эффекты без per-target теста — выводим как заметку
    if (te.kind && te.kind !== "grav") {
      btns.push(`<div class="roll-wprop-note">${fillRating(p.def.reminder || p.def.label, p)}</div>`);
      continue;
    }
    if (!te.condition && te.kind !== "grav") continue;

    // Эффекты «при непоглощённом уроне» показываем кнопку только если урон прошёл
    if (te.onUnsoaked && netDamageKnown && !hadUnsoaked) continue;

    const data = [
      `data-wp-label="${p.def.label}"`,
      `data-wp-kind="${te.kind ?? ""}"`,
      `data-wp-condition="${te.condition ?? ""}"`,
      `data-wp-test-char="${te.testChar ?? ""}"`,
      `data-wp-test-mod="${testMod}"`,
      `data-wp-level-per-dop="${te.levelPerDoP ? 1 : 0}"`,
      `data-wp-rounds="${te.rounds ? 1 : 0}"`,
      `data-wp-fixed-rounds="${te.fixedRounds ?? 0}"`,
      `data-wp-damage="${te.damageFromRating ? (p.rating || "") : (te.damage ?? "")}"`
    ].join(" ");

    const testStr = te.testChar
      ? ` (тест ${te.testChar.toUpperCase()}${testMod >= 0 ? "+" : ""}${testMod})`
      : "";
    btns.push(
      `<button class="wh-wprop-apply-btn" type="button" ${data}>
        ${p.def.label}${testStr}
      </button>`
    );
  }

  if (!btns.length) return "";
  return `
    <div class="roll-wprop-effects">
      <div class="roll-section-head">Эффекты свойств <span class="roll-head-hint">— выберите токен цели</span></div>
      ${btns.join("")}
    </div>`;
}

// Состояние → поле уровня/раундов в system.conditions
export const CONDITION_LEVEL_FIELD = {
  stunned:        "stunnedRounds",
  blinded:        "blindedRounds",
  burning:        "burningLevel",
  radiation:      "radiationLevel",
  bleeding:       "bleedingLevel",
  fatigued:       "fatiguedLevel",
  haemorrhaging:  "haemorrhagingLevel"
  // poisoned, pinned, hallucinogenic, prone — без уровня (булевы)
};
