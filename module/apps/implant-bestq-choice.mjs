// module/apps/implant-bestq-choice.mjs
// ════════════════════════════════════════════════════════════════════════
//  Best.Q-биоимпланты Друкхари (wdbc-ukpu, шаг 3): выбор бонусного эффекта
//  Best.Q при получении импланта актором.
//
//  Книга Аэльдари: Ответвления, «АРСЕНАЛ ДРУКХАРИ» (повторено во всех
//  разделах биоимплантов): Best.Q даёт один эффект на выбор из списка,
//  каждый следующий поднимает Редкость (system.availability) экземпляра на
//  1 — включая повторное взятие ОДНОГО И ТОГО ЖЕ варианта (книга у руки-
//  хищника это прямо оговаривает, правило распространено на весь арсенал).
//
//  Диалог по образцу module/apps/subrace-choice.mjs (тот же диалог выбора
//  при получении предмета, что и у Африэль/Эльданар), но с двумя отличиями:
//   1. у выбора есть цена — Редкость экземпляра растёт с числом взятых
//      эффектов сверх первого;
//   2. результат пишется НЕ Механикой предмета, а прямо в поля самого
//      экземпляра (system.chosenEffects + system.availability) — правило
//      этого импланта, не общая запись Конструктора.
//
//  Идемпотентность — не отдельный флаг, а сам system.chosenEffects: пока он
//  пуст, выбор не сделан. Второй флаг здесь развёл бы источники правды тем
//  же способом, что предупреждает диагностика migratedEffect в скилле
//  dbc-mechanics — здесь она не нужна, поле и есть факт выбора.
//
//  ОТКРЫТЫЙ ВОПРОС (решение владельца не запрашивалось, консервативный
//  выбор описан здесь и в комментарии bd wdbc-ukpu): после того как выбор
//  сделан (chosenEffects непуст), кнопка повторного выбора на листе
//  скрывается — книга говорит «выбирается при выращивании», то есть один
//  раз и навсегда. Отдельного действия «сбросить выбор» (для правки ошибки
//  ГМом) не заведено — если это неудобно в игре, разумно позже добавить
//  явную кнопку сброса, а не разрешать тихий повторный вызов диалога.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";

/**
 * Нужен ли диалог выбора: Best.Q-экземпляр со списком вариантов, выбор по
 * которому ещё не сделан. Чистая функция — без обращения к актору/Foundry,
 * читает только сами поля предмета.
 */
export function needsBestQChoice(item) {
  const sys = item?.system;
  if (!sys) return false;
  if (sys.quality !== "best") return false;
  if (!Array.isArray(sys.bestQualityEffects) || !sys.bestQualityEffects.length) return false;
  return !(Array.isArray(sys.chosenEffects) && sys.chosenEffects.length);
}

/**
 * counts — массив количеств, параллельный bestQualityEffects (сколько раз
 * взят каждый вариант, 0 и больше, повтор разрешён книгой). Чистая функция:
 * counts → {update} для item.update, либо null, если ничего не выбрано
 * (0 эффектов — то же самое, что отказ от диалога, ничего не пишем).
 * @param {Array<{label:string, note:string}>} options  system.bestQualityEffects
 * @param {number[]} counts
 * @param {number} baseAvailability  Доступность экземпляра ДО выбора (книжное значение)
 */
export function bestQChoiceUpdate(options, counts, baseAvailability) {
  const chosen = [];
  (options || []).forEach((opt, i) => {
    const n = Math.max(0, Number(counts?.[i]) || 0);
    for (let k = 0; k < n; k++) chosen.push({ label: opt.label, note: opt.note || "" });
  });
  if (!chosen.length) return null;
  return {
    "system.chosenEffects": chosen,
    "system.availability": (Number(baseAvailability) || 0) + Math.max(0, chosen.length - 1)
  };
}

/** Итог выбора для живого счётчика в диалоге: сколько взято и какой станет Доступность. */
export function bestQChoicePreview(counts, baseAvailability) {
  const total = (counts || []).reduce((s, n) => s + Math.max(0, Number(n) || 0), 0);
  return { total, availability: (Number(baseAvailability) || 0) + Math.max(0, total - 1) };
}

