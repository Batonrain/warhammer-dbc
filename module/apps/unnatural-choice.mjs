// module/apps/unnatural-choice.mjs
// ════════════════════════════════════════════════════════════════════════
//  Шаблоны «Unnatural Characteristic / Сверхъестественная Характеристика (X)»
//  и «Unnatural (выбор) (X)» (корбук стр. 26, Черты рас): какая Характеристика
//  и какое X — решается при выдаче, а не в паке. Раньше копию на листе
//  приходилось настраивать руками, и +X к Бонусу при этом молча не работал:
//  у шаблона стоит migratedEffect, и расчёт листа старое поле
//  system.effects.charBonusStat не читает (rules/character.mjs).
//
//  Теперь шаблон несёт запись Конструктора «Характеристика → бонус» со
//  значением «rating» и пустой Характеристикой (неполная запись эффекта не
//  даёт), а скрипт «При выдаче» зовёт chooseUnnaturalCharacteristic: окно
//  спрашивает Характеристику и X, пишет их в запись и в рейтинг Черты, и
//  пересборка Механики заводит эффект +X сама. +½X Успехов читает
//  rules/unnatural-characteristic.mjs по той же записи.
// ════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { esc } from "../helpers/utils.mjs";

/** Все Характеристики, кроме Влияния: у него нет Бонуса Сверхъестественной Черты. */
export const UNNATURAL_ANY = ["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel"];
/** «Unnatural (выбор)»: S/T/A/P. */
export const UNNATURAL_PHYSICAL = ["s", "t", "ag", "per"];

const FLAG = "warhammer-dbc";

/**
 * Механика с выбранной Характеристикой: первой записи «Характеристика →
 * бонус» на И-ветке ставится charKey. Чистая функция — без документа.
 * @returns {{groups: object[], found: boolean}}
 */
export function applyUnnaturalChoice(groups, charKey) {
  let found = false;
  const walk = (entries, operator) => (entries ?? []).map(e => {
    if (e?.kind === "group" && e.group) {
      return { ...e, group: { ...e.group, entries: walk(e.group.entries, e.group.operator) } };
    }
    if (!found && operator !== "OR" && e?.kind === "characteristic" && e.field === "bonus") {
      found = true;
      return { ...e, charKey };
    }
    return e;
  });
  const out = (groups ?? []).map(g => ({ ...g, entries: walk(g.entries, g.operator) }));
  return { groups: out, found };
}

/** Характеристика, уже выбранная на копии, — "" если ещё нет. */
export function chosenUnnaturalChar(groups) {
  for (const g of groups ?? []) {
    if (g.operator === "OR") continue;
    for (const e of g.entries ?? []) {
      if (e?.kind === "characteristic" && e.field === "bonus" && e.charKey) return e.charKey;
    }
  }
  return "";
}

/**
 * Окно выбора и запись в предмет. Вызывается скриптом шаблона («При выдаче»
 * и кнопкой «▶ Запустить» — чтобы переиграть выбор).
 * @param {Item} item
 * @param {object} [o]
 * @param {string[]} [o.allowed] ключи Характеристик на выбор
 * @returns {Promise<{charKey:string, rating:number}|null>}
 */
export async function chooseUnnaturalCharacteristic(item, { allowed = UNNATURAL_ANY } = {}) {
  if (!item) return null;
  const groups = item.getFlag(FLAG, "mechanics") ?? [];
  const current = chosenUnnaturalChar(groups);
  const rating = Math.max(1, Number(item.system?.rating) || 1);
  const opts = allowed.map(k =>
    `<option value="${k}" ${k === current ? "selected" : ""}>${esc(CHARACTERISTICS[k]?.label ?? k)} (${esc(CHARACTERISTICS[k]?.abbr ?? k)})</option>`).join("");
  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: `${item.name}: какая Характеристика?` },
    content: `<p>+X к Бонусу выбранной Характеристики и +½X Успехов на успешные тесты по ней.</p>
      <div class="form-group"><label>Характеристика</label><select name="charKey">${opts}</select></div>
      <div class="form-group"><label>X (рейтинг)</label><input type="number" name="rating" min="1" step="1" value="${rating}"/></div>`,
    ok: {
      label: "Готово",
      callback: (event, button) => ({
        charKey: String(button.form.elements.charKey.value || ""),
        rating: Math.max(1, Math.trunc(Number(button.form.elements.rating.value) || 1))
      })
    },
    rejectClose: false
  });
  if (!result?.charKey || !allowed.includes(result.charKey)) return null;
  const { groups: next, found } = applyUnnaturalChoice(groups, result.charKey);
  if (!found) {
    ui.notifications?.warn(`«${item.name}»: в Механике нет записи «Характеристика → бонус» — выбирать некуда.`);
    return null;
  }
  await item.update({ "system.rating": result.rating, [`flags.${FLAG}.mechanics`]: next });
  return result;
}
