// module/regions/runic-weave-zone.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Руническая Вязь, нанесённая на «замкнутое помещение» / стены (surfaceKinds
//  включает "region") — вместо предмета-носителя на акторе носитель тут
//  Region-документ на сцене: ГМ размечает комнату Region и вешает на него
//  поведение RunicWeaveZoneBehaviorType, указывающее исходный предмет вязи
//  (обычно лежит в мировых предметах, ничьим не владея).
//
//  Живой пересчёт «чей токен сейчас внутри» — тот же приём, что уже даёт
//  Аура (module/regions/auras.mjs, sweepAurasOnScene): актору, чей токен
//  вошёл в регион, клонируется временный предмет с той же Механикой (тем же
//  capabilityKey), помеченный auraSource-подобным флагом для снятия при
//  выходе. Полноценный Region-триггер (TOKEN_ENTER/EXIT) не нужен — сцена
//  пересчитывается целиком по тем же событиям, что и Ауры.
// ════════════════════════════════════════════════════════════════════════════

import { tokensInRegion } from "../combat/templates.mjs";

// Без префикса пакета — см. комментарий у LINGER_ZONE_TYPE (module/regions/linger-zone.mjs).
export const RUNIC_WEAVE_ZONE_TYPE = "runicWeaveZone";
const FLAG = "warhammer-dbc";

export class RunicWeaveZoneBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {
  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      weaveItemUuid: new fields.DocumentUUIDField({ type: "Item", label: "Руническая Вязь" })
    };
  }
}

/** Все действующие связки Region → исходная вязь на сцене. */
function zoneDescriptorsOf(scene) {
  const out = [];
  for (const region of scene?.regions ?? []) {
    for (const behavior of region.behaviors ?? []) {
      if (behavior.type !== RUNIC_WEAVE_ZONE_TYPE || behavior.disabled) continue;
      const uuid = behavior.system?.weaveItemUuid;
      if (uuid) out.push({ region, sourceItemUuid: uuid });
    }
  }
  return out;
}

/**
 * Полный прогон по сцене: клонирует/снимает копию вязи-источника у актора,
 * чей токен сейчас стоит в её Region. Один ГМ в игре (см. [[doombc-gm-login]]).
 * @param {Scene} scene
 */
export async function sweepRunicWeaveZones(scene) {
  if (!game.user.isGM || !scene) return;
  const descriptors = zoneDescriptorsOf(scene);
  if (!descriptors.length) return;

  /** @type {Map<string, Set<string>>} actorUuid -> Set(sourceItemUuid) */
  const desired = new Map();
  for (const t of scene.tokens.contents) if (t.actor) desired.set(t.actor.uuid, new Set());

  for (const { region, sourceItemUuid } of descriptors) {
    for (const token of tokensInRegion(region)) {
      desired.get(token.actor?.uuid)?.add(sourceItemUuid);
    }
  }

  const actors = new Set(scene.tokens.contents.map(t => t.actor).filter(Boolean));
  for (const actor of actors) {
    const want = desired.get(actor.uuid) ?? new Set();
    const have = new Map(); // sourceItemUuid -> [itemId,...]
    for (const item of actor.items) {
      const src = item.getFlag(FLAG, "runicWeaveZoneSource");
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
      const source = await fromUuid(src).catch(() => null);
      if (!source) continue;
      const data = source.toObject();
      delete data._id;
      data.flags = foundry.utils.mergeObject(data.flags || {}, { [FLAG]: { runicWeaveZoneSource: src } });
      toCreate.push(data);
    }
    if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
  }
}

export const checkRunicWeaveZones = foundry.utils.debounce(
  scene => sweepRunicWeaveZones(scene ?? canvas.scene),
  150
);
