// test/hooks-weapon-prop-poison-test-flag.test.mjs
//
// wdbc-1rno.1 (Пророк Гэллерпокса): единственная точка в системе, где реально
// кидается «тест против яда» — сопротивление свойству оружия Toxic
// (_applyWeaponPropEffect, module/hooks.mjs). Проверяет, что poisonTest
// прокидывается в collectTestMods ТОЛЬКО когда wpCondition==="poisoned", и
// что правило с target:"poison" реально сдвигает Порог именно там (не на
// других condition, использующих тот же код, — Concussive/Flame/…).

import "./support/foundry-stub.mjs";
import { captured, resetCaptured } from "./support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../module/rules/sources.mjs";

const { _applyWeaponPropEffect } = await import("../module/hooks.mjs");

const DEFAULT_SOURCES = getRuleSources();

beforeEach(() => {
  resetCaptured();
});

afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

function forcedActor() {
  return {
    uuid: "Actor.forced1", name: "Цель", isOwner: true, type: "character",
    system: { characteristics: { t: { total: 50 } }, patronGod: "" },
    update: async (changes) => { captured.updates.push(changes); }
  };
}

describe("_applyWeaponPropEffect: poisonTest флаг (wdbc-1rno.1)", () => {
  it("wpCondition=poisoned — правило target:poison сдвигает Порог", async () => {
    clearRuleSources();
    registerRuleSource("test.gallerpox", () => [{
      id: "test.gallerpox", label: "Тест", when: {},
      effects: [{ kind: "rollBonus", target: "poison", value: -30, auto: true, label: "Техновирус Гэллерпокса" }]
    }]);

    const actor = forcedActor();
    globalThis.fromUuid = async () => actor;

    await _applyWeaponPropEffect({
      wpForceActorUuid: actor.uuid, wpLabel: "Токсичное", wpKey: "toxic",
      wpCondition: "poisoned", wpTestChar: "t", wpDeg: "0"
    });

    const note = captured.chat.at(-1)?.content ?? "";
    expect(note).toContain("Техновирус Гэллерпокса");
    expect(note).toContain("-30");
    expect(note).toContain("<label>Порог</label><b>20</b>"); // 50 − 30
  });

  it("wpCondition=stunned (тот же код, другой эффект) — правило target:poison НЕ применяется", async () => {
    clearRuleSources();
    registerRuleSource("test.gallerpox", () => [{
      id: "test.gallerpox", label: "Тест", when: {},
      effects: [{ kind: "rollBonus", target: "poison", value: -30, auto: true, label: "Техновирус Гэллерпокса" }]
    }]);

    const actor = forcedActor();
    globalThis.fromUuid = async () => actor;

    await _applyWeaponPropEffect({
      wpForceActorUuid: actor.uuid, wpLabel: "Шокирующее", wpKey: "shocking",
      wpCondition: "stunned", wpTestChar: "t", wpDeg: "0"
    });

    const note = captured.chat.at(-1)?.content ?? "";
    expect(note).not.toContain("Техновирус Гэллерпокса");
    expect(note).toContain("<label>Порог</label><b>50</b>"); // без −30
  });
});
