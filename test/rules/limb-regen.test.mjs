// test/rules/limb-regen.test.mjs
//
// wdbc-yffxj. New Men / Новые Люди: «Йигори способен медленно регенерировать
// потерянные конечности и органы… потерянный глаз — за неделю, руку или ногу —
// за два месяца. Он не регенерирует органы, замененные бионикой». Кисть и стопа
// считаются как рука и нога (решение владельца 01.10.2026).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  LIMB_REGEN_DAYS, limbRegenAt, regenStartFields, dueLimbRegenSides
} from "../../module/rules/limb-loss.mjs";
import { SECONDS_PER_DAY } from "../../module/constants/imperial-calendar.mjs";

const NOW = 1_000_000;
const sys = (lostLimbs = {}) => ({ lostLimbs });

describe("сроки отрастания", () => {
  it("глаз — 7 суток, рука/кисть/нога/стопа — 60", () => {
    expect(LIMB_REGEN_DAYS).toEqual({ lostEyes: 7, lostHands: 60, lostArms: 60, lostFeet: 60, lostLegs: 60 });
    expect(limbRegenAt("lostEyes", NOW)).toBe(NOW + 7 * SECONDS_PER_DAY);
    expect(limbRegenAt("lostArms", NOW)).toBe(NOW + 60 * SECONDS_PER_DAY);
  });
});

describe("regenStartFields: таймер при потере", () => {
  it("новая потеря глаза — таймер на неделю; рука — на два месяца", () => {
    const p = regenStartFields(sys(), { "system.lostLimbs.leftEye.lost": true, "system.lostLimbs.rightArm.lost": true }, NOW);
    expect(p["system.lostLimbs.leftEye.regenAt"]).toBe(NOW + 7 * SECONDS_PER_DAY);
    expect(p["system.lostLimbs.rightArm.regenAt"]).toBe(NOW + 60 * SECONDS_PER_DAY);
  });
  it("часть тела уже была потеряна — таймер не перезапускается", () => {
    const p = regenStartFields(sys({ leftEye: { lost: true, regenAt: 5 } }), { "system.lostLimbs.leftEye.lost": true }, NOW);
    expect(p).toEqual({});
  });
  it("потеря мутацией не регенерирует (вернуть можно только Best.Q бионикой)", () => {
    const p = regenStartFields(sys(), { "system.lostLimbs.leftArm.lost": true, "system.lostLimbs.leftArm.mutation": true }, NOW);
    expect(p).toEqual({});
  });
  it("часть тела вернули (пришита, бионика) — таймер гасится", () => {
    const p = regenStartFields(sys({ leftArm: { lost: true, regenAt: 99 } }), { "system.lostLimbs.leftArm.lost": false }, NOW);
    expect(p).toEqual({ "system.lostLimbs.leftArm.regenAt": 0 });
  });
  it("правка не про потерю — ничего", () => {
    expect(regenStartFields(sys(), { "system.wounds.value": 3 }, NOW)).toEqual({});
  });
});

describe("dueLimbRegenSides: что отросло", () => {
  const lost = { lost: true, regenAt: NOW };
  it("срок вышел — отросла; рано — нет; без таймера — нет", () => {
    expect(dueLimbRegenSides(sys({ leftEye: lost }), NOW)).toEqual([{ key: "lostEyes", side: "left" }]);
    expect(dueLimbRegenSides(sys({ leftEye: lost }), NOW - 1)).toEqual([]);
    expect(dueLimbRegenSides(sys({ leftEye: { lost: true, regenAt: 0 } }), NOW + 10)).toEqual([]);
  });
  it("потеря мутацией и уже целая часть тела не отрастают", () => {
    expect(dueLimbRegenSides(sys({ leftArm: { ...lost, mutation: true } }), NOW + 1)).toEqual([]);
    expect(dueLimbRegenSides(sys({ leftArm: { lost: false, regenAt: NOW } }), NOW + 1)).toEqual([]);
  });
});
