// test/combat/legacy-tormentor-extreme-on-one.test.mjs
//
// Мучитель/merciless 10-10, Оружие Наследия (wdbc-1rno.35, стр. 428):
// «Броски в 1 на кубиках урона оружия вызывают Экстремальный Урон» — тот же
// приём, что Monofilament/wp.extremeLevelBonus (test/combat/
// extreme-level-bonus.test.mjs), но новый синтетический флаг wp.legacyExtremeOnOne.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { rollExtremeDamage } from "../../module/combat/attack.mjs";

const rollWithFace = (result, active = true) => ({ terms: [{ faces: 10, results: [{ active, result }] }] });

beforeEach(resetCaptured);

describe("rollExtremeDamage: wp.legacyExtremeOnOne (Мучитель)", () => {
  it("куб = 1, флаг включён — Экстремальный Урон срабатывает (ниже обычного порога)", async () => {
    captured.dice = [4];
    const { hasExtreme } = await rollExtremeDamage(rollWithFace(1), {
      wp: { extremeThreshold: 10, legacyExtremeOnOne: true }, damageType: "rending"
    });
    expect(hasExtreme).toBe(true);
  });

  it("куб = 1, флаг ВЫКЛЮЧЕН — обычное поведение, Экстремального нет", async () => {
    const { hasExtreme } = await rollExtremeDamage(rollWithFace(1), {
      wp: { extremeThreshold: 10, legacyExtremeOnOne: false }, damageType: "rending"
    });
    expect(hasExtreme).toBe(false);
  });

  it("куб = 5 (не 1, не порог), флаг включён — Экстремального нет", async () => {
    const { hasExtreme } = await rollExtremeDamage(rollWithFace(5), {
      wp: { extremeThreshold: 10, legacyExtremeOnOne: true }, damageType: "rending"
    });
    expect(hasExtreme).toBe(false);
  });

  it("куб = 1, но неактивный (отброшен Рвущим) — не считается", async () => {
    const { hasExtreme } = await rollExtremeDamage(rollWithFace(1, false), {
      wp: { extremeThreshold: 10, legacyExtremeOnOne: true }, damageType: "rending"
    });
    expect(hasExtreme).toBe(false);
  });

  it("обычный порог всё ещё работает как раньше, независимо от флага", async () => {
    captured.dice = [4];
    const { hasExtreme } = await rollExtremeDamage(rollWithFace(10), {
      wp: { extremeThreshold: 10, legacyExtremeOnOne: true }, damageType: "rending"
    });
    expect(hasExtreme).toBe(true);
  });
});