/** HTML диалога: по одному числовому полю на вариант + живой счётчик. */
function choiceDialogHtml(options, baseAvailability) {
  const rows = options.map((o, i) => `
    <div class="hw-choice bestq-choice-row">
      <label class="hw-choice-label">${esc(o.label)}</label>
      ${o.note ? `<div class="hw-choice-hint">${esc(o.note)}</div>` : ""}
      <input type="number" class="bestq-count" data-idx="${i}" value="0" min="0" step="1"/>
    </div>`).join("");

  return `<form class="hw-choice-form">
    <div class="hw-choice-desc">
      Best.Q даёт один эффект бесплатно. Каждый следующий (в том числе повтор
      уже взятого варианта) поднимает Доступность экземпляра на 1.
    </div>
    ${rows}
    <div class="bestq-count-summary">Выбрано: <span class="bestq-count-n">0</span> —
      Доступность станет: <span class="bestq-avail-n">${baseAvailability}</span></div>
  </form>`;
}

/**
 * Оживляет числовые поля: живой пересчёт «выбрано N — Доступность станет X»
 * при любом вводе. `h` — jQuery-корень содержимого Dialog (как и у
 * grantChoiceBlocksHtml/wireGrantChoiceBlocks в origin-shared.mjs).
 */
function wireChoiceDialog(h, options, baseAvailability) {
  const recount = () => {
    const counts = [];
    h.find(".bestq-count").each((_, el) => counts.push(parseInt(el.value) || 0));
    const { total, availability } = bestQChoicePreview(counts, baseAvailability);
    h.find(".bestq-count-n").text(String(total));
    h.find(".bestq-avail-n").text(String(availability));
  };
  h.find(".bestq-count").on("input", recount);
  recount();
}

/** Читает числовые поля диалога в массив counts, параллельный options. */
function readChoiceDialog(h, options) {
  const counts = new Array(options.length).fill(0);
  h.find(".bestq-count").each((_, el) => {
    const i = parseInt(el.dataset.idx);
    if (Number.isInteger(i)) counts[i] = parseInt(el.value) || 0;
  });
  return counts;
}

/**
 * Диалог выбора — открывается при получении Best.Q-импланта актором
 * (см. warhammer-dbc.mjs) и вручную кнопкой на листе предмета, пока выбор
 * ещё не сделан (item-sheet.mjs).
 * @returns {Promise<number[]|null>} counts или null — диалог закрыли без выбора
 */
export function promptBestQChoice(item) {
  const options = item.system?.bestQualityEffects || [];
  const baseAvailability = Number(item.system?.availability) || 0;
  if (!options.length) return Promise.resolve(null);

  return new Promise(resolve => {
    let done = false;
    new Dialog({
      title: `${item.name}: выбор эффекта Best.Q`,
      content: choiceDialogHtml(options, baseAvailability),
      buttons: {
        ok: {
          icon: '<i class="fas fa-check"></i>', label: "Принять",
          callback: h => { if (done) return; done = true; resolve(readChoiceDialog(h, options)); }
        },
        cancel: { label: "Отмена", callback: () => { if (!done) { done = true; resolve(null); } } }
      },
      default: "ok",
      render: h => wireChoiceDialog(h, options, baseAvailability),
      close: () => { if (!done) { done = true; resolve(null); } }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo", "hw-choice-dialog"], width: 480 }).render(true);
  });
}

/**
 * Полный цикл: спросить и записать. Точка входа и для автоматического хука
 * получения (createItem/updateItem, warhammer-dbc.mjs), и для ручной кнопки
 * на листе предмета (item-sheet.mjs) — один и тот же путь, поэтому оба места
 * ведут себя одинаково.
 */
export async function runBestQChoice(item) {
  // Гейт стоит ЗДЕСЬ, в общей точке, а не у каждого входа: их два, и они не
  // знают друг о друге — хук updateItem (warhammer-dbc.mjs) и кнопка листа
  // (sheets/item-sheet.mjs). ГМ ставит Качество «Высшее» дропдауном, хук
  // открывает окно; лист тем временем перерисовался, chosenEffects ещё пуст,
  // кнопка «Выбрать эффект(ы)» видна — второе окно. Оба «Принять» брали базой
  // ТЕКУЩУЮ Доступность, и она поднималась дважды, а chosenEffects
  // перезаписывался вторым выбором (wdbc-wc3).
  if (!needsBestQChoice(item)) return false;
  const counts = await promptBestQChoice(item);
  if (!counts) return false;
  // Проверка повторно ПОСЛЕ диалога: пока игрок думал, второе окно могло уже
  // записать выбор — тогда наша база Доступности устарела на единицу.
  if (!needsBestQChoice(item)) return false;
  const update = bestQChoiceUpdate(item.system?.bestQualityEffects || [], counts, item.system?.availability);
  if (!update) return false;
  await item.update(update);
  return true;
}
