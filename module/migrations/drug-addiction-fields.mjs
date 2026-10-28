// module/migrations/drug-addiction-fields.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Зависимость наркотиков: новые поля и книжные числа у уже выданных копий
//  (wdbc-gyqf2).
//
//  ЧТО СЛУЧИЛОСЬ. Пак «Химия» получил 25.10.2026 поля комбинированного теста
//  (testChar2/testMod2 — Рекаф, Алкоголь, Лхо), штрафа без дозы данными
//  (penaltyMods, breakMod), урона за период (periodCharDamage) и исправленные
//  по книге числа Зависимости (минимум доз, тест, частота у одиннадцати
//  препаратов). Копии на акторах — снимки момента выдачи: у них новых полей нет,
//  а числа старые, и часы Календаря считали бы по ним.
//
//  ЧТО ДЕЛАЕТ. Только то, что однозначно:
//   • новые поля — заполняет из пака, если на копии они ещё пусты (правка ГМа
//     главнее пака);
//   • книжные числа — исправляет, только если на копии стоит РОВНО старое
//     (неверное) значение пака: значит, ГМ его не трогал. Таблица старых значений
//     — CORRECTIONS ниже.
//  Тем же правилом «ровно старое → значение пака» чинится пост-эффект Струпа
//  (ITEM_CORRECTIONS): пак правился тогда же, а препарат без Зависимости.
//  Всё остальное («Обновить мир», apps/content-sync.mjs) остаётся ГМу.
//
//  Идемпотентна: второй прогон ничего не находит (новые поля уже заполнены,
//  старых значений уже нет).
//
//  Подбор записи пака — migrations/pack-source.mjs (uuid источника, затем имя).
// ════════════════════════════════════════════════════════════════════════════

import { allItemPackDocs, sameValue } from "../apps/content-sync.mjs";
import { buildSourceIndex, packValueFor } from "./pack-source.mjs";
import { deltaOwnedItems, unlinkedTokens } from "./unlinked-tokens.mjs";

/** Поля, которых на старых копиях нет вовсе. */
const NEW_FIELDS = ["testChar2", "testMod2", "penaltyMods", "breakMod", "periodCharDamage"];

/**
 * Книжные числа, что в паке стояли неверно (core.json, «Наркотики: Зависимость»):
 * английское имя → { поле: прежнее неверное значение }. Новое значение берётся из пака.
 */
export const CORRECTIONS = {
  "Blue Fire": { minDose: 1, testMod: -20 },
  "D-Dust": { testChar: "wp" },
  "Flect": { minDose: 4 },
  "Lho": { frequency: "1 час" },
  "Mortis": { frequency: "1 день", penalty: "−5 на тесты W и F; иначе тест W+0" },
  "Alcohol": { penalty: "−10 на тонкую манипуляцию и Ментальные действия" },
  "Puremind": { minDose: 1 },
  "Rose": { testMod: -40 },
  "Satrophine": { minDose: 1 },
  "Spook": { frequency: "1 день" },
  "Tiresias": { minDose: 4 }
};

/**
 * Поля самого препарата (не Зависимости), что в паке стояли неверно: английское
 * имя → { поле: прежнее значение }. Струп (стр. 284): урона в T у пост-эффекта
 * нет, кубы пост-эффекта — срок Оглушения, срок действия «1 час» по Календарю.
 */
export const ITEM_CORRECTIONS = {
  "Scab": {
    afterEffect: "Наносит 1d10 урона в T; в потоке рвоты — Оглушение 1d10 Раундов; иногда 1 Порча.",
    afterEffectDice: "",
    afterEffectCharDamage: { stat: "t", formula: "1d10" },
    gameMinutes: 0
  }
};

const isDefault = (field, v) => field === "periodCharDamage" ? !(v?.stat || v?.formula) : (v === "" || v === 0 || v == null);
const englishHalf = name => String(name ?? "").split("/").map(s => s.trim()).find(h => /^[A-Za-z]/.test(h)) ?? "";

/** Что об этом препарате говорит запись пака: только поля, которые миграция может занести. */
export function addictionOfPackDoc(doc) {
  const a = doc?.type === "drug" ? doc.system?.addiction : null;
  if (!a?.hasAddiction) return null;
  const keys = [...NEW_FIELDS, ...new Set(Object.values(CORRECTIONS).flatMap(c => Object.keys(c)))];
  return Object.fromEntries(keys.map(k => [k, structuredClone(a[k])]));
}

