// module/combat/momentum.mjs — Foundry-обвязка Момента Гладиатора (правила — rules/momentum.mjs).
import { hasRuleFlag } from "../rules/flags.mjs";
import { updateOrRelay } from "./command-state.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import {
  MOMENTUM_CAP, MOMENTUM_FLAG, MOMENTUM_SEEN_FLAG, MOMENTUM_SPENDS,
  momentumMax, momentumAfter, momentumAttackCounts
} from "../rules/momentum.mjs";

const NS = "warhammer-dbc";
const flagOf = (actor, k) => actor?.flags?.[NS]?.[k] ?? actor?.getFlag?.(NS, k);

/** Текущие очки Момента (0 у тех, у кого Черты нет). */
export function momentumOf(actor) {
  return hasRuleFlag(actor, MOMENTUM_CAP) ? Math.max(0, Number(flagOf(actor, MOMENTUM_FLAG)) || 0) : 0;
}

/** Изменить Момент на delta в пределах 0…A.b; возвращает новое значение или null, если Черты нет. */
export async function addMomentum(actor, delta) {
  if (!actor || !hasRuleFlag(actor, MOMENTUM_CAP)) return null;
  const max = momentumMax(actor.system?.characteristics?.ag?.total);
  const next = momentumAfter(flagOf(actor, MOMENTUM_FLAG), delta, max);
  if (next !== (Number(flagOf(actor, MOMENTUM_FLAG)) || 0)) await updateOrRelay(actor, { [`flags.${NS}.${MOMENTUM_FLAG}`]: next });
  return next;
}

/** Помечает карточку как учтённую актором; true — отметка поставлена только что (очко начисляется), false — уже была. */
async function claimOnce(actor, messageId) {
  if (!messageId) return true;
  const seen = flagOf(actor, MOMENTUM_SEEN_FLAG);
  if (seen === messageId) return false;
  await updateOrRelay(actor, { [`flags.${NS}.${MOMENTUM_SEEN_FLAG}`]: messageId });
  return true;
}

/** Промах рукопашной или метательной атаки — −1 очко атакующему. */
export async function momentumOnAttackMiss(actor, { isMelee, weaponClass } = {}) {
  if (!momentumAttackCounts({ isMelee, weaponClass })) return;
  await addMomentum(actor, -1);
}

/** Успешное Избегание — +1 очко защитнику. */
export async function momentumOnEvade(actor) {
  await addMomentum(actor, +1);
}

/**
 * Попадание дошло до урона (не отменено Избеганием): атакующему-гладиатору +1 (рукопашная/метательная),
 * цели-гладиатору −1; на одну карточку атаки — по одному очку, сколько бы ни было попаданий.
 */
export async function momentumOnDamage({ attackerUuid, target, weaponUuid = "", melee = false, sourceMessageId = "" } = {}) {
  if (attackerUuid) {
    const attacker = await fromUuid(attackerUuid).catch(() => null);
    if (attacker && hasRuleFlag(attacker, MOMENTUM_CAP)) {
      const weapon = weaponUuid ? await fromUuid(weaponUuid).catch(() => null) : null;
      if (momentumAttackCounts({ isMelee: melee, weaponClass: weapon?.system?.weaponClass }) && await claimOnce(attacker, `d:${sourceMessageId}`)) {
        await addMomentum(attacker, +1);
      }
    }
  }
  if (target && hasRuleFlag(target, MOMENTUM_CAP) && await claimOnce(target, `t:${sourceMessageId}`)) await addMomentum(target, -1);
}

/** Конец боя: очки Момента сгорают у всех участников. */
export async function clearMomentum(combat) {
  for (const c of combat?.combatants ?? []) {
    const a = c.actor;
    if (a && flagOf(a, MOMENTUM_FLAG) != null) {
      await updateOrRelay(a, { [`flags.${NS}.-=${MOMENTUM_FLAG}`]: null, [`flags.${NS}.-=${MOMENTUM_SEEN_FLAG}`]: null });
    }
  }
}

/** Потратить 1 очко Момента на эффект (кнопки на Чертах). Эффект на тест игрок применяет по подсказке карточки. */
export async function spendMomentum(actor, kind) {
  const spend = MOMENTUM_SPENDS[kind];
  if (!spend) return ui.notifications.warn(`Момент: неизвестная трата «${kind}».`);
  if (!actor || !hasRuleFlag(actor, MOMENTUM_CAP)) return ui.notifications.warn("Момент: у персонажа нет Черты «Момент».");
  const have = momentumOf(actor);
  if (have < 1) return ui.notifications.warn(`${actor.name}: очков Момента нет.`);
  await addMomentum(actor, -1);
  if (spend.clears && actor.system?.conditions?.[spend.clears]) await actor.update(conditionRemoveFields(spend.clears));
  await postTestCard(actor, {
    icon: rollIcon("sword", "#e08a3a"), title: `Момент — ${esc(actor.name)}`,
    outcome: `<span class="roll-success">${esc(spend.label)}</span>`,
    sections: [`<div class="roll-threshold" style="font-size:0.85em;">${esc(spend.note)} Осталось очков Момента: <b>${have - 1}</b>.</div>`]
  }, { sound: false });
}
