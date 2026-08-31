// test/combat/voice-of-god.test.mjs
//
// module/combat/voice-of-god.mjs (wdbc-sk8s) — «до ½Inf.b раз за бой, Риск
// 4+, успешная Личная Команда → получатель получает временное Очко
// Бесчестия». Проверяется только гейт/выдача, не UI Листа Отряда.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { hasVoiceOfGod, voiceOfGodMax, voiceOfGodAvailable, applyVoiceOfGod } from "../../module/combat/voice-of-god.mjs";
import { tempInfamyAmount, tempInfamyInfo } from "../../module/rules/temp-infamy.mjs";

function commander({ hasTalent = true, infBonus = 4 } = {}) {
  const flags = {};
  return {
    items: hasTalent ? [{ type: "talent", name: "Voice of God / Глас Божий" }] : [],
    system: { characteristics: { inf: { bonus: infBonus } } },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; }
  };
}

function recipient() {
  const flags = {};
  return {
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; }
  };
}

afterEach(() => { globalThis.game.combat = undefined; });

describe("hasVoiceOfGod / voiceOfGodMax", () => {
  it("определяет владение Талантом", () => {
    expect(hasVoiceOfGod(commander({ hasTalent: true }))).toBe(true);
    expect(hasVoiceOfGod(commander({ hasTalent: false }))).toBe(false);
  });
  it("½Inf.b округляется вверх", () => {
    expect(voiceOfGodMax(commander({ infBonus: 4 }))).toBe(2);
    expect(voiceOfGodMax(commander({ infBonus: 5 }))).toBe(3);
    expect(voiceOfGodMax(commander({ infBonus: 0 }))).toBe(0);
  });
});

describe("voiceOfGodAvailable", () => {
  it("без Таланта — недоступно", () => {
    expect(voiceOfGodAvailable(commander({ hasTalent: false }), 5)).toBe(false);
  });
  it("Риск < 4 — недоступно", () => {
    expect(voiceOfGodAvailable(commander(), 3)).toBe(false);
  });
  it("Inf.b = 0 (max 0) — недоступно даже при Риске 4+", () => {
    expect(voiceOfGodAvailable(commander({ infBonus: 0 }), 5)).toBe(false);
  });
  it("Талант + Риск 4+ + лимит не исчерпан — доступно", () => {
    globalThis.game.combat = { id: "combat-1" };
    expect(voiceOfGodAvailable(commander({ infBonus: 4 }), 4)).toBe(true);
  });
});

describe("applyVoiceOfGod", () => {
  it("списывает использование Командира и выдаёт 1 временное Очко Бесчестия получателю", async () => {
    globalThis.game.combat = { id: "combat-1" };
    const cmd = commander({ infBonus: 4 }); // max 2
    const rec = recipient();
    await applyVoiceOfGod(cmd, rec);
    expect(tempInfamyAmount(rec)).toBe(1);
    expect(tempInfamyInfo(rec).source).toBe("Voice of God / Глас Божий");
    expect(voiceOfGodAvailable(cmd, 4)).toBe(true); // 1 из 2 использовано

    await applyVoiceOfGod(cmd, recipient());
    expect(voiceOfGodAvailable(cmd, 4)).toBe(false); // 2 из 2 использовано
  });

  it("без получателя — ничего не делает", async () => {
    const cmd = commander();
    await expect(applyVoiceOfGod(cmd, null)).resolves.toBeUndefined();
  });
});
