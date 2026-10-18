// module/combat/hunker-down.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Hunker Down / Залегание (Талант Стойкости, глава 3): «Находясь в укрытии, он
//  может потратить полудействие, чтобы удвоить расчётный AP этого укрытия и дать
//  своим выглядывающим из укрытия частям тела обычное АР этого укрытия до начала
//  своего следующего Хода.»
//
//  Кнопка на вкладке БОЙ (образец — combat/caution.mjs): 1 ОД, только в укрытии
//  (ручное AP укрытия на листе > 0 либо токен стоит в зоне Укрытия сцены), метка
//  hunkerDown гаснет в начале следующего Хода (rules/turn-flags.mjs).
//
//  Сама арифметика — в конвейере урона: combat/damage.mjs читает метку и передаёт
//  её в rules/cover-locations.mjs::coverApForLocation. Как понят смысл отметок
//  частей тела на листе («☑ у части тела — прикрыта»):
//    • отмечены прикрытые части — у них AP укрытия ×2;
//    • неотмеченные при наличии отметок — это и есть «выглядывающие»: они получают
//      обычное AP укрытия (без Залегания у них было бы 0);
//    • отметок нет вовсе (укрытие общее) — ×2 на всём теле.
//  Множитель Взрывного и износ укрытия (−1 AP за пробивающее попадание) работают как
//  раньше: износ мерит урон против УДВОЕННОГО поглощения, а снимается с исходного AP.
//
//  Вне боя ОД не тратятся, а метка висит до начала следующего Хода в бою (Хода нет —
//  сама не гаснет); ГМ может снять её флагом hunkerDown вручную.
// ════════════════════════════════════════════════════════════════════════════

import { spendActionPoints } from "./action-economy.mjs";
import { coverApForToken } from "./cover.mjs";
import { hasResilienceTalent, HUNKER_DOWN_FLAG } from "../rules/resilience-talents.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

export function hasHunkerDown(actor) {
  return hasResilienceTalent(actor, "hunkerDown");
}

/** В укрытии ли персонаж: ручное AP укрытия на листе либо зона Укрытия под токеном. */
export function isInCover(actor) {
  if ((Number(actor?.system?.cover?.ap) || 0) > 0) return true;
  const token = actor?.getActiveTokens?.()?.[0] ?? null;
  return !!token && coverApForToken(token) > 0;
}

/** Метка Залегания сейчас стоит. */
export function hunkerDownOn(actor) {
  return !!actor?.getFlag?.(NS, HUNKER_DOWN_FLAG);
}

/** Почему нельзя залечь сейчас ("" — можно). */
export function hunkerDownBlockReason(actor) {
  if (!hasHunkerDown(actor)) return "Нужен Талант Hunker Down/Залегание.";
  if (hunkerDownOn(actor)) return "Уже залёг — Залегание действует до начала следующего Хода.";
  if (!isInCover(actor)) return "Залечь можно только в укрытии: укажите AP укрытия на листе (БОЙ) или встаньте в зону Укрытия.";
  return "";
}

export async function applyHunkerDown(actor) {
  const why = hunkerDownBlockReason(actor);
  if (why) return ui.notifications.warn(`⚠️ ${why}`);
  if (!await spendActionPoints(actor, 1, { physical: true })) return;
  await actor.setFlag(NS, HUNKER_DOWN_FLAG, true);
  await postTestCard(actor, {
    icon: rollIcon("shield", "#8fd0ff"), title: `Залегание — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Полудействие (1 ОД). AP укрытия ×2, выглядывающие части тела получают обычное AP укрытия — до начала следующего Хода.</div>`]
  }, { sound: false });
  return true;
}
