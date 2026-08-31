// module/regions/graviton-zone.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Свойство оружия Гравитонное (Graviton, стр. 168): «Шаблоны Blast от этого
//  оружия в начале каждого Хода стрелка уменьшают радиус на 1, пока не
//  исчезнут. Зона взрыва — Трудный Ландшафт−30... 5+ Провалов — подброс на
//  1d10м вместо сбивания с ног.» Тикет wdbc-wlwf.
//
//  В книге зона названа «Шаблоны Blast И Haywire» — в движке проекта нет
//  отдельного «шаблона Haywire» (haywire — точечный ЭМИ-эффект на попадание,
//  combat/damage.mjs, не AoE-зона), поэтому здесь Гравитонное применяется
//  только к Blast/Spray-шаблону оружия (единственный вид шаблона, который
//  вообще существует в движке).
//
//  Два независимых поведения на ОДНОМ Region-документе (не одно составное):
//    1. GravitonZoneBehaviorType (этот файл) — только усыхание радиуса на
//       начале Хода СТРЕЛКА (тот же паттерн триггера, что и Linger, см.
//       linger-zone.mjs — processShooterTurnStart, не любая смена Раунда).
//    2. DifficultTerrainBehaviorType (уже готовый, module/regions/difficult-
//       terrain.mjs) с extraMod:-30 — переиспользуется как есть, у него уже
//       есть штатное поле «ручная поправка сверх таблицы» именно под такой
//       случай.
//  Разделение, а не один новый behavior «Гравитонное = усыхание + террейн»,
//  чтобы не дублировать код Трудного Ландшафта, который уже работает и уже
//  читается showDifficultTerrainDialog/getTerrainInfoForToken без изменений.
//
//  «5+ Провалов — подброс 1d10м» НЕ автоматизировано — тот же прецедент, что
//  и обычный провал Трудного Ландшафта («книга не формализует урон от
//  падения — оставлено ГМу», movement-terrain.mjs): чат-заметка при
//  размещении зоны напоминает ГМу считать вручную.
// ═══════════════════════════════════════════════════════════════════════════

import { pxPerMeter, tokensInRegion } from "../combat/templates.mjs";
import { DIFFICULT_TERRAIN_TYPE } from "./difficult-terrain.mjs";
import { esc } from "../helpers/utils.mjs";

// Foundry v14: системный тип, без префикса пакета — см. комментарий у LINGER_ZONE_TYPE.
export const GRAVITON_ZONE_TYPE = "gravitonZone";

export class GravitonZoneBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      // uuid актора-стрелка — усыхание привязано к началу ЕГО хода, не любой
      // смене раунда (тот же принцип, что и attackerUuid у Linger).
      attackerUuid: new fields.StringField({ required: true, initial: "" }),
      // Текущий радиус зоны в метрах — источник истины для усыхания (у самой
      // Region-фигуры радиус в пикселях, метры удобнее хранить отдельно).
      radiusMeters: new fields.NumberField({ required: true, initial: 0, min: 0 })
    };
  }
}

/**
 * Разместить Гравитонную зону — тот же круг (blastCircleShape), что и у
 * обычного Взрывного, плюс усыхание + Трудный Ландшафт−30. Начальное
 * попадание по накрытым токенам НЕ применяется автоматически (как и у
 * обычного Взрывного) — накрытые токены становятся целями, дальше «Применить
 * урон» → «Всем» как обычно; только последующее усыхание/террейн — новое.
 * @param {object} shape        blastCircleShape(meters, pxPerMeter()).
 * @param {number} meters       Начальный радиус — тот же blastRating оружия.
 * @param {string} attackerUuid
 * @param {string} [name]
 * @returns {Promise<{tokens: Token[], region: RegionDocument}|null>}  null — размещение отменено (ПКМ).
 */
export async function placeGravitonZone(shape, meters, attackerUuid, name = "Гравитонное") {
  if (!canvas.ready) throw new Error("Нет активной сцены");
  const region = await canvas.regions.placeRegion({
    name,
    shapes: [shape],
    color: game.user.color.toString(),
    highlightMode: "coverage",
    displayMeasurements: true,
    behaviors: [
      {
        name: "Гравитонное (усыхание)",
        type: GRAVITON_ZONE_TYPE,
        system: { attackerUuid, radiusMeters: meters }
      },
      {
        name: "Трудный ландшафт (Гравитонное)",
        type: DIFFICULT_TERRAIN_TYPE,
        system: { extraMod: -30 }
      }
    ]
  });
  if (!region) return null;

  await ChatMessage.create({
    speaker: { alias: "Система" },
    content: `<div class="wh-roll-result">
      <div class="roll-outcome">🕳 Гравитонная зона «${esc(region.name)}» размещена (${meters}м, Трудный Ландшафт−30,
      радиус тает на 1м каждый ход стрелка). Провалившие тест на 5+ Провалов — подброс на 1d10м вместо
      сбивания с ног (ГМ считает вручную, как и обычное падение в Трудном Ландшафте).</div>
    </div>`
  });

  return { tokens: tokensInRegion(region), region };
}

/**
 * Дёрнуть все Гравитонные зоны, созданные атакующим `combatant`, на начале
 * его Хода: −1м радиуса, удалить при уходе в 0. Вызывается из hooks.mjs по
 * updateCombat при смене хода — тот же паттерн, что и processShooterTurnStart
 * (module/regions/linger-zone.mjs).
 * @param {Combatant} combatant
 */
export async function processGravitonShooterTurnStart(combatant) {
  if (!game.user.isGM || !combatant?.actor) return;
  const attackerUuid = combatant.actor.uuid;

  const combatScene = combatant.combat?.scene ?? canvas?.scene;
  for (const scene of combatScene ? [combatScene] : []) {
    const toDelete = [];
    for (const region of scene.regions) {
      const behavior = region.behaviors.find(b => b.type === GRAVITON_ZONE_TYPE && !b.disabled);
      if (!behavior || behavior.system.attackerUuid !== attackerUuid) continue;

      const newRadius = (behavior.system.radiusMeters ?? 0) - 1;
      if (newRadius <= 0) { toDelete.push(region.id); continue; }

      const px = pxPerMeter();
      const shapeData = region.toObject().shapes[0];
      await region.update({ shapes: [{ ...shapeData, radius: newRadius * px }] });
      await behavior.update({ "system.radiusMeters": newRadius });
    }
    if (toDelete.length) await scene.deleteEmbeddedDocuments("Region", toDelete);
  }
}

/**
 * Убрать ВСЕ ещё живые Гравитонные зоны — бой закончился, считать ходы
 * стрелка больше не от чего (тот же принцип, что и clearAllLingerZones).
 * Вызывается из hooks.mjs по deleteCombat.
 */
export async function clearAllGravitonZones() {
  if (!game.user.isGM) return;
  for (const scene of game.scenes) {
    const ids = [];
    for (const region of scene.regions) {
      if ([...region.behaviors].some(b => b.type === GRAVITON_ZONE_TYPE)) ids.push(region.id);
    }
    if (ids.length) await scene.deleteEmbeddedDocuments("Region", ids);
  }
}
