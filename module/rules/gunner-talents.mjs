// module/rules/gunner-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ «СТРЕЛКА» главы 3 — чистые функции (Sahara 3-5fbf). Бросков,
//  Foundry и листа здесь нет: актор, оружие и числа приходят аргументами.
//  Читатели — combat/attack.mjs, combat/damage.mjs, sheets/attack-dialog.mjs,
//  sheets/attack/*.mjs.
//
//  Опознание Таланта — развилка «имя ИЛИ ключ» (hasAbility): предметы на
//  акторах — снимки («ловушка Desiccated», 3-861e).
//
//  Модуль НЕ импортируется из rules/sources.mjs и ничего не регистрирует —
//  круга через source-registry нет (AGENTS.md, «Источники правил»).
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";
import { hasDamageTalent } from "./damage-talents.mjs";

export const GUNNER_TALENTS = Object.freeze({
  crackShot:     { key: "rangedCore.core.crackShot",     name: "Crack Shot" },
  deadeyeShot:   { key: "rangedCore.core.deadeyeShot",   name: "Deadeye Shot" },
  sharpshooter:  { key: "rangedCore.core.sharpshooter",  name: "Sharpshooter" },
  doubleTap:     { key: "rangedCore.core.doubleTap",     name: "Double Tap" },
  appliedPhysics:{ key: "rangedCore.core.appliedPhysics", name: "Applied Physics" },
  onThisMark:    { key: "rangedCore.core.onThisMark",    name: "On This Mark" },
  sureShot:      { key: "rangedCore.core.sureShot",      name: "Sure Shot" },
  eyeOfVengeance:{ key: "rangedCore.core.eyeOfVengeance", name: "Eye of Vengeance" },
  controlledBurst:{ key: "rangedCore.core.controlledBurst", name: "Controlled Burst" },
  cageFiring:    { key: "rangedCore.core.cageFiring",    name: "Cage Firing" },
  chamberIn:     { key: "rangedCore.core.chamberIn",     name: "Chamber In" },
  saturationFire:{ key: "rangedCore.core.saturationFire", name: "Saturation Fire" },
  fireThreat:    { key: "rangedCore.core.fireThreat",    name: "Fire Threat" },
  hipShooting:   { key: "rangedCore.core.hipShooting",   name: "Hip Shooting" },
  drawFire:      { key: "rangedCore.core.drawFire",      name: "Draw Fire" },
  coveringFire:  { key: "rangedCore.core.coveringFire",  name: "Covering Fire" }
});

/** Есть ли у актора Талант из списка выше (по имени или по ключу). */
export function hasGunnerTalent(actor, id) {
  const t = GUNNER_TALENTS[id];
  return !!t && hasAbility(actor, t.key, t.name, "talent");
}

// ── Отрицательные Раны (общий примитив) ─────────────────────────────────────

/**
 * Пробивной Удар (core.json, «Стрелок»): «Когда его стрелковая атака наносит
 * Отрицательные Раны, она получает +2 к Dmg». Тот же примитив нужен Калечащему
 * Удару («Рукопашные», 3-8dc5), поэтому величина прибавки едет на попадании
 * отдельным числом (`negWoundsBonus`), а не зашита в слове «стрелковая».
 *
 * Здесь — только «чей Талант и какая атака»: 2 для стрелка с Талантом,
 * иначе 0. Решение «ушли ли Раны в минус» — negativeWoundsBonus ниже, при
 * применении урона (цель и её Раны становятся известны только там).
 */
export function crackShotBonus(actor, { isMelee }) {
  return !isMelee && hasGunnerTalent(actor, "crackShot") ? 2 : 0;
}

/**
 * Калечащий Удар (core.json, «Рукопашные», 3-8dc5): «Когда рукопашная атака
 * персонажа наносит Отрицательные Раны, она получает +2 к Dmg». Тот же
 * примитив, что у Пробивного Удара (negWoundsBonus на попадании + решение
 * negativeWoundsBonus при применении урона), только для рукопашной атаки.
 */
export function cripplingStrikeBonus(actor, { isMelee }) {
  return isMelee && hasDamageTalent(actor, "cripplingStrike") ? 2 : 0;
}

