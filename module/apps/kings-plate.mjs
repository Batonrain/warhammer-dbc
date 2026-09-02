// module/apps/kings-plate.mjs
//
// UI/действие Таланта «King's Plate / Латы Короля» (wdbc-173l) — см.
// module/rules/kings-plate.mjs про арифметику. Кнопка на листе Таланта:
// берёт текущую цель (game.user.targets, тот же приём, что Flayed) как
// поглощаемый Рой — резолвит его system.magnitude.value (Орда), обнуляет
// Магнитуду (Рой «уничтожается», токен на сцене ГМ убирает сам — см.
// докстринг rules/kings-plate.mjs про то, почему не actor.delete()).

import { isKingsPlateItem, kingsPlateGrant, KINGS_PLATE_FLAG, kingsPlateShrinkToFit }
  from "../rules/kings-plate.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

export { isKingsPlateItem };

const FLAG = "warhammer-dbc";

/**
 * Ресинк ПОСЛЕ того, как общий ablative пул уменьшился по другой причине
 * (поглощение урона) — вызывать из хука updateActor.
 */
export async function reconcileKingsPlateToFit(actor) {
  const prev = Number(actor.getFlag(FLAG, KINGS_PLATE_FLAG)) || 0;
  if (prev <= 0) return;
  const result = kingsPlateShrinkToFit(actor.system, prev);
  if (!result) return;
  await actor.update({
    "system.wounds.ablativeMax": result.ablativeMax,
    [`flags.${FLAG}.${KINGS_PLATE_FLAG}`]: result.contribution
  });
}

/** Нажатие кнопки на листе Таланта: поглотить текущую цель-Рой. */
export async function useKingsPlate(actor, item) {
  if (!isKingsPlateItem(item) || !actor) return;
  const target = [...(game.user.targets ?? [])][0]?.actor || null;
  if (!target) {
    ui.notifications?.warn("Нет цели — наведите инструмент «Target» на Рой в базовом контакте.");
    return;
  }
  if (target.type !== "horde") {
    ui.notifications?.warn(`«${target.name}» не Орда/Рой — поглощать можно только Орду.`);
    return;
  }
  const magnitude = Number(target.system?.magnitude?.value) || 0;
  const prevContribution = Number(actor.getFlag(FLAG, KINGS_PLATE_FLAG)) || 0;
  const result = kingsPlateGrant(actor.system, prevContribution, magnitude);
  if (!result) {
    ui.notifications?.info(`«${target.name}» уже не имеет Магнитуды — поглощать нечего.`);
    return;
  }

  await actor.update({
    "system.wounds.ablative": result.ablative,
    "system.wounds.ablativeMax": result.ablativeMax,
    [`flags.${FLAG}.${KINGS_PLATE_FLAG}`]: result.contribution
  });
  await target.update({ "system.magnitude.value": 0 });

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("shield","#7a9c3f")}King's Plate — поглощён «${esc(target.name)}»</div>
      <div class="roll-threshold">+${result.granted} аблативных Ран (Магнитуда Роя) → всего <b>${result.ablative}</b></div>
      <div class="roll-threshold" style="opacity:.8;">Не смоделировано: Natural Armour (Cor.b), +10 S/T, развитие лат за свободное действие — отыгрывать вручную. Рой уничтожен (Магнитуда обнулена) — уберите токен со сцены.</div>
    </div>`,
    sound: null
  }, game.settings.get("core", "rollMode")));
}

/** Кнопка на листе предмета — пусто, если это не King's Plate или нет актора. */
export function kingsPlateButtonHtml(item, actor) {
  if (!isKingsPlateItem(item) || !actor) return "";
  const contribution = Number(actor.getFlag(FLAG, KINGS_PLATE_FLAG)) || 0;
  return `<div class="kings-plate-panel">
    <div class="kings-plate-status">Аблативные Раны от поглощённых Роёв: <b>${contribution}</b></div>
    <div class="kings-plate-hint">Полудействие: наведите инструмент «Target» на Рой в базовом контакте, затем нажмите.</div>
    <button type="button" class="kings-plate-btn" data-item-id="${item.id}">
      ${rollIcon("shield","#7a9c3f")}Поглотить Рой
    </button>
  </div>`;
}
