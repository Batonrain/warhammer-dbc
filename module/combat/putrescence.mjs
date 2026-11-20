// module/combat/putrescence.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Putrescence Within / Гниль Внутри (Черта Чумного Монаха; Разобрать u6c9x).
//  Книга: «Получив непоглощённый урон от рукопашного оружия, может потратить
//  Очко Бесчестия, чтобы уменьшить урон на Cor.b (до минимума в 1) и сделать
//  оружие бесполезным до конца сцены (сохраняет Reinforced). Оружие Наследия,
//  Демоническое и Священное оружие просто становится Poor.Q до конца сцены.»
//
//  Вопрос задаётся в цепочке урона (combat/damage.mjs) после всех слоёв
//  поглощения. Оружие помечается флагом PUTRESCENT_FLAG с прежним состоянием;
//  «сцена» — бой: deleteCombat (hooks.mjs) возвращает всё как было.
// ════════════════════════════════════════════════════════════════════════════

import { esc, relayItemUpdate } from "../helpers/utils.mjs";
import { actorHasInfamyPoint, actorInfamyPath, spendFromInfamyPool } from "../apps/infamy-points.mjs";
import { itemHasName } from "../rules/predicates.mjs";

const NS = "warhammer-dbc";
export const PUTRESCENT_FLAG = "putrescent";

export function hasPutrescenceWithin(actor) {
  return [...(actor?.items ?? [])].some(i => i?.type === "trait" && itemHasName(i, "Putrescence Within"));
}

/** Оружие Наследия, Демоническое или Священное — ему только Poor.Q. */
export function putrescenceResistant(weapon) {
  const s = weapon?.system ?? {};
  if (s.legacy?.historyKey || s.daemonWeapon?.bound) return true;
  return /sanctified|освящ|священ/i.test(String(s.special ?? "") + " " + String(s.properties ?? ""));
}

/** Урон после Гнили: −Cor.b, не меньше 1. */
export function putrescenceNet(net, corB) {
  return Math.max(1, (Number(net) || 0) - Math.max(0, Number(corB) || 0));
}

/** Порча оружия: что записать и как вернуть. */
export function putrescenceWeaponUpdate(weapon) {
  const s = weapon?.system ?? {};
  if (putrescenceResistant(weapon)) {
    return { [`system.quality`]: "poor", [`flags.${NS}.${PUTRESCENT_FLAG}`]: { quality: s.quality ?? "common" } };
  }
  return { "system.destroyed": true, [`flags.${NS}.${PUTRESCENT_FLAG}`]: { destroyed: !!s.destroyed } };
}

const confirm = (title, text, yes, no) => foundry.applications.api.DialogV2.confirm({
  window: { title }, content: `<p>${text}</p>`, yes: { label: yes }, no: { label: no }
}).then(r => !!r).catch(() => false);

/**
 * Предложение Гнили в цепочке урона. weaponUuid — рукопашное оружие атакующего.
 * @returns {Promise<{net:number, note:string}>}
 */
export async function putrescenceOffer(actor, netDamage, { melee = false, weaponUuid = "" } = {}) {
  const net = Number(netDamage) || 0;
  if (!actor || !melee || net <= 0 || !hasPutrescenceWithin(actor) || !actorHasInfamyPoint(actor)) return { net, note: "" };
  const corB = Math.max(0, Number(actor.system?.corruptionBonus) || 0);
  const weapon = weaponUuid ? await fromUuid(weaponUuid).catch(() => null) : null;
  const ok = await confirm("Гниль Внутри",
    `${esc(actor.name)} получает непоглощённый урон от рукопашного оружия: <b>${net}</b>. Потратить Очко Бесчестия: урон −${corB} (Cor.b, не меньше 1)${
      weapon ? `, а «${esc(weapon.name)}» ${putrescenceResistant(weapon) ? "становится Poor.Q" : "становится бесполезным"} до конца сцены` : ""}?`,
    "Потратить Очко", "Нет");
  if (!ok) return { net, note: "" };
  const path = actorInfamyPath(actor);
  const spend = await spendFromInfamyPool(actor, 1, path);
  if (!spend) return { net, note: "" };
  if (spend.poolSpent) await actor.update({ [path]: spend.poolValue });
  const out = putrescenceNet(net, corB);
  let weaponNote = "";
  if (weapon && !weapon.getFlag?.(NS, PUTRESCENT_FLAG)) {
    await relayItemUpdate(weapon, putrescenceWeaponUpdate(weapon));
    weaponNote = putrescenceResistant(weapon)
      ? ` «${esc(weapon.name)}» — Poor.Q до конца сцены.`
      : ` «${esc(weapon.name)}» размягчено и бесполезно до конца сцены (Reinforced сохраняет).`;
  }
  return { net: out, note: `🦠 Гниль Внутри: Очко Бесчестия, непоглощённый урон ${net} → ${out}.${weaponNote}` };
}

/** Конец сцены (боя): вернуть испорченное оружие участников. */
export async function restorePutrescentWeapons(actors = []) {
  for (const actor of actors) {
    for (const item of actor?.items ?? []) {
      const f = item.getFlag?.(NS, PUTRESCENT_FLAG);
      if (!f) continue;
      const data = { [`flags.${NS}.-=${PUTRESCENT_FLAG}`]: null };
      if (f.quality) data["system.quality"] = f.quality;
      if ("destroyed" in f) data["system.destroyed"] = !!f.destroyed;
      await relayItemUpdate(item, data);
    }
  }
}
