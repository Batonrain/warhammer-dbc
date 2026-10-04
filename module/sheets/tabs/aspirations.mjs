// module/sheets/tabs/aspirations.mjs
//
// Стремления (стр. 22) на вкладке «Записи» и в Мастере создания. Слотов ровно
// три, и позиция в массиве и есть категория: [0] Гордость, [1] Мотивация,
// [2] Позор (порядок ASPIRATION_TABLES). Слоты не добавляются и не удаляются —
// только чистятся крестиком или переключаются на «Своё» с собственным
// названием и модификаторами.
//
// Функция принимает актора, а не лист.
//
// Выбор пишет и ключ в слот (для отображения/подсказки), и — если это не
// «своё» и слот не помечен «без модификаторов» — embedded Item-носитель
// Механики (grantAspiration, apps/aspirations.mjs): с ним бонус Стремления
// считается сам, как у Рас/Родных миров.
//
// Книга (стр. 22) разрешает выбирать Стремления или бросать по d10 на каждой
// таблице, и использовать их как скелет характера, игнорируя модификаторы:
// отсюда кнопка d10 (`.aspir-roll`) и галочка слота «без модификаторов»
// (`slot.noMods`) — запись остаётся в слоте, а носитель Механики не выдаётся.

import { grantAspiration, clearAspirationGrant, aspirationOptions } from "../../apps/aspirations.mjs";
import { ASPIRATION_TABLES } from "../../constants/aspirations.mjs";
import { aspirationByRoll } from "../../rules/aspiration-sources.mjs";

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
 * Записывает выбор в слот i и выдаёт (или не выдаёт) носитель Механики.
 * Галочка «без модификаторов» переживает смену записи: игрок, отказавшийся от
 * бонусов, отказывается от них для слота, а не для одной записи.
 */
async function chooseAspiration(actor, i, value, { withCollector = fn => fn(), repick = false } = {}) {
  const arr = slotsOf(actor);
  const noMods = !!arr[i]?.noMods;
  arr[i] = (value === "__custom__")
    ? { custom: true, name: "", mods: "", desc: "" }
    : { id: value, ...(noMods && value ? { noMods: true } : {}) };
  await actor.update({ [SLOTS_PATH]: arr });
  if (value === "__custom__" || noMods) { await clearAspirationGrant(actor, i); return; }
  if (!value) { await clearAspirationGrant(actor, i); return; }
  // ИЛИ-вопросы Механики (Fel+5 или Per+5) Мастер перехватывает в строку шага.
  const status = await withCollector(() => grantAspiration(actor, i, value));
  // Игрок закрыл вопрос «Совершенства» — слот не должен остаться с записью,
  // у которой бонусов нет: выбор отменён целиком. Повторный выбор (repick) —
  // наоборот: прежняя выдача жива, слот не трогаем.
  if (status === "cancelled" && !repick) {
    await clearAspirationGrant(actor, i);
    const back = slotsOf(actor);
    back[i] = { id: "" };
    await actor.update({ [SLOTS_PATH]: back });
  }
}

/**
 * @param {Function} [withCollector] — оборачивает вызов grantAspiration.
 *   На листе актора не передаётся (обычный async-вызов) — ИЛИ-выбор Механики
 *   Стремления (если он есть — напр. «Fel+5 или Per+5») там всплывает
 *   диалогом, как и раньше. Мастер создания передаёт свою обёртку
 *   (withMechCollector) — ИЛИ-вопрос тогда рисуется строкой в форме шага.
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
    await chooseAspiration(actor, i, ev.currentTarget.value, { withCollector });
  });
  html.find(".aspir-custom-name, .aspir-custom-mods").on("change", async ev => {
    const i = parseInt(ev.currentTarget.dataset.index);
    const arr = slotsOf(actor);
    arr[i] = { ...arr[i], custom: true };
    if (ev.currentTarget.classList.contains("aspir-custom-name")) arr[i].name = ev.currentTarget.value;
    else arr[i].mods = ev.currentTarget.value;
    await actor.update({ [SLOTS_PATH]: arr });
  });

  // «Без модификаторов»: запись остаётся (скелет характера), бонусы не
  // применяются. Снятие галочки выдаёт носитель Механики заново.
  html.find(".aspir-nomods").on("change", async ev => {
    const i = parseInt(ev.currentTarget.dataset.index);
    const checked = !!ev.currentTarget.checked;
    const arr = slotsOf(actor);
    const slot = arr[i] ?? { id: "" };
    if (checked) slot.noMods = true; else delete slot.noMods;
    arr[i] = slot;
    await actor.update({ [SLOTS_PATH]: arr });
    if (checked) { await clearAspirationGrant(actor, i); return; }
    if (slot.id && !slot.custom) await chooseAspiration(actor, i, slot.id, { withCollector });
  });

  // d10 по таблице слота: результат — запись с этим номером (стр. 22).
  html.find(".aspir-roll").click(async ev => {
    ev.preventDefault();
    const i = parseInt(ev.currentTarget.dataset.index);
    const table = ASPIRATION_TABLES[i];
    if (!table) return;
    const roll = await new Roll("1d10").evaluate();
    const hit = aspirationByRoll(aspirationOptions(table.key), roll.total);
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `Стремление — ${table.label}: ${hit ? `«${hit.name}»` : "в таблице нет записи с этим номером"}`
    });
    if (hit) await chooseAspiration(actor, i, hit.key, { withCollector });
  });

  // «Выбрать Характеристики»: у Стремления с выбором («Совершенство») ответа
  // нет — запись выдана до появления выбора — или игрок хочет его переиграть.
  html.find(".aspir-repick").click(async ev => {
    ev.preventDefault();
    const i = parseInt(ev.currentTarget.dataset.index);
    const slot = slotsOf(actor)[i];
    if (!slot?.id || slot.custom || slot.noMods) return;
    await chooseAspiration(actor, i, slot.id, { withCollector, repick: true });
  });
}
