// module/combat/marked-prey.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ОТМЕЧЕННАЯ ДОБЫЧА / Marked Prey (Мастер Казней, Талант; Sahara fear-2, решение владельца 30.10.2026).
//
//  Книга: «Он может за свободное действие потратить очко Трофеев, чтобы отметить достойную трофея цель в
//  пределах прямой видимости или Трейта Unnatural Senses, пока та не умрет, или он не отметит другую цель.
//  Мастер Казней получает Преимущества на все атаки Казни по отмеченной цели и может видеть ее Трейтом
//  Unnatural Senses с расстояния до P км вместо P м как обычно.»
//
//  Как устроено:
//    • кнопка в ячейке «Трофеи» шапки листа (actor-sheet.mjs::onTrophyMarkPrey) отмечает выцеленный токен:
//      «достойна ли цель» решает ГМ (диалог trophyWorthyDecision), видимость/Unnatural Senses подтверждает стол;
//      Очко Трофеев списывается автоматически (rules/trophy-points.mjs), отметка — флаг актора markedPrey;
//    • «пока та не умрет» — отметка действует, только пока у цели не констатирована смерть; «или он не отметит
//      другую» — новая отметка заменяет прежнюю (и стоит ещё одно Очко);
//    • Преимущество (два броска d100, лучший — тот же приём, что Один Против Сотни) идёт в атаки Казни — двуручное
//      оружие в двуручном хвате, носитель Черты «Казнь» — по отмеченной цели (markedPreyAdvantage →
//      sheets/attack/dialog.mjs, opts.reroll); окно атаки заранее пишет об этом строкой.
//  НЕ автоматизировано: дальность Unnatural Senses «до P км» — в этой системе у зрения/чувств токена нет числа
//  дальности, на которое можно повлиять (вынесено в отчёт).
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { hasMarkedPrey, trophyUpdate, trophyValue, trophyMax } from "../rules/trophy-points.mjs";
import { hasExecution, isExecutionWeapon } from "../rules/execution.mjs";
import { trophyWorthyDecision } from "./trophy-kill.mjs";

const NS = "warhammer-dbc";

/** Флаг актора: { targetUuid, tokenUuid, name } — отмеченная цель. */
export const MARKED_PREY_FLAG = "markedPrey";

/** Преимущество книги: два броска d100, остаётся лучший (тот же вид, что у Одного Против Сотни, sheets/attack/dialog.mjs). */
export const MARKED_PREY_ADVANTAGE_REROLL = Object.freeze({ mode: "keepBest", rolls: 2 });

const isDead = actor => !!actor?.getFlag?.(NS, "deceased");

/** Текущая отметка актора (или null). */
export const markedPreyOf = actor => actor?.getFlag?.(NS, MARKED_PREY_FLAG) ?? null;

/**
 * Отмечена ли эта цель и жива ли она («пока та не умрет»): Талант, отметка на этой цели, смерть не констатирована.
 * @param {Actor} actor
 * @param {?Actor} targetActor
 */
export function markedPreyActive(actor, targetActor) {
  if (!targetActor?.uuid || !hasMarkedPrey(actor)) return false;
  return markedPreyOf(actor)?.targetUuid === targetActor.uuid && !isDead(targetActor);
}

/**
 * Преимущество на атаку: «все атаки Казни по отмеченной цели» — носитель Черты «Казнь», двуручное оружие в двуручном
 * хвате, цель отмечена и жива. undefined — не применяется (подходит прямо в `reroll || …` окна атаки).
 */
export function markedPreyAdvantage(actor, targetActor, weapon, gripKey) {
  if (!hasExecution(actor) || !isExecutionWeapon(weapon, gripKey)) return undefined;
  return markedPreyActive(actor, targetActor) ? { ...MARKED_PREY_ADVANTAGE_REROLL } : undefined;   // копия: бросок вправе дописать поля
}

/**
 * Отметить добычу: свободное действие + 1 Очко Трофеев. Решение ГМа «достойна ли цель» — диалог до списания.
 * @param {Actor} actor
 * @param {?Actor} target
 * @param {{targetTokenUuid?:string, decide?:(info:object)=>Promise<?object>}} o
 * @returns {Promise<{marked:boolean, reason?:string}>}
 */
export async function markPrey(actor, target, { targetTokenUuid = "", decide = trophyWorthyDecision } = {}) {
  if (!hasMarkedPrey(actor)) return { marked: false, reason: "noTalent" };
  if (!target?.uuid) return { marked: false, reason: "noTarget" };
  if (target === actor || target.uuid === actor.uuid) return { marked: false, reason: "self" };
  if (isDead(target)) return { marked: false, reason: "dead" };
  if (markedPreyOf(actor)?.targetUuid === target.uuid) return { marked: false, reason: "already" };
  if (trophyValue(actor) < 1) return { marked: false, reason: "noPoints" };
  const ok = await decide({
    title: "Отмеченная Добыча: достойна ли цель?", intro: `${actor.name}: отметить добычу за 1 Очко Трофеев (цель в прямой видимости или в зоне Unnatural Senses).`,
    victimName: target.name, askInf: false, okLabel: "Достойна — отметить"
  });
  if (!ok) return { marked: false, reason: "declined" };
  // Решение могло висеть долго: Очко проверяем заново прямо перед списанием.
  const patch = trophyUpdate(actor, -1);
  if (!patch) return { marked: false, reason: "noPoints" };
  await actor.update(patch);
  await actor.setFlag(NS, MARKED_PREY_FLAG, { targetUuid: target.uuid, tokenUuid: targetTokenUuid, name: target.name ?? "" });
  await postTestCard(actor, {
    icon: rollIcon("skull", "#c9a24a"),
    title: `Отмеченная Добыча — ${esc(target.name ?? "цель")}`,
    lines: [
      `<div class="roll-threshold">${esc(actor.name)} отмечает добычу: Преимущество на атаки Казни по ней, пока она не умрёт или не будет отмечена другая цель; `
        + `Unnatural Senses видит её дальше обычного (дальность — по тексту Таланта).</div>`,
      `<div class="roll-damage-meta">Потрачено Очко Трофеев (${trophyValue(actor)}/${trophyMax(actor)}).</div>`
    ]
  }, { sound: false });
  return { marked: true };
}

/** Цель с карты: первый выцеленный пользователем токен → { actor, tokenUuid }. */
export function firstTargetedPrey() {
  const token = [...(globalThis.game?.user?.targets ?? [])][0] ?? null;
  const actor = token?.actor ?? token?.document?.actor ?? null;
  return { actor, tokenUuid: token?.document?.uuid ?? token?.uuid ?? "" };
}

const REASONS = {
  noTalent: "нет Таланта «Отмеченная Добыча».",
  noTarget: "выцельте добычу (цель на карте).",
  self: "отметить можно только чужую цель.",
  dead: "цель уже убита.",
  already: "эта цель уже отмечена.",
  noPoints: "нет Очка Трофеев."
};

/** Клик по кнопке шапки листа: отметить выцеленного. Предупреждение при отказе — на экран. */
export async function markPreyFromTarget(actor) {
  const { actor: target, tokenUuid } = firstTargetedPrey();
  const res = await markPrey(actor, target, { targetTokenUuid: tokenUuid });
  if (!res.marked && REASONS[res.reason]) globalThis.ui?.notifications?.warn(`⚠️ Отмеченная Добыча: ${REASONS[res.reason]}`);
  return res;
}
