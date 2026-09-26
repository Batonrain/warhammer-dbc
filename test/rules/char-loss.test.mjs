// test/rules/char-loss.test.mjs
//
// Урон в Характеристики по книге (wdbc-x1nz.2.83): отдельное поле charLoss,
// пол 0, эффекты нулевой Характеристики, восстановление 1/ч и блокировки
// записями charRecovery. Чистые функции — rules/char-loss.mjs; доведение до
// актора — через prepareDerivedData, как у меток (condition-mirror-sync).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import {
  charLossAddFields, charLossHealFields, charHealFields, recoveryPolicy,
  charLossClockStep, isZeroedByLoss
} from "../../module/rules/char-loss.mjs";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";
import { CONDITION_RULES } from "../../module/rules/library/conditions.mjs";

const H = 3600;

function derived({ base = {}, loss = {}, manual = {}, conditions = {} } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  for (const [k, v] of Object.entries(base)) system.characteristics[k].base = v;
  Object.assign(system.charLoss, loss);
  Object.assign(system.charDamage, manual);
  Object.assign(system.conditions, conditions);
  const items = [];
  items.get = () => null;
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items, getFlag: () => undefined
  });
  return system;
}

describe("запись урона", () => {
  it("растёт урон, отсчёт часа начинается с первого урона и не сбрасывается", () => {
    const sys = { characteristics: { t: { total: 40 } }, charLoss: { t: 0 }, charLossAt: {} };
    const a = charLossAddFields(sys, "t", 6, 1000);
    expect(a.patch).toEqual({ "system.charLoss.t": 6, "system.charLossAt.t": 1000 + H });
    expect(a.after).toBe(34);
    const b = charLossAddFields({ ...sys, charLoss: { t: 6 }, charLossAt: { t: 1000 + H } }, "t", 3, 2000);
    expect(b.patch).toEqual({ "system.charLoss.t": 9 });
  });

  it("не ниже 0: лишний урон не пишется", () => {
    const a = charLossAddFields({ characteristics: { t: { total: 5 } }, charLoss: {} }, "t", 9, 0);
    expect(a.applied).toBe(5);
    expect(a.after).toBe(0);
  });

  it("лечение снимает урон, до нуля — гасит отсчёт", () => {
    expect(charLossHealFields({ charLoss: { s: 3 } }, "s", 5).patch).toEqual({ "system.charLoss.s": 0, "system.charLossAt.s": 0 });
  });

  it("Таланты лечения: сначала урон по книге, остаток — старый минус в «Мод.», не в бафф", () => {
    const r = charHealFields({ charLoss: { s: 2 }, charDamage: { s: -3 } }, "s", 4);
    expect(r.patch).toEqual({ "system.charLoss.s": 0, "system.charLossAt.s": 0, "system.charDamage.s": -1 });
    expect(r.healed).toBe(4);
    expect(charHealFields({ charLoss: {}, charDamage: { s: 5 } }, "s", 4).healed).toBe(0);
  });
});

describe("восстановление по часам", () => {
  const sys = (loss, at) => ({ charLoss: loss, charLossAt: at });

  it("1 в час: за 3 ч — 3", () => {
    const { patch, healed } = charLossClockStep(sys({ t: 5 }, { t: H }), recoveryPolicy([]), 3 * H);
    expect(healed.t).toBe(3);
    expect(patch["system.charLoss.t"]).toBe(2);
    expect(patch["system.charLossAt.t"]).toBe(4 * H);
  });

  it("всё восстановлено — отсчёт гаснет", () => {
    const { patch } = charLossClockStep(sys({ t: 1 }, { t: H }), recoveryPolicy([]), 10 * H);
    expect(patch).toEqual({ "system.charLoss.t": 0, "system.charLossAt.t": 0 });
  });

  it("блок: не восстанавливается, отсчёт сдвигается — после снятия ждать полный час", () => {
    const policy = recoveryPolicy([{ kind: "charRecovery", target: "t", mode: "block" }]);
    const { patch, healed } = charLossClockStep(sys({ t: 5 }, { t: H }), policy, 10 * H);
    expect(healed.t).toBeUndefined();
    expect(patch["system.charLossAt.t"]).toBe(11 * H);
  });

  it("период: Гниль Нургла — прочие раз в 7 ч", () => {
    const policy = recoveryPolicy([{ kind: "charRecovery", target: "all", mode: "period", hours: 7 }]);
    expect(policy.s.hours).toBe(7);
    const { healed } = charLossClockStep(sys({ s: 5 }, { s: 7 * H }), policy, 14 * H);
    expect(healed.s).toBe(2);
  });

  it("Гангрена и Лучевая болезнь блокируют T — записями в правилах Состояний", () => {
    const ids = CONDITION_RULES.filter(r => r.effects?.some(e => e.kind === "charRecovery" && e.target === "t" && e.mode === "block")).map(r => r.when?.hasCondition);
    expect(ids).toEqual(expect.arrayContaining(["gangrene", "radiationSickness"]));
  });
});

