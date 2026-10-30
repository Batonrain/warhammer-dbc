// module/combat/running-throw.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Running Throw / Бросок на Бегу — Foundry-обвязка (правило и допущения — rules/throwing-talents.mjs).
//
//  1. Первое Движение Хода в бою (combat/movement-actions.mjs::markMovedThisTurn — и действия Движения, и перемещение
//     токена) → offerRunningThrow кладёт в чат карточку с кнопкой «Бросок на Бегу».
//  2. Клик (hooks.mjs, .wh-running-throw-btn) → resolveRunningThrowClick: «раз в Ход» тратится самой попыткой;
//     тест Acrobatics−10; Успех — метка runningThrowPending и карточка с кнопками метательного оружия.
//  3. Кнопка оружия (.wh-free-shot-btn, data-kind="runningThrow") → combat/free-shot.mjs::activateFreeShot открывает
//     обычное окно атаки в режиме «без ОД»: Rng S.b×2 (sheets/attack-dialog.mjs), не считается Атакой Хода.
//
//  Импортирует только rules/ и helpers/ — этот модуль тянет movement-actions.mjs, обратного импорта нет.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { SKILLS_DEF } from "../constants/skills.mjs";
import {
  hasRunningThrow, runningThrowEligibleWeapon, RUNNING_THROW_USED_FLAG, RUNNING_THROW_PENDING_FLAG, RUNNING_THROW_ACROBATICS_MOD
} from "../rules/throwing-talents.mjs";

const NS = "warhammer-dbc";

/** Метательное оружие под бросок: экипированное, а если такого нет — всё метательное (гранаты лежат в разгрузке). */
export function runningThrowWeapons(actor) {
  const all = [...(actor?.items ?? [])].filter(runningThrowEligibleWeapon);
  const equipped = all.filter(i => i.system?.equipped);
  return equipped.length ? equipped : all;
}

/** Порог Acrobatics−10: итог Навыка плюс общие модификаторы тестов Ловкости. */
export function runningThrowThreshold(actor) {
  const sk = actor?.system?.skills?.acrobatics;
  const charKey = SKILLS_DEF.acrobatics?.char ?? "ag";
  const acro = sk?.total != null ? Number(sk.total) : (Number(actor?.system?.characteristics?.[charKey]?.total) || 0);
  const mods = collectTestMods(actor, { kind: "skill", skill: "acrobatics", char: "ag" });
  return { base: acro, parts: mods.parts, threshold: acro + RUNNING_THROW_ACROBATICS_MOD + mods.total };
}

/**
 * Первое Движение Хода: предложить Бросок на Бегу. Вне боя и без Таланта — тишина; повторно в тот же Ход не предлагает.
 */
export async function offerRunningThrow(actor) {
  if (!actor || !game.combat?.started || !hasRunningThrow(actor)) return;
  if (actor.getFlag?.(NS, RUNNING_THROW_USED_FLAG)) return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("run", "#b0a080")}${esc(actor.name)} — Бросок на Бегу</div>
      <div class="roll-threshold">Раз в Ход, пока вы двигаетесь: Acrobatics−10 → дополнительный бросок метательным оружием или гранатой (не бомбой) свободным действием. Rng падает до S.b×2 м; Атакой Хода не считается. Тест тратит попытку, даже если провален.</div>
      <button class="wh-running-throw-btn" type="button" data-actor-uuid="${esc(actor.uuid)}">🤸 Бросок на Бегу — Acrobatics−10</button>
    </div>`
  });
}

/**
 * Клик «Бросок на Бегу».
 * @returns {Promise<boolean>} true — попытка потрачена (кнопку можно гасить)
 */
export async function resolveRunningThrowClick(actorUuid) {
  const actor = await fromUuid(actorUuid).catch(() => null);
  if (!actor) { ui.notifications.warn("⚠️ Бросок на Бегу: персонаж не найден."); return false; }
  if (actor.isOwner === false) { ui.notifications.warn("⚠️ Бросок на Бегу: решать может владелец персонажа (или ГМ)."); return false; }
  if (!hasRunningThrow(actor)) { ui.notifications.warn(`⚠️ ${actor.name}: нет Таланта «Бросок на Бегу».`); return false; }
  if (!game.combat?.started || !actor.getFlag?.(NS, "movedThisTurn")) {
    ui.notifications.warn("⚠️ Бросок на Бегу: нужен бой и Движение в этом Ходу (карточка могла остаться с прошлого Хода).");
    return false;
  }
  if (actor.getFlag?.(NS, RUNNING_THROW_USED_FLAG)) { ui.notifications.warn("⚠️ Бросок на Бегу: в этом Ходу попытка уже была."); return false; }
  const weapons = runningThrowWeapons(actor);
  if (!weapons.length) { ui.notifications.warn("⚠️ Бросок на Бегу: нет метательного оружия или гранаты (бомбой нельзя)."); return false; }

  // Попытка тратится сразу: пока идёт бросок, второй клик не должен её повторить.
  await actor.setFlag(NS, RUNNING_THROW_USED_FLAG, true);
  const { base, parts, threshold } = runningThrowThreshold(actor);
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  if (success) await actor.setFlag(NS, RUNNING_THROW_PENDING_FLAG, true);

  const buttons = weapons.map(w => `<button class="wh-free-shot-btn" type="button" data-kind="runningThrow" data-actor-uuid="${esc(actor.uuid)}" data-item-id="${esc(w.id)}">🎯 Бросок на Бегу: ${esc(w.name)}</button>`).join("");
  await postTestCard(actor, {
    icon: rollIcon("target", "#8fd0ff"),
    title: `Бросок на Бегу — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "Acrobatics−10", base, parts: [`${RUNNING_THROW_ACROBATICS_MOD}`, ...parts], threshold, rv: roll.total }),
    outcome: success
      ? `<span class="roll-success">Успех (${deg}) — дополнительный бросок свободным действием</span>`
      : `<span class="roll-failure">Провал — броска нет, попытка этого Хода потрачена</span>`,
    sections: success ? [`<div class="roll-threshold">Rng — S.b×2 м; Атакой Хода бросок не считается.</div>${buttons}`] : []
  }, { rolls: [roll] });
  return true;
}
