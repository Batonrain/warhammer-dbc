// module/rules/rogue-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ РАЗБОЙНИКА (глава 3, группа «Разбойник») — чистая логика (задача
//  Sahara 3-bfbf; решения владельца 24.10.2026). Уже были: Backstab, Blindside,
//  Knife Fighter (rules/unseen-talents.mjs, combat/attack.mjs).
//
//    Sabotage / Саботаж              — цель «Оружие» в прицеле Избирательной атаки ножом
//    Close Quarters / Бой Вплотную   — враги, начавшие Ход в контакте: без бонуса длины, −10 при Rng>2
//    Razor's Edge / На Лезвии Бритвы — +разница Инициатив к Dmg ножа (до +10); Избегание — по Успехам
//    Coup de Grace / Ку де Гра       — ×2 урона по сочленениям/глазам Оглушённой или Лежащей цели
//    Street Fighting / Уличный Боец  — +½WS.b (макс. +5) к Критическому Эффекту ножа/кулаков
//    Blade Juggler / Жонглёр Клинком — метка «штраф Успехи×5 на Избегание следующей атаки ножом»
//
//  Талант опознаётся по имени предмета ИЛИ по записи Конструктора
//  kind:"capability" (rules/pugilist-talents.mjs::holdsCapability) — тем же
//  приёмом, что Таланты Пугилиста. Файл НЕ импортирует sources.mjs/collect.mjs
//  (AGENTS.md → «Источники правил»: круг вешает загрузку модулей).
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";
import { holdsCapability } from "./pugilist-talents.mjs";
import { weaponTechClass } from "./null-zones.mjs";
import { hasCompactMod } from "./runt.mjs";
import { currentMeleeGrip } from "./hands.mjs";
import { isKnifeWeapon } from "./unseen-talents.mjs";

const NS = "warhammer-dbc";

/** Короткий ключ → { ключ Возможности (constants/capabilities.mjs), имя Таланта }. */
export const ROGUE_TALENTS = {
  sabotage:      { key: "rogue.core.sabotage",      name: "Sabotage" },
  closeQuarters: { key: "rogue.core.closeQuarters", name: "Close Quarters" },
  razorsEdge:    { key: "rogue.core.razorSEdge",    name: "Razor's Edge" },
  coupDeGrace:   { key: "rogue.core.coupDeGrace",   name: "Coup de Grace" },
  streetFighting:{ key: "rogue.core.streetFighting",name: "Street Fighting" },
  bladeJuggler:  { key: "rogue.core.bladeJuggler",  name: "Blade Juggler" }
};

/** Есть ли у актора этот Талант Разбойника (по имени предмета ИЛИ по ключу Возможности). */
export function hasRogueTalent(actor, id) {
  const t = ROGUE_TALENTS[id];
  if (!t) return false;
  if (actor?.items?.some?.(i => i?.type === "talent" && itemHasName(i, t.name))) return true;
  return holdsCapability(actor, t.key);
}

/** Кулаки: рукопашное «Кулаки» или безоружный удар кулаком (интегральная атака с Хватом «Кист»). */
export function isFistWeapon(weapon) {
  if (!weapon) return false;
  if (String(weapon.system?.meleeCategory ?? "") === "Кулаки") return true;
  return !!weapon.getFlag?.(NS, "integralAttack") && /Кист/.test(String(weapon.system?.grips ?? ""));
}

// ── Инициатива (На Лезвии Бритвы) ───────────────────────────────────────────

/**
 * Инициатива актора: брошенная в активном бою (Combatant), а без боя — хранимая
 * system.initiative. Сравниваются ОДНОИМЁННЫЕ величины: если у одного из двоих
 * брошенной нет, берутся хранимые у обоих.
 */
export function initiativePair(attacker, defender) {
  const combatants = [...(globalThis.game?.combat?.combatants ?? [])];
  const rolled = a => {
    // Несвязанные копии одного NPC делят actorId базового актора: ищем по самому актору/токену,
    // а по actorId — только для связанных (иначе Инициатива берётся у первой копии).
    const tokenId = a?.token?.id ?? a?.token?.document?.id ?? null;
    const c = combatants.find(x => x?.actor === a || (tokenId && x?.tokenId === tokenId))
      ?? (a?.isToken ? null : combatants.find(x => (x?.actorId ?? x?.actor?.id) === a?.id));
    const v = Number(c?.initiative);
    return c && Number.isFinite(v) ? v : null;
  };
  const ra = rolled(attacker), rd = rolled(defender);
  if (ra !== null && rd !== null) return { attacker: ra, defender: rd };
  return { attacker: Number(attacker?.system?.initiative) || 0, defender: Number(defender?.system?.initiative) || 0 };
}

