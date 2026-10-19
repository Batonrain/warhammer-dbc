// module/combat/ablative-hardening.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Ablative Hardening / Аблативное Укрепление (Талант Стойкости, глава 3): «Каждый
//  раз, когда он тратит хотя бы 1 час на обслуживание своей брони, она получает
//  I.b зарядов прочности. Когда броня получает эффект, снижающий её АР, он может
//  потратить один заряд прочности и проигнорировать этот эффект.»
//
//  Заряды — поле брони system.hardeningCharges (data/item/armor.mjs). Две части:
//   • «Обслужить (1 ч)» — кнопка в строке брони (вкладка СНАРЯЖЕНИЕ): заряды
//     становятся равны I.b. Это ВЫСТАВЛЕНИЕ, а не накопление: книга «даёт I.b
//     зарядов», потолка не называет, поэтому повторное обслуживание запас
//     восполняет до I.b, но не растит сверх [допущение, решение по умолчанию].
//     Час работы система не меряет.
//   • Расход — offerHardeningSpend, его зовёт конвейер урона (combat/damage.mjs) в
//     трёх местах, где у системы броня реально теряет AP: Разъедающее, Касание
//     Энтропии и потеря заряда аблативной брони. Пробитие брони (armor-properties.mjs::
//     breachArmorAtLocation) AP не снижает — оно только ставит метку «пробита» (её
//     читает Sealed) — поэтому не покрыто.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import {
  hasResilienceTalent, ablativeHardeningRefill, pickHardeningArmor, HARDENING_FIELD
} from "../rules/resilience-talents.mjs";

export function hasAblativeHardening(actor) {
  return hasResilienceTalent(actor, "ablativeHardening");
}

const confirm = (title, text, yes, no) => foundry.applications.api.DialogV2.confirm({
  window: { title }, content: `<p>${text}</p>`, yes: { label: yes }, no: { label: no }
}).then(r => !!r).catch(() => false);

/** «Обслужить (1 ч)»: заряды прочности брони = I.b носителя. */
export async function maintainArmorForHardening(actor, armor) {
  if (!hasAblativeHardening(actor)) {
    return ui.notifications?.warn("Нужен Талант Ablative Hardening/Аблативное Укрепление.");
  }
  if (!armor || armor.type !== "armor") return;
  const charges = ablativeHardeningRefill(actor);
  await armor.update({ [`system.${HARDENING_FIELD}`]: charges });
  await postTestCard(actor, {
    icon: "🛡", title: `Аблативное Укрепление — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">«${esc(armor.name)}» обслужена (1 час): заряды прочности — <b>${charges}</b> (I.b).</div>`]
  }, { sound: false });
  return charges;
}

/**
 * Предложить погасить потерю AP зарядом прочности.
 * @param {Actor} actor
 * @param {object} p
 * @param {string} [p.armorKey] участок, где броня теряет AP (платит надетая броня, закрывающая его)
 * @param {Item}   [p.armor]    либо конкретная броня (аблативный мод знает, на какой броне стоит)
 * @param {string} p.reason     что именно снизит AP — для текста вопроса
 * @returns {Promise<boolean>} true — заряд потрачен, эффект игнорируется
 */
export async function offerHardeningSpend(actor, { armorKey = null, armor = null, reason = "" } = {}) {
  if (!actor || !hasAblativeHardening(actor)) return false;
  const items = actor.items?.contents ?? [...(actor.items ?? [])];
  const payer = armor
    ? (Number(armor.system?.[HARDENING_FIELD]) > 0 ? armor : null)
    : pickHardeningArmor(items, armorKey);
  if (!payer) return false;
  const left = Number(payer.system[HARDENING_FIELD]);
  const ok = await confirm("Аблативное Укрепление",
    `${esc(actor.name)}: ${esc(reason)}. Потратить заряд прочности «${esc(payer.name)}» (осталось <b>${left}</b>) и проигнорировать эффект?`,
    "Потратить заряд", "Нет");
  if (!ok) return false;
  await payer.update({ [`system.${HARDENING_FIELD}`]: left - 1 });
  return true;
}
