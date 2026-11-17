// module/combat/khorne-berserker.mjs
// ════════════════════════════════════════════════════════════════════════
//  Берсерк Кхорна (Элитный архетип, глава 3, Sahara 1-54b9) — Foundry-обвязка
//  к чистой логике rules/khorne-berserker.mjs.
//
//   • Гвозди Мясника — карточка-выбор «тест W+10 или Ярость» при непоглощённом
//     уроне (damage.mjs) и по кнопке вкладки БОЙ (оскорбление, угроза); Помеха
//     на выход из Ярости (combat/rage-behavior.mjs); Прорыв при каждой успешной
//     манифестации (sheets/tabs/psychic.mjs).
//   • Красная Полоса — кнопка вкладки БОЙ: 1 непоглощаемый R урон себе.
//   • Ему Не Важно — дополнительная Реакция только на Яростный Штурм
//     (sheets/attack/dialog.mjs::payTalentAttack).
//   • Кровавое Подношение, Подношение Черепов — убийство рукопашным оружием
//     (sheets/tabs/body.mjs::setDeceased); Закалённое в Крови — урон
//     (damage.mjs); конец Хода и конец боя — hooks.mjs.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { autoTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { isInRage } from "../rules/rage.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import { actionBlockReason, canSpendReaction, isOwnTurn, spendReaction } from "./action-economy.mjs";
import { combatOfActor } from "./actor-combat.mjs";
import {
  BLOOD_OFFERING_FLAG, FOR_HE_CARES_NOT_FLAG, RED_STREAK_DAMAGE, SKULL_OFFERING_BONUS, SKULL_OFFERING_FLAG, TEMPERED_FLAG,
  bloodOfferingActive, bloodOfferingDamage, bloodOfferingMark, bloodOfferingTurnEnd, extraFuriousReactionReady,
  hasBloodOffering, hasButchersNails, hasRedStreak, hasRendingMeleeWeapon, hasSkullOffering,
  hasTemperedInBlood, isRendingMelee, nailsTestNeeded, nailsThreshold, paintItRedApplies, skullOfferingMark,
  temperedAdd
} from "../rules/khorne-berserker.mjs";
import { LEADER_OR_CHAMPION_FLAG, LORD_MIGHT_FLAG } from "../rules/berserker-talents.mjs";

const NS = "warhammer-dbc";

/** Бой, в котором участвует актор (иначе открытый в трекере; пусто — боя нет). */
export const combatIdOf = actor => combatOfActor(actor)?.id ?? globalThis.game?.combat?.id ?? "";

// ── Гвозди Мясника: срыв в Ярость ──────────────────────────────────────────

/**
 * Карточка-выбор: «тест W+10 или Ярость, можно намеренно провалить». Решает владелец (hooks.mjs, .wh-nails-*-btn).
 * @returns {Promise<ChatMessage|null>}
 */
export async function postNailsGateCard(actor, reason) {
  if (!actor) return null;
  return postTestCard(actor, {
    icon: "🔩", title: `Гвозди Мясника — ${esc(actor.name)}`, actorUuid: actor.uuid,
    lines: [`<div class="roll-threshold">${esc(reason)}: тест W+10, иначе Ярость. Можно намеренно провалить его — сразу впасть в Ярость.</div>`],
    sections: [`<div class="roll-defense-section wh-owner-only" data-actor-uuid="${esc(actor.uuid)}">
      <div class="roll-defense-btns">
        <button type="button" class="wh-nails-roll-btn" data-actor-uuid="${esc(actor.uuid)}">🎲 Тест W+10</button>
        <button type="button" class="wh-nails-give-btn" data-actor-uuid="${esc(actor.uuid)}">😡 Впасть в Ярость</button>
      </div></div>`]
  }, { sound: false, flags: { [NS]: { nailsGate: { actorUuid: actor.uuid } } } });
}

/**
 * Непоглощённый урон (damage.mjs, после списания Ран): носитель Гвоздей, ещё не в Ярости, получает карточку-выбор.
 * @returns {Promise<string>} строка для карточки урона или ""
 */
export async function butchersNailsOnDamage(actor, netDamage) {
  if (!nailsTestNeeded(actor, netDamage)) return "";
  await postNailsGateCard(actor, "Непоглощённый урон");
  return `<div class="dmg-tb-note">🔩 Гвозди Мясника: тест W+10 или Ярость — карточка в чате.</div>`;
}

