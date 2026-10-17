// module/rules/speed-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ СКОРОСТИ (глава 3, группа «Скорость») — чистая логика.
//
//  Одиннадцать Талантов, и почти каждый — «действие дешевле» или «дистанция
//  длиннее». Сами действия (диалоги, ОД, карточки) живут в combat/…; здесь
//  только числа и условия, чтобы их можно было проверить без Foundry.
//
//    Leap Up / Вскочить              — Встать за свободное действие
//    Quick Draw / Быстрое Выхватывание, Quick Store / Быстрое Складывание
//                                    — Взять / Сложить за свободное действие
//    Rapid Reload / Быстрая Перезарядка — время перезарядки вдвое (окр.▼)
//    Technical Knock / Технический Трюк — Расклин за полудействие
//    Jumper / Прыгун                 — Прыжок за полудействие или частью Натиска
//    Preternatural Speed / Запредельная Скорость — Натиск на дистанцию Бега
//    Sprint / Спринт                 — Полное Движение на дистанцию Натиска,
//                                      Бег на двойную дистанцию Бега
//    Reposition / Смена Позиции      — Полудвижение в начале боя
//    Breacher / Прорыватель          — Полудвижение и Атака одним Полным действием
//    Half-Step / Полушаг             — уже сделан раньше (combat/movement-actions.mjs)
// ════════════════════════════════════════════════════════════════════════════

import { hasAbility } from "./ability-by-key.mjs";

/** Короткий ключ → { ключ Возможности, имя Таланта для опознания по имени }. */
export const SPEED_TALENTS = {
  leapUp:            { key: "speed.core.leapUp",            name: "Leap Up" },
  quickDraw:         { key: "speed.core.quickDraw",         name: "Quick Draw" },
  quickStore:        { key: "speed.core.quickStore",        name: "Quick Store" },
  rapidReload:       { key: "speed.core.rapidReload",       name: "Rapid Reload" },
  technicalKnock:    { key: "speed.core.technicalKnock",    name: "Technical Knock" },
  jumper:            { key: "speed.core.jumper",            name: "Jumper" },
  preternaturalSpeed:{ key: "speed.core.preternaturalSpeed",name: "Preternatural Speed" },
  sprint:            { key: "speed.core.sprint",            name: "Sprint" },
  reposition:        { key: "speed.core.reposition",        name: "Reposition" },
  breacher:          { key: "speed.core.breacher",          name: "Breacher" }
};

/** Есть ли у актора этот Талант Скорости (по имени предмета ИЛИ по ключу Возможности). */
export function hasSpeedTalent(actor, id) {
  const t = SPEED_TALENTS[id];
  return !!t && hasAbility(actor, t.key, t.name, "talent");
}

// ── Стоимость действий ──────────────────────────────────────────────────────

/** Встать обычным способом: Полудействие, а со Вскочить — свободное действие. */
export function standUpApCost(leapUp) {
  return leapUp ? 0 : 1;
}

/** Расклин: Полное действие, а с Техническим Трюком — Полудействие. */
export function clearJamApCost(technicalKnock) {
  return technicalKnock ? 1 : 2;
}

/**
 * Прыжок: Полное действие; Прыгун — Полудействие или «как часть Натиска»
 * (отдельно не оплачивается — Натиск уже стоит своё).
 */
export function jumpApCost({ jumper = false, partOfCharge = false } = {}) {
  if (!jumper) return 2;
  return partOfCharge ? 0 : 1;
}

/**
 * Быстрая Перезарядка: «время перезарядки снижается вдвое (окр.▼)» — в ОД
 * (решение владельца 17.10.2026). ½ (1 ОД) → свободное действие, «1» (2 ОД) →
 * 1 ОД, «2» (4 ОД) → 2 ОД, «3» (6 ОД) → 3 ОД. Бесплатная перезарядка
 * (0 ОД: «–», «†», «¼») остаётся бесплатной.
 */
