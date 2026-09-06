// module/apps/hyper-growth.mjs
//
// Обвязка боеприпаса «Гиперрост» (wdbc-utaw) — см. module/rules/hyper-growth.mjs
// про арифметику и что честно не смоделировано. Вызывается из
// hooks.mjs::_applyWeaponPropEffect сразу после броска «доп. урона» Toxic:
// если боеприпас, которым нанесён именно этот тик яда, опознан по имени как
// «Гиперрост» (имя пришло через data-wp-ammo-name кнопки — см.
// combat/weapon-properties.mjs::buildTargetEffectButtons), цель получает
// столько же аблативных Ран. Возвращает HTML-заметку для ТОЙ ЖЕ карточки
// чата — отдельного сообщения не создаёт (тем же приёмом, что dmgNote рядом).

import { isHyperGrowthAmmoName, hyperGrowthGrant, hyperGrowthShrinkToFit, HYPER_GROWTH_FLAG } from "../rules/hyper-growth.mjs";

export { isHyperGrowthAmmoName };

const FLAG = "warhammer-dbc";

/**
 * Тик яда от Toxic на этом выстреле — если боеприпас Гиперрост и урон > 0,
 * цель получает столько же аблативных Ран. Иначе — "" (ничего не меняет).
 *
 * @param {Actor}  actor    ЦЕЛЬ (получатель аблатива, не владелец боеприпаса)
 * @param {object} opts
 * @param {string} opts.ammoName  имя заряженного боеприпаса этого выстрела
 * @param {number} opts.dmg       урон, только что нанесённый тиком яда
 */
export async function applyHyperGrowthTick(actor, { ammoName, dmg } = {}) {
  if (!actor || !isHyperGrowthAmmoName(ammoName)) return "";
  const prevContribution = Number(actor.getFlag(FLAG, HYPER_GROWTH_FLAG)) || 0;
  const result = hyperGrowthGrant(actor.system, prevContribution, dmg);
  if (!result) return "";

  await actor.update({
    "system.wounds.ablative": result.ablative,
    "system.wounds.ablativeMax": result.ablativeMax,
    [`flags.${FLAG}.${HYPER_GROWTH_FLAG}`]: result.contribution
  });

  return `<div class="roll-threshold">🧬 Гиперрост: цель получает <b>+${result.granted}</b> аблативных Ран (опухоль на месте попадания) → всего <b>${result.ablative}</b></div>`;
}

/**
 * Ресинк ПОСЛЕ того, как общий ablative пул цели уменьшился по другой причине
 * (поглощение боевого урона) — вызывать из хука updateActor при изменении
 * system.wounds.ablative ЛЮБОГО актора (тот же приём, что остальные
 * динамические источники аблатива, см. warhammer-dbc.mjs).
 */
export async function reconcileHyperGrowthToFit(actor) {
  const prev = Number(actor.getFlag(FLAG, HYPER_GROWTH_FLAG)) || 0;
  if (prev <= 0) return;
  const result = hyperGrowthShrinkToFit(actor.system, prev);
  if (!result) return;
  await actor.update({
    "system.wounds.ablativeMax": result.ablativeMax,
    [`flags.${FLAG}.${HYPER_GROWTH_FLAG}`]: result.contribution
  });
}
