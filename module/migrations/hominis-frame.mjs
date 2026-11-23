// module/migrations/hominis-frame.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Фрейм Хоминис» у уже созданных Электрожрецов (Sahara 588-551f, razobrat
//  wdbc-zxsbb, 21.11.2026).
//
//  ЧТО СЛУЧИЛОСЬ. PR #588 сделал Архетип Электрожреца действующим только с
//  Чертой «Hominis Frame / Фрейм Хоминис» (rules/electropriest.mjs::
//  electropriestActive). Черту выдаёт запись Конструктора архетипа
//  (kind:"trait", equipMode:"direct") в момент выбора. Актор, взявший
//  архетип ДО появления записи, Черты не получил — и его Архетип гаснет.
//
//  ЧТО ДЕЛАЕТ. Однократно: у каждого актора с Элитным архетипом
//  «Electro-Priest» и без Черты «Hominis Frame» выдаёт Черту из компендиума
//  traits теми же метками, что обычная выдача (grantedByItem /
//  abilityEntryId — архетип потом считает её «своей»), и помечает запись
//  в mechanicsApplied архетипа (иначе «Обновить мир» выдаст вторую).
//
//  ЧЕГО НЕ ТРОГАЕТ. Актора, у которого Черта уже есть, и актора, на котором
//  стоит другой Фрейм (Ассасин/Паладин/Шедевр) — у того Хоминиса быть не
//  должно. Несвязанный токен без основы в мире получает Черту в свою дельту.
//
//  ИДЕМПОТЕНТНА: повтор находит Черту и ничего не создаёт.
// ════════════════════════════════════════════════════════════════════════════

import { allItemPackDocs } from "../apps/content-sync.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { unlinkedTokens } from "./unlinked-tokens.mjs";

const FLAG = "warhammer-dbc";
const ARCHETYPE_NAME = "Electro-Priest";
const TRAIT_NAME = "Hominis Frame";
const OTHER_FRAMES = ["Assassin Frame", "Paladin Frame", "Masterpiece Frame"];

const plain = doc => (doc?.toObject ? doc.toObject() : structuredClone(doc));
const archOf = items => [...(items ?? [])].find(i => i?.type === "eliteArchetype" && itemHasName(i, ARCHETYPE_NAME));

/** Черта «Фрейм Хоминис» уже на акторе. */
export const hasHominisTrait = items => [...(items ?? [])].some(i => i?.type === "trait" && itemHasName(i, TRAIT_NAME));

/** Стоит другой Фрейм Механикус — Хоминис не выдаём. */
export const hasOtherFrame = items =>
  [...(items ?? [])].some(i => i?.type === "trait" && OTHER_FRAMES.some(n => itemHasName(i, n)));

/** Контекст: образец Черты и id записи архетипа, которая её выдаёт. null — пак не пересобран. */
export function buildHominisContext(docs) {
  const list = docs ?? [];
  const trait = list.find(d => d?.type === "trait" && itemHasName(d, TRAIT_NAME));
  const archetype = list.find(d => d?.type === "eliteArchetype" && itemHasName(d, ARCHETYPE_NAME));
  if (!trait || !archetype) return null;
  const uuid = trait.uuid ?? "";
  let entryId = "";
  const walk = e => {
    if (Array.isArray(e)) return e.forEach(walk);
    if (!e || typeof e !== "object") return;
    if (e.kind === "trait" && uuid && e.sourceUuid === uuid) entryId = e.id;
    Object.values(e).forEach(walk);
  };
  walk(archetype.flags?.[FLAG]?.mechanics);
  return { trait, entryId };
}

/** Данные Черты для выдачи или null — выдавать не нужно. Чистая функция. */
export function hominisFrameData(items, ctx) {
  const arch = archOf(items);
  if (!ctx || !arch || hasHominisTrait(items) || hasOtherFrame(items)) return null;
  const data = plain(ctx.trait);
  delete data._id;
  data.flags = {
    ...(data.flags ?? {}),
    [FLAG]: { ...(data.flags?.[FLAG] ?? {}), grantedByItem: arch.id, ...(ctx.entryId ? { abilityEntryId: ctx.entryId } : {}) }
  };
  return data;
}

/** Правка архетипа: запись выдачи — в mechanicsApplied. null — уже помечена. */
export function hominisAppliedUpdate(items, ctx) {
  const arch = archOf(items);
  if (!arch || !ctx?.entryId) return null;
  const flag = arch.flags?.[FLAG]?.mechanicsApplied;
  if (flag === true || (Array.isArray(flag) && flag.includes(ctx.entryId))) return null;
  return { _id: arch.id, [`flags.${FLAG}.mechanicsApplied`]: [...(Array.isArray(flag) ? flag : []), ctx.entryId] };
}

async function migrateOneActor(actor, ctx) {
  const data = hominisFrameData(actor.items, ctx);
  if (!data) return 0;
  await actor.createEmbeddedDocuments("Item", [data]);
  const upd = hominisAppliedUpdate(actor.items, ctx);
  if (upd) await actor.updateEmbeddedDocuments("Item", [upd]);
  return 1;
}

export async function migrateHominisFrame({ tokensOnly = false } = {}) {
  if (!game.user?.isGM) { ui.notifications?.warn("Фрейм Хоминис у Электрожрецов: только для ГМа."); return; }
  const ctx = buildHominisContext(await allItemPackDocs());
  if (!ctx) {
    console.warn("Warhammer DBC | Фрейм Хоминис: в компендиумах нет Черты или архетипа (пересоберите паки) — прогон повторится при следующей загрузке.");
    return { fixed: 0, failed: 1 };
  }
  let fixed = 0, failed = 0;
  const guarded = async (what, fn) => {
    try { fixed += await fn(); }
    catch (e) { failed++; console.error(`Warhammer DBC | Фрейм Хоминис: сбой на «${what}», пропущено:`, e); }
  };
  if (!tokensOnly) {
    for (const actor of game.actors ?? []) await guarded(actor.name, () => migrateOneActor(actor, ctx));
  }
  for (const { scene, tokenDoc, actor } of unlinkedTokens()) {
    await guarded(`${tokenDoc.name} (${scene.name})`, () => migrateOneActor(actor, ctx));
  }
  const msg = failed
    ? `Фрейм Хоминис выдан Электрожрецам: ${fixed}; ${failed} пропущено из-за ошибок — повторится при следующей загрузке мира.`
    : `Фрейм Хоминис выдан Электрожрецам: ${fixed}.`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}
