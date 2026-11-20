// module/combat/shared-pain.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Shared Pain / Общая Боль (Талант Одержимых, Симбиоз 4; Разобрать hzn79).
//  Книга: «В Проявлении: потратить ОБ, уменьшить непоглощённый урон до 1;
//  проигнорированный урон переносится на дух демона.»
//
//  Цепочка урона (combat/damage.mjs) спрашивает перед применением Ран — тот же
//  приём, что Гниль Внутри (combat/putrescence.mjs). У демона Двойного Духа нет
//  своего листа, поэтому перенесённый урон пишется строкой в карточку для ГМа.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { actorHasInfamyPoint, actorInfamyPath, spendFromInfamyPool } from "../apps/infamy-points.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";

export const hasSharedPain = actor => hasAbility(actor, "elite.talantyOderzhimyh.talantyArhetipa.sharedPain", "Shared Pain", "talent");

/** Предложить ли трату: Талант, Проявление, урон больше 1. */
export function sharedPainApplies(actor, netDamage) {
  return (Number(netDamage) || 0) > 1 && !!actor?.system?.possession?.manifested && hasSharedPain(actor);
}

export async function sharedPainOffer(actor, netDamage) {
  const net = Number(netDamage) || 0;
  if (!sharedPainApplies(actor, net) || !actorHasInfamyPoint(actor)) return { net, note: "" };
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Общая Боль" },
    content: `<p>${esc(actor.name)} получает непоглощённый урон <b>${net}</b>. Потратить Очко Бесчестия: урон → 1, остальные ${net - 1} принимает дух демона?</p>`,
    yes: { label: "Потратить Очко" }, no: { label: "Нет" }, rejectClose: false
  }).catch(() => false);
  if (!ok) return { net, note: "" };
  const path = actorInfamyPath(actor);
  const spend = await spendFromInfamyPool(actor, 1, path);
  if (!spend) return { net, note: "" };
  if (spend.poolSpent) await actor.update({ [path]: spend.poolValue });
  return { net: 1, note: `👥 Общая Боль: Очко Бесчестия, непоглощённый урон ${net} → 1; ${net - 1} урона принимает дух демона (ГМ учитывает).` };
}
