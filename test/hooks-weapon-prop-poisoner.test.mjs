// 3-dc87: Талант «Отравитель» — Избирательное попадание ядом (Toxic): цель
// перебрасывает успешный тест против яда, урон яда бросается дважды (лучший).
// Флаг data-wp-poisoner приходит с кнопки карточки атаки (combat/weapon-properties.mjs).

import "./support/foundry-stub.mjs";
import { captured, resetCaptured } from "./support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { buildTargetEffectButtons } from "../module/combat/weapon-properties.mjs";

const { _applyWeaponPropEffect } = await import("../module/hooks.mjs");

beforeEach(resetCaptured);

function target() {
  return {
    uuid: "Actor.forced1", name: "Цель", isOwner: true, type: "character",
    system: { characteristics: { t: { total: 50 } }, patronGod: "", wounds: { value: 20, max: 20, critical: 0 }, conditions: {} },
    update: async changes => { captured.updates.push(changes); }
  };
}

const base = {
  wpForceActorUuid: "Actor.forced1", wpLabel: "Токсичное", wpKey: "toxic",
  wpCondition: "poisoned", wpTestChar: "t", wpDeg: "0", wpDamage: "1d10"
};

describe("Отравитель: переброс успеха цели и лучший из двух бросков урона", () => {
  it("с флагом: успешный тест (10 ≤ 50) перебрасывается — второй бросок 90 → провал, яд подействовал", async () => {
    globalThis.fromUuid = async () => target();
    captured.dice = [10, 90, 3, 7];
    await _applyWeaponPropEffect({ ...base, wpPoisoner: "1" });
    const note = captured.chat.at(-1).content;
    expect(note).toContain("Отравитель: успех против яда (10)");
    expect(note).toContain("эффект наложен");
    expect(note).toContain("Отравитель: 3 и 7, лучший");
    expect(note).toContain("Доп. урон (минуя броню): <b>7</b>");
  });

  it("без флага: тот же бросок 10 — цель сопротивилась, переброса нет", async () => {
    globalThis.fromUuid = async () => target();
    captured.dice = [10, 90, 3, 7];
    await _applyWeaponPropEffect({ ...base });
    const note = captured.chat.at(-1).content;
    expect(note).not.toContain("Отравитель");
    expect(note).toContain("сопротивилась");
  });

  it("без флага при провале теста урон бросается один раз", async () => {
    globalThis.fromUuid = async () => target();
    captured.dice = [90, 4, 9];
    await _applyWeaponPropEffect({ ...base });
    const note = captured.chat.at(-1).content;
    expect(note).toContain("Доп. урон (минуя броню): <b>4</b>");
    expect(note).not.toContain("лучший");
  });
});

describe("кнопка эффекта несёт data-wp-poisoner только для яда", () => {
  const toxic = { def: { key: "toxic", label: "Токсичное", auto: { targetEffect: { condition: "poisoned", testChar: "t", damage: "1d10", onBreach: true } } }, rating: 0 };
  const stun = { def: { key: "shocking", label: "Шок", auto: { targetEffect: { condition: "stunned", testChar: "t" } } }, rating: 0 };
  it("яд + Избирательное попадание Отравителя → 1; Оглушение → 0; без Таланта → 0", () => {
    expect(buildTargetEffectButtons([toxic], { hit: true, poisoner: true })).toContain('data-wp-poisoner="1"');
    expect(buildTargetEffectButtons([stun], { hit: true, poisoner: true })).toContain('data-wp-poisoner="0"');
    expect(buildTargetEffectButtons([toxic], { hit: true, poisoner: false })).toContain('data-wp-poisoner="0"');
  });
});