/**
 * «Если его Инициатива выше, чем у цели, при использовании ножей персонаж
 * добавляет разницу в Инициативе к Dmg, до максимума в +10.» 0 — условия нет.
 * Бонус идёт в плоскую прибавку урона и в Пробитие не попадает (книга: «не
 * учитывается в расчете пробития брони» — Пробитие в системе считается отдельно).
 */
export function razorsEdgeBonus(actor, weapon, defender) {
  if (!defender || !isKnifeWeapon(weapon) || !hasRogueTalent(actor, "razorsEdge")) return 0;
  const { attacker, defender: d } = initiativePair(actor, defender);
  return Math.max(0, Math.min(10, attacker - d));
}

/**
 * «При попытках Избегать одиночных ударов его ножа, более медленная цель должна
 * перебить все его Успехи на попадание, как если бы она получила столько
 * попаданий.» Сколько «попаданий» учесть Избеганию вместо одного: Успехи
 * атаки. null — правило не действует (не нож, не быстрее, очередь) или Успехов
 * меньше двух (разницы с обычным Избеганием нет).
 */
export function razorsEdgeEvasionHits(actor, weapon, defender, { hitsCount = 1, deg = 0 } = {}) {
  if (hitsCount !== 1 || !defender || !isKnifeWeapon(weapon) || !hasRogueTalent(actor, "razorsEdge")) return null;
  const { attacker, defender: d } = initiativePair(actor, defender);
  if (!(attacker > d)) return null;
  const n = Math.floor(Number(deg) || 0);
  return n >= 2 ? n : null;   // 0-1 Успех: одно попадание, как обычно
}

// ── Бой Вплотную ────────────────────────────────────────────────────────────

const CQ_MELEE = new Set(["Нож", "Кулаки", "Когти"]);

/**
 * «Если персонаж вооружен ножом, кулаками, когтями и/или пистолетом или любой их
 * комбинацией» — все его экипированные настоящие (не интегральные) оружия
 * подходят; безоружный (только интегральные атаки) — это кулаки/когти.
 */
export function closeQuartersArmed(actor) {
  const held = (actor?.items ?? []).filter(i => i?.type === "weapon" && i.system?.equipped
    && !i.getFlag?.(NS, "integralAttack"));
  return held.every(i => i.system?.weaponClass === "pistol"
    || (i.system?.weaponClass === "melee" && CQ_MELEE.has(String(i.system?.meleeCategory ?? ""))));
}

/**
 * Поправка к тесту противника по носителю Таланта (строка-галочка окна атаки):
 * −10, если у оружия противника Rng больше 2, и −5, снимающие автоматический
 * бонус «более длинное оружие» (+5). 0 — строка не нужна. Условие «начал свой
 * Ход в рукопашном бою с персонажем» система не определяет — это галочка (по
 * умолчанию снята), как решил владелец.
 * @param {object} defender    цель атаки (носитель Таланта)
 * @param {number} attackerRng действующий Rng оружия нападающего
 * @param {boolean} longerBonus стоит ли у нападающего бонус за более длинное оружие
 * @returns {{value:number, penalty:number, lengthCancel:number}}
 */
export function closeQuartersMod(defender, attackerRng, longerBonus) {
  if (!defender || !hasRogueTalent(defender, "closeQuarters") || !closeQuartersArmed(defender)) {
    return { value: 0, penalty: 0, lengthCancel: 0 };
  }
  const penalty = (Number(attackerRng) || 0) > 2 ? -10 : 0;
  const lengthCancel = longerBonus ? -5 : 0;
  return { value: penalty + lengthCancel, penalty, lengthCancel };
}

// ── Ку де Гра ───────────────────────────────────────────────────────────────

/**
 * «Когда он вооружен ножом в любом хвате, или мечом или копьем в Ближнем Хвате,
 * и попадает по сочленениям или глазам цели, которая Оглушена или Лежит, урон
 * этой атаки удваивается, как если бы цель была Беспомощной.»
 * @param {string} aimValue значение цели прицела окна атаки ("joint" | "eye" | …)
 */
