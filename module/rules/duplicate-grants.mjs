// module/rules/duplicate-grants.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Один и тот же Навык или Талант из разных источников.
//
//  При создании персонажа Навыки и Таланты приходят с нескольких сторон сразу:
//  раса, Прошлое, субраса, Родной мир, Архетип, Элитный архетип. Совпадения там
//  обычны, и раньше второй источник пропадал впустую: Навык брал лучший из двух
//  рангов, Талант просто не задваивался.
//
//  Правило стола:
//    Навык — второй источник поднимает на ступень выше (+0 → +10 → +20 → +30);
//            на потолке ступени нет, и вместо неё возвращается опыт в размере
//            третьей покупки (цена ступени +30) — Навык дальше не растёт, но
//            труд не пропадает;
//    Талант — повторить нечего, поэтому возвращается его цена целиком.
//
//  Здесь только решение «что делать»: ступень, признак возврата и индекс
//  ступени, по которой считать цену. Сами цены зависят от Склонностей и
//  культуры конкретного персонажа — их считает вызывающий теми же функциями,
//  что и вкладка «Развитие», иначе возврат разошёлся бы с покупкой.
// ════════════════════════════════════════════════════════════════════════════

import { SKILL_RANKS } from "../constants/characteristics.mjs";

/** Ранги по возрастанию: нетренированный, знает (+0), +10, +20, +30. */
export const RANK_ORDER = ["untrained", "knows", "trained", "veteran", "expert"];

/** Ступень покупки, чью цену возвращает Навык на потолке: +30 — третья. */
export const SKILL_REFUND_STEP = 3;

/** Индекс ранга в порядке роста; неизвестный считаем нетренированным. */
export const rankIndex = rank => Math.max(0, RANK_ORDER.indexOf(rank || "untrained"));

/** Следующая ступень или null, если это уже потолок. */
export function nextRank(rank) {
  const i = rankIndex(rank);
  return i >= RANK_ORDER.length - 1 ? null : RANK_ORDER[i + 1];
}

/** Выше из двух рангов — как при обычной выдаче. */
export function higherOf(a, b) {
  return rankIndex(a) >= rankIndex(b) ? (a || "untrained") : (b || "untrained");
}

/**
 * Что делать с Навыком, который выдают ещё раз.
 *
 * @param {string} current  ранг, уже выданный источниками (grantedRank)
 * @param {string} granted  ранг, который даёт новый источник
 * @returns {{rank: string, refundStep: number|null, duplicate: boolean}}
 *   rank — каким ранг станет; refundStep — индекс ступени для возврата опыта
 *   (null, если возврата нет); duplicate — сработало ли правило совпадения.
 */
export function skillGrantOutcome(current, granted) {
  const cur = current || "untrained";

  // Источник даёт больше, чем есть, — обычная выдача, правило не при чём.
  if (rankIndex(granted) > rankIndex(cur)) {
    return { rank: higherOf(cur, granted), refundStep: null, duplicate: false };
  }

  // Совпадение: ранг поднимается на ступень. Нетренированный Навык — не
  // совпадение, а первая выдача: подниматься ему не с чего.
  if (rankIndex(cur) === 0) {
    return { rank: granted || "knows", refundStep: null, duplicate: false };
  }

  const next = nextRank(cur);
  if (next) return { rank: next, refundStep: null, duplicate: true };

  // Потолок: расти некуда, возвращаем цену третьей покупки.
  return { rank: cur, refundStep: SKILL_REFUND_STEP, duplicate: true };
}

/** Подпись ступени для чата и подсказок: «+10», «+20», «+30». */
export function rankLabel(rank) {
  return SKILL_RANKS[rank]?.label || rank || "";
}

/**
 * Талант, который выдают ещё раз. Повторить его нельзя, поэтому источник
 * возвращает опыт — сколько Талант стоил бы этому персонажу.
 *
 * Специализация делает Талант другим: «Weapon Training (Bolt)» и «…(Las)» —
 * разные Таланты, и совпадением не считаются.
 */
export function isSameTalent(a, b) {
  const name = t => String(t?.name || "").trim().toLowerCase();
  const spec = t => String(t?.system?.specialization || "").trim().toLowerCase();
  return !!name(a) && name(a) === name(b) && spec(a) === spec(b);
}

/** Есть ли уже такой Талант среди имеющихся. */
export function findSameTalent(items = [], talent) {
  return [...items].find(i => i?.type === "talent" && isSameTalent(i, talent)) || null;
}
