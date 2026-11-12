// test/sheets/item-picker-price-hint.test.mjs
//
// task-bd8d: подсказка цены в окне покупки Талантов называла причину цены
// всегда одну и ту же — «совпадений склонностей: N», хотя при Покровительстве
// категория (а значит и цена) считается по Покровителю. Цена и буква были
// верны, вводила в заблуждение только подпись.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { talentPriceReason } from "../../module/rules/advance-category.mjs";
import { charAptitudeSet } from "../../module/constants/advancement.mjs";
import { openItemPicker } from "../../module/sheets/item-picker.mjs";

// «Combat Formation» — Талант Тзинча (talents-library, см. test/constants/patronage.test.mjs).
const TZEENTCH_TALENT = "Combat Formation / Боевое Построение";

const actorOf = ({ mode = "aptitude", patron = "", aptitudes = [] } = {}) => ({
  system: { pricingModeOverride: mode, patronGod: patron, aptitudes, race: "human" },
  items: []
});
const talent = (name, aptitudes = [], extra = {}) =>
  ({ name, id: "t1", system: { tier: 1, aptitudes, ...extra }, folder: null });

describe("talentPriceReason: причина цены Таланта следует режиму цены", () => {
  it("Склонности — считает совпадения Склонностей (как раньше)", () => {
    const a = actorOf({ mode: "aptitude", aptitudes: ["fellowship"] });
    const why = talentPriceReason(a, talent(TZEENTCH_TALENT, ["fellowship", "social"]), charAptitudeSet(a.system.aptitudes));
    expect(why).toBe("совпадений склонностей: 1");
  });

  it("Покровительство — называет Бога Таланта и Покровителя, а не Склонности", () => {
    const a = actorOf({ mode: "patronage", patron: "tzeentch", aptitudes: ["fellowship"] });
    const why = talentPriceReason(a, talent(TZEENTCH_TALENT, ["fellowship", "social"]), charAptitudeSet(a.system.aptitudes));
    expect(why).not.toMatch(/склонност/i);
    expect(why).toContain("Тзинч");
    expect(why).toMatch(/Покровит/);
  });

  it("Покровительство, Покровитель без Бога Таланта — называет Покровителя и Бога Таланта по-разному", () => {
    const a = actorOf({ mode: "patronage", patron: "khorne" });
    const why = talentPriceReason(a, talent(TZEENTCH_TALENT), charAptitudeSet([]));
    expect(why).toContain("Тзинч");
    expect(why).toContain("Кхорн");
  });

  it("Покровительство без Покровителя — так и сказано", () => {
    const a = actorOf({ mode: "patronage", patron: "" });
    const why = talentPriceReason(a, talent(TZEENTCH_TALENT), charAptitudeSet([]));
    expect(why).toMatch(/без Покровителя/);
  });

  it("Смешанная — называет обе половины", () => {
    const a = actorOf({ mode: "mixed", patron: "tzeentch", aptitudes: ["fellowship"] });
    const why = talentPriceReason(a, talent(TZEENTCH_TALENT, ["fellowship", "social"]), charAptitudeSet(a.system.aptitudes));
    expect(why).toMatch(/Смешанн/);
    expect(why).toContain("склонност");
    expect(why).toContain("Покровит");
  });

  it("Талант Элитного Архетипа при Склонностях — нейтрален (стр. 24)", () => {
    const a = actorOf({ mode: "aptitude" });
    const why = talentPriceReason(a, talent("Какой-то Элитный", [], { specialization: "Элитный архетип: Ассасин" }), charAptitudeSet([]));
    expect(why).toContain("Элитных Архетипов");
  });

  it("категория задана извне (раса/культура) — причина не про Склонности и не про Покровителя", () => {
    const a = actorOf({ mode: "patronage", patron: "khorne" });
    const why = talentPriceReason(a, talent(TZEENTCH_TALENT), charAptitudeSet([]), { forced: "ally" });
    expect(why).toMatch(/раса|раса|культур|независимо/i);
    expect(why).not.toMatch(/совпадений склонностей/);
  });
});

describe("Окно покупки Талантов: подсказка цены в строке (сквозь openItemPicker)", () => {
  // pickerPos (sheets/picker-ui.mjs) читает размеры окна браузера.
  beforeEach(() => { resetCaptured(); globalThis.window = { innerWidth: 1600, innerHeight: 900 }; });
  afterEach(() => { game.packs = undefined; delete globalThis.window; });

  async function priceTitle(actor, doc) {
    const pack = { getDocuments: async () => [doc] };
    game.packs = { get: name => (name === "warhammer-dbc.talents" ? pack : { getDocuments: async () => [] }) };
    await openItemPicker(actor, "talent");
    const m = captured.dialog.content.match(/<span class="pick-cost[^"]*" title="([^"]*)">/);
    return m?.[1] ?? null;
  }

  it("Покровительство: в подсказке цены нет «совпадений склонностей»", async () => {
    const a = actorOf({ mode: "patronage", patron: "tzeentch" });
    const title = await priceTitle(a, talent(TZEENTCH_TALENT, ["fellowship"]));
    expect(title).toBeTruthy();
    expect(title).not.toContain("совпадений склонностей");
    expect(title).toContain("Тзинч");
  });

  it("Склонности: подсказка прежняя", async () => {
    const a = actorOf({ mode: "aptitude" });
    const title = await priceTitle(a, talent(TZEENTCH_TALENT, ["fellowship"]));
    expect(title).toContain("совпадений склонностей: 0");
  });
});
