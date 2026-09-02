// test/rules/blood-shield.test.mjs
//
// wdbc-173l: Талант «Blood Shield / Кровавый Щит» — убийство рукопашной
// демон-оружием даёт W.b демона аблативных Ран, потолок W.b×2.

import { describe, it, expect } from "vitest";
import { isBloodShieldItem, isSubduedDaemonWeapon, bloodShieldGrant, bloodShieldLoseAll, bloodShieldShrinkToFit }
  from "../../module/rules/blood-shield.mjs";

describe("isBloodShieldItem", () => {
  it("узнаёт Талант по книжному двуязычному имени", () => {
    expect(isBloodShieldItem({ type: "talent", name: "Blood Shield / Кровавый Щит" })).toBe(true);
  });
  it("не путает с другим Талантом", () => {
    expect(isBloodShieldItem({ type: "talent", name: "King's Plate / Латы Короля" })).toBe(false);
  });
});

describe("isSubduedDaemonWeapon: RAW-условие «порабощённый демон»", () => {
  it("связан И порабощён — да", () => {
    expect(isSubduedDaemonWeapon({ system: { daemonWeapon: { bound: true, subdued: true } } })).toBe(true);
  });
  it("связан, но не порабощён — нет", () => {
    expect(isSubduedDaemonWeapon({ system: { daemonWeapon: { bound: true, subdued: false } } })).toBe(false);
  });
  it("не связан вовсе — нет", () => {
    expect(isSubduedDaemonWeapon({ system: { daemonWeapon: { bound: false, subdued: false } } })).toBe(false);
  });
  it("нет daemonWeapon — нет, не падает", () => {
    expect(isSubduedDaemonWeapon({ system: {} })).toBe(false);
    expect(isSubduedDaemonWeapon({})).toBe(false);
  });
});

describe("bloodShieldGrant: += W.b демона, потолок W.b×2", () => {
  it("первое убийство с нуля", () => {
    const system = { wounds: { ablative: 0, ablativeMax: 0 } };
    expect(bloodShieldGrant(system, 0, 4)).toEqual({ ablative: 4, ablativeMax: 4, contribution: 4, granted: 4, cap: 8 });
  });

  it("второе убийство складывается", () => {
    const system = { wounds: { ablative: 4, ablativeMax: 4 } };
    expect(bloodShieldGrant(system, 4, 4)).toEqual({ ablative: 8, ablativeMax: 8, contribution: 8, granted: 4, cap: 8 });
  });

  it("третье убийство срезается потолком W.b×2", () => {
    const system = { wounds: { ablative: 8, ablativeMax: 8 } };
    expect(bloodShieldGrant(system, 8, 4)).toBeNull(); // уже на потолке 8
  });

  it("демон с W.b 0 — null", () => {
    const system = { wounds: { ablative: 0, ablativeMax: 0 } };
    expect(bloodShieldGrant(system, 0, 0)).toBeNull();
  });

  it("не трогает посторонний аблатив на том же акторе", () => {
    const system = { wounds: { ablative: 3, ablativeMax: 3 } }; // 3 постороннего, своего вклада 0
    expect(bloodShieldGrant(system, 0, 4)).toMatchObject({ ablative: 7, contribution: 4 });
  });
});

describe("bloodShieldLoseAll: провал теста — теряет ВСЁ разом", () => {
  it("сбрасывает вклад в 0", () => {
    const system = { wounds: { ablative: 8, ablativeMax: 8 } };
    expect(bloodShieldLoseAll(system, 8)).toEqual({ ablative: 0, ablativeMax: 0, contribution: 0 });
  });
  it("не трогает посторонний аблатив", () => {
    const system = { wounds: { ablative: 11, ablativeMax: 11 } }; // 3 постороннего + 8 своего
    expect(bloodShieldLoseAll(system, 8)).toEqual({ ablative: 3, ablativeMax: 3, contribution: 0 });
  });
  it("своего вклада не было — null", () => {
    const system = { wounds: { ablative: 3, ablativeMax: 3 } };
    expect(bloodShieldLoseAll(system, 0)).toBeNull();
  });
});

describe("bloodShieldShrinkToFit: доля не больше, чем реально осталось", () => {
  it("пул уменьшился (урон) — доля щита ужимается вслед", () => {
    const system = { wounds: { ablative: 5, ablativeMax: 8 } }; // было 8, поглотили 3
    expect(bloodShieldShrinkToFit(system, 8)).toEqual({ ablativeMax: 5, contribution: 5 });
  });
});