/**
 * Прибавка к непоглощённому урону попадания, которое уводит Раны цели в минус.
 *
 * «Наносит Отрицательные Раны» = непоглощённый урон больше текущих Ран цели
 * (остаток уходит в Критические; woundLossAfter). Если Раны уже на нуле, любое
 * непоглощённое попадание тоже наносит отрицательные. Прибавка идёт к урону,
 * поэтому к Критическим добавляется целиком.
 *
 * @param {{net:number, value:number, bonus:number}} p
 *   net — непоглощённый урон; value — текущие Раны цели; bonus — величина (2).
 * @returns {number} сколько прибавить к net (0, если Раны остаются неотрицательными)
 */
export function negativeWoundsBonus({ net, value, bonus }) {
  const n = Number(net) || 0, b = Number(bonus) || 0;
  if (b <= 0 || n <= 0) return 0;
  return n > (Number(value) || 0) ? b : 0;
}

// ── Избирательная атака: В Яблочко / Меткий Стрелок ─────────────────────────

/**
 * В Яблочко (+10) и Меткий Стрелок (ещё +10) уменьшают штраф СТРЕЛКОВОЙ
 * Избирательной атаки (core.json, «Стрелок»). Половина про Размер цели —
 * правила core.deadeyeSize/core.sharpshooterSize (rules/library/core.mjs).
 * @returns {number} 0, 10 или 20
 */
export function selectiveAimReduction(actor, { isMelee }) {
  // Верный Удар / Выверенный Удар («Рукопашные», 3-8dc5): тот же шаг −10, но
  // для рукопашной атаки; Выверенный Удар требует Верного, поэтому вместе −20.
  if (isMelee) return (hasDamageTalent(actor, "sureStrike") ? 10 : 0) + (hasDamageTalent(actor, "preciseBlow") ? 10 : 0);
  return (hasGunnerTalent(actor, "deadeyeShot") ? 10 : 0) + (hasGunnerTalent(actor, "sharpshooter") ? 10 : 0);
}

/** Штраф после скидки: штраф (≤ 0) уменьшается, но выше нуля не поднимается. */
export function reducedAimPenalty(penalty, reduction) {
  const p = Number(penalty) || 0;
  return p < 0 ? Math.min(0, p + (Number(reduction) || 0)) : p;
}

// ── Двойной Выстрел ─────────────────────────────────────────────────────────

/** Есть ли смысл предлагать галочку: стрелковое оружие с Очередью и Талант. */
export function doubleTapAvailable(actor, { isMelee, sys }) {
  if (isMelee || !hasGunnerTalent(actor, "doubleTap")) return false;
  return (Number(sys?.rof_semi) || 0) > 0 || (Number(sys?.rof_full) || 0) > 0;
}

/**
 * Двойной Выстрел (core.json, «Стрелок»): «Когда он совершает любую
 * не-Избирательную очередь, он может выбрать нанести первое успешное попадание
 * (после Избеганий) в торс а второе — в голову, но все дальнейшие пролетают над
 * целью и считаются промахами». Трактовка владельца 24.10.2026 (А): порядок
 * жёстко ДО Избеганий — i-е попадание карточки: 0 → Торс, 1 → Голова, дальше
 * отбрасываются; если Уклонение снимет попадания, порядок «торс, голова»
 * остаётся за оставшимися (строка в карточке).
 */
export function doubleTapActive(actor, { opts, isMelee, rofMode, aimValue, targetIsVehicle }) {
  return !!opts?.doubleTap && !isMelee && !targetIsVehicle && !aimValue
    && (rofMode === "semi" || rofMode === "full") && hasGunnerTalent(actor, "doubleTap");
}

/** Место i-го попадания при Двойном Выстреле. */
export const doubleTapLocation = i => (i === 0 ? "Торс" : "Голова");

/** Сколько попаданий остаётся: не больше двух. */
export const doubleTapHits = n => Math.min(Number(n) || 0, 2);

// ── Прикладная Физика ───────────────────────────────────────────────────────

/**
 * Прикладная Физика (core.json, «Стрелок»): «Когда он попадает из оружия со
 * свойством Blast, после Избеганий от этого попадания персонаж может сместить
 * шаблон взрыва на до ½ BS.b (окр.▲) м. Цели, что уже Уклонились от взрыва,
 * могут продолжать Уклоняться от него, если у них хватает SPD».
 *
 * Решение владельца 24.10.2026: система только подсказывает предел сдвига на
 * карточке; повторных Избеганий не считает. Возвращает метры (0 — не применимо).
 */
export function appliedPhysicsShift(actor, { blastRating, bsBonus }) {
  if (!((Number(blastRating) || 0) > 0) || !hasGunnerTalent(actor, "appliedPhysics")) return 0;
  return Math.ceil((Number(bsBonus) || 0) / 2);
}

