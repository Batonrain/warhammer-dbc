// module/combat/weapon-repair.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ПОЧИНИТЬ УНИЧТОЖЕННОЕ ОРУЖИЕ (Sahara system-destroyed п.1).
//
//  system.destroyed ставят Выпуск Батареи (Batpack Dump), Расплавление
//  (Meltdown), Отложенный взрыв, Кровавое Пламя и поломка оружия Огрина;
//  снимали его только Экстренное Обслуживание и Песнь Перерождения. Книга не
//  даёт общей цены ремонта, поэтому здесь — решение стола: кнопка «Починить»
//  на листе у значка «Уничтожено» просто снимает метку (владелец актора или
//  ГМ). Тест на ремонт и затраты Мастерской стол назначает сам.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { JURY_RIGGED_FLAG, hasJuryRigging, qualityStepDown, juryRiggedOriginal } from "../rules/jury-rigging.mjs";
import { spendActionPoints, isEncounterActive } from "./action-economy.mjs";

/**
 * @param {Actor} actor  владелец оружия (проверяются права)
 * @param {Item}  item   оружие с system.destroyed
 * @returns {Promise<boolean>} true — метка снята
 */
export async function repairDestroyedWeapon(actor, item) {
  if (!item?.system?.destroyed) return false;
  if (!game.user?.isGM && actor?.isOwner === false) {
    ui.notifications?.warn(`⚠️ Чинить оружие «${item.name}» может только владелец персонажа или ГМ.`);
    return false;
  }
  await item.update({ "system.destroyed": false });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker?.({ actor }) ?? {},
    content: `<div class="wh-roll-result">
      <div class="roll-outcome"><span class="roll-success">🔧 ${esc(actor?.name ?? "")}: «${esc(item.name)}» починено — снова годно к стрельбе и бою.</span></div>
    </div>`
  });
  return true;
}

const QLBL = { poor: "Poor.Q", common: "Comm.Q", good: "Good.Q", best: "Best.Q" };

/**
 * На Честном Слове (rules/jury-rigging.mjs): починка за Полное действие с потерей
 * ступени Качества; прежнее Качество запоминается до полного ремонта.
 */
export async function juryRigWeapon(actor, item) {
  if (!item?.system?.destroyed) return false;
  if (!hasJuryRigging(actor)) { ui.notifications?.warn("⚠️ Нужен Талант Jury Rigging."); return false; }
  if (!game.user?.isGM && actor?.isOwner === false) {
    ui.notifications?.warn(`⚠️ Чинить «${item.name}» может только владелец персонажа или ГМ.`);
    return false;
  }
  if (isEncounterActive() && !(await spendActionPoints(actor, 2, { physical: true }))) {
    ui.notifications?.warn("⚠️ Не хватает ОД на Полное действие.");
    return false;
  }
  const was = String(item.system?.quality || "common");
  const orig = juryRiggedOriginal(item) ?? was;
  const now = qualityStepDown(was);
  await item.update({ "system.destroyed": false, "system.quality": now, [`flags.warhammer-dbc.${JURY_RIGGED_FLAG}`]: { quality: orig } });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker?.({ actor }) ?? {},
    content: `<div class="wh-roll-result">
      <div class="roll-outcome"><span class="roll-success">🔧 ${esc(actor?.name ?? "")}: «${esc(item.name)}» починено на честном слове за Полное действие — Качество ${QLBL[was] ?? was} → ${QLBL[now] ?? now}. Критический Провал теста этим оружием снова его сломает; полный ремонт вернёт ${QLBL[orig] ?? orig}.</span></div>
    </div>`
  });
  return true;
}

/** Полный ремонт наспех починенного: вернуть Качество и снять метку. */
export async function fullRepairJuryRigged(actor, item) {
  const orig = juryRiggedOriginal(item);
  if (orig == null) return false;
  if (!game.user?.isGM && actor?.isOwner === false) {
    ui.notifications?.warn(`⚠️ Чинить «${item.name}» может только владелец персонажа или ГМ.`);
    return false;
  }
  await item.update({ "system.quality": orig, "system.destroyed": false, [`flags.warhammer-dbc.-=${JURY_RIGGED_FLAG}`]: null });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker?.({ actor }) ?? {},
    content: `<div class="wh-roll-result">
      <div class="roll-outcome"><span class="roll-success">🔧 ${esc(actor?.name ?? "")}: «${esc(item.name)}» отремонтировано полностью — Качество снова ${QLBL[orig] ?? orig}.</span></div>
    </div>`
  });
  return true;
}
