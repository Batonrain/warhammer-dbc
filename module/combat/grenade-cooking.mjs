// module/combat/grenade-cooking.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Grenade Cooking / Выдержка Гранаты — тест Logic(I)+0 ПЕРЕД броском гранаты (правило и допущения —
//  rules/throwing-talents.mjs).
//
//  Вызывается из combat/attack.mjs до броска атаки, когда в окне включена галочка «Выдержка Гранаты»
//  (sheets/attack/talent-toggles.mjs). Результат (Успех со степенями / Провал) идёт дальше в атаку:
//  Успех даёт −5×Успехи на Уклонение от этой гранаты (кнопки карточки), Провал — «Очень Ненадёжное»
//  (граната всё равно метается; метательное оружие в системе не клинит, поэтому отметка только в карточке).
//  Перебросы той же атаки (+10, Очко Судьбы) тест не повторяют — результат лежит в opts.talentPaid.cooking.
// ════════════════════════════════════════════════════════════════════════════

import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { grenadeCookingApplies } from "../rules/throwing-talents.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

/** Порог Logic(I)+0: итог Навыка Логика; если Навыка нет на листе — Int −20 (как у необученного). */
export function grenadeCookingThreshold(actor) {
  const skill = actor?.system?.skills?.logic;
  if (Number.isFinite(skill?.total)) return Number(skill.total);
  return (Number(actor?.system?.characteristics?.int?.total) || 0) - 20;
}

/**
 * Выдержка гранаты перед броском.
 * @param {Actor} actor
 * @param {object} p
 * @param {object} p.sys           system оружия
 * @param {boolean} p.isMelee
 * @param {object} p.toggles       opts.talentToggles окна
 * @param {?{success:boolean, deg:number}} [p.paid] уже брошенный тест (перебросы той же атаки)
 * @returns {Promise<?{success:boolean, deg:number, rv:number, threshold:number}>} null — тест не нужен
 */
export async function resolveGrenadeCooking(actor, { sys, isMelee = false, toggles = {}, paid = null } = {}) {
  if (paid) return paid;
  if (!grenadeCookingApplies(actor, { sys, isMelee, toggles })) return null;
  const base = grenadeCookingThreshold(actor);
  const mods = collectTestMods(actor, { kind: "skill", skill: "logic", char: "int" });
  const threshold = base + mods.total;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  await postTestCard(actor, {
    icon: rollIcon("target", "#8fd0ff"),
    title: `Выдержка Гранаты — ${esc(actor.name ?? "")}`,
    threshold: rollStatLine({ label: "Logic(I)+0", base, parts: mods.parts, threshold, rv: roll.total }),
    outcome: success
      ? `<span class="roll-success">Успех (${deg}) — Уклонение от гранаты −${5 * deg}</span>`
      : `<span class="roll-failure">Провал — граната Очень Ненадёжна; её всё равно нужно метнуть</span>`
  }, { rolls: [roll] });
  return { success, deg, rv: roll.total, threshold };
}
