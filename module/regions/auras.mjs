// module/regions/auras.mjs
// ════════════════════════════════════════════════════════════════════════
//  Аура — «X метров» рядом с актором, живой пересчёт того, кто сейчас
//  задет, и автоматическая выдача/снятие эффекта (wdbc-1pa). НЕ шаблон
//  зоны поражения (конус/круг/линия при разовом применении) — это отдельный,
//  ещё не реализованный механизм, см. тикет.
//
//  Формат: item.flags["warhammer-dbc"].aura = {
//    radius: <метры>, affects: "allies"|"enemies"|"all",
//    includesSelf: <bool>, grant: [{uuid: <uuid>, rating: <number|null>}, ...]
//  }
//  rating — не голый uuid: «Черта-шаблон (X)» (Regeneration и т.п.) хранит
//  в паке свой базовый рейтинг, а выдача Ауры может требовать другой —
//  rescaleTraitByRating() пересчитывает эффект под него, как и путь
//  kind:"trait" в Конструкторе (module/apps/mechanics.mjs). null — рейтинг
//  не задан записью, клонируем как есть.
//  Флаг ведёт module/apps/mechanics.mjs::syncAuraFlag() по записям
//  kind:"aura" — этот модуль только исполняет уже проставленный флаг.
//
//  Два слоя: чистые функции (tokenRelationship/auraDescriptorsOf/
//  auraAffects) без обращения к canvas — тестируются напрямую; и
//  Foundry-обвязка (sweepAurasOnScene/checkAuras), которая читает canvas и
//  создаёт/удаляет выданные предметы. Тот же принцип, что у mutationPool()
//  в module/sheets/tabs/mutations.mjs.
// ════════════════════════════════════════════════════════════════════════

import { isItemActive } from "../apps/effects.mjs";
import { rescaleTraitByRating } from "../apps/mechanics.mjs";

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
      grant: Array.isArray(aura.grant) ? aura.grant.filter(g => g?.uuid) : []
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

/**
 * Дистанция между двумя токенами ПО ДОКУМЕНТАМ (x/y/width/height/elevation),
 * в единицах сцены (метрах), центр-к-центру, с учётом высоты. Placeable
 * (token.object) сознательно не используется: он существует только у сцены
 * на канвасе — замер через него на фоновой сцене давал Infinity и молча
 * стирал все выданные ауры; к тому же он ездит вместе с анимацией движения,
 * а документ сразу несёт конечные координаты.
 * @param {{x:number,y:number,width:number,height:number,elevation?:number}} a
 * @param {{x:number,y:number,width:number,height:number,elevation?:number}} b
 * @param {{size:number, distance:number}} grid  scene.grid
 */
export function tokenDocDistance(a, b, grid) {
  const size = Number(grid?.size) || 100;
  const unit = Number(grid?.distance) || 1;
  const ax = a.x + (a.width * size) / 2, ay = a.y + (a.height * size) / 2;
  const bx = b.x + (b.width * size) / 2, by = b.y + (b.height * size) / 2;
  const flat = Math.hypot(ax - bx, ay - by) / size * unit;
  const dz = (Number(a.elevation) || 0) - (Number(b.elevation) || 0);
  return Math.hypot(flat, dz);
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
  // Зачистка идёт по ВСЕМ токенам сцены с актором (включая скрытых — иначе
  // hidden уносил бы выданную ауру навсегда), а источниками и целями выдачи
  // служат только видимые.
  const allTokens = scene.tokens.contents.filter(t => t.actor);
  if (!allTokens.length) return;
  const visible = allTokens.filter(t => !t.hidden);

  /** @type {Map<string, Set<string>>} actorUuid -> Set(sourceItemUuid), кто должен быть задет */
  const desired = new Map();
  for (const t of allTokens) desired.set(t.actor.uuid, new Set());

  for (const source of visible) {
    const descriptors = auraDescriptorsOf(source.actor);
    if (!descriptors.length) continue;
    for (const target of visible) {
      const isSelf = target === source;
      const distance = isSelf ? 0 : tokenDocDistance(source, target, scene.grid);
      const relationship = tokenRelationship(source.disposition, target.disposition);
      for (const d of descriptors) {
        if (auraAffects(d, { isSelf, relationship, distance })) {
          desired.get(target.actor.uuid).add(d.sourceItemUuid);
        }
      }
    }
  }

  const bySourceUuid = new Map();
  for (const t of visible) for (const d of auraDescriptorsOf(t.actor)) bySourceUuid.set(d.sourceItemUuid, d);

  const seenActors = new Set();
  for (const t of allTokens) {
    const actor = t.actor;
    if (seenActors.has(actor.uuid)) continue;   // связанный актор двумя токенами — один проход
    seenActors.add(actor.uuid);
    const want = desired.get(actor.uuid) ?? new Set();
    const have = new Map(); // sourceItemUuid -> [itemId,...]
    for (const item of actor.items) {
      const src = item.getFlag(FLAG, "auraSource");
      if (!src) continue;
      // Маркер чужой сцены не трогаем: связанный актор может стоять на двух
      // сценах, и прогон одной не должен стирать выданное другой. Маркеры без
      // сцены (легаси) считаем своими.
      const markScene = item.getFlag(FLAG, "auraScene");
      if (markScene && markScene !== scene.id) continue;
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
      for (const g of descriptor?.grant ?? []) {
        const source = await fromUuid(g.uuid).catch(() => null);
        if (!source) continue;
        const data = source.toObject();
        delete data._id;
        // Тот же пересчёт, что у kind:"trait" в Конструкторе (wdbc-1pa.2) —
        // шаблонная Черта «(X)» несёт эффект, равный своему базовому рейтингу.
        if (g.rating != null && data.system) {
          rescaleTraitByRating(data, g.rating);
          data.system.hasRating = true;
          data.system.rating = g.rating;
        }
        data.flags = foundry.utils.mergeObject(data.flags || {}, { [FLAG]: { auraSource: src, auraScene: scene.id } });
        toCreate.push(data);
      }
    }
    if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
  }
}

/**
 * Снять с актора всё, что выдано аурами сцены (или любыми, без sceneId) —
 * для токена, покинувшего сцену: зачистка прогона его больше не увидит.
 */
export async function clearAuraGrants(actor, sceneId = null) {
  if (!actor) return;
  const ids = [...actor.items]
    .filter(i => i.getFlag(FLAG, "auraSource")
      && (!sceneId || !i.getFlag(FLAG, "auraScene") || i.getFlag(FLAG, "auraScene") === sceneId))
    .map(i => i.id);
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
}

// Прогоны строго по одному: sweep — длинный async, его собственные
// createItem/deleteItem планируют следующий прогон через debounce, и без
// очереди второй прогон читал бы состояние до записей первого — дубли выдач.
let _sweepChain = Promise.resolve();
function enqueueSweep(scene) {
  _sweepChain = _sweepChain
    .then(() => sweepAurasOnScene(scene))
    .catch(e => console.error("warhammer-dbc | ауры:", e));
  return _sweepChain;
}

export const checkAuras = foundry.utils.debounce(
  scene => enqueueSweep(scene ?? canvas.scene),
  150
);
