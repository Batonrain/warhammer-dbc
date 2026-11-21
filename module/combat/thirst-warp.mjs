// module/combat/thirst-warp.mjs
// ════════════════════════════════════════════════════════════════════════
//  Жажда Вампира против варп-оружия (Черта «The Thirst / Жажда», Sahara
//  583-5-t-10): «Урон от варп-оружия наносится в его Жажду, считая каждый
//  пункт как 5 Ран (расход Жажды округляется вверх); при этом его тошнит
//  кровью и он проходит тест T+10 или Оглушается на 1 Раунд».
//
//  Зовётся из applyDamageToActor (combat/damage.mjs) рядом с Саркофагом
//  Дредноута — тем же местом и по тому же признаку попадания (warpSoak):
//  после Поглощения, до Ран. Какой пул так работает и сколько Ран в пункте —
//  данные rules/resource-pools.mjs (KNOWN_RESOURCE_POOLS.thirst).
//  Тест T+10 — только когда Жажда что-то поглотила: пустой пул урон
//  пропускает в Раны как обычно, и «тошнить кровью» нечем.
// ════════════════════════════════════════════════════════════════════════

import { warpSoakPoolDef, warpPoolAbsorb, resourcePoolValue, resourceAmountLabel, resourcePoolMaxLabel } from "../rules/resource-pools.mjs";
import { rollResilienceTest } from "./resilience-test.mjs";
import { statusApplyFields } from "./status-resist.mjs";
import { conditionLevelField } from "../constants/conditions.mjs";

/**
 * Перехватить непоглощённый урон варп-оружия пулом (Жаждой).
 * @param {Actor} actor  цель
 * @param {number} rawNet урон после Поглощения
 * @returns {Promise<{net:number, note:string}>} net — что осталось Ранам
 */
export async function thirstWarpIntercept(actor, rawNet) {
  const dmg = Math.max(0, Number(rawNet) || 0);
  const def = dmg > 0 ? warpSoakPoolDef(actor) : null;
  if (!def) return { net: dmg, note: "" };
  const have = resourcePoolValue(actor, def.key, def);
  const r = warpPoolAbsorb(have, dmg, def.warpWoundsPerPoint);
  if (!r.spent) return { net: dmg, note: "" };
  await actor.update({ [`system.resourcePools.${def.key}`]: have - r.spent });
  let note = `${def.label}: урон варп-оружия ${r.absorbed} поглощён — потрачено ${resourceAmountLabel(def.key, r.spent, def)}`
    + ` (осталось ${have - r.spent} / ${resourcePoolMaxLabel(def)})${r.remaining ? `, ${r.remaining} — в Раны` : ""}.`;
  const test = await rollResilienceTest(actor, "t", {
    title: `${def.label}: тошнит кровью`, mod: 10, charLabel: "T",
    successText: "Устоял на ногах", failText: "Оглушён на 1 Раунд"
  });
  if (!test.success) {
    const field = conditionLevelField("stunned");
    const cur = field ? (Number(actor.system?.conditions?.[field]) || 0) : 0;
    const stun = await statusApplyFields(actor, "stunned", Math.max(cur, 1), { attacker: null, source: `${def.label}: варп-оружие` });
    if (Object.keys(stun.fields ?? {}).length) await actor.update(stun.fields);
    note += stun.note ? ` ${stun.note}` : " Тест T+10 провален — Оглушён на 1 Раунд.";
  } else {
    note += " Тест T+10 пройден.";
  }
  return { net: r.remaining, note };
}
