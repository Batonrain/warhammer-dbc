// module/rules/khorne-berserker.mjs
// ════════════════════════════════════════════════════════════════════════
//  Берсерк Кхорна (Элитный архетип, глава 3, Sahara 1-54b9) — чистая логика
//  без Foundry. Foundry-обвязка — combat/khorne-berserker.mjs.
//
//  Гвозди Мясника (Butcher's Nails): вне Ярости −10 на все Ментальные
//  действия и социальные взаимодействия — источник правил «khorneBerserker»
//  (область social — социальные навыки, power — манифестация психосилы);
//  в Ярости — Талант Hatred (Все!) — rules/predicates.mjs::hatredTargetsOf.
//
//  Ему Не Важно: +20 на Полную Атаку, пока кровоточит — прибавка к бонусу Базы
//  (rules/berserker-talents.mjs::meleeBaseBonus), потому что База выбирается в
//  окне атаки, а правила собираются раньше (см. шапку berserker-talents.mjs).
//
//  ── Почему файл ничего не импортирует из combat/ и flags.mjs ──
//  Он подключён к rules/sources.mjs (AGENTS.md, wdbc-795h): способность
//  опознаётся по имени предмета ИЛИ по ключу его записи Конструктора
//  (rules/item-marker.mjs), как в rules/plague-marine.mjs.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { itemHasKey } from "./item-marker.mjs";
import { isInRage } from "./rage.mjs";
import { baseIsFullAttack } from "./melee-base.mjs";

const NS = "warhammer-dbc";

export const NAILS_OFF_RAGE_PENALTY = -10;
export const NAILS_WP_BONUS = 10;

export const WRATH_ROUND_FLAG = "unstoppableWrath";
export const WRATH_DEATH_FLAG = "unstoppableWrathDeath";
export const WRATH_KEEP_BLEEDING = "bleeding";

export const FOR_HE_CARES_NOT_BONUS = 20;
export const FOR_HE_CARES_NOT_FLAG = "forHeCaresNotUsed";

export const SKULL_OFFERING_FLAG = "skullOffering";
export const SKULL_OFFERING_BONUS = 2;

export const BLOOD_OFFERING_FLAG = "bloodOffering";

export const TEMPERED_FLAG = "temperedInBlood";

export const RED_STREAK_DAMAGE = 1;

const hasAbility = (actor, key, name, type) =>
  [...(actor?.items ?? [])].some(i => i?.type === type && (itemHasName(i, name) || itemHasKey(i, key)));

export const hasButchersNails = actor => hasAbility(actor, "ability.butchersNails", "Butcher's Nails", "trait");
export const hasUnstoppableWrath = actor => hasAbility(actor, "ability.unstoppableWrath", "Unstoppable Wrath", "trait");
export const hasForHeCaresNot = actor => hasAbility(actor, "ability.forHeCaresNot", "For He Cares Not", "talent");
export const hasRedStreak = actor => hasAbility(actor, "ability.redStreak", "Red Streak", "talent");
export const hasPaintItRed = actor => hasAbility(actor, "ability.paintItRed", "Paint It Red", "talent");
export const hasTemperedInBlood = actor => hasAbility(actor, "ability.temperedInBlood", "Tempered in Blood", "talent");
export const hasBloodOffering = actor => hasAbility(actor, "ability.bloodOffering", "Blood Offering", "talent");
export const hasSkullOffering = actor => hasAbility(actor, "ability.skullOffering", "Skull Offering", "talent");

/** «Рукопашное оружие, наносящее R Dmg» (Красная Полоса, Окрась Всё в Красный, Кровавое Подношение, Закалённое в Крови). */
export function isRendingMelee(weapon) {
  const sys = weapon?.system ?? {};
  return sys.weaponClass === "melee" && sys.damageType === "rending";
}

/** Есть ли у актора в руках/на листе рукопашное оружие R Dmg (для Красной Полосы). */
export function hasRendingMeleeWeapon(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "weapon" && isRendingMelee(i) && i.system?.equipped !== false);
}

// ── Гвозди Мясника ────────────────────────────────────────────────────────

