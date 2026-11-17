// module/combat/demon-god-traits.mjs — Foundry-обвязка божественных Трейтов демонов (правила — rules/demon-god-traits.mjs).
import { hasRuleFlag } from "../rules/flags.mjs";
import { updateOrRelay } from "./command-state.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import {
  BLOOD_GOD_CAP, BLOOD_GOD_KILLS_FLAG, BLOOD_GOD_MAX, BLOOD_GOD_STEP, bloodGodDamageBonus, isKillingBlow,
  MOCKERY_CAP, MOCKERY_ROUND_FLAG, MOCKERY_TEST_MOD, mockeryAvailable, mockeryRoundKey, dropsBelowZero, mockeryCappedDamage
} from "../rules/demon-god-traits.mjs";

const NS = "warhammer-dbc";
const flagOf = (actor, k) => actor?.flags?.[NS]?.[k] ?? actor?.getFlag?.(NS, k);

/** Бонус к рукопашному урону Крови Богу Крови (читает attack.mjs). */
export function bloodGodBonusOf(actor) {
  return hasRuleFlag(actor, BLOOD_GOD_CAP) ? bloodGodDamageBonus(flagOf(actor, BLOOD_GOD_KILLS_FLAG)) : 0;
}

/** Атакующий вывел цель из строя — записать убийство демону-Кхорну. Возвращает строку для карточки урона. */
export async function bloodGodOnKill(attackerUuid, woundsBefore, woundsAfter) {
  if (!attackerUuid || !isKillingBlow(woundsBefore, woundsAfter)) return "";
  const attacker = await fromUuid(attackerUuid).catch(() => null);
  if (!attacker || !hasRuleFlag(attacker, BLOOD_GOD_CAP)) return "";
  const kills = Math.min(BLOOD_GOD_MAX / BLOOD_GOD_STEP, (Number(flagOf(attacker, BLOOD_GOD_KILLS_FLAG)) || 0) + 1);
  await updateOrRelay(attacker, { [`flags.${NS}.${BLOOD_GOD_KILLS_FLAG}`]: kills });
  return `<div class="dmg-tb-note">🩸 Кровь Богу Крови: ${esc(attacker.name)} +${bloodGodDamageBonus(kills)} к рукопашному урону до конца боя.</div>`;
}

/** Конец боя: сбросить счётчик убийств у всех участников. */
export async function clearBloodGodKills(combat) {
  for (const c of combat?.combatants ?? []) {
    const a = c.actor;
    if (a && flagOf(a, BLOOD_GOD_KILLS_FLAG) != null) await updateOrRelay(a, { [`flags.${NS}.-=${BLOOD_GOD_KILLS_FLAG}`]: null });
  }
}

/**
 * Насмешка над Жизнью: урон опускает Раны ниже 0 → раз в Раунд тест Т+10, успех — остаётся с 0 Ран.
 * Священное оружие обходит. Возвращает {net, note}.
 */
export async function mockeryOfLifeOnDamage(actor, { netDamage, sanctified = false } = {}) {
  const none = { net: netDamage, note: "" };
  if (!actor || !hasRuleFlag(actor, MOCKERY_CAP) || sanctified) return none;
  const wounds = Number(actor.system?.wounds?.value) || 0;
  if (!dropsBelowZero(wounds, netDamage)) return none;
  const combat = game.combat ?? null;
  if (!mockeryAvailable(flagOf(actor, MOCKERY_ROUND_FLAG), combat)) return none;
  const key = mockeryRoundKey(combat);
  if (key) await updateOrRelay(actor, { [`flags.${NS}.${MOCKERY_ROUND_FLAG}`]: key });
  const t = Number(actor.system?.characteristics?.t?.total) || 0;
  const threshold = t + MOCKERY_TEST_MOD;
  const roll = await new Roll("1d100").evaluate();
  const { success } = testOutcome(roll.total, threshold);
  await postTestCard(actor, {
    icon: rollIcon("shield", "#8fd0ff"), title: `Насмешка над Жизнью — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "T", base: t, parts: [`+${MOCKERY_TEST_MOD}`], threshold, rv: roll.total }),
    outcome: success
      ? `<span class="roll-success">Успех — остаётся с 0 Ран</span>`
      : `<span class="roll-failure">Провал — Раны опускаются ниже 0</span>`
  }, { rolls: [roll] });
  return success
    ? { net: mockeryCappedDamage(wounds), note: `<div class="dmg-tb-note">Насмешка над Жизнью: демон держится на 0 Ран.</div>` }
    : none;
}