// ── По Этим Координатам ─────────────────────────────────────────────────────

/**
 * По Этим Координатам (core.json, «Стрелок»): персонаж «может без штрафов
 * стрелять по целям, которых он не видит», если засёк их только по координатам
 * (ауспекс, Mind Radiance) или получает изображение от союзника. «Эти выстрелы
 * не могут быть Избирательными или получать преимущества Прицеливания».
 *
 * Решение владельца 24.10.2026: система только запрещает Избирательную атаку и
 * Прицеливание при включённой галочке «по координатам» и подсказывает; никаких
 * штрафов за невидимость в системе не снимается (их нет).
 */
export function onThisMarkActive(actor, { opts, isMelee }) {
  return !!opts?.onThisMark && !isMelee && hasGunnerTalent(actor, "onThisMark");
}

/** Есть ли у носителя Таланта смысл показывать галочку. */
export function onThisMarkAvailable(actor, { isMelee }) {
  return !isMelee && hasGunnerTalent(actor, "onThisMark");
}

// ── Верный Выстрел ──────────────────────────────────────────────────────────

/**
 * Верный Выстрел (core.json, «Стрелок»): «После успешного одиночного выстрела
 * персонаж может выбрать потратить 1 Очко Бесчестия, чтобы противник получил
 * штраф –10 за каждый Успех на попадание на все броски Избегания против этого
 * выстрела». Галочка окна атаки (toggles.sureShot); трата Очка — при успехе.
 */
export function sureShotApplies(actor, { toggles, isMelee, rofMode, hit }) {
  return !!toggles?.sureShot && !isMelee && rofMode === "single" && !!hit && hasGunnerTalent(actor, "sureShot");
}

/** Штраф Избеганию цели: −10 за каждый Успех на попадание. */
export const sureShotDodgePenalty = deg => (Math.max(0, Number(deg) || 0) ? -10 * Number(deg) : 0);

// ── Око Мщения ──────────────────────────────────────────────────────────────

/** Флаг актора: id оружия, усиленного Оком Мщения «до конца Хода» (rules/turn-flags.mjs). */
export const EYE_OF_VENGEANCE_FLAG = "eyeOfVengeanceWeapon";

/**
 * Око Мщения (core.json, «Стрелок»): «Он может потратить 1 Очко Бесчестия,
 * чтобы добавить Inf.b к Dmg и Pen одного стрелкового оружия до конца Хода».
 * Бонус = Inf.b носителя Таланта, только стрелковому оружию, которое усилено
 * (флаг на акторе хранит id этого оружия).
 */
export function eyeOfVengeanceBonus(actor, { item, isMelee, activeWeaponId }) {
  if (isMelee || !item?.id || activeWeaponId !== item.id || !hasGunnerTalent(actor, "eyeOfVengeance")) return 0;
  return Math.max(0, Number(actor?.system?.characteristics?.inf?.bonus) || 0);
}

/** Можно ли включить Око Мщения этим оружием сейчас (Талант, стрелковое). */
export function eyeOfVengeanceAvailable(actor, { isMelee }) {
  return !isMelee && hasGunnerTalent(actor, "eyeOfVengeance");
}

// ── Контролируемая Очередь ──────────────────────────────────────────────────

/**
 * Контролируемая Очередь (core.json, «Стрелок»): «После Короткой или Длинной
 * очереди (но не Широкой или Подавления) он может уменьшить расчётный RoF
 * оружия вплоть до половины (окр.▲) настоящего, но не меньше количества
 * попаданий +1 (без учёта бонусных попаданий от свойств оружия)». Расчётный
 * RoF в системе — это расход патронов очереди.
 *
 * @param {{rof:number, hits:number}} p  rof — настоящий RoF режима; hits — попадания без бонусных
 * @returns {number} расчётный RoF (не больше настоящего)
 */
export function controlledBurstRof({ rof, hits }) {
  const r = Math.max(0, Number(rof) || 0);
  const floor = Math.max(Math.ceil(r / 2), (Number(hits) || 0) + 1);
  return Math.min(r, floor);
}

export function controlledBurstApplies(actor, { toggles, isMelee, rofMode, wideBurst }) {
  return !!toggles?.controlledBurst && !isMelee && !wideBurst && (rofMode === "semi" || rofMode === "full")
    && hasGunnerTalent(actor, "controlledBurst");
}

