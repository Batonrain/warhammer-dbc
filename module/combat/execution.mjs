// module/combat/execution.mjs
// ════════════════════════════════════════════════════════════════════════════
//  КАЗНЬ / Execution — Foundry-обвязка к rules/execution.mjs (Черта Мастера Казней; Sahara fear-2,
//  решение владельца 30.10.2026 — автоматизировать).
//
//  Книга: «…совершает им атаку по достойной трофейной цели, если он не убил ее этой атакой, он может совершить
//  по ней еще одну атаку тем же оружием с той же базой и приемом Обычная Атака. Если Inf цели 30-59, … до 2-х
//  дополнительных раз, 60-79 – до 3-х, а 80+ – до 4-х. Он может совершать Казнь только один раз в Раунд.»
//
//  Как устроено (по образцу Упорства, combat/tenacity.mjs, и Жнеца, combat/reaper-chain.mjs):
//    1. на карточке рукопашной атаки двуручным оружием в двуручном хвате (носитель Черты, цель жива, идёт бой)
//       появляется кнопка «Казнь: ещё атака» (executionOfferHtml; attack.mjs → attack-card.mjs);
//    2. клик (hooks.mjs, .wh-execution-btn) → startExecutionFollow: «не убил» = у цели не констатирована смерть;
//       на новой серии ГМ решает «достойна ли цель» (диалог trophyWorthyDecision, Inf цели правится — у не-Хаоситов
//       берётся аналог), по Inf считается число доп. атак; серия жива — диалог не повторяется;
//    3. окно атаки — та же База, Приём Обычная Атака, свободное действие (techniqueOpts.executionFollow:
//       rules/melee-talents.mjs::freeMeleeFlags/freeAttackLockProblem); цель выцеливается на сцене сама;
//    4. серия (флаг актора executionSeries: бой, Раунд, цель, сколько положено и сколько сделано) пишется на
//       «Бросок!» окна (payOnRoll.execution → commitExecutionStep), а не на клик: закрытое окно ничего не съедает.
//  Окончательная Казнь (combat/final-execution.mjs) независима: её серия — «атаки Казнью» того же Раунда, игрок
//  вооружает её кнопкой окна атаки на любой из них.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { actorInf } from "../rules/trophy-points.mjs";
import {
  hasExecution, isExecutionWeapon, executionExtraAttacks, executionSeriesLive, executionStepVerdict
} from "../rules/execution.mjs";
import { trophyWorthyDecision } from "./trophy-kill.mjs";

const NS = "warhammer-dbc";

/** Ключ отметки на карточке (белый список сокета — card-once.mjs::CARD_ONCE_FLAGS). */
export const EXECUTION_CARD_FLAG = "executionUsed";

/** Флаг актора: { combatId, round, targetUuid, total, used } — серия Казни текущего Раунда. */
export const EXECUTION_SERIES_FLAG = "executionSeries";

const liveCombat = () => globalThis.game?.combat?.id ? globalThis.game.combat : null;
const isDead = actor => !!actor?.getFlag?.(NS, "deceased");

/**
 * Кнопка «Казнь» на карточку атаки. Пусто — не носителю, не двуручному оружию в двуручном хвате, не
 * рукопашной атаке, цель мертва / неизвестна, нет боя, серия закончилась или идёт по другой цели.
 * @param {Actor} actor
 * @param {{isMelee:boolean, weapon:Item, gripKey:string, defender:?Actor, defenderTokenUuid?:string, baseKey?:string}} ctx
 */
export function executionOfferHtml(actor, { isMelee, weapon, gripKey, defender, defenderTokenUuid = "", baseKey = "" } = {}) {
  const combat = liveCombat();
  if (!isMelee || !combat || !defender?.uuid || !hasExecution(actor) || !isExecutionWeapon(weapon, gripKey)) return "";
  if (isDead(defender)) return "";
  const series = actor.getFlag?.(NS, EXECUTION_SERIES_FLAG);
  let left = null;
  if (executionSeriesLive(series, combat)) {
    const v = executionStepVerdict({ series, combat, targetUuid: defender.uuid });
    if (!v.ok) return "";
    left = v.left;
  }
  return `<button class="wh-execution-btn" type="button"
      data-attacker-uuid="${esc(actor.uuid)}" data-weapon-uuid="${esc(weapon.uuid ?? "")}"
      data-target-uuid="${esc(defender.uuid)}" data-target-token-uuid="${esc(defenderTokenUuid)}" data-base="${esc(baseKey)}"
      title="Казнь (Мастер Казней): если цель не убита этой атакой — ещё одна атака тем же оружием, с той же Базой и Обычной Атакой, свободным действием. Достойна ли цель трофея, решает ГМ; по Inf цели положено до 2 (30–59), 3 (60–79) или 4 (80+) таких атак. Раз в Раунд.">
      ${rollIcon("sword")}Казнь: ещё атака${left != null ? ` (осталось ${left})` : ""}, если цель жива
    </button>`;
}

