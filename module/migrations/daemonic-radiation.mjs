// module/migrations/daemonic-radiation.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Иммунитеты к радиации, ядам и болезням у уже выданных копий Черты Daemonic
//  (daemonic-46e0, daemonic-force-sanctified-warp-weapon п.1–2).
//
//  ЧТО СЛУЧИЛОСЬ. Книга (core.json, Трейт Daemonic (X)): «Он иммунен к ядам,
//  болезням, и радиации». Черте в паке traits дописаны три группы Конструктора:
//   • радиация (02.10.2026) — kind:"condition" condMode:"immunity"
//     condKey:"radiation": Rad и Состояние «Радиация» гасятся без правок кода
//     (combat/radiation.mjs, sheets/tabs/conditions.mjs);
//   • яды — возможность poison.immune (Toxic и яды-препараты, hooks.mjs::
//     _applyWeaponPropEffect, sheets/tabs/drugs.mjs) плюс иммунитет к Состоянию
//     «Отравление», образец — Черта Abominable Physiology;
//   • болезни — возможность defence.diseaseEffectsImmune (болезнь не действует и
//     не заражает, rules/disease-immunity.mjs), образец — Метка Нургла.
//  Но запись живёт на самом предмете, а копии на акторах — снимки момента
//  выдачи: у них её нет, и демон из Бестиария по-прежнему получает урон в T от
//  оружия Рад, травится и болеет.
//
//  Файл и ключ версии (daemonicRadiationVersion) названы по первому проходу и
//  не переименовываются: ключ уже в настройках миров. Версия прохода — 2: миры,
//  где версия 1 (только радиация) уже отработала, догоняют яды и болезни.
//
//  КТО ПОПАДАЕТ.
//   - Копии базовой Черты «Daemonic / Демонический (X)» — по ссылке на
//     источник или по имени (migrations/pack-source.mjs);
//   - существа Бестиария: их Daemonic — своя копия с именем «Daemonic (4)»
//     (Демоны Хаоса; у Друкхари — «Daemonic (4) / Демонический (4)») без
//     ссылки на источник, поэтому опознаются по имени. Паки Бестиария
//     получили запись тем же днём — этот проход догоняет уже созданных из
//     них акторов мира.
//
//  ЧТО НЕ ТРОГАЕТСЯ. «Daemonic (+X) / Демонический» Элитных архетипов Друкхари
//  (предметы без рейтинга с текстом «+X к рейтингу Daemonic» — отдельная
//  задача: у них нет и надбавки к T.b), vehicleTrait «Daemonic (X)» Техники
//  (радиация по Технике бьёт экипаж, у каждого на борту свои Черты).
//  Daemonic Armament, Presence и Dread — другие Черты. Копия, у которой иммунитет уже есть (в
//  том числе вписанный ГМом руками), и копия, где ГМ снял его через окно
//  «Обновить мир» (опора flags.warhammer-dbc.contentSync.mechanicsBaseline
//  его содержит), остаются как есть.
//
//  ИДЕМПОТЕНТНА: группа дописывается только при отсутствии иммунитета, повтор
//  ничего не меняет. Запись — живой запрос, при получении предмета ничего не
//  пишет, поэтому дописать группу в flags.mechanics достаточно.
// ════════════════════════════════════════════════════════════════════════════

import { allItemPackDocs } from "../apps/content-sync.mjs";
import { flattenMechEntries } from "../rules/fatigue-grace.mjs";
import { buildSourceIndex, packValueFor } from "./pack-source.mjs";
import { deltaOwnedItems, unlinkedTokens } from "./unlinked-tokens.mjs";

const FLAG = "warhammer-dbc";
const MECHANICS = `flags.${FLAG}.mechanics`;
const MECH_BASELINE = `flags.${FLAG}.contentSync.mechanicsBaseline`;

/** Имя базовой Черты в паке traits (любая половина двуязычного имени подходит). */
export const DAEMONIC_BASE_NAME = "Daemonic / Демонический (X)";

/**
 * Имя Черты у существ Бестиария: «Daemonic (4)» (Демоны Хаоса) и двуязычное
 * «Daemonic (4) / Демонический (4)» (Друкхари) — рейтинг в имени, без ссылки
 * на источник.
 */
