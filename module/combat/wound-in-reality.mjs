// module/combat/wound-in-reality.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Рана в Реальности (Талант Псайканы, Sahara 3-28, пачка I2): Foundry-обвязка к
//  rules/wound-in-reality.mjs — запись галочки «бесплатная» и согласование радиуса ауры.
//
//  Сама аура — штатный движок module/regions/auras.mjs: его флаг на Таланте ведёт
//  apps/mechanics.mjs::syncAuraFlag по записи kind:"aura" (радиус считает ключ «wound»
//  формулы — число бесплатных сил). Конструктор пересинхронизирует флаг сам только при
//  правке Механики, а радиус зависит ещё от поддержания и Порчи — их правки звать сюда.
// ════════════════════════════════════════════════════════════════════════════

import { syncAuraFlag } from "../apps/mechanics.mjs";
import {
  WOUND_FREE_FLAG, hasWoundInReality, woundInRealityTalents, woundFreeToggleGate
} from "../rules/wound-in-reality.mjs";

const NS = "warhammer-dbc";

/** Привести флаг ауры Таланта в соответствие с числом бесплатных сил и Порчей. */
export async function syncWoundAura(actor) {
  for (const t of woundInRealityTalents(actor)) {
    try { await syncAuraFlag(t); }
    catch (e) { console.warn("warhammer-dbc | Рана в Реальности: не обновить радиус ауры", e); }
  }
}

/**
 * Поставить/снять «бесплатно» у силы. Предмет-носитель — сама психосила (флаг на ней).
 * @param {{assumeSustained?:boolean}} opts окно манифестации: сила ещё не отмечена поддерживаемой
 * @returns {Promise<boolean>} получилось ли
 */
export async function setWoundFree(actor, power, on, { assumeSustained = false } = {}) {
  const gate = woundFreeToggleGate(actor, power, { off: !on, assumeSustained });
  if (!gate.ok) { ui.notifications?.warn(gate.reason); return false; }
  if (on) await power.setFlag(NS, WOUND_FREE_FLAG, true);
  else if (power.getFlag?.(NS, WOUND_FREE_FLAG)) await power.unsetFlag(NS, WOUND_FREE_FLAG);
  await syncWoundAura(actor);
  return true;
}

/**
 * Хук updateItem/deleteItem: правка психосилы, меняющая число бесплатных сил или их цену.
 * Пересинхронизирует радиус ауры. Чужое/несвязанное — молча мимо.
 */
export async function onWoundRelevantItemChange(item, changed) {
  const actor = item?.parent;
  if (!actor?.items || item.type !== "psychicPower" || !hasWoundInReality(actor)) return;
  if (!changed || touchesWoundSustain(changed)) await syncWoundAura(actor);
}

/** Хук updateActor: Порча меняет Cor.b, а с ним радиус. */
export async function onWoundRelevantActorChange(actor, changed) {
  if (!changed?.system?.corruption || !hasWoundInReality(actor)) return;
  await syncWoundAura(actor);
}

/** Правка касается поддержания или пометки «бесплатно» (в виде вложенного или «плоского» ключа). */
export function touchesWoundSustain(changed) {
  const sys = changed?.system ?? {};
  if ("isSustained" in sys || "sustainCost" in sys) return true;
  const flags = changed?.flags?.[NS] ?? {};
  if (WOUND_FREE_FLAG in flags || `-=${WOUND_FREE_FLAG}` in flags) return true;
  return Object.keys(changed ?? {}).some(k => k.startsWith(`flags.${NS}.`) && k.endsWith(WOUND_FREE_FLAG)
    || k === "system.isSustained" || k === "system.sustainCost");
}
