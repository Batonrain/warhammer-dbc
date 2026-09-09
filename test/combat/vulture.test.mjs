// test/combat/vulture.test.mjs
//
// Стервятник / Vulture (Дар Нургла, wdbc-1rno): три умирающих/трупа в 7 м —
// временное Очко Бесчестия в начале своего Хода, сгорает к следующему.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  isVultureFodder, vultureFodderCount, vultureQualifies,
  processVultureTurnStart, VULTURE, VULTURE_SOURCE
} from "../../module/combat/vulture.mjs";
import { tempInfamyInfo } from "../../module/rules/temp-infamy.mjs";

const fodder = crit => ({ actor: { system: { wounds: { critical: crit } } } });

/** Актор-носитель Дара + сцена вокруг него; расстояния меряет реальный tokensWithinRadius. */
function scene({ hasGift = true, around = [], tempInfamy = null } = {}) {
  const flags = { "warhammer-dbc": {} };
  if (tempInfamy) flags["warhammer-dbc"].tempInfamy = tempInfamy;
  const items = hasGift ? [{
    id: "gift", type: "mutation", name: "Vulture",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: VULTURE, label: "" }
    ] }] } }
  }] : [];
  const actor = {
    type: "character", system: { wounds: { critical: 0 } },
    items: Object.assign(items.slice(), { contents: items }),
    flags,
    getFlag: (sc, k) => flags[sc]?.[k],
    setFlag: async (sc, k, v) => { (flags[sc] ??= {})[k] = v; },
    unsetFlag: async (sc, k) => { delete flags[sc]?.[k]; }
  };
  // Токены сцены: сам носитель в (0,0) и «тела» рядом — все в одной клетке,
  // чтобы проверялся именно порог по количеству, а не геометрия (её считает
  // tokenDocDistance и у неё свои тесты).
  const tokens = [];
  const self = { id: "self", hidden: false, actor, x: 0, y: 0, width: 1, height: 1 };
  tokens.push(self);
  around.forEach((t, i) => tokens.push({ id: `t${i}`, hidden: false, actor: t.actor, x: 0, y: 0, width: 1, height: 1 }));
  const grid = { size: 100, distance: 1, type: 0 };
  self.parent = { tokens: Object.assign(tokens.slice(), { contents: tokens }), grid };
  for (const t of tokens) t.parent = self.parent;
  return { actor, token: self };
}

describe("isVultureFodder / vultureQualifies", () => {
  it("Раны −5 — подходит, −4 — нет", () => {
    expect(isVultureFodder(fodder(5).actor)).toBe(true);
    expect(isVultureFodder(fodder(4).actor)).toBe(false);
  });
  it("здоровый актор без поля critical не подходит", () => {
    expect(isVultureFodder({ system: {} })).toBe(false);
  });
  it("порог книги — ровно три тела", () => {
    expect(vultureFodderCount([fodder(9), fodder(1), fodder(6)])).toBe(2);
    expect(vultureQualifies([fodder(9), fodder(6)])).toBe(false);
    expect(vultureQualifies([fodder(9), fodder(6), fodder(5)])).toBe(true);
  });
});

describe("processVultureTurnStart", () => {
  it("три тела рядом — начисляет одно временное Очко со своим источником", async () => {
    const { actor, token } = scene({ around: [fodder(5), fodder(7), fodder(20)] });
    await processVultureTurnStart(actor, token);
    expect(tempInfamyInfo(actor)).toMatchObject({ amount: 1, source: VULTURE_SOURCE });
  });

  it("тел меньше трёх — ничего не начисляет", async () => {
    const { actor, token } = scene({ around: [fodder(5), fodder(7)] });
    await processVultureTurnStart(actor, token);
    expect(tempInfamyInfo(actor)).toBe(null);
  });

  it("нет Дара — не начисляет даже при полном поле трупов", async () => {
    const { actor, token } = scene({ hasGift: false, around: [fodder(5), fodder(7), fodder(9)] });
    await processVultureTurnStart(actor, token);
    expect(tempInfamyInfo(actor)).toBe(null);
  });

  it("непотраченное Очко прошлого Хода сгорает и заменяется новым", async () => {
    const { actor, token } = scene({
      around: [fodder(5), fodder(7), fodder(9)],
      tempInfamy: { amount: 1, source: VULTURE_SOURCE, restriction: "" }
    });
    await processVultureTurnStart(actor, token);
    expect(tempInfamyInfo(actor)).toMatchObject({ amount: 1, source: VULTURE_SOURCE });
  });

  it("тел не осталось — старое Очко Стервятника просто сгорает", async () => {
    const { actor, token } = scene({
      around: [], tempInfamy: { amount: 1, source: VULTURE_SOURCE, restriction: "" }
    });
    await processVultureTurnStart(actor, token);
    expect(tempInfamyInfo(actor)).toBe(null);
  });

  it("чужое временное Бесчестие (Глас Божий) не стирается и не перетирается", async () => {
    const { actor, token } = scene({
      around: [fodder(5), fodder(7), fodder(9)],
      tempInfamy: { amount: 1, source: "Глас Божий", restriction: "только на эту Команду" }
    });
    await processVultureTurnStart(actor, token);
    expect(tempInfamyInfo(actor)).toMatchObject({ amount: 1, source: "Глас Божий" });
  });
});