export function coupDeGraceActive({ actor, weapon, gripKey, aimValue, targetActor, isMelee = true }) {
  if (!isMelee || !hasRogueTalent(actor, "coupDeGrace")) return false;
  if (aimValue !== "joint" && aimValue !== "eye") return false;
  const c = targetActor?.system?.conditions ?? {};
  if (!c.stunned && !c.prone) return false;
  if (isKnifeWeapon(weapon)) return true;
  const cat = String(weapon?.system?.meleeCategory ?? "");
  if (cat !== "Меч" && cat !== "Копьё") return false;
  return (gripKey || currentMeleeGrip(weapon)) === "Бл";
}

// ── Уличный Боец ────────────────────────────────────────────────────────────

/**
 * «Когда персонаж наносит Критические Эффекты ножом или кулаками, будь то от
 * Отрицательных Ран или Экстремального Урона, он увеличивает Критический Эффект
 * на ½WS.b (окр.▲) (максимум +5).» Общий примитив «плоская прибавка к уровню
 * Критического Эффекта»: звать там, где уровень идёт в getCriticalEffect.
 */
export function criticalEffectFlatBonus(actor, weapon) {
  if (!weapon || !(isKnifeWeapon(weapon) || isFistWeapon(weapon))) return 0;
  if (!hasRogueTalent(actor, "streetFighting")) return 0;
  const wsb = Number(actor?.system?.characteristics?.ws?.bonus) || 0;
  return Math.max(0, Math.min(5, Math.ceil(wsb / 2)));
}

// ── Саботаж ─────────────────────────────────────────────────────────────────

/** Префикс значения цели прицела: "weapon:<id оружия цели>". */
export const SABOTAGE_AIM_PREFIX = "weapon:";

/** Оружие цели, пригодное для Саботажа: экипированное настоящее (не интегральное). */
function sabotageCandidates(defender) {
  return (defender?.items ?? []).filter(i => i?.type === "weapon" && i.system?.equipped
    && !i.getFlag?.(NS, "integralAttack")
    && ["basic", "ranged", "heavy", "launcher", "pistol", "melee"].includes(i.system?.weaponClass));
}

/**
 * Штраф Избирательной атаки по оружию (по классу оружия ЦЕЛИ):
 *   −10 тяжёлое; −20 винтовки и рукопашное с Хватом П+Л; −30 пистолеты и рукопашное;
 *   −40 ножи и компактные пистолеты (пистолет с модификацией Compact).
 * Питание проводами (+20) не моделируется (решение владельца).
 */
export function sabotagePenalty(owner, weapon) {
  const cls = weapon?.system?.weaponClass;
  if (cls === "heavy" || cls === "launcher") return -10;
  if (cls === "basic" || cls === "ranged") return -20;
  if (cls === "pistol") return hasCompactMod(owner, weapon) ? -40 : -30;
  if (cls === "melee") {
    if (String(weapon.system?.meleeCategory ?? "") === "Нож") return -40;
    if (currentMeleeGrip(weapon) === "П+Л") return -20;
    return -30;
  }
  return 0;
}

/** Что Саботаж делает с оружием: стрелковое — Клинит; высокотехнологичное (электрическое) рукопашное — отключает; прочее — ничего. */
export function sabotageEffectKind(weapon) {
  if (!weapon) return "none";
  if (weapon.system?.weaponClass === "melee") return weaponTechClass(weapon) === "electric" ? "disable" : "none";
  return "jam";
}

/**
 * Строки прицела для окна атаки: по одной на экипированное оружие цели. Пусто,
 * пока у атакующего нет Таланта, оружие — не нож в рукопашной или цели нечем
 * (нет оружия).
 */
export function sabotageAimEntries(actor, weapon, defender, { isMelee = true } = {}) {
  if (!isMelee || !defender || !isKnifeWeapon(weapon) || !hasRogueTalent(actor, "sabotage")) return [];
  return sabotageCandidates(defender).map(w => ({
    value: `${SABOTAGE_AIM_PREFIX}${w.id}`,
    // Штраф вписан в подпись: имя оружия часто содержит скобки, и окно тогда не дописывает его само.
    label: `Оружие цели: ${w.name} (${sabotagePenalty(defender, w)})`,
    penalty: sabotagePenalty(defender, w),
    sabotage: true
  }));
}

