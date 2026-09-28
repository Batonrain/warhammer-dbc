// module/apps/possession-attack.mjs
// ════════════════════════════════════════════════════════════════════════
//  Атака Одержимостью (Трейт «Possession / Одержимость», wdbc-q267, вариант
//  «а» по решению Сергея 26.09.2026): кнопка на Трейте бросает оба теста
//  W+0 сама, копит счёт, по 5 Успехам вселяет демона (контроль над телом —
//  rules/actor-control.mjs) или отбрасывает его (1d10 непоглощаемого урона,
//  запрет на 24 ч). Вторая кнопка — выход из хоста со всеми последствиями
//  книги. Арифметика — rules/possession-attack.mjs.
//
//  Не сделано (осталось столу): «Хост использует I/P/W демона и его WS/BS,
//  если они выше» — подмена Характеристик и Навыков чужого тела это отдельная
//  механика; сейчас демон играет хостом с его собственными значениями плюс
//  +10 S/T и +1d10+3 Ран.
// ════════════════════════════════════════════════════════════════════════

import {
  possessionStep, possessionBarredRemaining, possessionInRange, POSSESSION_GOAL,
  POSSESSION_ATTACK_FLAG, POSSESSION_BARRED_FLAG, POSSESSION_HOST_FLAG
} from "../rules/possession-attack.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { hasUnnaturalCharacteristic, unnaturalRating, unnaturalDegreeBonus } from "../rules/unnatural-characteristic.mjs";
import { establishControl, releaseControl, controlOf } from "../rules/actor-control.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { expectedPhase } from "../constants/effect-keys.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { measureTokens } from "../combat/tactical-map.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { applyCharDamage } from "../combat/char-damage.mjs";
import { DEFAULT_RECOVERY_HOURS } from "../rules/char-loss.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";
const ICON = rollIcon("skull", "#c86bff");

function tokenOf(actor) {
  return actor?.getActiveTokens?.()?.[0] ?? null;
}

async function rollWill(actor) {
  const mods = collectTestMods(actor, { kind: "characteristic", char: "wp" });
  const threshold = (Number(actor.system?.characteristics?.wp?.total) || 0) + mods.total;
  const roll = await new Roll("1d100").evaluate();
  const out = testOutcome(roll.total, threshold);
  // Unnatural W добавляет Успехи к удачному тесту (стр. 26).
  const deg = out.success ? out.deg + unnaturalDegreeBonus(unnaturalRating(actor, "wp")) : out.deg;
  return { roll, rv: roll.total, threshold, parts: mods.parts ?? [], success: out.success, deg,
           unnatural: hasUnnaturalCharacteristic(actor, "wp") };
}

const sideLine = (actor, r) =>
  `W (${esc(actor.name)}): <b>${r.threshold}</b>${r.parts.length ? ` (${r.parts.join(", ")})` : ""}`
  + ` → бросок <b>${r.rv}</b> — ${r.success ? "Успех" : "Провал"} ${r.deg}`;

/**
 * Один Ход Атаки Одержимостью по текущей цели (game.user.targets). Книга:
 * тест «в конце каждого Хода атакующего» — кнопку жмут в конце своего Хода.
 */
export async function attemptPossessionAttack(actor) {
  const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  if (!actor || !target) {
    ui.notifications?.warn("Выберите цель Атаки Одержимостью.");
    return null;
  }
  if (actor.getFlag(NS, POSSESSION_HOST_FLAG) || controlOf(target)) {
    ui.notifications?.warn(`${target.name} уже под чужим контролем.`);
    return null;
  }
  const worldTime = game.time?.worldTime ?? 0;
  const barred = possessionBarredRemaining(actor.getFlag(NS, POSSESSION_BARRED_FLAG), target.uuid, worldTime);
  if (barred > 0) {
    ui.notifications?.warn(`${target.name} уже отбросил демона — новая попытка через ${Math.ceil(barred / 3600)} ч.`);
    return null;
  }
  const dist = (() => {
    const a = tokenOf(actor), b = tokenOf(target);
    return a && b ? measureTokens(a, b)?.edgeM ?? null : null;
  })();
  const wpb = Number(actor.system?.characteristics?.wp?.bonus) || 0;
  if (!possessionInRange(wpb, dist)) {
    ui.notifications?.warn(`Цель дальше W.b (${wpb} м) — Атака Одержимостью не начинается.`);
    return null;
  }

  // Смена цели обнуляет счёт — расширенное действие идёт против одной жертвы.
  const prev = actor.getFlag(NS, POSSESSION_ATTACK_FLAG);
  const tally = prev?.targetUuid === target.uuid ? Number(prev.tally) || 0 : 0;

  const mine = await rollWill(actor);
  const theirs = await rollWill(target);
  const step = possessionStep(tally, mine, theirs);

  const lines = [sideLine(actor, mine), sideLine(target, theirs),
    `Счёт: ${tally} ${step.delta >= 0 ? "+" : "−"} ${Math.abs(step.delta)} = <b>${step.tally}</b> (нужно ±${POSSESSION_GOAL})`];

  if (step.outcome === "possessed") {
    await actor.unsetFlag(NS, POSSESSION_ATTACK_FLAG);
    const bonus = await possessHost(target, actor);
    lines.push(`<span class="roll-success">${esc(actor.name)} вселяется в ${esc(target.name)}!</span>`
      + ` Хост получает +10 S, +10 T и +${bonus} Ран (1d10+3); действует на Инициативе демона.`);
  } else if (step.outcome === "repelled") {
    await actor.unsetFlag(NS, POSSESSION_ATTACK_FLAG);
    const barredMap = { ...(actor.getFlag(NS, POSSESSION_BARRED_FLAG) ?? {}), [target.uuid]: worldTime };
    await actor.setFlag(NS, POSSESSION_BARRED_FLAG, barredMap);
    const dmg = await new Roll("1d10").evaluate();
    await applyWoundLoss(actor, dmg.total);
    lines.push(`<span class="roll-failure">${esc(target.name)} отбрасывает демона:`
      + ` ${dmg.total} непоглощаемого урона в Торс, повторная попытка — через 24 ч.</span>`);
    mine.extraRolls = [dmg];
  } else {
    await actor.setFlag(NS, POSSESSION_ATTACK_FLAG, { targetUuid: target.uuid, tally: step.tally });
    lines.push("Борьба продолжается — следующий тест в конце следующего Хода.");
  }

  await postTestCard(actor, {
    icon: ICON,
    title: `Атака Одержимостью — ${esc(actor.name)} → ${esc(target.name)}`,
    lines: lines.map(l => `<div class="roll-threshold">${l}</div>`)
  }, { rolls: [mine.roll, theirs.roll, ...(mine.extraRolls ?? [])] });
  return step;
}

