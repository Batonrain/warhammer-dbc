// module/combat/grapple-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ ПУГИЛИСТА В БОРЬБЕ (стр. 62; задача Sahara 3-eddb, решения
//  владельца 24.10.2026) — клей на combat/grapple.mjs.
//
//  УДУШЕНИЕ / Chokehold: «Его Сжать наносит цели 1 Усталости, а Заломить – 1
//  Усталости за каждый Успех, на который он победил, или 1 Усталости, даже если
//  он проиграл. Если он побеждает на встречном тесте Athletics Захвата на 5+
//  Успехов, он также наносит цели 1 Усталости за каждые полные 5 Успехов, на
//  которые он победил. Все эти эффекты действуют только на живых существ,
//  нуждающихся в кислороде.»
//   • «Успехов, на которые победил» — разница степеней встречного теста
//     (margin из combat/opposed-contest.mjs), а не собственные степени.
//   • Усталость — через sheets/tabs/conditions.mjs::addFatigue (иммунитет к
//     Усталости, например Саркофаг Дредноута, проверяется там).
//   • «Живые существа, нуждающиеся в кислороде» (нежить, машины, вакуумные) —
//     не определяются автоматически: в карточке стоит напоминание; снять
//     Усталость по ошибке игрок/ГМ может на листе.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { writeToTarget } from "./gm-relay.mjs";

/**
 * Швырнуть / Slam (Талант Пугилиста): «При взятии цели в Захват, победе во
 * встречном тесте на Athletics на 5+ Успехов». Успехи победы — разница степеней.
 */
export function slamOffered(margin) {
  return (Number(margin) || 0) >= 5;
}

/**
 * Наскок / Pounce (Талант Пугилиста): Захват с Базы «Натиск» и победа в
 * встречном Athletics на 3+ Успеха → свободный Повалить.
 */
export function pounceOffered({ baseKey, margin }) {
  return baseKey === "charge" && (Number(margin) || 0) >= 3;
}

/** Победа в этом Повалить на 5+ Успехов → схватить 2+ руками, упасть, Сжать + Заломить. */
export function pounceGrabOffered(margin) {
  return (Number(margin) || 0) >= 5;
}

/** Заломить: победа — Усталость за каждый Успех победы (минимум 1), проигрыш — 1. */
export function chokeholdWrenchFatigue({ won, margin }) {
  return won ? Math.max(1, Number(margin) || 0) : 1;
}

/** Захват, победа на 5+ Успехов: по 1 Усталости за каждые полные 5. */
export function chokeholdGrappleFatigue(margin) {
  return Math.floor(Math.max(0, Number(margin) || 0) / 5);
}

/**
 * Нанести Усталость хватке Удушения и записать причину в чат.
 * @param {object} actor    душащий
 * @param {object} partner  душимый
 * @param {number} amount   сколько Усталости
 * @param {string} reason   подпись приёма
 * @param {{add?: Function}} [inject] подмена addFatigue для тестов
 */
export async function applyChokehold(actor, partner, amount, reason, { add } = {}) {
  if (!partner || !(amount > 0)) return 0;
  // Партнёр обычно чужой NPC — Усталость пишет ГМ (combat/gm-relay.mjs). Отказ (ГМа нет в игре) приём прерывает.
  const addFatigue = add ?? ((p, n) => writeToTarget(p, { kind: "addFatigue", amount: n }, actor));
  if ((await addFatigue(partner, amount)) === false) return 0;
  await postTestCard(actor, {
    icon: rollIcon("sword", "#e08a3a"), title: `Удушение: ${esc(reason)}`,
    outcome: `${esc(partner.name)} получает ${amount} Усталости.`,
    sections: [`<div class="roll-threshold" style="font-size:0.85em;">Действует только на живых существ, нуждающихся в кислороде — если ${esc(partner.name)} к ним не относится, снимите Усталость на листе.</div>`]
  }, { sound: false });
  return amount;
}