/**
 * Серия: можно ли сделать ещё одну атаку именно сейчас (пересчёт на «Бросок!» — за время открытого окна
 * Раунд мог смениться). Пустая строка — можно.
 * @param {Actor} actor
 * @param {{targetUuid:string, total:number}} exec
 */
export function executionPayProblem(actor, { targetUuid, total } = {}) {
  const v = executionStepVerdict({ series: actor?.getFlag?.(NS, EXECUTION_SERIES_FLAG), combat: liveCombat(), targetUuid, total });
  return v.ok ? "" : v.reason;
}

/**
 * Подтверждённая атака Казни: записать шаг серии. false — отказ (серия исчерпана, Раунд другой, цель другая).
 * Звать ПОСЛЕ подтверждения («Бросок!» окна, payTalentAttack), не по клику на кнопку.
 */
export async function commitExecutionStep(actor, { targetUuid, total } = {}) {
  const combat = liveCombat();
  const series = actor?.getFlag?.(NS, EXECUTION_SERIES_FLAG);
  const v = executionStepVerdict({ series, combat, targetUuid, total });
  if (!v.ok) return false;
  const live = executionSeriesLive(series, combat);
  await actor.setFlag(NS, EXECUTION_SERIES_FLAG, {
    combatId: combat.id, round: Number(combat.round) || 0, targetUuid, total: v.total, used: (live ? Number(series.used) || 0 : 0) + 1
  });
  return true;
}

/** Выцелить токен цели на сцене (как Рисовка): старые цели сбрасываются. */
function targetOnScene(targetUuid, targetTokenUuid) {
  const token = globalThis.canvas?.tokens?.placeables?.find(t => (targetTokenUuid && t.document?.uuid === targetTokenUuid) || t.actor?.uuid === targetUuid);
  if (!token) return;
  globalThis.game?.user?.targets?.forEach?.(t => t.setTarget(false, { user: globalThis.game.user, releaseOthers: false }));
  token.setTarget(true, { user: globalThis.game.user, releaseOthers: true });
}

/**
 * Клик по кнопке: диалог ГМа (на новой серии) и окно бесплатной атаки.
 * @param {Actor} attacker
 * @param {Item} weapon
 * @param {{targetUuid:string, targetTokenUuid?:string, baseKey?:string, messageId?:string,
 *          decide?:(info:object)=>Promise<?{inf:number}>}} o   decide — решение ГМа (по умолчанию диалог)
 * @returns {Promise<boolean>} окно атаки открыто
 */
export async function startExecutionFollow(attacker, weapon, { targetUuid, targetTokenUuid = "", baseKey = "", messageId = "", decide = trophyWorthyDecision } = {}) {
  const warn = text => globalThis.ui?.notifications?.warn(`⚠️ Казнь: ${text}`);
  const combat = liveCombat();
  if (!combat) { warn("Казнь — раз в Раунд, а вне боя Раундов нет."); return false; }
  const target = await fromUuid(targetUuid).catch(() => null);
  if (!target) { warn("цель не найдена."); return false; }
  if (isDead(target)) { warn(`${target.name} убит(а) — Казнь продолжается, только пока цель жива.`); return false; }

  const series = attacker.getFlag?.(NS, EXECUTION_SERIES_FLAG);
  let total = 0;
  if (!executionSeriesLive(series, combat)) {
    const decision = await decide({
      title: "Казнь: достойна ли цель?", intro: `${attacker.name}: Казнь двуручным оружием.`,
      victimName: target.name, inf: actorInf(target), askInf: true, okLabel: "Достойна — Казнь"
    });
    if (!decision) return false;
    total = executionExtraAttacks(decision.inf);
  }
  const verdict = executionStepVerdict({ series, combat, targetUuid, total });
  if (!verdict.ok) { warn(verdict.reason); return false; }

  targetOnScene(targetUuid, targetTokenUuid);
  await attacker.sheet?._showAttackDialog?.(weapon, {
    ...(baseKey ? { forceBase: baseKey } : {}), technique: "standard", executionFollow: true,
    payOnRoll: { label: "Казнь", cardId: messageId, cardKey: EXECUTION_CARD_FLAG, execution: { targetUuid, total: verdict.total } }
  });
  return true;
}
