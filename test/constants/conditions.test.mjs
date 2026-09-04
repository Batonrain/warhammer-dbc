// test/constants/conditions.test.mjs
//
// wdbc-w88h: один реестр Состояний вместо четырёх списков. Тесты фиксируют,
// что производные формы (CONDITIONS_DEF листа, CONDITION_ICONS токена,
// CONDITION_COUNTERS схемы, ROUND_TICK_CONDITIONS тика) остаются согласованы
// друг с другом сами, потому что строятся из одного CONDITIONS — раньше это
// было ровно то место, где расхождение проходило молча (wdbc-1xjx).

import { describe, it, expect } from "vitest";
import {
  CONDITIONS, CONDITION_KEYS, CONDITION_COUNTERS, CONDITIONS_DEF, CONDITION_ICONS,
  ROUND_TICK_CONDITIONS, TOKEN_SYNC_EXCLUDE, conditionLevelField, condIconHTML
} from "../../module/constants/conditions.mjs";

describe("CONDITIONS: согласованность производных форм", () => {
  it("CONDITIONS_DEF несёт запись на каждый ключ CONDITIONS, и только на них", () => {
    expect(Object.keys(CONDITIONS_DEF).sort()).toEqual(CONDITION_KEYS.sort());
  });

  it("«В Шоке» (wdbc-1xjx) есть в реестре — раньше оно было только в схеме, не в CONDITIONS_DEF", () => {
    expect(CONDITIONS_DEF.shocked).toBeTruthy();
    expect(CONDITIONS_DEF.shocked.label).toBe("В Шоке");
    expect(CONDITION_ICONS.shocked).toBeTruthy();
  });

  it("hasLevel/levelField в CONDITIONS_DEF совпадают с CONDITION_COUNTERS", () => {
    for (const [key, def] of Object.entries(CONDITIONS_DEF)) {
      const suffix = CONDITION_COUNTERS[key];
      expect(def.hasLevel).toBe(!!suffix);
      expect(def.levelField).toBe(suffix ? key + suffix : null);
    }
  });

  it("каждый непустой desc — иначе тег на листе останется без подсказки", () => {
    for (const [key, def] of Object.entries(CONDITIONS_DEF))
      expect(def.desc?.trim(), key).toBeTruthy();
  });

  it("css — cond- + kebab-case ключа (lostHands → cond-lost-hands)", () => {
    expect(CONDITIONS_DEF.bleeding.css).toBe("cond-bleeding");
    expect(CONDITIONS_DEF.lostHands.css).toBe("cond-lost-hands");
    expect(CONDITIONS_DEF.hallucinogenic.css).toBe("cond-hallucinogenic");
  });

  it("CONDITION_ICONS несёт {color, body} для каждого ключа", () => {
    for (const key of CONDITION_KEYS) {
      expect(CONDITION_ICONS[key].color).toBe(CONDITIONS[key].color);
      expect(CONDITION_ICONS[key].body).toBe(CONDITIONS[key].body);
    }
  });

  it("ROUND_TICK_CONDITIONS — только состояния со счётчиком rounds", () => {
    const keys = ROUND_TICK_CONDITIONS.map(c => c.key).sort();
    expect(keys).toEqual(["blinded", "stunned", "suffocating"]);
    for (const { key, field } of ROUND_TICK_CONDITIONS)
      expect(field).toBe(conditionLevelField(key));
  });

  it("TOKEN_SYNC_EXCLUDE — только Усталость (счётчик, не тумблер)", () => {
    expect([...TOKEN_SYNC_EXCLUDE]).toEqual(["fatigued"]);
  });

  it("conditionLevelField: null для состояния без счётчика", () => {
    expect(conditionLevelField("prone")).toBeNull();
    expect(conditionLevelField("bleeding")).toBe("bleedingLevel");
  });

  it("condIconHTML: пусто для неизвестного ключа, не падает", () => {
    expect(condIconHTML("no-such-condition")).toBe("");
  });
});