/** Вселение: контроль над телом, +10 S/T эффектом, +1d10+3 Ран. */
async function possessHost(host, possessor) {
  await establishControl(host, possessor.uuid, { permanent: true });
  const r = await new Roll("1d10+3").evaluate();
  const bonus = r.total;
  const changes = ["s", "t"].map(k => {
    const key = `system.characteristics.${k}.totalFx`;
    return { key, type: "add", value: 10, phase: expectedPhase(key), priority: 0 };
  });
  await host.createEmbeddedDocuments("ActiveEffect", [{
    name: `Одержим: ${possessor.name}`, img: "icons/svg/daze.svg",
    system: { changes },
    flags: { [NS]: { [POSSESSION_HOST_FLAG]: possessor.uuid } }
  }]);
  const max = Number(host.system?.wounds?.max) || 0;
  const cur = Number(host.system?.wounds?.value) || 0;
  await host.update({
    "system.wounds.max": max + bonus,
    "system.wounds.value": cur + bonus,
    [`flags.${NS}.${POSSESSION_HOST_FLAG}`]: { possessorUuid: possessor.uuid, woundsBonus: bonus }
  });
  return bonus;
}

/**
 * Выход из хоста (свободное действие). actor — сам демон; хост находится по
 * флагу. Если хост жив — 3d10 урона всем Характеристикам и 1d10 Порчи.
 */
export async function leavePossessionHost(actor) {
  const host = (game.actors?.contents ?? []).find(a => a.getFlag?.(NS, POSSESSION_HOST_FLAG)?.possessorUuid === actor?.uuid)
    ?? canvas?.tokens?.placeables?.map(t => t.actor).find(a => a?.getFlag?.(NS, POSSESSION_HOST_FLAG)?.possessorUuid === actor?.uuid)
    ?? null;
  if (!host) {
    ui.notifications?.warn(`${actor?.name ?? "Демон"} ни в кого не вселён.`);
    return null;
  }
  const state = host.getFlag(NS, POSSESSION_HOST_FLAG);
  const fxIds = host.effects.filter(e => e.getFlag?.(NS, POSSESSION_HOST_FLAG)).map(e => e.id);
  if (fxIds.length) await host.deleteEmbeddedDocuments("ActiveEffect", fxIds);
  await releaseControl(host);

  const bonus = Number(state?.woundsBonus) || 0;
  const max = Math.max(1, (Number(host.system?.wounds?.max) || 0) - bonus);
  const cur = Math.min(max, (Number(host.system?.wounds?.value) || 0) - bonus);
  const upd = { "system.wounds.max": max, "system.wounds.value": Math.max(0, cur),
                [`flags.${NS}.-=${POSSESSION_HOST_FLAG}`]: null };

  const lines = [`${esc(actor.name)} покидает тело ${esc(host.name)}.`];
  const rolls = [];
  // «Если Хост пережил Одержимость» — мёртвое тело последствий не несёт.
  const survived = !host.statuses?.has?.("dead");
  const charRolls = {};
  if (survived) {
    for (const k of Object.keys(CHARACTERISTICS)) {
      if (!(k in (host.system?.characteristics ?? {}))) continue;
      const r = await new Roll("3d10").evaluate();
      rolls.push(r);
      charRolls[k] = r.total;
    }
    const cor = await new Roll("1d10").evaluate();
    rolls.push(cor);
    upd["system.corruption.value"] = (Number(host.system?.corruption?.value) || 0) + cor.total;
    lines.push(`Порча +${cor.total}.`);
  }
  await host.update(upd);
  // Урон в Характеристики — через единственную точку (combat/char-damage.mjs,
  // пол 0, восстановление, смерть от T = 0), порцией со своим темпом: «в 12
  // раз медленнее обычного» = 12 ч за пункт при обычном 1 ч (rules/char-loss.mjs).
  if (survived) {
    const dmg = [];
    for (const [k, amount] of Object.entries(charRolls)) {
      const { applied } = await applyCharDamage(host, k, amount,
        { portion: { hours: 12 * DEFAULT_RECOVERY_HOURS, source: "Одержимость" } });
      dmg.push(`${CHARACTERISTICS[k].abbr} −${applied}`);
    }
    lines.push(`Хост пережил Одержимость: урон Характеристикам — ${dmg.join(", ")}.`,
      "Этот урон восстанавливается в 12 раз медленнее обычного.");
  }
  await postTestCard(actor, {
    icon: ICON, title: `Одержимость окончена — ${esc(host.name)}`,
    lines: lines.map(l => `<div class="roll-threshold">${l}</div>`)
  }, { rolls });
  return { host, survived };
}
