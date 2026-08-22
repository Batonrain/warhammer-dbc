// module/sheets/tabs/aspirations.mjs
//
// Стремления (стр. 22) в шапке листа. Слотов ровно три, и позиция в массиве
// и есть категория: [0] Гордыня, [1] Позор, [2] Мотивация. Слоты не
// добавляются и не удаляются — только чистятся крестиком или переключаются на
// «Своё» с собственным названием и модификаторами.
//
// Функция принимает актора, а не лист.
//
// Выбор пишет и ключ в слот (для отображения/подсказки), и — если это не
// «своё» — embedded Item-носитель Механики (grantAspiration, apps/aspirations.mjs):
// с ним бонус Стремления перестаёт быть текстом-памяткой и реально считается,
// как у Рас/Родных миров.

import { grantAspiration, clearAspirationGrant } from "../../apps/aspirations.mjs";

/** Куда пишется выбор. Само поле `aspirations` — объект (там же Фактор Прибыли). */
const SLOTS_PATH = "system.aspirations.slots";

/** Три слота как массив: недостающие добираются пустыми. */
function slotsOf(actor) {
  const v = actor.system.aspirations?.slots;
  const arr = Array.isArray(v) ? foundry.utils.deepClone(v) : [];
  while (arr.length < 3) arr.push({ id: "" });
  return arr;
}

/**
 * @param {Function} [withCollector] — оборачивает вызов grantAspiration.
 *   На листе актора не передаётся (обычный async-вызов) — ИЛИ-выбор Механики
 *   Стремления (если он есть — напр. «Fel+5 или Per+5») там всплывает
 *   диалогом, как и раньше. Мастер создания передаёт свою обёртку
 *   (withMechCollector) — тот же диалог тогда перехватывается и рисуется
 *   строкой прямо в форме шага, без всплывающего окна (wdbc-2ot, «тот же
 *   принцип на прочих этапах»). Пока привязка Стремления к Механике
 *   (grantAspiration) не смержена отдельным PR — обёртке нечего оборачивать,
 *   параметр принят для совместимости сигнатуры с вызовом из Мастера.
 */
export function activateAspirationListeners(html, actor, withCollector = fn => fn()) {
  html.find(".aspir-remove").click(async ev => {
    ev.preventDefault();
    const i = parseInt(ev.currentTarget.dataset.index);
    const arr = slotsOf(actor); arr[i] = { id: "" };
    await actor.update({ [SLOTS_PATH]: arr });
    await clearAspirationGrant(actor, i);
  });
  html.find(".aspir-select").on("change", async ev => {
    const i = parseInt(ev.currentTarget.dataset.index);
    const arr = slotsOf(actor);
    const value = ev.currentTarget.value;
    arr[i] = (value === "__custom__")
      ? { custom: true, name: "", mods: "", desc: "" }
      : { id: value };
    await actor.update({ [SLOTS_PATH]: arr });
    if (value === "__custom__") await clearAspirationGrant(actor, i);
    else await grantAspiration(actor, i, value);
  });
  html.find(".aspir-custom-name, .aspir-custom-mods").on("change", async ev => {
    const i = parseInt(ev.currentTarget.dataset.index);
    const arr = slotsOf(actor);
    arr[i] = { ...arr[i], custom: true };
    if (ev.currentTarget.classList.contains("aspir-custom-name")) arr[i].name = ev.currentTarget.value;
    else arr[i].mods = ev.currentTarget.value;
    await actor.update({ [SLOTS_PATH]: arr });
  });
}
