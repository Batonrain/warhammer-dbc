import { esc, _degWord } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { isCapabilityAvailable, markCapabilityUsed } from "../rules/cooldown.mjs";
import { grantTimedEffect, timedEffectsOf } from "./timed-effects.mjs";
import {
  PSYCHIC_SPRINT_KEY, PSYCHIC_SPRINT_EFFECT_KEY, PSYCHIC_SPRINT_SPD_KEY, PSYCHIC_SPRINT_EXTRA_ROUNDS,
  psychicSprintEpr, psychicSprintTestMod, psychicSprintThreshold, psychicSprintSpeedBonus, discountedMovementAp
} from "../rules/psychic-sprint.mjs";

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

export async function startPsychicSprint(actor) {
  if (!actor) return false;
  const epr = psychicSprintEpr(actor);
  if (epr < 1) {
    ui.notifications?.warn(`${actor.name}: Психический Рывок — нет Пси-Рейтинга (эPR 0).`);
    return false;
  }
  if (!isCapabilityAvailable(actor, PSYCHIC_SPRINT_KEY, "battle")) {
    ui.notifications?.warn(`${actor.name}: Психический Рывок уже применён в этом бою.`);
    return false;
  }
  const wp = Number(actor.system?.characteristics?.wp?.total) || 0;
  const mods = collectTestMods(actor, { kind: "skill", char: "wp" });
  const threshold = psychicSprintThreshold(wp, epr, mods.total);
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  await markCapabilityUsed(actor, PSYCHIC_SPRINT_KEY, "battle");

  const bonus = psychicSprintSpeedBonus(epr);
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
      outcome: outcomeHtml(false, `Провал (${deg} ${_degWord(deg)}) — рывка нет; Талант на этот бой потрачен`)
    }, { rolls: [roll] });
    return true;
  }
  const combat = globalThis.game?.combat?.started ? globalThis.game.combat : null;
  await grantTimedEffect(actor, {
    key: PSYCHIC_SPRINT_EFFECT_KEY, name: `Психический Рывок — SPD +${bonus}`, img: "icons/svg/wing.svg",
    changes: [{ key: PSYCHIC_SPRINT_SPD_KEY, type: "add", value: bonus }],
    duration: { value: 1, units: "rounds", expiry: "turnEnd" },
    span: PSYCHIC_SPRINT_EXTRA_ROUNDS
  });
  await postTestCard(actor, {
    icon, title, threshold: statLine,
    outcome: outcomeHtml(true, `Успех (${deg} ${_degWord(deg)}) — SPD +${bonus} на этот и следующий Раунд`),
    lines: [
      `<div class="roll-threshold">Прибавка к SPD <b>+${bonus}</b> учтена на листе временным эффектом: до конца Хода ${esc(actor.name)} в следующем Раунде${combat ? "" : " (срок пойдёт с началом боя)"}.</div>`,
      `<div class="roll-threshold">Полное Движение, Натиск и Бег на это время — на <b>1 ОД меньше</b>: цена в ОД спишется уже со скидкой. В бою Талант применяется один раз.</div>`
    ]
  }, { rolls: [roll] });
  return true;
}
