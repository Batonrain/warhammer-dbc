// module/combat/warp-instability.mjs — Foundry-обвязка Варп-Нестабильности (правила — rules/warp-instability.mjs).
import { hasRuleFlag } from "../rules/flags.mjs";
import { updateOrRelay } from "./command-state.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import {
  WARP_INSTABILITY_CAP, WARP_INSTAB_HURT_FLAG, WARP_INSTAB_DEALT_FLAG, WARP_BANISHED_FLAG,
  instabilityTestNeeded, instabilityDamageFormula, shouldBanish
} from "../rules/warp-instability.mjs";

const NS = "warhammer-dbc";
const flagOf = (actor, k) => actor?.flags?.[NS]?.[k] ?? actor?.getFlag?.(NS, k);

/** Цель получила непоглощённый урон. */
export async function warpInstabilityOnHurt(actor, netDamage) {
  if ((Number(netDamage) || 0) <= 0 || !hasRuleFlag(actor, WARP_INSTABILITY_CAP)) return;
  if (!flagOf(actor, WARP_INSTAB_HURT_FLAG)) await updateOrRelay(actor, { [`flags.${NS}.${WARP_INSTAB_HURT_FLAG}`]: true });
}

/** Атакующий нанёс непоглощённый урон. */
export async function warpInstabilityOnDealt(attackerUuid, netDamage) {
  if (!attackerUuid || (Number(netDamage) || 0) <= 0) return;
  const attacker = await fromUuid(attackerUuid).catch(() => null);
  if (!attacker || !hasRuleFlag(attacker, WARP_INSTABILITY_CAP)) return;
  if (!flagOf(attacker, WARP_INSTAB_DEALT_FLAG)) await updateOrRelay(attacker, { [`flags.${NS}.${WARP_INSTAB_DEALT_FLAG}`]: true });
}

/** Изгнание в Варп: Раны не уходят в минус, токены скрыты, карточка в чат. */
export async function banishToWarp(actor, loss) {
  await updateOrRelay(actor, {
    "system.wounds.critical": Number(loss?.currentCritical) || 0,
    [`flags.${NS}.${WARP_BANISHED_FLAG}`]: true
  });
  for (const t of actor.getActiveTokens?.(false, true) ?? []) await t.update?.({ hidden: true });
  await postTestCard(actor, {
    icon: rollIcon("skull", "#c070ff"), title: `Изгнан в Варп — ${esc(actor.name)}`,
    outcome: `<span class="roll-failure">Раны ниже 0: ${esc(actor.name)} изгнан в Варп вместо Отрицательных Ран.</span>`
  });
}

/** Конец Хода демона: тест W+0, провал — Energy-урон без поглощения; затем сброс отметок. */
export async function warpInstabilityTurnEnd(actor) {
  if (!actor || !hasRuleFlag(actor, WARP_INSTABILITY_CAP) || flagOf(actor, WARP_BANISHED_FLAG)) return;
  const hurt = !!flagOf(actor, WARP_INSTAB_HURT_FLAG);
  const dealt = !!flagOf(actor, WARP_INSTAB_DEALT_FLAG);
  const reset = { [`flags.${NS}.-=${WARP_INSTAB_HURT_FLAG}`]: null, [`flags.${NS}.-=${WARP_INSTAB_DEALT_FLAG}`]: null };
  if (!instabilityTestNeeded({ hurt, dealt })) {
    if (hurt || dealt) await updateOrRelay(actor, reset);
    return;
  }
  const wp = Number(actor.system?.characteristics?.wp?.total) || 0;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, wp);
  let detail = `<span class="roll-success">Успех — Варп держит</span>`;
  let loss = null;
  if (!success) {
    const dmg = await new Roll(instabilityDamageFormula(Math.abs(Number(deg) || 0))).evaluate();
    loss = await applyWoundLoss(actor, dmg.total);
    detail = `<span class="roll-failure">Провал (${Math.abs(Number(deg) || 0)}) — ${dmg.total} непоглощаемого Energy-урона (Раны ${loss.currentWounds}→${loss.newWounds})</span>`;
  }
  await postTestCard(actor, {
    icon: rollIcon("skull", "#c070ff"), title: `Варп-Нестабильность — ${esc(actor.name)}`,
    threshold: `W+0 (<b>${wp}</b>): <b>${roll.total}</b>`,
    outcome: detail
  }, { rolls: [roll] });
  await updateOrRelay(actor, reset);
  if (loss && shouldBanish(loss)) await banishToWarp(actor, loss);
}
