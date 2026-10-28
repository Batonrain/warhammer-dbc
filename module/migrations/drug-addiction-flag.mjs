// module/migrations/drug-addiction-flag.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Зависимость от наркотиков: из поля предмета — в флаг актора (task-9717).
//
//  ЧТО СЛУЧИЛОСЬ. Решение владельца 26.10.2026 (вариант A): зависимость
//  хранится флагом АКТОРА flags.warhammer-dbc.drugWithdrawal по ключу
//  препарата (rules/drug-withdrawal.mjs), а не полем system.addiction.isAddicted
//  предмета-препарата. У уже выданных копий поле стоит true — без прохода
//  текущие зависимые «выздоровели» бы: штраф без дозы, часы Календаря и тест на
//  срыв читают теперь только флаг.
//
//  ЧТО ДЕЛАЕТ. Для каждой копии препарата актора, у которой зависимость есть
//  (hasAddiction и isAddicted):
//   1. пишет запись флага актора { addicted, name, addiction (снимок настроек),
//      lastDose, doneTo, tested }. Отсчёт частоты приёма, оставшийся от версии
//      wdbc-gyqf2 (lastDose/doneTo/tested), сохраняется как есть — штраф не
//      «обнуляется» и не наступает задним числом; метки дозы нет — lastDose
//      остаётся null, и часы Календаря начнут отсчёт с конца ближайшего сдвига;
//   2. только после этого сбрасывает устаревшее isAddicted у предмета.
//  Порядок важен: сбой между шагами оставляет isAddicted=true, и повтор
//  допишет запись заново.
//
//  ИДЕМПОТЕНТНОСТЬ. Копия с isAddicted=false проходом не затрагивается, запись
//  флага при повторе пишется с теми же значениями (метки дозы уже стоят — берутся
//  из существующей записи, а не обнуляются). Отдельный ключ версии
//  (drugAddictionFlagVersion) и свой ключ для токенов — не поднимать версию
//  drug-addiction-fields (wdbc-gbd3).
//
//  Несвязанный токен — только предметы его дельты (migrations/unlinked-tokens.mjs):
//  унаследованное прошло вместе с базовым актором, а флаг пишется в дельту токена
//  только если у него самого есть зависимая копия.
//
//  Предметы папки мира (без владельца) не трогаются: зависимость — состояние
//  персонажа, у заготовки его не бывает.
// ════════════════════════════════════════════════════════════════════════════

import { deltaOwnedItems, unlinkedTokens } from "./unlinked-tokens.mjs";
import { WITHDRAWAL_FLAG, addictionSnapshot, drugKey, readWithdrawalEntries } from "../rules/drug-withdrawal.mjs";

const NS = "warhammer-dbc";

/** Копия препарата, у которой зависимость ещё записана старым полем предмета. */
export const hasLegacyAddiction = item =>
  item?.type === "drug" && !!item.system?.addiction?.hasAddiction && !!item.system?.addiction?.isAddicted;

/**
 * План переноса для набора предметов одного актора. Чистая функция: ни Foundry, ни
 * записи.
 * @param {Iterable} items    предметы актора (для токена — только его дельта)
 * @param {object}   entries  текущий флаг актора drugWithdrawal ({} — нет)
 * @returns {{entries: Object<string,object>, itemUpdates: object[]}}
 *   entries — записи для флага (по ключу препарата); itemUpdates — для
 *   updateEmbeddedDocuments: сброс устаревшего поля. Пусто — переносить нечего.
 */
export function drugAddictionFlagPlan(items, entries = {}) {
  const out = { entries: {}, itemUpdates: [] };
  for (const item of items ?? []) {
    if (!hasLegacyAddiction(item)) continue;
    const key = drugKey(item);
    const prev = entries?.[key];
    // Метки дозы прежней версии (wdbc-gyqf2) переносятся; нет — lastDose null: часы начнут отсчёт сами.
    out.entries[key] = {
      lastDose: prev?.lastDose ?? null,
      doneTo: Number(prev?.doneTo) || 0,
      tested: Number(prev?.tested) || 0,
      ...(out.entries[key] ?? {}),
      addicted: true,
      name: item.name,
      addiction: addictionSnapshot(item.system.addiction)
    };
    out.itemUpdates.push({ _id: item.id, "system.addiction.isAddicted": false });
  }
  return out;
}

async function migrateOneActor(actor, items = actor.items) {
  const plan = drugAddictionFlagPlan(items, readWithdrawalEntries(actor));
  const keys = Object.keys(plan.entries);
  if (!keys.length) return 0;
  // Запись на актора (в дельту токена) — ДО сброса поля предмета.
  await actor.update({ [`flags.${NS}.${WITHDRAWAL_FLAG}`]: plan.entries });
  await actor.updateEmbeddedDocuments("Item", plan.itemUpdates);
  return plan.itemUpdates.length;
}

/**
 * Акторы мира и несвязанные токены сцен (только предметы из дельты токена).
 * Ошибка на одном акторе/токене логируется и пропускается; версия штампуется
 * вызывающим кодом только при полном успехе.
 */
export async function migrateDrugAddictionFlag({ tokensOnly = false } = {}) {
  if (!game.user?.isGM) { ui.notifications?.warn("Зависимость наркотиков (флаг актора): только для ГМа."); return; }
  let fixed = 0;
  let failed = 0;
  const guarded = async (what, fn) => {
    try { fixed += await fn(); }
    catch (e) { failed++; console.error(`Warhammer DBC | Зависимость наркотиков (флаг актора): сбой на «${what}», пропущено:`, e); }
  };

  if (!tokensOnly) {
    for (const actor of game.actors ?? []) await guarded(actor.name, () => migrateOneActor(actor));
  }
  for (const { scene, tokenDoc, actor } of unlinkedTokens()) {
    await guarded(`${tokenDoc.name} (${scene.name})`, () => migrateOneActor(actor, deltaOwnedItems(tokenDoc)));
  }

  const msg = failed
    ? `Зависимость наркотиков перенесена на персонажей: ${fixed}; ${failed} пропущено из-за ошибок — повторится при следующей загрузке мира.`
    : `Зависимость наркотиков перенесена на персонажей: ${fixed}.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}