export function rapidReloadApCost(apCost) {
  return Math.floor((Number(apCost) || 0) / 2);
}

// ── Взять / Сложить ─────────────────────────────────────────────────────────

/**
 * Какое оружие подходит под Быстрое Выхватывание / Быстрое Складывание:
 * «метательное оружие, пистолет, винтовку, рукопашное оружие, что может быть
 * использовано в одной руке». Ручное (basic) — это «винтовка» книги.
 * Тяжёлое, пусковое и стационарное не подходят; рукопашное — только если ему
 * хватает одной руки.
 * @param {{weaponClass?:string}} sys   system оружия
 * @param {number} hands                сколько рук оружие занимает (weaponHandsRequired)
 */
export function quickDrawWeaponEligible(sys, hands) {
  const cls = sys?.weaponClass;
  if (cls === "thrown" || cls === "pistol" || cls === "basic") return true;
  if (cls === "melee") return (Number(hands) || 0) <= 1;
  return false;
}

// ── Дистанции ───────────────────────────────────────────────────────────────

/**
 * Дистанции Движения с учётом Запредельной Скорости и Спринта.
 *
 *   Запредельная Скорость: Натиск на дистанцию Бега (charge = run).
 *   Спринт: Полное Движение на дистанцию Натиска (move = SPD×3 из таблицы
 *     главы 3, «Полн.Движение – SPD×3»), Бег на двойную дистанцию Бега
 *     (sprintRun = SPD×12); САМ run не удваивается — «в отношении других
 *     механик» остаётся SPD×6.
 *
 * Полное Движение Спринта берётся от обычного Натиска, а не от Запредельного —
 * в таблице таланта стоит SPD×3, а не «дистанция Натиска со всеми надбавками»
 * (допущение: иначе у носителя обоих Талантов, Искусства Скорости, Полное
 * Движение совпало бы с Бегом, чего таблица не обещает).
 *
 * @returns {{move:number, charge:number, run:number, sprintRun:number}}
 */
export function speedTalentDistances({ move, charge, run }, { preternatural = false, sprint = false } = {}) {
  const out = { move, charge, run, sprintRun: 0 };
  if (sprint) {
    out.move = Math.max(move, charge);
    out.sprintRun = run * 2;
  }
  if (preternatural) out.charge = Math.max(charge, run);
  return out;
}

// ── Спринт: Усталость ───────────────────────────────────────────────────────

/**
 * «Если он совершает Бег на дистанцию более нормальной два Хода подряд, он
 * получает 1 Усталости в конце Хода.» Ходы подряд — Раунды подряд в одном бою.
 * @param {{combatId?:string, round?:number}|null} previous  прошлый «дальний» Бег
 * @param {{combatId?:string, round?:number}} current        нынешний
 */
export function sprintFatigueDue(previous, current) {
  if (!previous || !current) return false;
  if (!previous.combatId || previous.combatId !== current.combatId) return false;
  return Number(previous.round) === Number(current.round) - 1;
}

// ── Смена Позиции ───────────────────────────────────────────────────────────

/**
 * Доступна ли Смена Позиции: «в начале боя сразу после бросков Инициативы» —
 * один раз за бой (ready — метка «battle» ещё не стоит) и только пока идёт
 * первый Раунд. Вне боя (нет id боя) — недоступна: начала боя ещё нет.
 */
export function repositionAvailable({ combatId, round, ready = true } = {}) {
  if (!combatId) return false;
  if (Number(round) > 1) return false;
  return !!ready;
}

// ── Прорыватель ─────────────────────────────────────────────────────────────

/**
 * «Когда он вооружён щитом в одной руке и находится в Защитной стойке»:
 * Талант + щит в руке + Защитная Стойка.
 */
export function breacherReady({ talent = false, shield = false, stance = "standard" } = {}) {
  return !!talent && !!shield && stance === "defensive";
}
