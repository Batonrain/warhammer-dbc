// Тех Ассасин: модульный фрейм — Размер, Скорпион, Куколка, Черепная Мантия, Вуаль (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import {
  frameState, frameChange, frameSizeShift, scorpioActive, usableDendrites, chrysalisProgress, chrysalisReset,
  paradoxVeilRules, FRAME_FLAG, VEIL_FLAG
} from "../../module/rules/tech-assassin.mjs";

const actor = (talents = [], frame = null, extra = {}) => ({
  items: talents.map(n => ({ type: n.startsWith("trait:") ? "trait" : "talent", name: n.replace(/^trait:/, "") })),
  flags: { "warhammer-dbc": { ...(frame ? { [FRAME_FLAG]: frame } : {}), ...extra } }
});

describe("Тех Ассасин: фрейм", () => {
  it("отсоединение и присоединение (присоединение конечности — 1 Когниция)", () => {
    const s0 = frameState(actor());
    const d = frameChange(s0, "leftArm", "detach");
    expect(d.ok).toBe(true);
    expect(d.cost).toBe(0);
    expect(frameChange(d.state, "leftArm", "detach").ok).toBe(false);
    const a = frameChange(d.state, "leftArm", "attach");
    expect(a.cost).toBe(1);
    expect(a.state.detached.leftArm).toBe(false);
    const x = frameChange(s0, "torso", "destroy");
    expect(frameChange(x.state, "torso", "attach").ok).toBe(false);
  });

  it("Скорпион: −1 Размер только без обеих ног и с Талантом", () => {
    const legs = { detached: { leftLeg: true, rightLeg: true } };
    expect(frameSizeShift(actor(["Scorpio / Скорпион"], legs))).toBe(-1);
    expect(scorpioActive(actor(["Scorpio / Скорпион"], { detached: { leftLeg: true } }))).toBe(false);
    expect(frameSizeShift(actor([], legs))).toBe(0);
  });

  it("Модульная Автономия: голова без торса −2, Мантия держит два дендрита", () => {
    const head = { detached: { torso: true } };
    const ma = actor(["Modular Autonomy / Модульная Автономия"], head);
    expect(frameSizeShift(ma)).toBe(-2);
    expect(usableDendrites(ma, 4)).toBe(0);
    expect(usableDendrites(actor(["Modular Autonomy", "Cranial Mantle / Черепная Мантия"], head), 4)).toBe(2);
    expect(usableDendrites(actor(["Cranial Mantle"]), 4)).toBe(4);
  });

  it("Куколка: копилка 7 на конечность, 20 на торс, сброс при разрыве контакта", () => {
    let s = frameChange(frameState(actor()), "rightArm", "destroy").state;
    let p = chrysalisProgress(s, "rightArm", 2);
    expect(p.done).toBe(false);
    expect(p.wounds).toBe(2);
    for (let i = 0; i < 3; i++) p = chrysalisProgress(p.state, "rightArm", 2);
    expect(p.done).toBe(true);
    expect(p.state.destroyed.rightArm).toBe(false);
    s = frameChange(frameState(actor()), "torso", "destroy").state;
    p = chrysalisProgress(s, "torso", 2);
    expect(p.need).toBe(20);
    expect(chrysalisReset(p.state).regrow).toBe(null);
  });
});

describe("Вуаль Парадокса", () => {
  const veiled = mode => actor(["trait:Paradox Veil / Вуаль Парадокса"], null, { [VEIL_FLAG]: mode });
  const machine = actor(["trait:Machine / Машина (X)"]);
  it("полная Вуаль: Внимательность Механикум с Чертой Machine проваливается", () => {
    const rules = paradoxVeilRules(machine, { targetActor: veiled("full") });
    expect(rules).toHaveLength(1);
    expect(rules[0].effects[0].kind).toBe("autoFail");
  });
  it("частичная/выключенная Вуаль или живой наблюдатель — ничего", () => {
    expect(paradoxVeilRules(machine, { targetActor: veiled("partial") })).toEqual([]);
    expect(paradoxVeilRules(actor(), { targetActor: veiled("full") })).toEqual([]);
    expect(paradoxVeilRules(machine, {})).toEqual([]);
  });
});