/** Впасть в Ярость (намеренный провал или провал теста). */
async function enterRage(actor) {
  if (isInRage(actor)) return;
  await actor.update({ "system.inRage": true });
}

/** Тест W+10 против срыва: провал — Ярость. */
export async function rollNailsTest(actor, reason = "") {
  if (!hasButchersNails(actor)) return null;
  if (isInRage(actor)) { ui.notifications?.info?.(`${actor.name}: уже в Ярости.`); return null; }
  const wp = Number(actor.system?.characteristics?.wp?.total) || 0;
  const mods = autoTestMods(actor, { kind: "skill", char: "wp" });
  const threshold = nailsThreshold(wp, mods.total);
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  if (!success) await enterRage(actor);
  await postTestCard(actor, {
    icon: "🔩", title: `Гвозди Мясника: тест W+10 — ${esc(actor.name)}`, actorUuid: actor.uuid,
    threshold: rollStatLine({ prefix: reason, label: "W", base: wp, parts: ["Гвозди +10", ...mods.parts], threshold, rv: roll.total }),
    outcome: success
      ? outcomeHtml(true, "Успех — удерживается от срыва")
      : outcomeHtml(false, `Провал (${deg}) — впадает в Ярость`)
  }, { rolls: [roll] });
  return success;
}

/** Намеренно провалить тест: сразу в Ярость, без броска. */
export async function giveInToNails(actor) {
  if (!hasButchersNails(actor) || isInRage(actor)) return false;
  await enterRage(actor);
  await postTestCard(actor, {
    icon: "🔩", title: `Гвозди Мясника — ${esc(actor.name)}`, actorUuid: actor.uuid,
    outcome: outcomeHtml(false, "Намеренно проваливает тест — впадает в Ярость")
  }, { sound: false });
  return true;
}

/** Кнопка вкладки БОЙ: оскорбление или угроза — тот же выбор «тест W+10 или Ярость». */
export async function provokeNails(actor) {
  if (!hasButchersNails(actor)) return null;
  if (isInRage(actor)) { ui.notifications?.info?.(`${actor.name}: уже в Ярости.`); return null; }
  return postNailsGateCard(actor, "Оскорбление или угроза");
}

// ── Красная Полоса ──────────────────────────────────────────────────────────

/** Свободное действие: 1 непоглощаемый R урон себе, по желанию — Кровотечение. */
export async function useRedStreak(actor) {
  if (!hasRedStreak(actor)) return false;
  if (!hasRendingMeleeWeapon(actor)) {
    ui.notifications?.warn("Красная Полоса: нужно рукопашное оружие, наносящее R Dmg.");
    return false;
  }
  const bleed = await foundry.applications.api.DialogV2.confirm({
    window: { title: `Красная Полоса — ${actor.name}` },
    content: `<p>${esc(actor.name)} наносит себе ${RED_STREAK_DAMAGE} непоглощаемого R урона и покрывает клинки кровью. Нанести себе ещё и Кровотечение?</p>`,
    yes: { label: "С Кровотечением" }, no: { label: "Только урон" }, rejectClose: false
  });
  if (bleed === null) return false;
  await applyWoundLoss(actor, RED_STREAK_DAMAGE);
  let bleedNote = "";
  if (bleed) {
    const fields = conditionApplyFields("bleeding", null, actor);
    if (Object.keys(fields).length) { await actor.update(fields); bleedNote = " и Кровотечение"; }
  }
  await postTestCard(actor, {
    icon: rollIcon("blood", "#ff6b6b"), title: `Красная Полоса — ${esc(actor.name)}`, actorUuid: actor.uuid,
    lines: [`<div class="roll-threshold">${esc(actor.name)} наносит себе ${RED_STREAK_DAMAGE} непоглощаемого R урона${bleedNote} — клинки покрыты кровью (свободное действие).</div>`]
  }, { sound: false });
  if (hasButchersNails(actor) && nailsTestNeeded(actor, RED_STREAK_DAMAGE)) await postNailsGateCard(actor, "Непоглощённый урон (Красная Полоса)");
  return true;
}

// ── Ему Не Важно: дополнительная Реакция ────────────────────────────────────

/** Доступна ли дополнительная Реакция «только на Яростный Штурм». */
export function furiousExtraReactionAvailable(actor) {
  return extraFuriousReactionReady(actor) && !actionBlockReason(actor, { physical: true });
}

/** Может ли актор заплатить Реакцию за Яростный Штурм — обычную или дополнительную. */
export function canPayFuriousReaction(actor) {
  return canSpendReaction(actor) || furiousExtraReactionAvailable(actor);
}

