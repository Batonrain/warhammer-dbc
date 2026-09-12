// test/rules/fatalism.test.mjs
//
// Fatalism / Фатализм (wdbc-1rno, 12.09.2026): аура Cor.b м — цели в ней
// игнорируют эффекты психосил Прорицания, тест Сопротивления не нужен.
// Первая находка кластера «сопротивление психосилам» — использует уже
// существующий конвейер «Психотест X vs Y+N» (sheets/tabs/psychic.mjs),
// добавляя только сам иммунитет.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { fatalismProtects, fatalismBlocksPower } from "../../module/rules/fatalism.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

const grid = { size: 100, distance: 2 }; // клетка 100px = 2 метра

function bearerActor(corruptionBonus) {
  return { system: { corruptionBonus } };
}
function plainActor() {
  return { system: {} };
}
function token(id, actor, { x = 0, y = 0 } = {}) {
  return { id, x, y, width: 1, height: 1, hidden: false, actor };
}
function scene(tokens) {
  const sc = { grid, tokens: { contents: tokens } };
  for (const t of tokens) t.parent = sc;
  return sc;
}

/** Носитель Фатализма грантует свою capability, остальные акторы — нет. */
function grantFatalismTo(bearer) {
  clearRuleSources();
  registerRuleSource("test", a => a === bearer
    ? [{ id: "test.fatalism", when: {}, effects: [{ kind: "grantFlag", target: "gift.nurgle.fatalism" }] }]
    : []);
}

describe("fatalismProtects", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("цель в радиусе Cor.b носителя — защищена", () => {
    const bearer = bearerActor(3);
    grantFatalismTo(bearer);
    const bearerT = token("bearer", bearer, { x: 0 });
    const targetT = token("target", plainActor(), { x: 100 }); // 1 клетка × 2м = 2м ≤ 3
    scene([bearerT, targetT]);
    expect(fatalismProtects(targetT)).toBe(true);
  });

  it("цель вне радиуса Cor.b — не защищена", () => {
    const bearer = bearerActor(1);
    grantFatalismTo(bearer);
    const bearerT = token("bearer", bearer, { x: 0 });
    const targetT = token("target", plainActor(), { x: 1000 }); // 10 клеток × 2м = 20м
    scene([bearerT, targetT]);
    expect(fatalismProtects(targetT)).toBe(false);
  });

  it("Cor.b 0 — не защищает даже вплотную (нулевой радиус не значит «рядом»)", () => {
    const bearer = bearerActor(0);
    grantFatalismTo(bearer);
    const bearerT = token("bearer", bearer, { x: 0 });
    const targetT = token("target", plainActor(), { x: 0 });
    scene([bearerT, targetT]);
    expect(fatalismProtects(targetT)).toBe(false);
  });

  it("сам носитель тоже под своей аурой", () => {
    const bearer = bearerActor(2);
    grantFatalismTo(bearer);
    const bearerT = token("bearer", bearer, { x: 0 });
    scene([bearerT]);
    expect(fatalismProtects(bearerT)).toBe(true);
  });

  it("на сцене нет носителей Дара — никто не защищён", () => {
    clearRuleSources();
    const targetT = token("target", plainActor());
    scene([targetT]);
    expect(fatalismProtects(targetT)).toBe(false);
  });

  it("токен без сцены/без токена — false, не падает", () => {
    clearRuleSources();
    expect(fatalismProtects({ id: "x", actor: plainActor() })).toBe(false);
    expect(fatalismProtects(null)).toBe(false);
  });
});

describe("fatalismBlocksPower", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  function protectedScene(corBonus = 5) {
    const bearer = bearerActor(corBonus);
    grantFatalismTo(bearer);
    const bearerT = token("bearer", bearer, { x: 0 });
    const targetT = token("target", plainActor(), { x: 0 });
    scene([bearerT, targetT]);
    return targetT;
  }

  it("дисциплина Прорицания, цель в радиусе — гасит эффект силы", () => {
    const targetT = protectedScene();
    expect(fatalismBlocksPower(targetT, "divination")).toBe(true);
  });

  it("другая дисциплина — не гасит, даже в радиусе (книжно только Прорицание распознаётся)", () => {
    const targetT = protectedScene();
    expect(fatalismBlocksPower(targetT, "telepathy")).toBe(false);
    expect(fatalismBlocksPower(targetT, "")).toBe(false);
  });

  it("Прорицание, но цель вне радиуса — не гасит", () => {
    const bearer = bearerActor(1);
    grantFatalismTo(bearer);
    const bearerT = token("bearer", bearer, { x: 0 });
    const targetT = token("target", plainActor(), { x: 1000 });
    scene([bearerT, targetT]);
    expect(fatalismBlocksPower(targetT, "divination")).toBe(false);
  });

  it("регистр дисциплины не важен", () => {
    const targetT = protectedScene();
    expect(fatalismBlocksPower(targetT, "Divination")).toBe(true);
  });
});
