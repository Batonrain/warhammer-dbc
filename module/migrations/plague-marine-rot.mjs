// module/migrations/plague-marine-rot.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Гниль Нургла у уже созданных Чумных Десантников (razobrat wdbc-jb0zt, 13.11.2026).
//
//  ЧТО СЛУЧИЛОСЬ. Элитный архетип «Чумной Десантник» выдаёт болезнь «Nurgle's Rot /
//  Гниль Нургла» записью Конструктора (kind:"equipment", equipMode:"direct") в
//  момент выбора архетипа. Актор, взявший архетип ДО появления этой записи, болезнь
//  не получил: «Чумной Пастырь», зараза от носителя и бонусы болезни у него молчат.
//
//  ЧТО ДЕЛАЕТ. Однократно: у каждого актора, у которого есть Элитный архетип
//  «Plague Marine» и нет болезни «Nurgle's Rot» (по имени, тип disease), выдаёт
//  болезнь из компендиума diseases теми же данными, что обычная выдача
//  (apps/mechanics.mjs, kind:"equipment": active:true, flags grantedByItem /
//  equipEntryId — архетип потом опознаёт её «своей»).
//
//  ЧЕГО НЕ ТРОГАЕТ. Актора, у которого болезнь уже есть (выдана, вписана ГМом).
//  Несвязанный токен: основа уже получила болезнь в проходе по акторам;
//  токен без неё (основы нет в мире) получает болезнь в свою дельту.
//
//  ИДЕМПОТЕНТНА: повтор находит болезнь и ничего не создаёт. Версия — ключ
//  plagueMarineRotVersion, штампуется вызывающим кодом при полном успехе.
// ════════════════════════════════════════════════════════════════════════════

import { allItemPackDocs } from "../apps/content-sync.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { unlinkedTokens } from "./unlinked-tokens.mjs";

const FLAG = "warhammer-dbc";
const ARCHETYPE_NAME = "Plague Marine";
const DISEASE_NAME = "Nurgle's Rot";

const plain = doc => (doc?.toObject ? doc.toObject() : structuredClone(doc));

/** Архетип «Чумной Десантник» на акторе. */
export function hasPlagueMarineArchetype(items) {
  return [...(items ?? [])].some(i => i?.type === "eliteArchetype" && itemHasName(i, ARCHETYPE_NAME));
}

/** Болезнь «Гниль Нургла» уже на акторе. */
export function hasNurglesRot(items) {
  return [...(items ?? [])].some(i => i?.type === "disease" && itemHasName(i, DISEASE_NAME));
}

/**
 * Контекст: образец болезни и id записи Конструктора архетипа, которая её
 * выдаёт. null — пак не пересобран (чинить нечем).
 */
export function buildRotContext(docs) {
  const list = docs ?? [];
  const disease = list.find(d => d?.type === "disease" && itemHasName(d, DISEASE_NAME));
  const archetype = list.find(d => d?.type === "eliteArchetype" && itemHasName(d, ARCHETYPE_NAME));
  if (!disease || !archetype) return null;
  const uuid = disease.uuid ?? "";
  let entryId = "", archetypeId = "";
  const walk = e => {
    if (Array.isArray(e)) return e.forEach(walk);
    if (!e || typeof e !== "object") return;
    if (e.kind === "equipment" && e.equipMode === "direct" && uuid && e.equipSourceUuid === uuid) entryId = e.id;
    Object.values(e).forEach(walk);
  };
  walk(archetype.flags?.[FLAG]?.mechanics);
  archetypeId = archetype.id ?? "";
  return { disease, entryId, archetypeId };
}

/**
 * Данные болезни для выдачи актору или null — выдавать не нужно. `items` —
 * все предметы актора. Чистая функция: ни Foundry, ни записи.
 */
export function plagueMarineRotData(items, ctx) {
  if (!ctx || !hasPlagueMarineArchetype(items) || hasNurglesRot(items)) return null;
  const arch = [...items].find(i => i?.type === "eliteArchetype" && itemHasName(i, ARCHETYPE_NAME));
  const data = plain(ctx.disease);
  delete data._id;
  data.system = { ...(data.system ?? {}), active: true };
  data.flags = {
    ...(data.flags ?? {}),
    [FLAG]: { ...(data.flags?.[FLAG] ?? {}), grantedByItem: arch?.id ?? ctx.archetypeId, equipEntryId: ctx.entryId }
  };
  return data;
}

async function migrateOneActor(actor, ctx) {
  const data = plagueMarineRotData(actor.items, ctx);
  if (!data) return 0;
  await actor.createEmbeddedDocuments("Item", [data]);
  return 1;
}

export async function migratePlagueMarineRot({ tokensOnly = false } = {}) {
  if (!game.user?.isGM) { ui.notifications?.warn("Гниль Нургла у Чумных Десантников: только для ГМа."); return; }
  const ctx = buildRotContext(await allItemPackDocs());
  if (!ctx) {
    console.warn("Warhammer DBC | Гниль Нургла у Чумных Десантников: в компендиумах нет болезни или архетипа (пересоберите паки) — прогон повторится при следующей загрузке.");
    return { fixed: 0, failed: 1 };
  }
  let fixed = 0, failed = 0;
  const guarded = async (what, fn) => {
    try { fixed += await fn(); }
    catch (e) { failed++; console.error(`Warhammer DBC | Гниль Нургла у Чумных Десантников: сбой на «${what}», пропущено:`, e); }
  };
  if (!tokensOnly) {
    for (const actor of game.actors ?? []) await guarded(actor.name, () => migrateOneActor(actor, ctx));
  }
  for (const { scene, tokenDoc, actor } of unlinkedTokens()) {
    await guarded(`${tokenDoc.name} (${scene.name})`, () => migrateOneActor(actor, ctx));
  }
  const msg = failed
    ? `Гниль Нургла выдана Чумным Десантникам: ${fixed}; ${failed} пропущено из-за ошибок — повторится при следующей загрузке мира.`
    : `Гниль Нургла выдана Чумным Десантникам: ${fixed}.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}
