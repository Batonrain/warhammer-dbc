// module/combat/heal-target.mjs
// ════════════════════════════════════════════════════════════════════════
//  ОБЩАЯ ТОЧКА ЛЕЧЕНИЯ РАН (wdbc-1rno.26, решение владельца 24.10.2026, вариант L).
//
//  Зачем. «Недоверие к Лечению» (Затронутый Варпом, субмутация 10): «после
//  получения любого лечения, кроме как от себя, штраф −10 на все тесты, кроме
//  Т, на 1 час». Метку «лечили не вы сами» (rules/warp-touched.mjs) раньше
//  ставили три разбросанных места, а остальные писатели Ран (около двадцати) о
//  ней не знали. Теперь любое место, где Раны ВОССТАНАВЛИВАЕТ ДРУГОЙ актор,
//  отмечает это одним вызовом отсюда — и условие «лечил другой, Раны реально
//  восстановлены, у пациента есть субмутация» живёт в одном месте.
//
//  Три примитива:
//   • woundsRestored(до, после) — чистая арифметика: сколько Ран восстановлено
//     (запас здоровья = value − critical, Критические — Раны в минусе);
//   • noteWoundsRestored(пациент, лечащий, сколько) — только отметка. Для мест,
//     которые пишут Раны сами (общий update вместе с другими полями, часы
//     Календаря, абсолютная установка «Раны до 0»), — вызвать ПОСЛЕ записи;
//   • healActor(пациент, сколько, {healer}) — лечение «под ключ»: запись Ран
//     (сперва Критические, потом обычные, до максимума — как окно Лечения) +
//     отметка. Для нового кода и скриптов предметов (apps/item-script.mjs).
//
//  Что НЕ проходит через эту точку, и это намеренно: самолечение (регенерация,
//  Плод Исцеления, Сус-ан, Неутомимый Воин, Исцеление Покровителя, часы
//  Календаря «пассивно» и т.п.) — лечащего нет или он и есть пациент, штрафа по
//  книге нет, переводить такие писатели значило бы рисковать ради нулевого
//  эффекта. Полная опись писателей Ран — отчёт задачи wdbc-1rno.26.
//
//  «Любое лечение» — любое восстановление Ран другим актором. Лечение без
//  восстановления Ран (остановить кровотечение, вправить конечность, прижечь,
//  вылечить болезнь) книга лечением в этом смысле не определяет — сюда не входит
//  (вопрос владельцу в отчёте задачи).
// ════════════════════════════════════════════════════════════════════════

import { noteHealingFromOther } from "./warp-touched.mjs";
import { computeWoundHealing } from "../sheets/tabs/wounds.mjs";

/** Запас здоровья: Критические — Раны в минусе. */
const hpOf = w => (Number(w?.value) || 0) - (Number(w?.critical) || 0);

/**
 * Сколько Ран восстановлено между двумя состояниями (0 — урон или без перемен).
 * @param {{value?:number, critical?:number}} before
 * @param {{value?:number, critical?:number}} after
 */
export function woundsRestored(before, after) {
  return Math.max(0, hpOf(after) - hpOf(before));
}

/**
 * Отметка «лечил другой»: если Раны восстановлены (restored > 0), лечил не сам
 * пациент и у него «Недоверие к Лечению» — штраф на час. Возвращает строку для
 * карточки лечения ("" — ничего не поставлено). Бросает, если метку записать
 * нельзя (нет прав на лист пациента) — вызывающий решает, что сказать игроку.
 * @param {Actor} patient
 * @param {Actor|null} healer  кто лечил; null — тело лечится само, штрафа нет
 * @param {number} restored    сколько Ран восстановлено
 * @param {{at?: number|null}} [opts]  момент лечения, если он был раньше «сейчас»
 */
export async function noteWoundsRestored(patient, healer, restored, { at = null } = {}) {
  if (!(Number(restored) > 0)) return "";
  return noteHealingFromOther(patient, healer, { at });
}

/**
 * Вылечить пациента на amount Ран (не больше, чем не хватает до максимума;
 * effectiveMax — Саркофаг Дредноута) и отметить лечение «от другого».
 *
 * Запись Ран и отметка — два разных права: отказ записать Раны бросает
 * исключение (метки нет), отказ записать метку НЕ бросает, а отдаётся флагом
 * mistrustFailed — Раны к этому моменту уже вылечены, и карточка не должна
 * выдавать это за невылеченные Раны.
 *
 * @param {Actor} patient
 * @param {number} amount
 * @param {{healer?: Actor|null, at?: number|null, extra?: object}} [opts]
 *   extra — добавочные поля того же update (например, метки Первой Помощи)
 * @returns {Promise<{applied:number, mistrust:string, mistrustFailed:boolean}>}
 */
export async function healActor(patient, amount, { healer = null, at = null, extra = {} } = {}) {
  const w = patient.system?.wounds ?? {};
  const woundMax = Number(w.effectiveMax ?? w.max) || 0;
  const missing = Math.max(0, woundMax - (Number(w.value) || 0)) + (Number(w.critical) || 0);
  const applied = Math.min(Math.max(0, Number(amount) || 0), missing);

  const updates = applied > 0 ? { ...computeWoundHealing(patient.system, applied), ...extra } : { ...extra };
  if (Object.keys(updates).length) await patient.update(updates);

  let mistrust = "";
  let mistrustFailed = false;
  if (applied > 0) {
    try { mistrust = await noteWoundsRestored(patient, healer, applied, { at }); }
    catch { mistrustFailed = true; }
  }
  return { applied, mistrust, mistrustFailed };
}