// ── Огневая Клеть ───────────────────────────────────────────────────────────

/**
 * Огневая Клеть (core.json, «Стрелок»): «Когда он совершает Широкую Длинную
 * Очередь по одиночной цели, он может уменьшить эффективный RoF еще на 3, но
 * тогда цель должна тратить вдвое больше Успехов для Уклонения от этой атаки».
 * Галочка окна; «по одиночной цели» решает стрелок.
 */
export function cageFiringApplies(actor, { toggles, isMelee, rofMode, wideBurst }) {
  return !!toggles?.cageFiring && !isMelee && !!wideBurst && rofMode === "full" && hasGunnerTalent(actor, "cageFiring");
}

/** Во сколько раз дороже Успехами Уклонение цели от атаки Клетью. */
export const CAGE_FIRING_EVADE_COST = 2;

// ── Досылание ───────────────────────────────────────────────────────────────

/** Метка актора «досылал в этом Ходу» (rules/turn-flags.mjs). */
export const CHAMBER_IN_FLAG = "chamberInThisTurn";

/** Оружие, заряжаемое отдельными патронами (не топливом и не батареями). */
const CHAMBER_IN_TYPES = new Set(["bolt", "solid", "primitive", "lowtech", "needler", "launcher", "rocket", "explosive", "shuriken", "splinter", "acid"]);

export function chamberInAvailable(actor, weapon) {
  return weapon?.type === "weapon" && CHAMBER_IN_TYPES.has(weapon.system?.weaponType)
    && ["pistol", "basic"].includes(weapon.system?.weaponClass) && hasGunnerTalent(actor, "chamberIn");
}

/**
 * Досылание (core.json, «Стрелок»): «Когда он держит винтовку или длинную
 * винтовку двумя руками или вооружен пистолетом и имеет свободную руку, он
 * может раз в Ход свободным действием зарядить в это оружие один патрон, но
 * только со своего бандольера или пояса. Этот Талант не работает с оружием,
 * что заряжается топливом или батареями».
 *
 * Решение владельца 24.10.2026: «+1 патрон в магазин», запас магазинов не
 * уменьшается. Возвращает причину отказа или "" (можно).
 */
export function chamberInBlockReason(weapon, { handsNeeded, freeHands, usedThisTurn, magazineCur, magazineMax, modBlocked = false }) {
  if (modBlocked) return "модификация Буллпап запрещает Досылание";
  if (usedThisTurn) return "уже досылали патрон в этом Ходу";
  if ((Number(magazineMax) || 0) <= 0 || (Number(magazineCur) || 0) >= Number(magazineMax)) return "магазин уже полон";
  const cls = weapon?.system?.weaponClass;
  if (cls === "basic" && (Number(handsNeeded) || 0) < 2) return "винтовку нужно держать двумя руками";
  if (cls === "pistol" && (Number(freeHands) || 0) < 1) return "для пистолета нужна свободная рука";
  return "";
}

// ── Стрельба на Насыщение ───────────────────────────────────────────────────

/**
 * Стрельба на Насыщение (core.json, «Стрелок»): «Когда персонаж совершает
 * длинную или короткую очередь, половина выстрелов в очереди, что не попала в
 * цель (окр.▲), вместо этого попадает в укрытие цели или другое укрытие в 2м
 * от основной цели по выбору персонажа…».
 *
 * Решение владельца 24.10.2026: только укрытие ЦЕЛИ. Система показывает
 * строку «выстрелов в укрытие: N, AP укрытия −N» и подсказку ГМу; сам износ
 * укрытия (1 AP за выстрел, если урон выше его AP — damage.mjs) ведёт ГМ.
 * Подавление книга тоже называет («каждый промах повреждает укрытие в области
 * подавления») — здесь не считается.
 *
 * @param {{rof:number, hits:number}} p  rof — потенциальные выстрелы очереди; hits — попадания
 * @returns {number} выстрелов в укрытие (0 — нечего показывать)
 */
export function saturationFireCoverShots(actor, { rofMode, isMelee, rof, hits }) {
  if (isMelee || (rofMode !== "semi" && rofMode !== "full") || !hasGunnerTalent(actor, "saturationFire")) return 0;
  const misses = Math.max(0, (Number(rof) || 0) - (Number(hits) || 0));
  return Math.ceil(misses / 2);
}

// ── Огневая Угроза ──────────────────────────────────────────────────────────

