// module/combat/blessing-of-steel.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Благословение Стали / Blessing of Steel (Талант Механикума, Sahara 3-cc96
//  п.3; DoomBC — Основная книга): «Потратив 5 минут на ритуал, персонаж может
//  благословить оружие или набор брони, увеличив их Качество на 1 до конца
//  следующего боя. Только один предмет одновременно.»
//
//  Механика по образцу Песни Изменений (combat/reformation-song.mjs): Качество
//  предмета реально поднимается на ступень (poor → common → good → best), а
//  прежнее значение лежит флагом предмета и возвращается, когда кончается бой.
//  «Следующего боя» читаем буквально: если ритуал проведён посреди боя, то он
//  переживает ЭТОТ бой и снимается в конце следующего, в котором участвует
//  владелец. Пять минут игрового времени и «ритуал» — на совести стола.
//
//  Благословенный предмет остаётся обычным предметом с повышенным Качеством:
//  всё, что читает Качество (крафт, ремонт, бонусы Good.Q/Best.Q в Конструкторе,
//  карточка предмета), видит новое значение само. Высшее Качество выше не
//  растёт — ритуал над Best.Q ничего не даёт, и система об этом говорит.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { normQuality, ITEM_QUALITY } from "../constants/quality.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard } from "../helpers/test-card.mjs";

const SYSTEM = "warhammer-dbc";
export const BLESSING_FLAG = "blessingOfSteel";
const STEP_UP = { poor: "common", common: "good", good: "best", best: "best" };
const STEP_DOWN = { best: "good", good: "common", common: "poor", poor: "poor" };

export const hasBlessingOfSteel = actor =>
  [...(actor?.items ?? [])].some(i => i?.type === "talent"
    && (itemHasName(i, "Blessing of Steel") || itemHasName(i, "Благословение Стали")));

/** Ступенька выше (Высшее остаётся Высшим). */
export const blessedQuality = q => STEP_UP[normQuality(q)];

/** Предметы, которые можно благословить: оружие и броня актора. */
export function blessableItems(actor) {
  return [...(actor?.items ?? [])].filter(i => i?.type === "weapon" || i?.type === "armor");
}

/** Уже благословлённый предмет актора (по правилу — не больше одного). */
export function blessedItem(actor) {
  return [...(actor?.items ?? [])].find(i => i?.getFlag?.(SYSTEM, BLESSING_FLAG)) ?? null;
}

/** Возвращает предмету прежнее Качество и гасит метку. */
async function revertItem(item) {
  const mark = item.getFlag(SYSTEM, BLESSING_FLAG);
  if (!mark) return;
  // Откат — «на ступень вниз», и только если Качество всё ещё то, что поставило
  // благословение: Песня Изменений откатывает своё «абсолютно» (в deleteCombat
  // она идёт раньше), и возврат прежнего значения оставил бы оружие на ступень
  // выше. Метка старого вида (без blessedQuality) откатывается как раньше.
  if (!mark.blessedQuality) {
    await item.update({ "system.quality": mark.originalQuality });
  } else if (normQuality(item.system?.quality) === mark.blessedQuality) {
    await item.update({ "system.quality": STEP_DOWN[mark.blessedQuality] });
  }
  await item.unsetFlag(SYSTEM, BLESSING_FLAG);
}

/**
 * Кнопка Таланта «Благословить предмет»: выбор оружия/брони, +1 ступень
 * Качества, метка на предмете, карточка в чат. Прежний благословлённый
 * предмет теряет благословение (одновременно — один).
 * @returns {Promise<boolean>} true — благословение наложено
 */
export async function startBlessingOfSteel(actor) {
  if (!hasBlessingOfSteel(actor)) return false;
  const candidates = blessableItems(actor);
  if (!candidates.length) {
    ui.notifications.warn("Благословение Стали: у персонажа нет оружия или брони.");
    return false;
  }
  const previous = blessedItem(actor);
  const options = candidates.map(i => {
    const q = normQuality(i.system?.quality);
    const mark = i.getFlag?.(SYSTEM, BLESSING_FLAG);
    return `<option value="${esc(i.id)}"${mark ? " selected" : ""}>${esc(i.name)} — ${ITEM_QUALITY[q].abbr}${mark ? " (благословлён)" : ""}</option>`;
  }).join("");
  const id = await foundry.applications.api.DialogV2.wait({
    window: { title: `Благословение Стали — ${actor.name}` },
    content: `<p>5 минут ритуала: оружие или набор брони получает +1 к Качеству до конца следующего боя. Только один предмет одновременно${previous ? ` — благословение «${esc(previous.name)}» будет снято` : ""}.</p>
      <label>Предмет: <select name="item">${options}</select></label>`,
    buttons: [
      { action: "go", label: "Благословить", default: true, callback: (_ev, button) => button.form.querySelector('[name="item"]')?.value },
      { action: "cancel", label: "Отмена", callback: () => null }
    ],
    rejectClose: false
  });
  if (!id) return false;
  const item = actor.items.get(id);
  if (!item) return false;

  const wasMark = item.getFlag(SYSTEM, BLESSING_FLAG);
  const original = wasMark ? wasMark.originalQuality : normQuality(item.system?.quality);
  if (previous && previous.id !== item.id) await revertItem(previous);
  // Повторный ритуал над тем же предметом срок обновляет, ступень не добавляет.
  const target = blessedQuality(original);
  const stepped = target !== original;
  if (stepped) {
    await item.update({ "system.quality": target });
    await item.setFlag(SYSTEM, BLESSING_FLAG, { originalQuality: original, blessedQuality: target, combatId: game.combat?.id ?? null });
  }
  await postTestCard(actor, {
    icon: rollIcon("wrench", "#ffb84d"), title: `Благословение Стали — ${esc(actor.name)}`,
    threshold: `<div class="roll-threshold">${esc(item.name)}: ${stepped
      ? `Качество <b>${ITEM_QUALITY[original].label} → ${ITEM_QUALITY[target].label}</b> до конца следующего боя.`
      : "уже Высшее Качество — повышать нечего."}${previous && previous.id !== item.id ? ` Благословение «${esc(previous.name)}» снято.` : ""}</div>`
  }, { sound: false });
  return stepped;
}

/**
 * Снимает благословение в конце боя: звать из deleteCombat. Откатываются
 * предметы участников этого боя, благословлённые НЕ в нём самом (ритуал
 * посреди боя действует до конца следующего).
 */
export async function clearBlessingOfSteel(combat) {
  for (const c of combat?.combatants ?? []) {
    const actor = c.actor;
    if (!actor?.items) continue;
    for (const item of [...actor.items]) {
      const mark = item.getFlag?.(SYSTEM, BLESSING_FLAG);
      if (!mark) continue;
      if (mark.combatId && mark.combatId === combat.id) continue;
      await revertItem(item);
    }
  }
}
