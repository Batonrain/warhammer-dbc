// test/rules/eater-of-pain.test.mjs
//
// Eater of Pain / Пожиратель Боли (wdbc-1rno, Слаанеш): геометрия «крит
// рядом» (та же аура Cor.b м, что rules/fatalism.mjs) и арифметика трёх
// преимуществ (та же формула charDamage, что apps/skillful-torture.mjs::
// grantTortureBenefit).

import "../support/foundry-stub.mjs";
import { describe, it, expect, afterEach } from "vitest";
import { eaterOfPainHoldersNear, eaterOfPainBenefitUpdate, eaterOfPainChoiceButtonsHtml }
  from "../../module/rules/eater-of-pain.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

const grid = { size: 100, distance: 2 }; // клетка 100px = 2 метра

function bearerActor(corruptionBonus, name = "Носитель") {
  return { name, uuid: `Actor.${name}`, system: { corruptionBonus } };
}
function token(id, actor, { x = 0, y = 0 } = {}) {
  return { id, x, y, width: 1, height: 1, hidden: false, actor };
}
function scene(tokens) {
  const sc = { grid, tokens: { contents: tokens } };
  for (const t of tokens) t.parent = sc;
  return sc;
}
function grantEaterOfPainTo(bearer) {
  clearRuleSources();
  registerRuleSource("test", a => a === bearer
    ? [{ id: "test.eater", when: {}, effects: [{ kind: "grantFlag", target: "gift.slaanesh.eaterOfPain" }] }]
    : []);
}

describe("eaterOfPainHoldersNear", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("жертва в радиусе Cor.b носителя — попадает в список", () => {
    const holder = bearerActor(3);
    grantEaterOfPainTo(holder);
    const holderT = token("holder", holder, { x: 0 });
    const victimT = token("victim", { system: {} }, { x: 100 }); // 2м ≤ 3
    scene([holderT, victimT]);
    expect(eaterOfPainHoldersNear(victimT).map(h => h.actor)).toEqual([holder]);
  });

  it("жертва вне радиуса — пустой список", () => {
    const holder = bearerActor(1);
    grantEaterOfPainTo(holder);
    const holderT = token("holder", holder, { x: 0 });
    const victimT = token("victim", { system: {} }, { x: 1000 }); // 20м
    scene([holderT, victimT]);
    expect(eaterOfPainHoldersNear(victimT)).toEqual([]);
  });

  it("несколько носителей рядом — срабатывают все разом", () => {
    const a = bearerActor(3, "A");
    const b = bearerActor(3, "B");
    clearRuleSources();
    registerRuleSource("test", act => (act === a || act === b)
      ? [{ id: "test.eater", when: {}, effects: [{ kind: "grantFlag", target: "gift.slaanesh.eaterOfPain" }] }]
      : []);
    const aT = token("a", a, { x: 0 });
    const bT = token("b", b, { x: 50 });
    const victimT = token("victim", { system: {} }, { x: 100 });
    scene([aT, bT, victimT]);
    expect(eaterOfPainHoldersNear(victimT).map(h => h.actor)).toEqual([a, b]);
  });

  it("сам носитель попадает под собственную ауру (includeSelf)", () => {
    const holder = bearerActor(2);
    grantEaterOfPainTo(holder);
    const holderT = token("holder", holder, { x: 0 });
    scene([holderT]);
    expect(eaterOfPainHoldersNear(holderT).map(h => h.actor)).toEqual([holder]);
  });

  it("на сцене нет носителей — пустой список", () => {
    clearRuleSources();
    const victimT = token("victim", { system: {} });
    scene([victimT]);
    expect(eaterOfPainHoldersNear(victimT)).toEqual([]);
  });

  it("без сцены/без токена — пустой список, не падает", () => {
    clearRuleSources();
    expect(eaterOfPainHoldersNear({ id: "x", actor: { system: {} } })).toEqual([]);
    expect(eaterOfPainHoldersNear(null)).toEqual([]);
  });
});

describe("eaterOfPainBenefitUpdate", () => {
  it("fatigue — снимает Усталость, не уходит в минус", () => {
    expect(eaterOfPainBenefitUpdate({ fatigue: { value: 3 } }, "fatigue", 5))
      .toEqual({ "system.fatigue.value": 0 });
    expect(eaterOfPainBenefitUpdate({ fatigue: { value: 8 } }, "fatigue", 3))
      .toEqual({ "system.fatigue.value": 5 });
  });

  it("wounds — лечит Раны, не выше эффективного максимума", () => {
    expect(eaterOfPainBenefitUpdate({ wounds: { value: 10, max: 20 } }, "wounds", 5))
      .toEqual({ "system.wounds.value": 15 });
    expect(eaterOfPainBenefitUpdate({ wounds: { value: 18, max: 20 } }, "wounds", 5))
      .toEqual({ "system.wounds.value": 20 });
  });

  it("wounds — effectiveMax (Саркофаг Дредноута) побеждает обычный max", () => {
    expect(eaterOfPainBenefitUpdate({ wounds: { value: 10, max: 20, effectiveMax: 15 } }, "wounds", 10))
      .toEqual({ "system.wounds.value": 15 });
  });

  it("char — лечит ТОЛЬКО повреждённые Характеристики, клэмп к 0", () => {
    const system = { characteristics: { ws: {}, s: {}, t: {} }, charDamage: { ws: -3, s: 0 } };
    expect(eaterOfPainBenefitUpdate(system, "char", 5)).toEqual({ "system.charDamage.ws": 0 });
  });

  it("char — несколько повреждённых сразу, каждая лечится независимо", () => {
    const system = { characteristics: { ws: {}, s: {} }, charDamage: { ws: -10, s: -2 } };
    expect(eaterOfPainBenefitUpdate(system, "char", 5)).toEqual({
      "system.charDamage.ws": -5, "system.charDamage.s": 0
    });
  });

  it("нулевой/отрицательный бросок — пустое обновление", () => {
    expect(eaterOfPainBenefitUpdate({ fatigue: { value: 3 } }, "fatigue", 0)).toEqual({});
    expect(eaterOfPainBenefitUpdate({ fatigue: { value: 3 } }, "fatigue", -1)).toEqual({});
  });

  it("неизвестный choice — пустое обновление", () => {
    expect(eaterOfPainBenefitUpdate({}, "nonsense", 5)).toEqual({});
  });
});

describe("eaterOfPainChoiceButtonsHtml", () => {
  it("три кнопки, formula несёт diceCount×кость", () => {
    const html = eaterOfPainChoiceButtonsHtml("Actor.x", 3);
    expect(html).toContain('data-eater-uuid="Actor.x"');
    expect(html).toContain('data-choice="fatigue"');
    expect(html).toContain('data-dice="3d5"');
    expect(html).toContain('data-choice="wounds"');
    expect(html).toContain('data-choice="char"');
    expect(html).toContain('data-dice="3d10"');
  });

  it("diceCount по умолчанию — 1", () => {
    expect(eaterOfPainChoiceButtonsHtml("Actor.x")).toContain('data-dice="1d5"');
  });

  it("diceCount < 1 клэмпится к 1 (защита от плохого margin)", () => {
    expect(eaterOfPainChoiceButtonsHtml("Actor.x", 0)).toContain('data-dice="1d5"');
    expect(eaterOfPainChoiceButtonsHtml("Actor.x", -2)).toContain('data-dice="1d5"');
  });
});
