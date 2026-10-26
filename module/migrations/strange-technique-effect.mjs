// module/migrations/strange-technique-effect.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Странная Техника: снять старый ActiveEffect «+1 к system.reactions.max»
//  у уже выданных копий (Sahara 3-8dc5, решение владельца 26.10.2026).
//
//  ЧТО СЛУЧИЛОСЬ. Талант нёс ActiveEffect, прибавлявший 1 к ОБЩЕМУ максимуму
//  Реакций — шире книги: книга даёт дополнительную Реакцию «только на атаки,
//  вроде атак хвостом, мехадендритами, или бонусных приёмов Повалить», а общая
//  годилась и на Избегание. Теперь это отдельный пул system.reactions.
//  strangeValue (rules/melee-talents.mjs::strangeReactionMax), а эффект из пака
//  убран. Без этого прохода у выданных копий осталась бы лишняя общая Реакция.
//
//  ЧТО ДЕЛАЕТ. У каждой копии Таланта (на акторе, в дельте несвязанного токена и
//  в предметах мира) удаляет эффекты, которые меняют ТОЛЬКО system.reactions.max
//  и называются «Strange Technique…» — то есть именно переданный из пака. Эффект,
//  который ГМ вписал сам (другое имя или другие ключи), не трогается.
//
//  ИДЕМПОТЕНТНОСТЬ. Нечего снимать — нет записей; повтор безопасен. Отдельный ключ
//  версии (strangeTechniqueEffectVersion). Несвязанный токен — только предметы его
//  дельты (unlinked-tokens.mjs).
// ════════════════════════════════════════════════════════════════════════════

import { deltaOwnedItems, unlinkedTokens } from "./unlinked-tokens.mjs";

const REACTIONS_MAX = "system.reactions.max";

/** Имя Таланта (любая половина двуязычного имени). */
function isStrangeTechnique(name) {
  return String(name ?? "").includes("Strange Technique") || String(name ?? "").includes("Странная Техника");
}

/**
 * Эффект — тот самый общий +1 к максимуму Реакций из пака (имя Таланта, все
 * изменения — system.reactions.max). Чистая функция.
 */
export function isLegacyStrangeEffect(effect) {
  if (!isStrangeTechnique(effect?.name)) return false;
  const changes = effect?.changes ?? effect?.system?.changes ?? [];
  return changes.length > 0 && changes.every(c => c?.key === REACTIONS_MAX);
}

/** Идентификаторы эффектов копии Таланта, которые нужно удалить ([] — нечего). */
export function strangeTechniqueEffectIds(item) {
  if (item?.type !== "talent" || !isStrangeTechnique(item.name)) return [];
  const effects = item.effects?.contents ?? item.effects ?? [];
  return [...effects].filter(isLegacyStrangeEffect).map(e => e.id ?? e._id);
}

async function migrateItems(items) {
  let n = 0;
  for (const item of items) {
    const ids = strangeTechniqueEffectIds(item);
    if (!ids.length) continue;
    await item.deleteEmbeddedDocuments("ActiveEffect", ids);
    n += ids.length;
  }
  return n;
}

/**
 * Акторы мира, предметы мира и несвязанные токены сцен (только дельта). Ошибка на одном
 * акторе/токене логируется и пропускается; версия штампуется вызывающим кодом только
 * при полном успехе.
 */
export async function migrateStrangeTechniqueEffect({ tokensOnly = false } = {}) {
  if (!game.user?.isGM) { ui.notifications?.warn("Странная Техника (снять общую Реакцию): только для ГМа."); return; }
  let fixed = 0;
  let failed = 0;
  const guarded = async (what, fn) => {
    try { fixed += await fn(); }
    catch (e) { failed++; console.error(`Warhammer DBC | Странная Техника: сбой на «${what}», пропущено:`, e); }
  };

  if (!tokensOnly) {
    for (const actor of game.actors ?? []) await guarded(actor.name, () => migrateItems([...(actor.items ?? [])]));
    await guarded("предметы мира", () => migrateItems([...(game.items ?? [])]));
  }
  for (const { scene, tokenDoc } of unlinkedTokens()) {
    await guarded(`${tokenDoc.name} (${scene.name})`, () => migrateItems(deltaOwnedItems(tokenDoc)));
  }

  const msg = failed
    ? `Странная Техника: снято общих Реакций ${fixed}; ${failed} пропущено из-за ошибок — повторится при следующей загрузке мира.`
    : `Странная Техника: снято общих Реакций ${fixed} (теперь отдельный пул «странных» атак).`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}
