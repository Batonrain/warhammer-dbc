import { esc, _degWord } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { isCapabilityAvailable, markCapabilityUsed } from "../rules/cooldown.mjs";
import { grantTimedEffect, timedEffectsOf } from "./timed-effects.mjs";
import {
  PSYCHIC_SPRINT_KEY, PSYCHIC_SPRINT_EFFECT_KEY, PSYCHIC_SPRINT_PENDING_FLAG,
  psychicSprintEpr, psychicSprintTestMod, psychicSprintThreshold, psychicSprintSpeedBonus, discountedMovementAp,
  psychicSprintPendingData, psychicSprintPendingOf, psychicSprintEffectSpec
} from "../rules/psychic-sprint.mjs";

const NS = "warhammer-dbc";

export function psychicSprintActive(actor) {
  return timedEffectsOf(actor, PSYCHIC_SPRINT_EFFECT_KEY)
    .some(e => !e.disabled && e.duration?.expired !== true);
}

export function movementApCost(actor, cost) {
  return discountedMovementAp(cost, psychicSprintActive(actor));
}

export function movementApNote(actor) {
  return psychicSprintActive(actor)
    ? `<div class="roll-threshold" style="font-size:0.85em;">Психический Рывок действует: Полное Движение, Натиск и Бег — на 1 ОД меньше (учтено).</div>`
    : "";
}

/**
 * Рывок, брошенный вне начатого боя, не может стать эффектом сразу: ядро Foundry вне боя помечает
 * срок в Раундах истёкшим. Результат ждёт на акторе флагом, пока бой не начнётся (processPsychicSprintCombatStart);
 * он же служит ячейкой «раз за бой» до боя — повторить Рывок, пока флаг висит, нельзя, провал тоже.
 */
export async function startPsychicSprint(actor) {
  if (!actor) return false;
  const epr = psychicSprintEpr(actor);
  if (epr < 1) {
    ui.notifications?.warn(`${actor.name}: Психический Рывок — нет Пси-Рейтинга (эPR 0).`);
    return false;
  }
  if (psychicSprintPendingOf(actor)) {
    ui.notifications?.warn(`${actor.name}: Психический Рывок уже брошен вне боя — его результат ждёт начала боя.`);
    return false;
  }
  const combat = globalThis.game?.combat?.started ? globalThis.game.combat : null;
  if (combat && !isCapabilityAvailable(actor, PSYCHIC_SPRINT_KEY, "battle")) {
    ui.notifications?.warn(`${actor.name}: Психический Рывок уже применён в этом бою.`);
    return false;
  }
  const wp = Number(actor.system?.characteristics?.wp?.total) || 0;
  const mods = collectTestMods(actor, { kind: "skill", char: "wp" });
  const threshold = psychicSprintThreshold(wp, epr, mods.total);
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  const bonus = psychicSprintSpeedBonus(epr);
  if (combat) await markCapabilityUsed(actor, PSYCHIC_SPRINT_KEY, "battle");
  else await actor.setFlag(NS, PSYCHIC_SPRINT_PENDING_FLAG, psychicSprintPendingData(success, bonus));

  const statLine = rollStatLine({
    label: "W", base: wp,
    parts: [`Рывок −30+3×эPR(${epr}) = ${psychicSprintTestMod(epr)}`, ...mods.parts],
    threshold, rv: roll.total
  });
  const title = `Психический Рывок — ${esc(actor.name)}`;
  const icon = rollIcon("run", "#9a7dff");
  if (!success) {
    await postTestCard(actor, {
      icon, title, threshold: statLine,
      outcome: outcomeHtml(false, `Провал (${deg} ${_degWord(deg)}) — рывка нет; Талант на ${combat ? "этот" : "ближайший"} бой потрачен`)
    }, { rolls: [roll] });
    return true;
  }
  if (!combat) {
    await postTestCard(actor, {
      icon, title, threshold: statLine,
      outcome: outcomeHtml(true, `Успех (${deg} ${_degWord(deg)}) — SPD +${bonus} на первый и второй Раунд боя`),
      lines: [
        `<div class="roll-threshold">Боя нет, поэтому эффект начнётся с началом боя: результат запомнен и превратится в эффект «Психический Рывок» в 1-м Раунде.</div>`,
        `<div class="roll-threshold">Талант на ближайший бой потрачен: повторить Рывок до боя и в этом бою нельзя.</div>`
      ]
    }, { rolls: [roll] });
    return true;
  }
  await grantTimedEffect(actor, psychicSprintEffectSpec(bonus));
  await postTestCard(actor, {
    icon, title, threshold: statLine,
    outcome: outcomeHtml(true, `Успех (${deg} ${_degWord(deg)}) — SPD +${bonus} на этот и следующий Раунд`),
    lines: [
      `<div class="roll-threshold">Прибавка к SPD <b>+${bonus}</b> учтена на листе временным эффектом: до конца Хода ${esc(actor.name)} в следующем Раунде.</div>`,
      `<div class="roll-threshold">Полное Движение, Натиск и Бег на это время — на <b>1 ОД меньше</b>: цена в ОД спишется уже со скидкой. В бою Талант применяется один раз.</div>`
    ]
  }, { rolls: [roll] });
  return true;
}

/**
 * Бой начался (первый updateCombat, пишет активный ГМ): участникам, у кого висит результат Рывка вне боя,
 * успех становится обычным эффектом 1-го Раунда этого боя, а Талант отмечается потраченным в нём.
 * Ожидание лежит на мировом акторе (кнопка с бокового листа) или на акторе токена (с листа токена) —
 * читаем и снимаем оба. Не участник боя ожидание сохраняет до своего боя; присоединившийся к уже начатому бою
 * получает эффект сразу (convertPsychicSprintPending из хука createCombatant).
 */
export async function convertPsychicSprintPending(combat, combatant, round = 1) {
  const actor = combatant?.actor;
  if (!actor) return false;
  const base = actor.isToken ? (actor.token?.baseActor ?? globalThis.game?.actors?.get?.(actor.id) ?? null) : null;
  const holders = [base, actor].filter(Boolean);
  const pending = holders.map(psychicSprintPendingOf).find(Boolean);
  if (!pending) return false;
  if (pending.success && pending.bonus > 0) {
    await grantTimedEffect(actor, { ...psychicSprintEffectSpec(pending.bonus), combat: { id: combat.id, round } });
  }
  await markCapabilityUsed(actor, PSYCHIC_SPRINT_KEY, "battle", combat.id);
  for (const holder of holders) {
    if (psychicSprintPendingOf(holder)) await holder.unsetFlag(NS, PSYCHIC_SPRINT_PENDING_FLAG);
  }
  return true;
}

export async function processPsychicSprintCombatStart(combat) {
  for (const combatant of combat?.combatants ?? []) await convertPsychicSprintPending(combat, combatant, 1);
}