/** Поля препарата из ITEM_CORRECTIONS в записи пака (null — препарат не из таблицы). */
function itemFieldsOfPackDoc(doc) {
  const fields = ITEM_CORRECTIONS[englishHalf(doc?.name)];
  return fields ? Object.fromEntries(Object.keys(fields).map(k => [k, structuredClone(doc.system?.[k])])) : null;
}

/** Индекс «копия → { addiction, item } её записи пака» (поля Зависимости и поля ITEM_CORRECTIONS). */
export function buildDrugAddictionIndex(docs) {
  return buildSourceIndex((docs ?? []).filter(d => d?.type === "drug"), doc => {
    const addiction = addictionOfPackDoc(doc), item = itemFieldsOfPackDoc(doc);
    return addiction || item ? { addiction, item } : null;
  });
}

/**
 * Патч обновления одной копии (плоские пути) или null — трогать не нужно.
 * Чистая функция: ни Foundry, ни записи.
 */
export function drugAddictionPatch(item, index) {
  if (item?.type !== "drug") return null;
  const found = packValueFor(item, index);
  if (!found) return null;
  const patch = {};
  const cur = item.system?.addiction, pack = found.addiction;
  if (cur?.hasAddiction && pack) {
    for (const field of NEW_FIELDS) {
      if (isDefault(field, cur[field]) && !isDefault(field, pack[field])) patch[`system.addiction.${field}`] = structuredClone(pack[field]);
    }
    for (const [field, was] of Object.entries(CORRECTIONS[englishHalf(item.name)] ?? {})) {
      if (cur[field] === was && pack[field] !== undefined && pack[field] !== was) patch[`system.addiction.${field}`] = pack[field];
    }
  }
  for (const [field, was] of Object.entries(ITEM_CORRECTIONS[englishHalf(item.name)] ?? {})) {
    const now = found.item?.[field];
    if (sameValue(item.system?.[field], was) && now !== undefined && !sameValue(now, was)) patch[`system.${field}`] = structuredClone(now);
  }
  return Object.keys(patch).length ? patch : null;
}

/** Обновления для набора копий одного владельца — для updateEmbeddedDocuments. */
export function drugAddictionUpdates(items, index) {
  const out = [];
  for (const item of items ?? []) {
    const patch = drugAddictionPatch(item, index);
    if (patch) out.push({ _id: item.id, ...patch });
  }
  return out;
}

async function migrateOneActor(actor, index, items = actor.items) {
  const updates = drugAddictionUpdates(items, index);
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  return updates.length;
}

/**
 * Предметы мира, акторы мира и несвязанные токены сцен (только предметы из
 * дельты токена — унаследованные прошли вместе с базовым актором). Ошибка на
 * одном акторе/токене логируется и пропускается; версия штампуется вызывающим
 * кодом только при полном успехе.
 */
export async function migrateDrugAddictionFields({ tokensOnly = false } = {}) {
  if (!game.user?.isGM) { ui.notifications?.warn("Зависимость наркотиков: только для ГМа."); return; }
  const index = buildDrugAddictionIndex(await allItemPackDocs());
  let fixed = 0;
  let failed = 0;
  const guarded = async (what, fn) => {
    try { fixed += await fn(); }
    catch (e) { failed++; console.error(`Warhammer DBC | Зависимость наркотиков: сбой на «${what}», пропущено:`, e); }
  };

  if (!tokensOnly) {
    await guarded("предметы мира", async () => {
      let n = 0;
      for (const item of game.items ?? []) {
        const patch = drugAddictionPatch(item, index);
        if (patch) { await item.update(patch); n++; }
      }
      return n;
    });
    for (const actor of game.actors ?? []) await guarded(actor.name, () => migrateOneActor(actor, index));
  }
  for (const { scene, tokenDoc, actor } of unlinkedTokens()) {
    await guarded(`${tokenDoc.name} (${scene.name})`, () => migrateOneActor(actor, index, deltaOwnedItems(tokenDoc)));
  }

  const msg = failed
    ? `Зависимость наркотиков (комбинированный тест, штраф без дозы, книжные числа): обновлено ${fixed}; ${failed} пропущено из-за ошибок — повторится при следующей загрузке мира.`
    : `Зависимость наркотиков (комбинированный тест, штраф без дозы, книжные числа): обновлено ${fixed}.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}