/**
 * Источник правил «khorneBerserker» (sources.mjs): вне Ярости носитель Гвоздей Мясника получает −10 на
 * социальные тесты и манифестацию. В Ярости — пусто (там свои запреты, rules/rage-behavior.mjs).
 */
export function khorneBerserkerRules(actor) {
  if (!hasButchersNails(actor) || isInRage(actor)) return [];
  const label = "🔩 Гвозди Мясника (вне Ярости)";
  return [{
    id: "khorne.nails.offRage",
    label: "Гвозди Мясника: вне Ярости −10 на Ментальные действия и социальные взаимодействия",
    when: {},
    effects: [
      { kind: "rollBonus", target: "social", value: NAILS_OFF_RAGE_PENALTY, label, auto: true },
      { kind: "rollBonus", target: "power", value: NAILS_OFF_RAGE_PENALTY, label, auto: true }
    ]
  }];
}

/** Гвозди Мясника заставляют каждую успешную манифестацию вызывать Прорыв: носитель — Псайкер. */
export function nailsForcePeril(actor) {
  return hasButchersNails(actor);
}

/** Порог теста «срыва» — W+10. */
export function nailsThreshold(wp, modsTotal = 0) {
  return (Number(wp) || 0) + NAILS_WP_BONUS + (Number(modsTotal) || 0);
}

/** Нужно ли предлагать тест срыва: носитель Гвоздей, ещё не в Ярости, в сознании. */
export function nailsTestNeeded(actor, netDamage = 1) {
  if (!(Number(netDamage) > 0)) return false;
  if (!hasButchersNails(actor) || isInRage(actor)) return false;
  const c = actor?.system?.conditions ?? {};
  return !(c.unconscious || actor?.getFlag?.(NS, "deceased"));
}

// ── Ему Не Важно ──────────────────────────────────────────────────────────

/** Кровоточит ли актор (Состояние «Кровотечение»). */
export function isBleeding(actor) {
  return !!actor?.system?.conditions?.bleeding;
}

/** +20 на Полную Атаку, пока Берсерк страдает от Кровотечения (прибавка к бонусу Базы). */
export function forHeCaresNotBonus(actor, baseKey) {
  if (!baseIsFullAttack(baseKey) || !hasForHeCaresNot(actor) || !isBleeding(actor)) return 0;
  return FOR_HE_CARES_NOT_BONUS;
}

/**
 * Доступна ли дополнительная Реакция «только на Яростный Штурм»: Талант есть, Берсерк кровоточит, ещё не потрачена
 * (флаг гаснет с началом следующего своего Хода, rules/turn-flags.mjs).
 */
export function extraFuriousReactionReady(actor) {
  return hasForHeCaresNot(actor) && isBleeding(actor) && !actor?.getFlag?.(NS, FOR_HE_CARES_NOT_FLAG);
}

// ── Неостановимый Гнев ────────────────────────────────────────────────────

/**
 * Какие кнопки блока Критического Эффекта Гнев НЕ гасит. «Но не Кровотечение» — пилюля Кровотечения остаётся;
 * Смерть игнорируется «только один раз за бой» — если этот раз уже потрачен, кнопки смерти остаются живыми.
 * @param {{deathIgnored:boolean}} o  true — Смерть этой карточки игнорируется (разовое право потрачено на ней)
 */
export function wrathKeeps(btn, { deathIgnored = false } = {}) {
  const ds = btn?.dataset ?? {};
  if (btn?.classList?.contains?.("wh-crit-apply-btn") && ds.condKey === WRATH_KEEP_BLEEDING) return true;
  if (btn?.classList?.contains?.("wh-crit-bleed-test-btn")) return true;
  if (!deathIgnored && (btn?.classList?.contains?.("wh-crit-death-btn") || btn?.classList?.contains?.("wh-shock-death-btn"))) return true;
  return false;
}

// ── Кровавое Подношение ───────────────────────────────────────────────────

/** Надбавка к урону следующего попадания: +½Cor.b (окр.▲). */
export function bloodOfferingDamage(corBonus) {
  return Math.ceil(Math.max(0, Number(corBonus) || 0) / 2);
}

/**
 * Метка после убийства: оружие, срок Cor.b Ходов владельца (минимум 1), бой. Убил в свой Ход (ownTurn) — этот Ход
 * не считается: «в течение Cor.b Ходов» идут следующие, а конец текущего сразу убавил бы срок.
 */