describe("Итог и эффекты нулевой Характеристики (через актора)", () => {
  it("урон вычитается, в разборке своя строка", () => {
    const s = derived({ base: { t: 40 }, loss: { t: 6 } });
    expect(s.characteristics.t.total).toBe(34);
    expect(s.characteristics.t.bonus).toBe(3);
    expect(s.characteristics.t.totalBreakdown.some(b => /Урон в Характеристику/.test(b.label))).toBe(true);
  });

  it("пол 0: урон больше значения", () => {
    expect(derived({ base: { s: 20 }, loss: { s: 50 } }).characteristics.s.total).toBe(0);
  });

  it("ручной «Мод.» работает как раньше и отдельно от урона", () => {
    expect(derived({ base: { s: 30 }, manual: { s: 5 }, loss: { s: 2 } }).characteristics.s.total).toBe(33);
  });

  it("незаполненный лист (0 без урона) — не «обнулён уроном»", () => {
    const s = derived();
    expect(isZeroedByLoss(s, "ag")).toBe(false);
    expect(s.conditions.helpless).toBeFalsy();
    expect(s.conditions.coma).toBeFalsy();
  });

  it("S = 0 — без сознания и Беспомощен; I = 0 — Кома", () => {
    const s = derived({ base: { s: 20, int: 20 }, loss: { s: 20, int: 20 } });
    expect(s.conditions.unconscious).toBe(true);
    expect(s.conditions.helpless).toBe(true);
    expect(s.conditions.coma).toBe(true);
  });

  it("A = 0 — Парализован, Беспомощен, не двигается", () => {
    const s = derived({ base: { ag: 25 }, loss: { ag: 25 } });
    expect(s.conditions.paralyzed).toBe(true);
    expect(s.conditions.helpless).toBe(true);
    expect(s.movement.halfMove).toBe(0);
  });

  it("P = 0 — Ослеплён и Оглох; F = 0 — Немота", () => {
    const s = derived({ base: { per: 30, fel: 30 }, loss: { per: 30, fel: 30 } });
    expect(s.conditions.blinded).toBe(true);
    expect(s.conditions.deafened).toBe(true);
    expect(s.conditions.mute).toBe(true);
  });
});

describe("единая точка урона (combat/char-damage.mjs)", () => {
  it("T до 0 — смерть; до 1 — жив", async () => {
    const { applyCharDamage } = await import("../../module/combat/char-damage.mjs");
    const mk = total => {
      const flags = {};
      const a = {
        name: "Жертва", system: { characteristics: { t: { total } }, charLoss: { t: 0 }, charLossAt: {} },
        getFlag: (_s, k) => flags[k], setFlag: async (_s, k, v) => { flags[k] = v; },
        update: async d => { for (const [p, v] of Object.entries(d)) { const m = p.match(/^flags\.warhammer-dbc\.(.+)$/); if (m) flags[m[1]] = v; else if (p === "system.charLoss.t") a.system.charLoss.t = v; } }
      };
      a.flags = flags;
      return a;
    };
    const dead = mk(5);
    expect((await applyCharDamage(dead, "t", 7)).died).toBe(true);
    expect(dead.system.charLoss.t).toBe(5);
    const alive = mk(5);
    expect((await applyCharDamage(alive, "t", 4)).died).toBe(false);
  });
});
