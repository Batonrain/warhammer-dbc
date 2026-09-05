// module/apps/blood-shield.mjs
//
// UI/действие Таланта «Blood Shield / Кровавый Щит» (wdbc-173l) — см.
// module/rules/blood-shield.mjs про арифметику и почему тест сохранения на
// конец Хода не смоделирован. Кнопка на листе Таланта: ищет у актора
// снаряжённое демон-оружие с порабощённым демоном (subdued) и грантует
// W.b демона аблативных Ран (потолок W.b×2) — момент «убил рукопашной этим
// оружием» GM/игрок подтверждает нажатием, автодетекта убийства нет.

import { isBloodShieldItem, isSubduedDaemonWeapon, bloodShieldGrant, bloodShieldLoseAll,
         BLOOD_SHIELD_FLAG, bloodShieldShrinkToFit } from "../rules/blood-shield.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

export { isBloodShieldItem };

const FLAG = "warhammer-dbc";

/** Снаряжённое демон-оружие с порабощённым демоном, если есть. */
function equippedSubduedDaemonWeapon(actor) {
  return actor?.items?.find(i => i.type === "weapon" && i.system?.equipped && isSubduedDaemonWeapon(i)) || null;
}

/**
 * Ресинк ПОСЛЕ того, как общий ablative пул уменьшился по другой причине
 * (поглощение урона) — вызывать из хука updateActor.
 */
export async function reconcileBloodShieldToFit(actor) {
  const prev = Number(actor.getFlag(FLAG, BLOOD_SHIELD_FLAG)) || 0;
  if (prev <= 0) return;
  const result = bloodShieldShrinkToFit(actor.system, prev);
  if (!result) return;
  await actor.update({
    "system.wounds.ablativeMax": result.ablativeMax,
    [`flags.${FLAG}.${BLOOD_SHIELD_FLAG}`]: result.contribution
  });
}

/** Нажатие кнопки «Насытился убийством». */
export async function useBloodShieldKill(actor, item) {
  if (!isBloodShieldItem(item) || !actor) return;
  const weapon = equippedSubduedDaemonWeapon(actor);
  if (!weapon) {
    ui.notifications?.warn("Нет снаряжённого демон-оружия с порабощённым демоном.");
    return;
  }
  const demonWb = Number(weapon.system?.daemonWeapon?.demonWb) || 0;
  const prevContribution = Number(actor.getFlag(FLAG, BLOOD_SHIELD_FLAG)) || 0;
  const result = bloodShieldGrant(actor.system, prevContribution, demonWb);
  if (!result) {
    ui.notifications?.info(demonWb <= 0
      ? `У «${weapon.name}» не задан W.b демона.`
      : `Уже на потолке (W.b×2 = ${demonWb * 2}).`);
    return;
  }

  await actor.update({
    "system.wounds.ablative": result.ablative,
    "system.wounds.ablativeMax": result.ablativeMax,
    [`flags.${FLAG}.${BLOOD_SHIELD_FLAG}`]: result.contribution
  });

  // Карточки Кровавого Щита — результат нажатия кнопки, а не тест: своего
  // броска здесь нет (тест сохранения на конец Хода отыгрывается вручную,
  // см. rules/blood-shield.mjs), поэтому ни Порога, ни строки броска, ни звука.
  await postTestCard(actor, {
    icon: rollIcon("blood", "#8b1a1a"),
    title: "Blood Shield — насытился убийством",
    lines: [
      `<div class="roll-threshold">+${result.granted} аблативных Ран (W.b «${esc(weapon.name)}») → всего <b>${result.ablative}</b> (потолок ${result.cap})</div>`,
      `<div class="roll-threshold" style="opacity:.8;">В Ход без убийства — тест W+0 в конце Хода или теряет всё; штраф складывается −10 за Ход подряд без убийств — отыгрывать вручную (кнопка «Потерять щит» ниже, если тест провален).</div>`
    ]
  }, { sound: false });
}

/** Нажатие кнопки «Потерять щит» (провален тест сохранения). */
export async function useBloodShieldLose(actor, item) {
  if (!isBloodShieldItem(item) || !actor) return;
  const prevContribution = Number(actor.getFlag(FLAG, BLOOD_SHIELD_FLAG)) || 0;
  const result = bloodShieldLoseAll(actor.system, prevContribution);
  if (!result) return;
  await actor.update({
    "system.wounds.ablative": result.ablative,
    "system.wounds.ablativeMax": result.ablativeMax,
    [`flags.${FLAG}.${BLOOD_SHIELD_FLAG}`]: result.contribution
  });
  await postTestCard(actor, {
    icon: rollIcon("blood", "#8b1a1a"),
    title: "Blood Shield — щит развеян",
    lines: [`<div class="roll-threshold">Все аблативные Раны Blood Shield потеряны.</div>`]
  }, { sound: false });
}

/** Кнопки на листе предмета — пусто, если это не Blood Shield или нет актора. */
export function bloodShieldButtonHtml(item, actor) {
  if (!isBloodShieldItem(item) || !actor) return "";
  const contribution = Number(actor.getFlag(FLAG, BLOOD_SHIELD_FLAG)) || 0;
  return `<div class="blood-shield-panel">
    <div class="blood-shield-status">Аблативные Раны Blood Shield: <b>${contribution}</b></div>
    <button type="button" class="blood-shield-kill-btn" data-item-id="${item.id}">
      ${rollIcon("blood","#8b1a1a")}Насытился убийством
    </button>
    ${contribution > 0 ? `<button type="button" class="blood-shield-lose-btn" data-item-id="${item.id}">
      ${rollIcon("skull","#5a4a30")}Потерять щит (провален тест)
    </button>` : ""}
  </div>`;
}