/** Это цель прицела «Оружие»? */
export function isSabotageAim(aimTarget) {
  return typeof aimTarget?.value === "string" && aimTarget.value.startsWith(SABOTAGE_AIM_PREFIX);
}

/** Оружие цели, на которое указывает цель прицела. */
export function sabotageWeaponOf(aimTarget, defender) {
  if (!isSabotageAim(aimTarget)) return null;
  const id = aimTarget.value.slice(SABOTAGE_AIM_PREFIX.length);
  return sabotageCandidates(defender).find(w => w.id === id) ?? null;
}

/**
 * Комбинированное оружие: есть и рукопашный профиль (или класс «melee»), и
 * стрелковый ствол. Выбор — «саботировать либо ВСЕ рукопашные профили, либо ОДИН
 * из стрелковых». Пусто для обычного оружия.
 */
export function sabotageProfileChoices(weapon) {
  const profiles = Array.isArray(weapon?.system?.profiles) ? weapon.system.profiles : [];
  const meleeProfiles = profiles.filter(p => p?.melee);
  const barrels = profiles.map((p, i) => ({ p, i })).filter(({ p }) => p?.ownFire);
  const baseIsMelee = weapon?.system?.weaponClass === "melee";
  const hasMelee = baseIsMelee || meleeProfiles.length > 0;
  const rangedBarrels = [];
  if (!baseIsMelee) rangedBarrels.push({ key: "base", label: weapon?.name ?? "основной ствол", kind: "jam" });
  for (const { p, i } of barrels) rangedBarrels.push({ key: `fire:${i}`, label: p.label || `ствол ${i + 1}`, kind: "jam" });
  if (!hasMelee || !rangedBarrels.length) return [];
  return [
    { key: "melee", label: "Все рукопашные профили", kind: sabotageEffectKindForMelee(weapon) },
    ...rangedBarrels
  ];
}

function sabotageEffectKindForMelee(weapon) {
  return weaponTechClass(weapon) === "electric" ? "disable" : "none";
}

// ── Жонглёр Клинком ─────────────────────────────────────────────────────────

/** Метка на носителе: { targetUuid, penalty } — штраф на Избегания цели от следующей атаки ножом. */
export const BLADE_JUGGLER_MARK_FLAG = "bladeJugglerMark";
/** «Раз в Ход». */
export const BLADE_JUGGLER_USE_FLAG = "bladeJugglerUsedThisTurn";

/**
 * Штраф цели: «Успехи×5» (Успехи победы во встречном тесте), положительное число
 * очков; на тест Избегания он ложится со знаком минус.
 */
export function bladeJugglerPenalty(margin) {
  return Math.max(0, Math.floor(Number(margin) || 0)) * 5;
}

/** Метка действует на эту цель (штраф к её Избеганию)? Возвращает величину штрафа (положительную) или 0. */
export function bladeJugglerMarkAgainst(actor, targetUuid) {
  const mark = actor?.getFlag?.(NS, BLADE_JUGGLER_MARK_FLAG);
  return mark && targetUuid && mark.targetUuid === targetUuid ? (Number(mark.penalty) || 0) : 0;
}

export async function markBladeJuggler(actor, targetUuid, penalty) {
  await actor.setFlag(NS, BLADE_JUGGLER_MARK_FLAG, { targetUuid, penalty });
}

export async function consumeBladeJugglerMark(actor) {
  if (actor?.getFlag?.(NS, BLADE_JUGGLER_MARK_FLAG)) await actor.unsetFlag(NS, BLADE_JUGGLER_MARK_FLAG);
}

export function bladeJugglerUsedThisTurn(actor) {
  return !!actor?.getFlag?.(NS, BLADE_JUGGLER_USE_FLAG);
}

/** Начало Хода носителя: метка и гейт «раз в Ход» снимаются («от его следующей атаки ножом В ЭТОТ ХОД»). */
export async function clearBladeJuggler(actor) {
  if (actor?.getFlag?.(NS, BLADE_JUGGLER_USE_FLAG)) await actor.unsetFlag(NS, BLADE_JUGGLER_USE_FLAG);
  if (actor?.getFlag?.(NS, BLADE_JUGGLER_MARK_FLAG)) await actor.unsetFlag(NS, BLADE_JUGGLER_MARK_FLAG);
}
