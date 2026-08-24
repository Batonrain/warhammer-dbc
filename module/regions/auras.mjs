// module/regions/auras.mjs
// ════════════════════════════════════════════════════════════════════════
//  Аура — «X метров» рядом с актором, живой пересчёт того, кто сейчас
//  задет, и автоматическая выдача/снятие эффекта (wdbc-1pa). НЕ шаблон
//  зоны поражения (конус/круг/линия при разовом применении) — это отдельный,
//  ещё не реализованный механизм, см. тикет.
//
//  Формат: item.flags["warhammer-dbc"].aura = {
//    radius: <метры>, affects: "allies"|"enemies"|"all",
//    includesSelf: <bool>, grant: [<uuid>, ...]
//  }
//  Простановка флага пока ручная (Конструктор подключается позже отдельным
//  тикетом) — этот модуль только исполняет уже проставленный флаг.
//
//  Два слоя: чистые функции (tokenRelationship/auraDescriptorsOf/
//  auraAffects) без обращения к canvas — тестируются напрямую; и
//  Foundry-обвязка (sweepAurasOnScene/checkAuras), которая читает canvas и
//  создаёт/удаляет выданные предметы. Тот же принцип, что у mutationPool()
//  в module/sheets/tabs/mutations.mjs.
// ════════════════════════════════════════════════════════════════════════

import { isItemActive } from "../apps/effects.mjs";

const FLAG = "warhammer-dbc";

/* ---------------------------------------- Чистая логика ---------------------------------------- */

/**
 * Отношение между источником и целью по их диспозициям на сцене
 * (CONST.TOKEN_DISPOSITIONS: HOSTILE -1, NEUTRAL 0, FRIENDLY 1, SECRET -2).
 * Союзники — равные не-нейтральные диспозиции, враги — противоположные
 * не-нейтральные; нейтральные (и SECRET) — никому не союзники и не враги,
 * включая друг друга.
 * @param {number} sourceDisposition
 * @param {number} targetDisposition
 * @returns {"ally"|"enemy"|"neutral"}
 */
export function tokenRelationship(sourceDisposition, targetDisposition) {
  const s = Number(sourceDisposition) || 0;
  const t = Number(targetDisposition) || 0;
  // Только HOSTILE(-1)/FRIENDLY(1) участвуют в отношениях; NEUTRAL(0) и
  // SECRET(-2) — ни союзники, ни враги никому.
  if (Math.abs(s) !== 1 || Math.abs(t) !== 1) return "neutral";
  return s === t ? "ally" : "enemy";
}

/**
 * Нормализованные дескрипторы ауры со всех активных предметов актора
 * (isItemActive — та же проверка, что решает включённость эффектов).
 * @param {Actor} actor
 * @returns {{sourceItemUuid:string, radius:number, affects:string, includesSelf:boolean, grant:string[]}[]}
 */
export function auraDescriptorsOf(actor) {
  const out = [];
  for (const item of actor?.items ?? []) {
    const aura = item.getFlag(FLAG, "aura");
    if (!aura || !(Number(aura.radius) > 0)) continue;
    if (!isItemActive(item)) continue;
    out.push({
      sourceItemUuid: item.uuid,
      radius: Number(aura.radius),
      affects: aura.affects === "enemies" || aura.affects === "all" ? aura.affects : "allies",
      includesSelf: !!aura.includesSelf,
      grant: Array.isArray(aura.grant) ? aura.grant.filter(Boolean) : []
    });
  }
  return out;
}

/**
 * Задета ли цель конкретной аурой — чистое решение по уже посчитанным
 * входным данным (никакого canvas здесь).
 * @param {{radius:number, affects:string, includesSelf:boolean}} descriptor
 * @param {{isSelf:boolean, relationship:"ally"|"enemy"|"neutral", distance:number}} ctx
 */
export function auraAffects(descriptor, { isSelf, relationship, distance }) {
  if (isSelf) return !!descriptor.includesSelf;
  if (distance > descriptor.radius) return false;
  if (descriptor.affects === "all") return true; // независимо от отношения, включая нейтральных
  return descriptor.affects === "enemies" ? relationship === "enemy" : relationship === "ally";
}

/* ---------------------------------------- Foundry-обвязка ---------------------------------------- */

/**
 * Полный прогон по сцене: для каждого источника ауры и каждого другого
 * токена сцены решает, задет ли он, и приводит выданные маркеры
 * (flags.warhammer-dbc.auraSource = sourceItemUuid) в соответствие.
 * Один ГМ в игре (см. память «Вход как ГМ») — без pf2e-style
 * primaryUpdater-разделения между клиентами.
 * @param {Scene} scene
 */
export async function sweepAurasOnScene(scene) {
  if (!game.user.isGM || !scene) return;
  const tokens = scene.tokens.contents.filter(t => t.actor && !t.hidden);
  if (!tokens.length) return;

  /** @type {Map<string, Set<string>>} actorUuid -> Set(sourceItemUuid), кто должен быть задет */
  const desired = new Map();
  for (const t of tokens) desired.set(t.actor.uuid, new Set());

  for (const source of tokens) {
    const descriptors = auraDescriptorsOf(source.actor);
    if (!descriptors.length) continue;
    for (const target of tokens) {
      const isSelf = target === source;
      const distance = isSelf ? 0 : (source.object?.distanceTo?.(target.object) ?? Infinity);
      const relationship = tokenRelationship(source.disposition, target.disposition);
      for (const d of descriptors) {
        if (auraAffects(d, { isSelf, relationship, distance })) {
          desired.get(target.actor.uuid).add(d.sourceItemUuid);
        }
      }
    }
  }

  const bySourceUuid = new Map();
  for (const t of tokens) for (const d of auraDescriptorsOf(t.actor)) bySourceUuid.set(d.sourceItemUuid, d);

  for (const t of tokens) {
    const actor = t.actor;
    const want = desired.get(actor.uuid) ?? new Set();
    const have = new Map(); // sourceItemUuid -> [itemId,...]
    for (const item of actor.items) {
      const src = item.getFlag(FLAG, "auraSource");
      if (!src) continue;
      if (!have.has(src)) have.set(src, []);
      have.get(src).push(item.id);
    }

    const toDelete = [];
    for (const [src, ids] of have) if (!want.has(src)) toDelete.push(...ids);
    if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete);

    const toCreate = [];
    for (const src of want) {
      if (have.has(src)) continue;
      const descriptor = bySourceUuid.get(src);
      for (const uuid of descriptor?.grant ?? []) {
        const source = await fromUuid(uuid).catch(() => null);
        if (!source) continue;
        const data = source.toObject();
        delete data._id;
        data.flags = foundry.utils.mergeObject(data.flags || {}, { [FLAG]: { auraSource: src } });
        toCreate.push(data);
      }
    }
    if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
  }
}

export const checkAuras = foundry.utils.debounce(
  scene => sweepAurasOnScene(scene ?? canvas.scene),
  150
);
