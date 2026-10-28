// 3-dc87: общий диалог Пытки (apps/torture.mjs) и Талант «Мучитель» (rules/torture.mjs).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { testSuccesses, torturerVictimPenalty, torturerThreshold } from "../../module/rules/torture.mjs";
import { resolveTorture, torturerHolders, isTortureImmune } from "../../module/apps/torture.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

const DEFAULT_SOURCES = getRuleSources();

function actor(id, { int = 40, wp = 40, medicae = 40, interrogate = "knows" } = {}) {
  const flags = {};
  return {
    id, name: id, uuid: `Actor.${id}`, type: "character", items: [],
    system: {
      conditions: {},
      characteristics: { int: { total: int, bonus: Math.floor(int / 10) }, wp: { total: wp, bonus: Math.floor(wp / 10) } },
      skills: { interrogate: { rank: interrogate }, medicae: { total: medicae } }
    },
    getFlag: (ns, k) => flags[`${ns}.${k}`], setFlag: async (ns, k, v) => { flags[`${ns}.${k}`] = v; },
    update: async () => {}
  };
}

describe("rules/torture", () => {
  it("Успехи d100: провал → 0, иначе десятки запаса + 1", () => {
    expect(testSuccesses(60, 50)).toBe(0);
    expect(testSuccesses(50, 50)).toBe(1);
    expect(testSuccesses(21, 50)).toBe(3);
  });
  it("Мучитель: −3 за Успех", () => {
    expect(torturerVictimPenalty(0)).toBe(0);
    expect(torturerVictimPenalty(3)).toBe(-9);
  });
  it("Предел Medicae−10", () => {
    expect(torturerThreshold({ system: { skills: { medicae: { total: 45 } } } })).toBe(35);
    expect(torturerThreshold({ system: { characteristics: { int: { total: 40 } } } })).toBe(10);
  });
});

describe("resolveTorture", () => {
  beforeEach(() => { resetCaptured(); game.combat = undefined; });
  afterEach(() => { captured.dice = null; clearRuleSources(); for (const [k, f] of DEFAULT_SOURCES) registerRuleSource(k, f); });
  const grantTorturer = () => { clearRuleSources(); registerRuleSource("test", () => [{ id: "t.tor", when: {}, effects: [{ kind: "grantFlag", target: "medic.core.torturer" }] }]); };

  it("общий режим: пытающий Допрос(Int)−20 vs Воля; победа — карточка без выгод друкхари", async () => {
    const t = actor("t"), v = actor("v");
    captured.dice = [10, 90]; // пытающий 10 ≤ 20 (Int 40, нетренированный? knows → +0 −20 = 20), жертва 90 > 40
    const res = await resolveTorture(t, v, {});
    expect(res.winner).toBe("mine");
    expect(captured.chat.at(-1).content).toContain("Жертва сломлена");
    expect(captured.chat.at(-1).content).not.toContain("друкхари");
  });

  it("модификаторы сторон входят в Пределы", async () => {
    const t = actor("t"), v = actor("v");
    captured.dice = [50, 50];
    await resolveTorture(t, v, { torturerMod: 30, targetMod: -20 });
    const html = captured.chat.at(-1).content;
    expect(html).toContain("vs 50"); // 40−20+... : Допрос(Int)−20 (knows: 40+0−20=20... +30)
    expect(html).toContain("vs 20"); // Воля 40 −20
  });

  it("Ортопрокси: область interrogation даёт жертве +20 к встречному тесту Воли (и только ей)", async () => {
    clearRuleSources();
    registerRuleSource("test", () => [{ id: "t.ortho", when: {},
      effects: [{ kind: "rollBonus", target: "interrogation", value: 20, auto: true }] }]);
    const t = actor("t"), v = actor("v");
    captured.dice = [90, 90];
    await resolveTorture(t, v, {});
    const html = captured.chat.at(-1).content;
    expect(html).toContain("vs 60"); // Воля 40 + 20 у жертвы
    expect(html).toContain("vs 20"); // пытающий: Допрос(Int)−20, без бонуса
  });

  it("Мучитель: Успехи теста Medicae−10 снижают Порог жертвы на 3 за Успех", async () => {
    grantTorturer();
    const t = actor("t", { medicae: 50 }), v = actor("v", { wp: 60 });
    captured.dice = [11, 90, 90]; // Мучитель: Предел 40, бросок 11 → 3 Успеха; пытающий и жертва — провалы
    await resolveTorture(t, v, { holder: t });
    const html = captured.chat.at(-1).content;
    expect(html).toContain("3 Успех(ов)");
    expect(html).toContain("жертве -9 на встречный тест");
    expect(html).toContain("vs 51"); // Воля 60 − 9
  });

  it("Мучитель + неудача пытки: подсказка «без урона, остаётся пригодной»", async () => {
    grantTorturer();
    const t = actor("t"), v = actor("v");
    captured.dice = [90, 95, 5]; // Мучитель провалился; пытающий 95 — провал; жертва 5 — успех
    await resolveTorture(t, v, { holder: t });
    expect(captured.chat.at(-1).content).toContain("не получает урона и остаётся пригодной");
  });

  it("бросок пытающего — тест I: флаг Предусмотрительности гаснет (review 24.10.2026)", async () => {
    const t = actor("t"), v = actor("v");
    await t.setFlag("warhammer-dbc", "foresightReady", true);
    t.unsetFlag = async (ns, k) => { await t.setFlag(ns, k, undefined); };
    captured.dice = [90, 5];
    await resolveTorture(t, v, {});
    expect(t.getFlag("warhammer-dbc", "foresightReady")).toBeFalsy();
  });

  it("без Таланта holder игнорируется (мутация: проверка Таланта обязательна)", async () => {
    const t = actor("t"), v = actor("v");
    captured.dice = [90, 5];
    await resolveTorture(t, v, { holder: t });
    expect(captured.chat.at(-1).content).not.toContain("Мучитель");
  });
});

describe("кандидаты в Мучители и иммунитет", () => {
  afterEach(() => { clearRuleSources(); for (const [k, f] of DEFAULT_SOURCES) registerRuleSource(k, f); });
  it("сам пытающий и ассистенты на сцене, но не жертва", () => {
    clearRuleSources(); registerRuleSource("test", () => [{ id: "t.tor", when: {}, effects: [{ kind: "grantFlag", target: "medic.core.torturer" }] }]);
    const t = actor("t"), a = actor("a"), v = actor("v");
    game.combat = { combatants: [{ actor: t }, { actor: a }, { actor: v }] };
    expect(torturerHolders(t, v).map(h => h.id)).toEqual(["t", "a"]);
    game.combat = undefined;
  });
  it("иммунитет к пыткам: Не Чувствует Боли / Метка Слаанеш", () => {
    clearRuleSources();
    expect(isTortureImmune(actor("v"))).toBe(false);
    registerRuleSource("test", () => [{ id: "t.imm", when: {}, effects: [{ kind: "grantFlag", target: "defence.tortureImmune" }] }]);
    expect(isTortureImmune(actor("v"))).toBe(true);
  });
});
