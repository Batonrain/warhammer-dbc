// test/sheets/attack-mods-conditions.test.mjs
//
// Строки окна атаки от Состояний («Раны и Урон», «Статусы»):
//  - wdbc-x1nz.2.89: «Ослеплён» при распознанном Ослеплении отмечен и заперт;
//  - wdbc-x1nz.2.88 п.2: «Беспомощная цель: в упор / в рукопашной» —
//    авто-отметка по замеренной дистанции в упор и по стрельбе в рукопашной;
//  - wdbc-x1nz.2.97 п.6: ручные «Цель лежит»/«Цель Оглушена» при
//    распознанном Состоянии цели отмечены, заперты и стоят 0 — бонус +20
//    окно уже дало автоматически (proneMod/stunnedMod), второго нет.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { situationalMods } from "../../module/sheets/attack/mods.mjs";

function baseArgs(overrides = {}) {
  return {
    actor: { items: [], system: {} },
    attackCtx: {},
    attackerToken: null,
    gripRange: null,
    hasFatigue: false,
    hasLostEyes: false,
    isBlinded: false,
    isMelee: true,
    measured: null,
    targetHelpless: false,
    targetToken: null,
    weapon: null,
    wProps: [],
    wp: {},
    ...overrides
  };
}

beforeEach(() => {
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] }, ready: true };
});

const byLabel = (list, label) => list.find(m => m.label === label);

describe("Ослеплён — строка окна атаки заперта (wdbc-x1nz.2.89)", () => {
  it("Ослеплён, стрельба — автопровал отмечен и заперт", () => {
    const { commonMods } = situationalMods(baseArgs({ isBlinded: true, isMelee: false }));
    const row = byLabel(commonMods, "Ослеплён");
    expect(row).toMatchObject({ autofail: true, autoCheck: true, locked: true });
  });

  it("Ослеплён, рукопашная — −30 отмечено и заперто", () => {
    const row = byLabel(situationalMods(baseArgs({ isBlinded: true })).commonMods, "Ослеплён");
    expect(row).toMatchObject({ value: -30, autoCheck: true, locked: true });
  });

  it("не Ослеплён — галочка ручная, не заперта", () => {
    const row = byLabel(situationalMods(baseArgs()).commonMods, "Ослеплён");
    expect(row.locked).toBeFalsy();
    expect(row.autoCheck).toBeFalsy();
  });
});

describe("Беспомощная цель: в упор/в рукопашной — сама по дистанции (wdbc-x1nz.2.88 п.2)", () => {
  const helplessRow = args => situationalMods(baseArgs({ isMelee: false, targetHelpless: true, ...args }))
    .specificMods.find(m => m.id === "atk-helpless-close");

  it("замеренная дистанция в упор — авто-успех отмечен", () => {
    const row = helplessRow({ measured: { edgeM: 2, contact: "none" }, gripRange: 100 });
    expect(row).toMatchObject({ autosuccess: true, autoCheck: true });
  });

  it("стрельба в рукопашной (контакт Баз) — авто-успех отмечен", () => {
    const row = helplessRow({ measured: { edgeM: 1, contact: "base" }, gripRange: 100 });
    expect(row.autoCheck).toBe(true);
  });

  it("дальняя дистанция — не отмечен (остаётся +30)", () => {
    const row = helplessRow({ measured: { edgeM: 80, contact: "none" }, gripRange: 100 });
    expect(row.autoCheck).toBe(false);
  });

  it("без замера — ручная галочка, как раньше", () => {
    expect(helplessRow({}).autoCheck).toBe(false);
  });
});

describe("«Цель лежит»/«Цель Оглушена» не складываются с авто-бонусом (wdbc-x1nz.2.97 п.6)", () => {
  const target = conditions => ({ system: { conditions } });

  it("цель Повалена — ручная галочка отмечена, заперта и стоит 0", () => {
    const { commonMods } = situationalMods(baseArgs({ attackCtx: { targetActor: target({ prone: true }) } }));
    expect(byLabel(commonMods, "Цель лежит")).toMatchObject({ value: 0, autoCheck: true, locked: true });
  });

  it("цель Оглушена (или в Ступоре) — то же для «Цель Оглушена»", () => {
    for (const conds of [{ stunned: true }, { dazed: true }]) {
      const { commonMods } = situationalMods(baseArgs({ attackCtx: { targetActor: target(conds) } }));
      expect(byLabel(commonMods, "Цель Оглушена")).toMatchObject({ value: 0, autoCheck: true, locked: true });
    }
  });

  it("без распознанного Состояния — обычные ручные +20", () => {
    const { commonMods } = situationalMods(baseArgs({ attackCtx: { targetActor: target({}) } }));
    expect(byLabel(commonMods, "Цель лежит")).toMatchObject({ value: 20 });
    expect(byLabel(commonMods, "Цель лежит").locked).toBeFalsy();
    expect(byLabel(commonMods, "Цель Оглушена")).toMatchObject({ value: 20 });
  });
});