export function bloodOfferingMark({ weaponUuid, corBonus, combatId = "", ownTurn = false }) {
  return { weaponUuid, turnsLeft: Math.max(1, Math.floor(Number(corBonus) || 0)) + (ownTurn ? 1 : 0), combatId: combatId ?? "" };
}

/** Действует ли метка для этого оружия в этом бою. */
export function bloodOfferingActive(flag, weaponUuid, combatId = "") {
  return !!flag && !!weaponUuid && flag.weaponUuid === weaponUuid && (flag.combatId ?? "") === (combatId ?? "");
}

/** Конец Хода владельца: счётчик убывает, на нуле метка теряется (null). */
export function bloodOfferingTurnEnd(flag) {
  if (!flag) return null;
  const left = (Number(flag.turnsLeft) || 0) - 1;
  return left > 0 ? { ...flag, turnsLeft: left } : null;
}

// ── Подношение Черепов ────────────────────────────────────────────────────

/** Метка до конца боя. */
export const skullOfferingMark = (combatId = "") => ({ combatId: combatId ?? "" });

/** +2 Dmg на рукопашную атаку, пока метка действует в этом бою. */
export function skullOfferingBonus(actor, { isMelee, combatId = "" } = {}) {
  if (!isMelee || !hasSkullOffering(actor)) return 0;
  const flag = actor?.getFlag?.(NS, SKULL_OFFERING_FLAG);
  return flag && (flag.combatId ?? "") === (combatId ?? "") ? SKULL_OFFERING_BONUS : 0;
}

// ── Окрась Всё в Красный ──────────────────────────────────────────────────

/** Действует ли Талант на это оружие этого актора (рукопашное R Dmg). */
export function paintItRedApplies(actor, weapon) {
  return hasPaintItRed(actor) && isRendingMelee(weapon);
}

/**
 * «Если на любом кубике урона (даже отброшенном) выпало 8» — Экстремальный Урон. Кубы Roll: results с active=false
 * (отброшенные) тоже считаются.
 */
export function rolledEightOnAnyDie(dmgRoll) {
  for (const term of dmgRoll?.terms ?? []) {
    if (!term?.faces || !term?.results) continue;
    if (term.results.some(r => Number(r?.result) === 8)) return true;
  }
  return false;
}

/** «Критические Эффекты этим оружием всегда наносят Кровотечение» — нужна ли добавочная пилюля к списку. */
export function paintItRedNeedsBleedPill(pills) {
  return !(pills ?? []).some(p => p?.key === "bleeding" && !p?.formula);
}

// ── Закалённое в Крови ────────────────────────────────────────────────────

/** Метка боя: id оружия, нанёсшего ≥1 урона. */
export function temperedAdd(flag, weaponId, combatId = "") {
  const same = flag && (flag.combatId ?? "") === (combatId ?? "");
  const ids = same ? [...(flag.weaponIds ?? [])] : [];
  if (weaponId && !ids.includes(weaponId)) ids.push(weaponId);
  return { combatId: combatId ?? "", weaponIds: ids };
}

/** Есть ли у актора оружие с меткой «Закалённое» в этом бою (тогда выбить его нельзя). */
export function temperedWeaponHeld(actor, combatId = "") {
  if (!hasTemperedInBlood(actor)) return false;
  const flag = actor?.getFlag?.(NS, TEMPERED_FLAG);
  if (!flag || (flag.combatId ?? "") !== (combatId ?? "")) return false;
  const ids = new Set(flag.weaponIds ?? []);
  return [...(actor?.items ?? [])].some(i => ids.has(i?.id) && i.system?.equipped !== false);
}

/** Правило «нельзя выбить/вырвать» для Закалённого оружия — тем же ключом, что Инстинктивное и Присоски. */
export function temperedRules(actor, combatId = "") {
  if (!temperedWeaponHeld(actor, combatId)) return [];
  return [{
    id: "khorne.tempered.disarmImmune",
    label: "Закалённое в Крови: оружие нельзя выбить или вырвать из рук",
    when: {},
    effects: [{ kind: "grantFlag", target: "combat.cannotBeDisarmed" }]
  }];
}
