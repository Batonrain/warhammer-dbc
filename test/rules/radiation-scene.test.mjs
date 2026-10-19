// test/rules/radiation-scene.test.mjs
//
// wdbc-c5vf0. Радиация сцены (корбук, стр. 484): интенсивность 1-10 задаёт
// частоту тика 1 урона в T, защита снижает эффективную интенсивность
// (складывается), иммунитет отменяет, на дозе 10/20/30… — тест T+0.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  RAD_INTERVAL_SECONDS, RAD_MAX_TICKS, armourRadProtection, radProtectionOf, effectiveRadiation,
  radIntervalSeconds, radiationTicks, doseCrossings
} from "../../module/rules/radiation-scene.mjs";
import { RAD_TABLE, RAD_PROTECTION } from "../../module/constants/environment.mjs";
import { registerRuleSource, clearRuleSources } from "../../module/rules/sources.mjs";

const armour = (name, { type = "carapace", props = [], equipped = true } = {}) =>
  ({ type: "armor", name, system: { armorType: type, properties: props, equipped } });
const trait = name => ({ type: "trait", name, system: {} });
const actorOf = (...items) => ({ items });

describe("частота тика по интенсивности", () => {
  it("совпадает с таблицей книги: 8 ч, 4 ч, 2 ч, час, 30 мин, 15, 5, минута, Ход, 5 в Ход", () => {
    expect(RAD_TABLE.map(r => r.freq)).toHaveLength(10);
    expect(RAD_INTERVAL_SECONDS[1]).toBe(8 * 3600);
    expect(RAD_INTERVAL_SECONDS[4]).toBe(3600);
    expect(RAD_INTERVAL_SECONDS[8]).toBe(60);
    expect(RAD_INTERVAL_SECONDS[10]).toBe(RAD_INTERVAL_SECONDS[9] / 5);
    expect(radIntervalSeconds(0)).toBeNull();
  });
});

describe("защита от радиации", () => {
  it("броня: терминаторская — иммунитет, силовая −3, пустотная −2, закрытая −1; лучшая из надетых", () => {
    expect(armourRadProtection(actorOf(armour("Terminator Armour / Терминаторская Броня", { type: "power" }))).immune).toBe(true);
    expect(armourRadProtection(actorOf(armour("Power", { type: "power" }))).value).toBe(3);
    expect(armourRadProtection(actorOf(armour("Void", { props: ["void"] }))).value).toBe(2);
    expect(armourRadProtection(actorOf(armour("Sealed", { props: ["sealed"] }))).value).toBe(1);
    expect(armourRadProtection(actorOf(armour("Sealed", { props: ["sealed"] }), armour("Void", { props: ["void"] }))).value).toBe(2);
    expect(armourRadProtection(actorOf(armour("Power", { type: "power", equipped: false }))).value).toBe(0);
  });

  it("таблица справки в окне согласована: силовая броня −3 (книга), Скват −3", () => {
    expect(RAD_PROTECTION).toContainEqual(expect.objectContaining({ label: "Силовая броня", val: "−3" }));
  });

  it("складывается: броня + Машина + укрытие; Существо из Кошмаров и радиационный бункер — иммунитет", () => {
    const a = actorOf(armour("Void", { props: ["void"] }), trait("Machine (2) / Машина (2)"));
    const p = radProtectionOf(a, "rockcrete");
    expect(p).toMatchObject({ immune: false, total: 2 + 1 + 2 });
    expect(radProtectionOf(actorOf(trait("Stuff of Nightmares / Существо из Кошмаров")), "").immune).toBe(true);
    expect(radProtectionOf(actorOf(), "radbunker").immune).toBe(true);
    expect(radProtectionOf(actorOf(), "").total).toBe(0);
  });

  describe("Крепкий как Камень −3", () => {
    beforeEach(() => {
      clearRuleSources();
      registerRuleSource("test", () => [{ id: "t", when: {}, effects: [{ kind: "grantFlag", target: "trait.hardAsStone" }] }]);
    });
    afterEach(() => clearRuleSources());
    it("Скват в закрытой броне под открытым небом: 3 + 1", () => {
      expect(radProtectionOf(actorOf(armour("Sealed", { props: ["sealed"] }))).total).toBe(4);
    });
  });

  it("эффективная интенсивность: сцена − защита, не ниже 0; иммунитет — 0", () => {
    expect(effectiveRadiation(7, { total: 3 })).toBe(4);
    expect(effectiveRadiation(2, { total: 5 })).toBe(0);
    expect(effectiveRadiation(10, { immune: true, total: 0 })).toBe(0);
    expect(effectiveRadiation(12, { total: 0 })).toBe(10);
  });
});

describe("radiationTicks", () => {
  const H = 3600;
  it("первый отрезок заводит отсчёт, тики — когда интервал накопился", () => {
    let r = radiationTicks(null, { from: 0, to: 30 * 60, interval: H });
    expect(r.ticks).toBe(0);
    r = radiationTicks(r.clock, { from: 30 * 60, to: 90 * 60, interval: H });
    expect(r.ticks).toBe(1);
    expect(r.clock).toEqual({ at: H, seen: 90 * 60 });
  });
  it("прыжок на сутки при интервале час — 24 тика", () => {
    expect(radiationTicks(null, { from: 0, to: 24 * H, interval: H }).ticks).toBe(24);
  });
  it("отсчёт протух (актор не облучался между отрезками) — начинается заново", () => {
    const r = radiationTicks({ at: 0, seen: 100 }, { from: 10_000, to: 10_000 + H, interval: H });
    expect(r.ticks).toBe(1);
    expect(r.clock.at).toBe(10_000 + H);
  });
  it("страховочный потолок тиков", () => {
    const r = radiationTicks(null, { from: 0, to: 1_000_000, interval: 60 });
    expect(r.ticks).toBe(RAD_MAX_TICKS);
    expect(r.clock.at).toBe(1_000_000);
  });
});

describe("doseCrossings: тесты T+0 на 10/20/30", () => {
  it("считает пройденные десятки", () => {
    expect(doseCrossings(9, 1)).toBe(1);
    expect(doseCrossings(0, 9)).toBe(0);
    expect(doseCrossings(5, 30)).toBe(3);
    expect(doseCrossings(10, 5)).toBe(0);
  });
});
