// test/rules/infamy-success.test.mjs
//
// «Вместо провала — успех на 1 Успех за Очко Бесчестия» (Survivor/Выживальщик,
// Дикарь). Чистая часть: какие способности предлагаются на ЭТОМ проваленном
// тесте. Кнопка на карточке и списание Очка — Foundry-обвязка (hooks.mjs).

import { describe, it, expect } from "vitest";
import { infamySuccessOptions, infamySuccessSectionHtml, INFAMY_SUCCESS_ABILITIES } from "../../module/rules/infamy-success.mjs";

const survivor = new Set(["trait.survivor"]);

describe("Выживальщик: не-атакующий тест S, T, A или P", () => {
  it.each(["s", "t", "ag", "per"])("тест на %s — предлагается", (charKey) => {
    const opts = infamySuccessOptions(survivor, { kind: "skill", charKey });
    expect(opts.map(o => o.capability)).toEqual(["trait.survivor"]);
  });

  it("Навык через эти Характеристики тоже (Athletics(S), Awareness(P)) — [допущение]", () => {
    expect(infamySuccessOptions(survivor, { kind: "skill", charKey: "s", skillKey: "athletics" })).toHaveLength(1);
    expect(infamySuccessOptions(survivor, { kind: "skill", charKey: "per", skillKey: "awareness" })).toHaveLength(1);
  });

  it.each(["ws", "bs", "int", "wp", "fel", "inf"])("тест на %s — нет", (charKey) => {
    expect(infamySuccessOptions(survivor, { kind: "skill", charKey })).toEqual([]);
  });

  it("атака (даже на S/A) и манифестация — нет", () => {
    expect(infamySuccessOptions(survivor, { kind: "attack", charKey: "s" })).toEqual([]);
    expect(infamySuccessOptions(survivor, { kind: "power", charKey: "t" })).toEqual([]);
  });

  it("без Черты — нет", () => {
    expect(infamySuccessOptions(new Set(), { kind: "skill", charKey: "t" })).toEqual([]);
  });

  it("кнопка на карточке: своя возможность в data-, только владельцу, гаснет без Очков", () => {
    const opts = infamySuccessOptions(survivor, { kind: "skill", charKey: "t" });
    const on = infamySuccessSectionHtml(opts, { actorUuid: "Actor.x", hasPoint: true });
    expect(on).toContain('class="wh-infamy-success-btn" data-capability="trait.survivor"');
    expect(on).toContain('wh-owner-only" data-actor-uuid="Actor.x"');
    expect(on).toContain("Выживальщик");
    expect(on).not.toMatch(/\sdisabled\s/);
    expect(infamySuccessSectionHtml(opts, { actorUuid: "Actor.x", hasPoint: false })).toMatch(/\sdisabled\s/);
    expect(infamySuccessSectionHtml([], { actorUuid: "Actor.x", hasPoint: true })).toBe("");
  });

  it("у каждой способности есть подпись и возможность — реестр не пустышка", () => {
    expect(INFAMY_SUCCESS_ABILITIES.length).toBeGreaterThan(0);
    for (const a of INFAMY_SUCCESS_ABILITIES) {
      expect(a.capability).toMatch(/^trait\./);
      expect(a.label).toBeTruthy();
      expect(typeof a.applies).toBe("function");
    }
  });
});