/** Платит за Яростный Штурм: сначала дополнительной Реакцией (она ни на что другое не годится), потом обычной. */
export async function payFuriousReaction(actor) {
  if (furiousExtraReactionAvailable(actor)) {
    await actor.setFlag(NS, FOR_HE_CARES_NOT_FLAG, true);
    return true;
  }
  return spendReaction(actor);
}

// ── Окрась Всё в Красный ────────────────────────────────────────────────────

/** Добавочная пилюля Кровотечения для Критического Эффекта, вызванного таким оружием. */
export async function paintItRedBleeds(attackerUuid, weaponUuid) {
  if (!attackerUuid || !weaponUuid) return false;
  const attacker = await fromUuid(attackerUuid).catch(() => null);
  const weapon = await fromUuid(weaponUuid).catch(() => null);
  return !!attacker && !!weapon && paintItRedApplies(attacker.actor ?? attacker, weapon);
}

// ── Закалённое в Крови ──────────────────────────────────────────────────────

/** Рукопашное R-оружие нанесло ≥1 урона — до конца боя его не выбить (damage.mjs). */
export async function temperedOnDamage(attackerUuid, weaponUuid, netDamage) {
  if (!(Number(netDamage) >= 1) || !attackerUuid || !weaponUuid) return;
  const attacker = await fromUuid(attackerUuid).catch(() => null);
  const actor = attacker?.actor ?? attacker;
  if (!actor || !hasTemperedInBlood(actor)) return;
  const weapon = await fromUuid(weaponUuid).catch(() => null);
  if (!weapon || weapon.parent?.id !== actor.id || !isRendingMelee(weapon)) return;
  const combatId = combatIdOf(actor);
  const prev = actor.getFlag?.(NS, TEMPERED_FLAG);
  if (prev && (prev.combatId ?? "") === combatId && (prev.weaponIds ?? []).includes(weapon.id)) return;
  await actor.setFlag(NS, TEMPERED_FLAG, temperedAdd(prev, weapon.id, combatId));
}

// ── Кровавое Подношение ─────────────────────────────────────────────────────

/** Бонус следующего попадания этим оружием: {dmg, sanctified}; нули — метки нет. */
export function bloodOfferingForAttack(actor, weapon) {
  const none = { dmg: 0, sanctified: false };
  if (!hasBloodOffering(actor) || !weapon?.uuid) return none;
  const flag = actor.getFlag?.(NS, BLOOD_OFFERING_FLAG);
  if (!bloodOfferingActive(flag, weapon.uuid, combatIdOf(actor))) return none;
  return { dmg: bloodOfferingDamage(actor.system?.corruptionBonus), sanctified: true };
}

/** Попадание состоялось — метка израсходована. */
export async function consumeBloodOffering(actor, weapon, hit) {
  if (!hit || !weapon?.uuid) return;
  const flag = actor.getFlag?.(NS, BLOOD_OFFERING_FLAG);
  if (bloodOfferingActive(flag, weapon.uuid, combatIdOf(actor))) await actor.unsetFlag(NS, BLOOD_OFFERING_FLAG);
}

/** Конец Хода владельца: «если в течение Cor.b Ходов оружие не наносит попаданий» метка теряется. */
export async function khorneTurnEnd(actor) {
  const flag = actor?.getFlag?.(NS, BLOOD_OFFERING_FLAG);
  if (!flag) return;
  const next = bloodOfferingTurnEnd(flag);
  if (next) await actor.setFlag(NS, BLOOD_OFFERING_FLAG, next);
  else await actor.unsetFlag(NS, BLOOD_OFFERING_FLAG);
}

/** Конец боя: метки боя снимаются у всех участников. */
export async function clearKhorneCombat(combat) {
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor;
    if (!actor) continue;
    for (const key of [SKULL_OFFERING_FLAG, BLOOD_OFFERING_FLAG, TEMPERED_FLAG]) {
      if (actor.getFlag?.(NS, key)) await actor.unsetFlag(NS, key);
    }
  }
}

// ── Убийство: Кровавое Подношение и Подношение Черепов ──────────────────────

const flagOf = (actor, key) => actor?.getFlag?.(NS, key) ?? actor?.flags?.[NS]?.[key];

/**
 * Смерть признана (sheets/tabs/body.mjs::setDeceased): убийца с Талантами получает метку Кровавого Подношения и
 * карточку Подношения Черепов.
 * @param {Actor} victim
 * @param {Item}  weapon  оружие последнего ранения; weapon.parent — убийца
 */