/**
 * Огневая Угроза (core.json, «Стрелок»): «Когда он вооружен стрелковым
 * оружием, кроме длинной винтовки и тяжелого, персонаж может проводить
 * Давление, используя BS вместо WS, но тогда он не сможет последовать за
 * целью, если успешно заставит ее подвигаться».
 *
 * Возвращает подходящее экипированное оружие (Пистолет/Ручное без longRifle)
 * или null, если Таланта нет или такого оружия в руках нет.
 */
export function fireThreatWeapon(actor) {
  if (!hasGunnerTalent(actor, "fireThreat")) return null;
  const isLongRifle = w => (w.system?.weaponProps ?? []).some(p => (p?.key ?? p) === "longRifle");
  return [...(actor?.items ?? [])].find(i => i.type === "weapon" && i.system?.equipped
    && (i.system?.weaponClass === "pistol" || i.system?.weaponClass === "basic") && !isLongRifle(i)) ?? null;
}

// ── Бесплатные одиночные выстрелы: Стрельба от Бедра и Огонь с Вытягивания ───

/** Метка актора: Полное Движение «от бедра» объявлено, выстрел ещё не сделан (rules/turn-flags.mjs). */
export const HIP_SHOOTING_FLAG = "hipShootingPending";
/** Ключ «раз в Раунд» (apps/game-session.mjs::isRoundCapabilityAvailable) для Огня с Вытягивания. */
export const DRAW_FIRE_ROUND_FLAG = "drawFire";

const hasProp = (item, key) => (item?.system?.weaponProps ?? []).some(p => (p?.key ?? p) === key);

/**
 * Стрельба от Бедра (core.json, «Стрелок»): «Он может провести Полное Движение
 * и Одиночный Выстрел, который не может быть Избирательным, как одно полное
 * действие (в любом порядке). Этот Талант не может использоваться с длинными
 * винтовками и тяжелым оружием». Подходит: Пистолет или Ручное без longRifle.
 */
const rangedNoLongRifle = item => item?.type === "weapon"
  && (item.system?.weaponClass === "pistol" || item.system?.weaponClass === "basic") && !hasProp(item, "longRifle");
/** Стрельба от Бедра: нужен Одиночный выстрел у оружия. */
export const hipShootingEligibleWeapon = item => rangedNoLongRifle(item) && (Number(item.system?.rof_single) || 0) > 0;
/** Прикрывающий Огонь: нужна Короткая или Длинная очередь у оружия. */
export const coveringFireEligibleWeapon = item => rangedNoLongRifle(item)
  && ((Number(item.system?.rof_semi) || 0) > 0 || (Number(item.system?.rof_full) || 0) > 0);

/** Экипированное оружие, из которого можно стрелять от бедра (или null). */
export function hipShootingWeapon(actor) {
  if (!hasGunnerTalent(actor, "hipShooting")) return null;
  return [...(actor?.items ?? [])].find(i => i.system?.equipped && hipShootingEligibleWeapon(i)) ?? null;
}

/**
 * Огонь с Вытягивания (core.json, «Стрелок»): «Раз в Раунд, снимая пистолет с
 * удобной разгрузки, персонаж может сразу же за свободное действие совершить из
 * него не-Избирательный одиночный выстрел, не считающийся атакой в расчете
 * других атак в этот Ход». Решение владельца 24.10.2026 — автопредложение в
 * чате при Взять: да, если это пистолет, Талант есть и разгрузка не неудобная.
 */
export function drawFireOffered(actor, item, { awkwardRig }) {
  return item?.type === "weapon" && item.system?.weaponClass === "pistol" && (Number(item.system?.rof_single) || 0) > 0
    && !awkwardRig && hasGunnerTalent(actor, "drawFire");
}

// ── Прикрывающий Огонь ──────────────────────────────────────────────────────

/** Метки на стрелке (rules/turn-flags.mjs): враги из контакта при Выходе из Боя / метки Подавления их Натиска. */
export const COVERING_FIRE_OFFER_FLAG = "coveringFireOffer";
export const COVERING_FIRE_MARKS_FLAG = "coveringFireMarks";
/** Штраф самой очереди Прикрывающего Огня. */
export const COVERING_FIRE_PENALTY = -20;

/** Модификатор теста Подавления: «+10 / +0 (для короткой / длинной очереди)». */
export const coveringFireSuppressionMod = rofMode => (rofMode === "semi" ? 10 : 0);
