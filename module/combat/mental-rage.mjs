// module/combat/mental-rage.mjs
// ════════════════════════════════════════════════════════════════════════════
//  МЕНТАЛЬНЫЙ ГНЕВ / MENTAL RAGE — сторона Foundry (правила — rules/mental-rage.mjs).
//
//  Манифестация силы с признаком system.mindEffect по цели в Ярости с этим
//  Талантом: кастер получает Ступор на 1 Раунд, эффект силы для носителя
//  игнорируется. Срабатывает на самом решении воздействовать — исход
//  психотеста не важен (книга: «решивший воздействовать»).
//
//  Эффекты силы система сама не накладывает на цель (их ведёт стол), поэтому
//  «игнорируется» — строка на карточке манифестации; Ступор кастеру ложится
//  Состоянием.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { mentalRageTargets } from "../rules/mental-rage.mjs";
import { applyConditionWithDuration } from "./condition-effects.mjs";

/**
 * Применить Ментальный Гнев к кастеру. Пусто — ни одна цель не подходит.
 * @param {Actor} caster
 * @param {Item} power
 * @param {Actor[]} targetActors
 * @returns {Promise<string>} блок карточки манифестации
 */
export async function applyMentalRage(caster, power, targetActors) {
  const hit = mentalRageTargets(caster, power, targetActors);
  if (!hit.length) return "";
  const stupor = await applyConditionWithDuration(caster, "dazed", { value: 1, unit: "rounds" });
  const names = hit.map(t => esc(t.name)).join(", ");
  return `<div class="roll-threshold" style="color:#c07000;">😡 Ментальный Гнев (${names}): `
    + `<b>${esc(caster.name)}</b> ${stupor ? "получает <b>Ступор на 1 Раунд</b>" : "Ступор не получает (иммунитет)"}, `
    + `эффект «${esc(power.name)}» для ${names} игнорируется.</div>`;
}
