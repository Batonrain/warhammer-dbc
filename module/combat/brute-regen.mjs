// module/combat/brute-regen.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Часы Календаря для Brute Physiology / Физиология Громилы — обработчик
//  CONDITION_CLOCK_HANDLERS (combat/condition-clock.mjs). Арифметика —
//  rules/brute-regen.mjs. В бою Календарь идёт по 6 секунд за Раунд, так что
//  легко раненый Огрин поднимает Рану каждые 10 Раундов сам, без кнопки.
//
//  Карточка — только когда что-то восстановлено: игрокам-владельцам в общий
//  чат, статистам — ГМу (как у естественного лечения, combat/healing-clock.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { hasRuleFlag } from "../rules/flags.mjs";
import { BRUTE_REGEN_CAPABILITY, BRUTE_REGEN_FLAG, planBruteRegen } from "../rules/brute-regen.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";

export async function bruteRegenClock(actor, { from, to }) {
  if (!actor?.system?.wounds || actor.getFlag?.(NS, "deceased")) return;
  if (!hasRuleFlag(actor, BRUTE_REGEN_CAPABILITY)) return;
  const lastAt = actor.getFlag?.(NS, BRUTE_REGEN_FLAG) ?? null;
  const plan = planBruteRegen(actor.system, lastAt, { from, to });
  if (!plan) return;

  const update = plan.flagAt == null
    ? { [`flags.${NS}.-=${BRUTE_REGEN_FLAG}`]: null }
    : { [`flags.${NS}.${BRUTE_REGEN_FLAG}`]: plan.flagAt };
  if (plan.wounds) {
    update["system.wounds.value"] = plan.wounds.value;
    update["system.wounds.critical"] = plan.wounds.critical;
  }
  await actor.update(update);
  if (!plan.healed) return;

  const rollMode = actor.hasPlayerOwner ? game.settings.get("core", "rollMode") : "gmroll";
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("heart", "#ff8a8a")}${esc(actor.name)} — Физиология Громилы</div>
      <div class="roll-threshold">Сам восстановил Ран: <b>${plan.healed}</b> (1 в минуту легко раненым, в 10 минут тяжело, в час критически).</div>
    </div>`
  }, rollMode));
}
