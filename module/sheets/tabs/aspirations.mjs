// module/sheets/tabs/aspirations.mjs
//
// Стремления (стр. 22) в шапке листа. Слотов ровно три, и позиция в массиве
// и есть категория: [0] Гордыня, [1] Позор, [2] Мотивация. Слоты не
// добавляются и не удаляются — только чистятся крестиком или переключаются на
// «Своё» с собственным названием и модификаторами.
//
// Функция принимает актора, а не лист.

/** Куда пишется выбор. Само поле `aspirations` — объект (там же Фактор Прибыли). */
const SLOTS_PATH = "system.aspirations.slots";

/** Три слота как массив: недостающие добираются пустыми. */
function slotsOf(actor) {
  const v = actor.system.aspirations?.slots;
  const arr = Array.isArray(v) ? foundry.utils.deepClone(v) : [];
  while (arr.length < 3) arr.push({ id: "" });
  return arr;
}

export function activateAspirationListeners(html, actor) {
  html.find(".aspir-remove").click(async ev => {
    ev.preventDefault();
    const i = parseInt(ev.currentTarget.dataset.index);
    const arr = slotsOf(actor); arr[i] = { id: "" };
    await actor.update({ [SLOTS_PATH]: arr });
  });
  html.find(".aspir-select").on("change", async ev => {
    const i = parseInt(ev.currentTarget.dataset.index);
    const arr = slotsOf(actor);
    arr[i] = (ev.currentTarget.value === "__custom__")
      ? { custom: true, name: "", mods: "", desc: "" }
      : { id: ev.currentTarget.value };
    await actor.update({ [SLOTS_PATH]: arr });
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