const BESTIARY_NAME = /^Daemonic \(\d+\)(?: \/ Демонический \(\d+\))?$/i;

/** Есть ли среди групп Механики запись «Иммунитет к радиации». */
export function hasRadiationImmunity(groups) {
  return flattenMechEntries(Array.isArray(groups) ? groups : []).some(e =>
    e?.kind === "condition" && e.condMode === "immunity" && String(e.condKey ?? "").trim() === "radiation");
}

/** Есть ли среди групп Механики возможность с таким ключом. */
function hasCapability(groups, key) {
  return flattenMechEntries(Array.isArray(groups) ? groups : []).some(e =>
    e?.kind === "capability" && String(e.capabilityKey ?? "").trim() === key);
}

/** Есть ли среди групп Механики иммунитет к ядам (возможность poison.immune). */
export function hasPoisonImmunity(groups) { return hasCapability(groups, "poison.immune"); }

/** Есть ли среди групп Механики иммунитет к болезням (defence.diseaseEffectsImmune). */
export function hasDiseaseImmunity(groups) { return hasCapability(groups, "defence.diseaseEffectsImmune"); }

/**
 * Иммунитеты Черты: ключ, проверка «группа с таким иммунитетом уже есть» и
 * подпись для сообщения. Каждый — своя группа Механики на базовой Черте: ГМ
 * снимает их по отдельности, а миграция дописывает по отдельности.
 */
export const DAEMONIC_IMMUNITIES = [
  { key: "radiation", has: hasRadiationImmunity, label: "радиации" },
  { key: "poison",    has: hasPoisonImmunity,    label: "ядам" },
  { key: "disease",   has: hasDiseaseImmunity,   label: "болезням" }
];

/**
 * Группы-образцы иммунитетов базовой Черты Daemonic: { radiation, poison,
 * disease } (нет группы в паке — null), для любого другого документа — null.
 */
export function daemonicGroupsOf(doc) {
  if (doc?.type !== "trait" || doc.name !== DAEMONIC_BASE_NAME) return null;
  const groups = doc.flags?.[FLAG]?.mechanics;
  if (!Array.isArray(groups)) return null;
  const out = {};
  for (const imm of DAEMONIC_IMMUNITIES) out[imm.key] = groups.find(g => imm.has([g])) ?? null;
  return out;
}

/** Группа Механики базовой Черты Daemonic, несущая иммунитет к радиации, или null. */
export function radiationGroupOf(doc) {
  return daemonicGroupsOf(doc)?.radiation ?? null;
}

/**
 * Контекст миграции по документам паков: группы-образцы и индекс «копия →
 * группы» (по ссылке на источник и по имени). groups — { radiation, poison,
 * disease }; пустой ключ — в паке образца нет, чинить нечем (group — то же
 * для радиации, прежнее имя поля).
 */
export function buildDaemonicContext(docs) {
  const list = (docs ?? []).filter(d => d?.type === "trait");
  const groups = Object.fromEntries(DAEMONIC_IMMUNITIES.map(imm =>
    [imm.key, list.map(d => daemonicGroupsOf(d)?.[imm.key]).find(Boolean) ?? null]));
  return {
    groups,
    group: groups.radiation,
    index: buildSourceIndex(list, daemonicGroupsOf)
  };
}

/** Образцы собраны полностью — иначе пак не пересобран, и чинить нечем. */
export function daemonicContextComplete(ctx) {
  return DAEMONIC_IMMUNITIES.every(imm => !!ctx?.groups?.[imm.key]);
}

/** Опознаётся ли копия как Daemonic: группы-образцы, если да, иначе null. */
function daemonicGroupsFor(item, ctx) {
  if (item?.type !== "trait") return null;
  if (BESTIARY_NAME.test(String(item.name ?? "").trim())) return ctx.groups;
  return packValueFor(item, ctx.index) || null;
}

/**
 * Патч обновления одной копии (плоские пути) или null — трогать не нужно.
 * Дописывает ТОЛЬКО недостающие иммунитеты: тот, что уже есть (в том числе
 * вписанный ГМом руками) или снят ГМом через «Обновить мир» (опора
 * mechanicsBaseline его содержит), остаётся как есть.
 * Чистая функция: ни Foundry, ни записи.
 */
