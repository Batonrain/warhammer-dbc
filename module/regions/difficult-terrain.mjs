// module/regions/difficult-terrain.mjs
// ════════════════════════════════════════════════════════════════════════
//  Трудный Ландшафт — Region Behavior (нативные Зоны Foundry v13).
//  ГМ рисует зону на сцене штатным слоем Regions и вешает на неё поведение
//  «Трудный ландшафт»; галочки — свойства ландшафта из таблицы корбука
//  (стр. 29 «ДВИЖЕНИЕ»), каждая даёт готовый модификатор теста A+0 при
//  Беге/Натиске через зону (см. module/combat/movement-terrain.mjs).
//  Само наличие поведения на регионе = зона трудного ландшафта → SPD
//  уменьшается вдвое (реализовано через _getTerrainEffects: удваивает
//  стоимость хода в линейке движения токена, тот же механизм, что у
//  нативного поведения "Изменить стоимость движения").
// ════════════════════════════════════════════════════════════════════════

export const DIFFICULT_TERRAIN_TYPE = "warhammer-dbc.difficultTerrain";

// Таблица «Ландшафт — модификатор» (корбук, стр. 29). Ключ поля схемы →
// подпись чекбокса → модификатор теста A+0 при Беге/Натиске через зону.
export const TERRAIN_PROPS = [
  { key: "smoke",      label: "Дым или туман",       mod:  10 },
  { key: "mud",         label: "Грязь",                mod:   0 },
  { key: "bloodPool",   label: "Лужа воды или крови",  mod:   0 },
  { key: "dark",        label: "Тьма",                 mod: -10 },
  { key: "deepSnow",    label: "Глубокий снег",        mod: -10 },
  { key: "thicket",     label: "Густой подлесок",      mod: -10 },
  { key: "ice",         label: "Лёд",                  mod: -10 },
  { key: "crowd",       label: "Плотная толпа",        mod: -20 },
  { key: "corpses",     label: "Трупы",                mod: -20 },
  { key: "rubble",      label: "Обломки",              mod: -20 },
  { key: "earthquake",  label: "Землетрясение",        mod: -20 }
];

export class DifficultTerrainBehaviorType extends foundry.data.regionBehaviors.RegionBehaviorType {

  /** @override */
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};
    for (const p of TERRAIN_PROPS) {
      schema[p.key] = new fields.BooleanField({
        required: true, initial: false,
        label: `${p.label} (${p.mod >= 0 ? "+" : ""}${p.mod})`
      });
    }
    schema.extraMod = new fields.NumberField({
      required: true, integer: true, initial: 0, nullable: false,
      label: "Доп. модификатор", hint: "Ручная поправка ГМа сверх таблицы (если ландшафт особый)."
    });
    return schema;
  }

  /* ---------------------------------------- */

  /** Активные свойства зоны с их подписями/модификаторами. */
  get activeProps() {
    return TERRAIN_PROPS.filter(p => this[p.key]);
  }

  /** Суммарный модификатор теста A+0 (свойства зоны + ручная поправка ГМа). */
  get totalModifier() {
    return this.activeProps.reduce((sum, p) => sum + p.mod, 0) + (Number(this.extraMod) || 0);
  }

  /** Подписи включённых свойств — для тултипа/чат-карточки. */
  get activeLabels() {
    return this.activeProps.map(p => p.label);
  }

  /* ---------------------------------------- */

  // Зона трудного ландшафта всегда удваивает стоимость хода — SPD ×0.5
  // по правилу (стр. 29), независимо от того, какие галочки включены.
  /** @override */
  _getTerrainEffects(token, segment, options) {
    return [{ name: "difficulty", difficulty: 2 }];
  }

  /* ---------------------------------------- */
  // Пересчёт спланированных путей движения при изменении настроек зоны —
  // тот же паттерн, что у нативного "Изменить стоимость движения"
  // (client/data/region-behaviors/increase-movement-cost.mjs).

  static async #onBehaviorViewed() { canvas.tokens?.recalculatePlannedMovementPaths(); }
  static async #onBehaviorUnviewed() { canvas.tokens?.recalculatePlannedMovementPaths(); }
  static async #onRegionBoundary(event) {
    if (!this.behavior.viewed) return;
    canvas.tokens?.recalculatePlannedMovementPaths();
  }

  /** @override */
  static events = {
    [CONST.REGION_EVENTS.BEHAVIOR_VIEWED]:   this.#onBehaviorViewed,
    [CONST.REGION_EVENTS.BEHAVIOR_UNVIEWED]: this.#onBehaviorUnviewed,
    [CONST.REGION_EVENTS.REGION_BOUNDARY]:   this.#onRegionBoundary
  };

  /** @inheritDoc */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    if (!("system" in changed) || !this.behavior.viewed) return;
    canvas.tokens?.recalculatePlannedMovementPaths();
  }
}

/**
 * Сырое инфо о трудном ландшафте под токеном (без учёта иммунитетов актора —
 * см. module/combat/movement-terrain.mjs effectiveTerrainInfo() для этого):
 * по-свойственный список включённых галочек со всех активных (не отключённых)
 * поведений «Трудный ландшафт» на регионах под токеном + сумма их «Доп.
 * модификатор» (extraMod не относится ни к одному свойству — не иммунится).
 * @param {TokenDocument} tokenDoc
 * @returns {{inTerrain: boolean, props: {key:string,label:string,mod:number}[], extraMod: number}}
 */
export function getTerrainInfoForToken(tokenDoc) {
  const regions = tokenDoc?.regions;
  if (!regions || !regions.size) return { inTerrain: false, props: [], extraMod: 0 };
  const props = [];
  let extraMod = 0;
  let any = false;
  for (const region of regions) {
    for (const behavior of region.behaviors) {
      if (behavior.type !== DIFFICULT_TERRAIN_TYPE || behavior.disabled) continue;
      any = true;
      extraMod += Number(behavior.system.extraMod) || 0;
      props.push(...behavior.system.activeProps);
    }
  }
  return { inTerrain: any, props, extraMod };
}
