// module/apps/aptitude-binding-dialog.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «КАКИЕ ДВЕ СКЛОННОСТИ У ЭТОГО ОБЪЕКТА» — диалог смены привязки (wdbc-1pvq).
//
//  Открывается щелчком по значку Д/Н/В у Характеристики или Навыка на вкладке
//  ПРОДВИЖЕНИЕ. Отдельной колонки под это нет намеренно: вкладка и так плотная,
//  а значок уже стоит ровно там, где игрок видит последствие — цену.
//
//  Механика (что считается записью, как она снимается, кто сильнее) живёт в
//  module/rules/aptitude-binding.mjs — здесь только окно и запись патча.
// ════════════════════════════════════════════════════════════════════════════

import { APTITUDES } from "../constants/characteristics.mjs";
import { objectAptitudes, isAptitudeBindingOverridden, setBindingPatch }
  from "../rules/aptitude-binding.mjs";
import { esc } from "../helpers/utils.mjs";
import { recalcAllAdvanceCosts } from "../sheets/tabs/advance.mjs";

const SCOPE_LABEL = { char: "Характеристика", skill: "Навык" };

/**
 * Показать диалог и записать выбор.
 *
 * @param {object} actor
 * @param {"char"|"skill"} scope
 * @param {string} key       ключ объекта
 * @param {string} title     как объект называется на листе
 * @param {string[]} bookApts книжная привязка — для кнопки «вернуть как в книге»
 */
export async function showAptitudeBindingDialog(actor, scope, key, title, bookApts = []) {
  if (!actor || !SCOPE_LABEL[scope] || !key) return null;
  const current = objectAptitudes(actor, scope, key, bookApts);
  const overridden = isAptitudeBindingOverridden(actor, scope, key);

  const options = (selected) => Object.entries(APTITUDES)
    .map(([k, label]) => `<option value="${esc(k)}"${k === selected ? " selected" : ""}>${esc(label)}</option>`)
    .join("");

  const bookLine = bookApts.length
    ? `По книге: <b>${esc(bookApts.map(a => APTITUDES[a] || a).join(" + "))}</b>`
    : "Книжная привязка у этого объекта не задана";

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: `Склонности: ${title}` },
    classes: ["wh-apt-binding-dialog", "warhammer-dbc", "wh-holo"],
    position: { width: 420 },
    content: `
      <div class="wh-apt-binding-form">
        <div class="apt-book-line">${bookLine}${overridden ? " — сейчас переопределена" : ""}</div>
        <label class="apt-row">Первая
          <select class="apt-first">${options(current[0])}</select>
        </label>
        <label class="apt-row">Вторая
          <select class="apt-second">${options(current[1])}</select>
        </label>
        <div class="apt-hint">Цена Продвижения считается по совпадению этих двух со Склонностями персонажа: две — Дружественная, одна — Нейтральная, ноль — Враждебная.</div>
      </div>`,
    rejectClose: false,
    buttons: [
      { action: "save", label: "Сохранить", icon: "fas fa-check", default: true,
        callback: (event, button) => ({
          first:  button.form.querySelector(".apt-first")?.value || "",
          second: button.form.querySelector(".apt-second")?.value || ""
        }) },
      { action: "book", label: "Вернуть как в книге", icon: "fas fa-rotate-left" },
      { action: "cancel", label: "Отмена" }
    ]
  });

  if (!result || result === "cancel") return null;
  // Одна и та же Склонность в обеих строках — почти наверняка описка, а цена
  // от неё меняется молча и навсегда: aptitudeCat (constants/advancement.mjs)
  // считает совпадения по множеству, дубль схлопывается, и объект не может
  // стать Дружественным НИКОМУ — максимум Нейтральным. Подпись при этом
  // честно покажет «Ловкость + Ловкость», но заметить это можно, только зная,
  // что так быть не должно. Поэтому не пишем вовсе и говорим почему.
  if (result !== "book" && result.first && result.first === result.second) {
    ui.notifications?.warn(
      `Обе Склонности одинаковые (${APTITUDES[result.first] || result.first}). ` +
      "Нужны две РАЗНЫЕ — иначе объект не сможет стать Дружественным ни одному персонажу.");
    return null;
  }
  // «Вернуть как в книге» снимает запись, а не пишет книжные значения копией:
  // иначе правка книги/таблицы позже до этого актора уже не дошла бы.
  const patch = result === "book"
    ? setBindingPatch(scope, key, [])
    : setBindingPatch(scope, key, [result.first, result.second]);
  if (!Object.keys(patch).length) return patch;
  await actor.update(patch);
  // Цена Продвижения ХРАНИТСЯ полем (system.characteristics.<key>.cost и
  // system.skills.<key>.cost), а не считается на лету: её пишет обработчик
  // выбора уровня улучшения. Значит смена привязки сама по себе цену не
  // трогает — значок Д/Н/В менялся, а число оставалось прежним, пока
  // игрок не потрогает выпадающий список заново (найдено живой проверкой
  // 06.09.2026). Это ровно тот же случай, что смена Склонностей ПЕРСОНАЖА:
  // sheets/tabs/advance.mjs::setAptitudes после записи зовёт полный пересчёт,
  // и здесь делается то же самое. Пересчёт стоит ЗДЕСЬ, а не у вызывающего:
  // забыть его нельзя, если он вшит в саму запись.
  await recalcAllAdvanceCosts(actor);
  return patch;
}