export function daemonicRadiationPatch(item, ctx) {
  const samples = daemonicGroupsFor(item, ctx);
  if (!samples) return null;
  const mechanics = item.flags?.[FLAG]?.mechanics;
  const current = Array.isArray(mechanics) ? mechanics : [];
  const baseline = item.flags?.[FLAG]?.contentSync?.mechanicsBaseline;
  const add = DAEMONIC_IMMUNITIES
    .filter(imm => samples[imm.key] && !imm.has(current) && !(Array.isArray(baseline) && imm.has(baseline)))
    .map(imm => samples[imm.key]);
  if (!add.length) return null;
  const patch = { [MECHANICS]: [...current, ...add.map(g => structuredClone(g))] };
  if (Array.isArray(baseline)) patch[MECH_BASELINE] = [...baseline, ...add.map(g => structuredClone(g))];
  return patch;
}

/** Обновления для набора копий одного владельца — для updateEmbeddedDocuments. */
export function daemonicRadiationUpdates(items, ctx) {
  const out = [];
  for (const item of items ?? []) {
    const patch = daemonicRadiationPatch(item, ctx);
    if (patch) out.push({ _id: item.id, ...patch });
  }
  return out;
}

/** Правит копии ОДНОГО актора; исключение уходит наружу — решает вызывающий. */
async function migrateOneActor(actor, ctx, items = actor.items) {
  const updates = daemonicRadiationUpdates(items, ctx);
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  return updates.length;
}

/**
 * Предметы мира, акторы мира и несвязанные токены сцен (только предметы из
 * дельты токена, migrations/unlinked-tokens.mjs). Ошибка на одном
 * акторе/токене логируется и пропускается; версия штампуется вызывающим кодом
 * только при полном успехе. Нет образца в паке — это сбой, а не «чинить
 * нечего»: иначе версия встала бы навсегда над пустым прогоном.
 */
export async function migrateDaemonicRadiation({ tokensOnly = false } = {}) {
  if (!game.user?.isGM) { ui.notifications?.warn("Иммунитеты Daemonic: только для ГМа."); return; }
  const ctx = buildDaemonicContext(await allItemPackDocs());
  if (!daemonicContextComplete(ctx)) {
    const missing = DAEMONIC_IMMUNITIES.filter(imm => !ctx.groups[imm.key]).map(imm => imm.label).join(", ");
    console.warn(`Warhammer DBC | Иммунитеты Daemonic: в компендиуме traits у «Daemonic / Демонический (X)» нет записи иммунитета к: ${missing} (пересоберите паки) — прогон повторится при следующей загрузке.`);
    return { fixed: 0, failed: 1 };
  }
  let fixed = 0;
  let failed = 0;
  const guarded = async (what, fn) => {
    try { fixed += await fn(); }
    catch (e) { failed++; console.error(`Warhammer DBC | Иммунитеты Daemonic: сбой на «${what}», пропущено:`, e); }
  };

  if (!tokensOnly) {
    await guarded("предметы мира", async () => {
      let n = 0;
      for (const item of game.items ?? []) {
        const patch = daemonicRadiationPatch(item, ctx);
        if (patch) { await item.update(patch); n++; }
      }
      return n;
    });
    for (const actor of game.actors ?? []) await guarded(actor.name, () => migrateOneActor(actor, ctx));
  }
  for (const { scene, tokenDoc, actor } of unlinkedTokens()) {
    await guarded(`${tokenDoc.name} (${scene.name})`, () => migrateOneActor(actor, ctx, deltaOwnedItems(tokenDoc)));
  }

  const msg = failed
    ? `Иммунитеты к радиации, ядам и болезням дописаны Чертам Daemonic: ${fixed}; ${failed} пропущено из-за ошибок — повторится при следующей загрузке мира.`
    : `Иммунитеты к радиации, ядам и болезням дописаны Чертам Daemonic: ${fixed} (Rad, яды и болезни демонов больше не действуют).`;
  console[failed ? "warn" : "log"]("Warhammer DBC |", msg);
  if (fixed || failed) ui.notifications?.[failed ? "warn" : "info"]("Warhammer DBC: " + msg);
  return { fixed, failed };
}
