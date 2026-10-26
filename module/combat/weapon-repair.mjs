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
