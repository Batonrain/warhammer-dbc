// module/combat/purity-of-battle.mjs
// ════════════════════════════════════════════════════════════════════════
//  Purity of Battle / Чистота Битвы (Дар Кхорна, wdbc-1rno): «За полное
//  действие (даже находясь в Ярости) персонаж может потратить Очко
//  Бесчестия, чтобы выпустить из себя сферическую волну радиусом Cor.b м.
//  Со всех персонажей в этом радиусе немедленно снимаются эффекты боевых
//  наркотиков, психосил и техночудес, и они не могут подвергаться снятым с
//  них эффектам до конца боя или сцены.»
//
//  Три категории эффектов книги — три разных источника данных в системе:
//   • Боевые наркотики — предмет type:"drug" на самой цели с
//     system.activeEffect.isActive (тот же путь снятия, что уже даёт
//     "counteractsDrugs" в sheets/tabs/drugs.mjs — Purity of Battle его не
//     импортирует, чтобы не тянуть Foundry-тяжёлый модуль листа, но
//     обнуляет ТЕ ЖЕ поля, что и он).
//   • Психосилы — ДВА случая: (а) цель сама поддерживает психосилу на себе
//     (isSustained на её же предмете); (б) кто-то ДРУГОЙ поддерживает
//     психосилу, чья ТЕКУЩАЯ цель — этот персонаж (item.system.
//     sustainedTargetUuid === цель, тот же приём, что уже читает
//     rules/psychic-sustain-target.mjs, только здесь не читаем правило, а
//     СНИМАЕМ поддержание у источника). Навигаторские силы цели не имеют —
//     у navigator-power.mjs нет sustainedTargetUuid, только self-buff.
//   • Техночудеса — ЧЕСТНО НЕ снимаются: type:"techPower" не несёт
//     isSustained вообще нигде в схеме (тот же вывод, что уже
//     задокументирован в module/rules/sundering.mjs про копии Разделения —
//     "техночудеса не имеют isSustained вообще нигде в системе, копировать
//     нечего"), здесь то же самое — снимать нечего программно.
//
//  «Не могут подвергаться повторно наложенным эффектам до конца боя/сцены»
//  — ЧЕСТНО НЕ автоматизировано: потребовало бы гейта в КАЖДОЙ точке, где
//  наркотик/психосила накладываются (sheets/tabs/drugs.mjs::applyDrugEffect,
//  sheets/tabs/psychic.mjs::toggle поддержания) — общесистемная правка ради
//  одной находки, тот же класс решения, что уже принят у Hidden
//  Threat/False Witness этого же тикета.
// ════════════════════════════════════════════════════════════════════════

import { tokensWithinRadius } from "../rules/aoe-target.mjs";

/** Актор снимает СВОИ активные боевые наркотики — {names, updates}. */
function clearOwnDrugs(actor) {
  const cleared = [];
  const updates = [];
  for (const item of actor?.items ?? []) {
    if (item.type !== "drug" || !item.system?.activeEffect?.isActive) continue;
    cleared.push(item.name);
    updates.push({
      _id: item.id,
      "system.activeEffect.isActive": false,
      "system.activeEffect.isAfterEffect": false,
      "system.activeEffect.roundsRemaining": 0,
      "system.activeEffect.charDamageStat": "",
      "system.activeEffect.charDamageAmount": 0
    });
  }
  return { cleared, updates };
}

/** Актор снимает СВОЁ поддержание своих же психосил/навигаторских сил (self-buff). */
function clearOwnSustainedPowers(actor) {
  const cleared = [];
  const updates = [];
  for (const item of actor?.items ?? []) {
    if ((item.type !== "psychicPower" && item.type !== "navigatorPower") || !item.system?.isSustained) continue;
    cleared.push(item.name);
    const patch = { _id: item.id, "system.isSustained": false, "system.sustainedDegree": null };
    if (item.type === "psychicPower") patch["system.sustainedTargetUuid"] = "";
    updates.push(patch);
  }
  return { cleared, updates };
}

/**
 * Психосилы ЧУЖИХ акторов, чья текущая цель поддержания — targetActor —
 * возвращает {casterActor, item} пары для снятия на СТОРОНЕ источника.
 */
function foreignSustainedPowersTargeting(targetActor) {
  if (typeof game === "undefined" || !targetActor?.uuid) return [];
  const out = [];
  for (const caster of game.actors ?? []) {
    if (caster === targetActor) continue;
    for (const item of caster?.items ?? []) {
      if (item.type !== "psychicPower" || !item.system?.isSustained) continue;
      if (item.system?.sustainedTargetUuid !== targetActor.uuid) continue;
      out.push({ casterActor: caster, item });
    }
  }
  return out;
}

/**
 * Снять боевые наркотики + психосилы (свои и чужие, нацеленные на цель) со
 * ОДНОГО персонажа. Возвращает сводку для карточки — {name, drugs[], powers[]}.
 * Техночудеса — не трогает (см. шапку файла).
 */
export async function purgeBattleBuffsFrom(targetActor) {
  if (!targetActor) return { name: "", drugs: [], powers: [] };
  const drugs = clearOwnDrugs(targetActor);
  const ownPowers = clearOwnSustainedPowers(targetActor);
  if (drugs.updates.length) await targetActor.updateEmbeddedDocuments("Item", drugs.updates);
  if (ownPowers.updates.length) await targetActor.updateEmbeddedDocuments("Item", ownPowers.updates);

  const foreignCleared = [];
  const byCaster = new Map();
  for (const { casterActor, item } of foreignSustainedPowersTargeting(targetActor)) {
    foreignCleared.push(item.name);
    const patch = { _id: item.id, "system.isSustained": false, "system.sustainedDegree": null, "system.sustainedTargetUuid": "" };
    if (!byCaster.has(casterActor)) byCaster.set(casterActor, []);
    byCaster.get(casterActor).push(patch);
  }
  for (const [casterActor, patches] of byCaster) {
    await casterActor.updateEmbeddedDocuments("Item", patches);
  }

  return {
    name: targetActor.name,
    drugs: drugs.cleared,
    powers: [...ownPowers.cleared, ...foreignCleared]
  };
}

/**
 * Вся сферическая волна разом — все токены в радиусе Cor.b м от кастера,
 * ВКЛЮЧАЯ его самого (книга не оговаривает исключение — "со всех
 * персонажей в этом радиусе"). Возвращает список сводок purgeBattleBuffsFrom
 * по каждому затронутому актору (только те, у кого реально что-то снято).
 */
export async function purityOfBattleWave(casterTokenDoc, radiusMeters) {
  const targets = tokensWithinRadius(casterTokenDoc, radiusMeters, { includeSelf: true });
  const summaries = [];
  for (const tokenDoc of targets) {
    const actor = tokenDoc?.actor;
    if (!actor) continue;
    const summary = await purgeBattleBuffsFrom(actor);
    if (summary.drugs.length || summary.powers.length) summaries.push(summary);
  }
  return summaries;
}
