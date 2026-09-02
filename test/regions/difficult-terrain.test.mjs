// test/regions/difficult-terrain.test.mjs
//
// module/regions/difficult-terrain.mjs — Трудный Ландшафт (Region Behavior):
// таблица свойств ландшафта (стр. 29), суммарный модификатор и сырое чтение
// зон под токеном (getTerrainInfoForToken). Сам класс наследует нативный
// foundry.data.regionBehaviors.RegionBehaviorType — геттеры вызываются через
// их дескриптор на прототипе (.call), не через `new` (нет полноценного
// DataModel в стабе), тот же приём, что и остальные region-тесты проекта.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import {
  TERRAIN_PROPS, DIFFICULT_TERRAIN_TYPE,
  DifficultTerrainBehaviorType, getTerrainInfoForToken
} from "../../module/regions/difficult-terrain.mjs";

// Экземпляр через прототип (не `new` — конструктору нужен полноценный
// DataModel, которого в стабе нет), чтобы this.activeProps внутри
// totalModifier/activeLabels резолвился по цепочке прототипов как у настоящего.
const instance = (flags) => Object.assign(Object.create(DifficultTerrainBehaviorType.prototype), flags);

describe("TERRAIN_PROPS", () => {
  it("ключи уникальны и совпадают с книжной таблицей (стр. 29)", () => {
    const keys = TERRAIN_PROPS.map(p => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("модификаторы — только те значения, что реально встречаются в таблице (10/0/-10/-20)", () => {
    for (const p of TERRAIN_PROPS) expect([10, 0, -10, -20]).toContain(p.mod);
  });
});

describe("activeProps / totalModifier / activeLabels", () => {
  it("без включённых галочек — пусто, модификатор равен только ручной поправке", () => {
    const self = instance({ extraMod: 5 });
    expect(self.activeProps).toEqual([]);
    expect(self.totalModifier).toBe(5);
    expect(self.activeLabels).toEqual([]);
  });

  it("суммирует модификаторы всех включённых свойств плюс ручную поправку", () => {
    // smoke +10, dark -10, crowd -20, extraMod +5 → -15
    const self = instance({ smoke: true, dark: true, crowd: true, extraMod: 5 });
    expect(self.totalModifier).toBe(-15);
    expect(self.activeProps.map(p => p.key).sort()).toEqual(["crowd", "dark", "smoke"]);
    expect(self.activeLabels).toEqual(["Дым или туман", "Тьма", "Плотная толпа"]);
  });

  it("extraMod нечисловой/отсутствующий — трактуется как 0", () => {
    expect(instance({ smoke: true }).totalModifier).toBe(10);
    expect(instance({ smoke: true, extraMod: "не число" }).totalModifier).toBe(10);
  });
});

describe("getTerrainInfoForToken", () => {
  const behaviorOf = (props, extraMod = 0, disabled = false) => ({
    type: DIFFICULT_TERRAIN_TYPE, disabled,
    system: { activeProps: props, extraMod }
  });

  it("токен без регионов — не в ландшафте", () => {
    expect(getTerrainInfoForToken({ regions: null })).toEqual({ inTerrain: false, props: [], extraMod: 0 });
    expect(getTerrainInfoForToken({ regions: new Set() })).toEqual({ inTerrain: false, props: [], extraMod: 0 });
  });

  it("собирает свойства и extraMod со всех активных поведений «Трудный ландшафт» под токеном", () => {
    const region1 = { behaviors: [behaviorOf([TERRAIN_PROPS[0]], 5)] };
    const region2 = { behaviors: [behaviorOf([TERRAIN_PROPS[1]], 3)] };
    const info = getTerrainInfoForToken({ regions: new Set([region1, region2]) });
    expect(info.inTerrain).toBe(true);
    expect(info.props).toEqual([TERRAIN_PROPS[0], TERRAIN_PROPS[1]]);
    expect(info.extraMod).toBe(8);
  });

  it("отключённые поведения и поведения другого типа не учитываются", () => {
    const region = {
      behaviors: [
        behaviorOf([TERRAIN_PROPS[0]], 10, true),                       // disabled
        { type: "someOtherBehavior", disabled: false, system: { activeProps: [TERRAIN_PROPS[0]], extraMod: 99 } }
      ]
    };
    expect(getTerrainInfoForToken({ regions: new Set([region]) })).toEqual({ inTerrain: false, props: [], extraMod: 0 });
  });
});