export async function registerKhorneKill(victim, weapon) {
  const killer = weapon?.actor ?? weapon?.parent ?? null;
  if (!killer || !victim || killer === victim) return;
  if (weapon.system?.weaponClass !== "melee") return;
  const combatId = combatIdOf(killer);

  if (hasBloodOffering(killer) && isRendingMelee(weapon)) {
    const corBonus = Number(killer.system?.corruptionBonus) || 0;
    await killer.setFlag(NS, BLOOD_OFFERING_FLAG, bloodOfferingMark({ weaponUuid: weapon.uuid, corBonus, combatId, ownTurn: !!combatId && isOwnTurn(killer) }));
    await postTestCard(killer, {
      icon: rollIcon("skull", "#ff6b6b"), title: `Кровавое Подношение — ${esc(killer.name)}`,
      lines: [`<div class="roll-threshold">${esc(killer.name)} убил(а) ${esc(victim.name)} оружием «${esc(weapon.name)}» (R Dmg): `
        + `следующее попадание этим оружием — <b>+${bloodOfferingDamage(corBonus)} Dmg</b> и свойство <b>Освящённое</b>; `
        + `метка пропадёт, если за ${Math.max(1, corBonus)} Ходов (Cor.b) попаданий не будет.</div>`]
    }, { sound: false });
  }

  if (hasSkullOffering(killer)) {
    const notable = flagOf(victim, LEADER_OR_CHAMPION_FLAG) || flagOf(victim, LORD_MIGHT_FLAG);
    await postSkullOfferingCard(killer, victim, { notable: !!notable });
  }
}

/** Карточка: достойный ли противник (решает ГМ), обезглавил ли смертельный удар; кнопки читает hooks.mjs. */
export async function postSkullOfferingCard(killer, victim, { notable = false } = {}) {
  return postTestCard(killer, {
    icon: rollIcon("skull", "#ff6b6b"), title: `Подношение Черепов — ${esc(killer.name)}`, actorUuid: killer.uuid,
    lines: [`<div class="roll-threshold">${esc(killer.name)} убил(а) ${esc(victim.name)} в рукопашной. `
      + (notable ? "Лидер или чемпион по метке ГМа — достойный противник. " : "Достойный ли это противник (командир, чемпион, лорд, массивное чудовище), решает ГМ. ")
      + `Если так — Реакцией обезглавить труп и получить <b>+${SKULL_OFFERING_BONUS} Dmg</b> ко всему рукопашному урону до конца боя `
      + `(без Реакции, если смертельный удар и так обезглавил).</div>`],
    sections: [`<div class="roll-defense-section wh-owner-only" data-actor-uuid="${esc(killer.uuid)}">
      <div class="roll-defense-btns">
        <button type="button" class="wh-skull-offering-btn" data-killer-uuid="${esc(killer.uuid)}" data-decapitated="0"
          title="Потратить Реакцию, обезглавить труп: +2 Dmg ко всему рукопашному урону до конца боя">💀 Обезглавить (Реакция)</button>
        <button type="button" class="wh-skull-offering-btn" data-killer-uuid="${esc(killer.uuid)}" data-decapitated="1"
          title="Смертельный удар и так обезглавил противника: бонус без траты Реакции">💀 Удар обезглавил (без Реакции)</button>
      </div></div>`]
  }, { sound: false, flags: { [NS]: { skullOffering: { killerUuid: killer.uuid } } } });
}

/** Принять Подношение: Реакция (если голову не снёс сам удар), метка до конца боя. */
export async function claimSkullOffering(killer, { decapitated = false } = {}) {
  if (!hasSkullOffering(killer)) { ui.notifications?.warn(`${killer?.name ?? "?"}: нет Таланта «Подношение Черепов».`); return false; }
  if (!decapitated && !(await spendReaction(killer))) return false;
  await killer.setFlag(NS, SKULL_OFFERING_FLAG, skullOfferingMark(combatIdOf(killer)));
  await postTestCard(killer, {
    icon: rollIcon("skull", "#ff6b6b"), title: `Подношение Черепов — ${esc(killer.name)}`, actorUuid: killer.uuid,
    outcome: outcomeHtml(true, `+${SKULL_OFFERING_BONUS} Dmg ко всему рукопашному урону до конца боя${decapitated ? " (Реакция не потрачена)" : ""}`)
  }, { sound: false });
  return true;
}

