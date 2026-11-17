// test/combat/rage-reentry-gate.test.mjs
//
// wdbc-sh3qt. Книга: «Однажды выйдя из Ярости, персонаж не может снова войти в нее до конца боя, кроме
// как с помощью наркотиков или психосил». Запрет общий — для любой Ярости, не только у владельцев
// Frenzy (module/combat/frenzy.mjs::blockRageReentry, хук preUpdateActor в warhammer-dbc.mjs). Здесь:
// сам гейт и реальные источники Ярости (Вспыльчивость, Кхорнгор, Миролюбец, Гвозди Мясника),
// пропущенные через ту же обёртку update, что делает Foundry. Первобытный Вой — в beastman-shaman.test.mjs,
// галлюциногены — в hallucinogenic.test.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  blockRageReentry, frenzyEntryBlocked, markFrenzyExited, tryEnterRage, RAGE_SOURCE_OPTION
} from "../../module/combat/frenzy.mjs";
import { rollQuickToAngerTest } from "../../module/rules/quick-to-anger.mjs";
import { khorngorRageTest } from "../../module/combat/beastman-subrace.mjs";
import { rollPacifismTest } from "../../module/combat/pacifism.mjs";
import { rollNailsTest } from "../../module/combat/khorne-berserker.mjs";
import { registerRuleSource, clearRuleSources } from "../../module/rules/sources.mjs";
import { withRageGate } from "../support/rage-gate.mjs";

const NAILS = { type: "trait", name: "Butcher's Nails / Гвозди Мясника" };
const FRENZY = { type: "talent", name: "Frenzy / Ярость" };

function actor({ items = [], inRage = false } = {}) {
  const flags = {};
  const a = {
    name: "Зверь", id: "a1", items,
    system: { inRage, characteristics: { wp: { total: 40, bonus: 4 } } },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    update: async data => {
      if (data["system.inRage"] !== undefined) a.system.inRage = data["system.inRage"];
    }
  };
  return withRageGate(a);
}

const exited = async a => { await markFrenzyExited(a); a.system.inRage = false; };
const grant = key => registerRuleSource("test", () => [{ id: "t", when: {}, effects: [{ kind: "grantFlag", target: key }] }]);

beforeEach(() => {
  resetCaptured();
  clearRuleSources();
  globalThis.game.combat = { id: "combat-1", round: 1 };
});
afterEach(() => { globalThis.game.combat = undefined; clearRuleSources(); });

describe("общий лимит: выход из Ярости закрывает вход любому", () => {
  it("актор без Таланта Frenzy после выхода тоже блокирован", async () => {
    const a = actor();
    expect(frenzyEntryBlocked(a)).toBe(false);
    await markFrenzyExited(a);
    expect(frenzyEntryBlocked(a)).toBe(true);
  });

  it("новый бой — метка снята", async () => {
    const a = actor();
    await markFrenzyExited(a);
    globalThis.game.combat = { id: "combat-2", round: 1 };
    expect(frenzyEntryBlocked(a)).toBe(false);
  });

  it("вне боя метки нет — вход свободен", async () => {
    globalThis.game.combat = undefined;
    const a = actor();
    await markFrenzyExited(a);
    expect(frenzyEntryBlocked(a)).toBe(false);
  });

  it("Гвозди Мясника снимают лимит и метку", async () => {
    const a = actor({ items: [NAILS] });
    await markFrenzyExited(a);
    expect(frenzyEntryBlocked(a)).toBe(false);
  });

  it("вторая отметка выхода в том же бою флаг не переписывает", async () => {
    const a = actor();
    let writes = 0;
    const setFlag = a.setFlag;
    a.setFlag = async (...args) => { writes++; return setFlag(...args); };
    await markFrenzyExited(a);
    await markFrenzyExited(a);
    expect(writes).toBe(1);
  });

  it("tryEnterRage у актора без Frenzy после выхода отказывает с понятной причиной", async () => {
    const a = actor();
    await markFrenzyExited(a);
    const r = await tryEnterRage(a);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("повторный вход запрещён");
  });
});

describe("blockRageReentry — гейт на правку system.inRage", () => {
  it("до выхода — пропускает", () => {
    const a = actor();
    const changes = { system: { inRage: true } };
    expect(blockRageReentry(a, changes, {})).toBe(false);
    expect(changes.system.inRage).toBe(true);
  });

  it("после выхода — вычищает inRage из правки, предупреждает и пишет в чат", async () => {
    const a = actor();
    await markFrenzyExited(a);
    const changes = { system: { inRage: true } };
    expect(blockRageReentry(a, changes, {})).toBe(true);
    expect(changes.system.inRage).toBeUndefined();
    expect(captured.warnings.at(-1)).toContain("повторный вход");
    expect(JSON.stringify(captured.chat.at(-1))).toContain("повторный вход");
  });

  it("выключение Ярости и повторное включение уже включённой — не гейтятся", async () => {
    const a = actor({ inRage: true });
    await markFrenzyExited(a);
    expect(blockRageReentry(a, { system: { inRage: false } }, {})).toBe(false);
    expect(blockRageReentry(a, { system: { inRage: true } }, {})).toBe(false);
    expect(blockRageReentry(a, { system: { wounds: 1 } }, {})).toBe(false);
  });

  it("наркотик и психосила обходят лимит, неизвестный источник — нет", async () => {
    const a = actor();
    await markFrenzyExited(a);
    expect(blockRageReentry(a, { system: { inRage: true } }, { [RAGE_SOURCE_OPTION]: "drug" })).toBe(false);
    expect(blockRageReentry(a, { system: { inRage: true } }, { [RAGE_SOURCE_OPTION]: "psychic" })).toBe(false);
    expect(blockRageReentry(a, { system: { inRage: true } }, { [RAGE_SOURCE_OPTION]: "other" })).toBe(true);
  });

  it("с Гвоздями Мясника не блокирует", async () => {
    const a = actor({ items: [NAILS] });
    await markFrenzyExited(a);
    expect(blockRageReentry(a, { system: { inRage: true } }, {})).toBe(false);
  });
});

describe("источники Ярости у актора, уже выходившего из неё в этом бою", () => {
  it("Вспыльчивость (Скорый на Гнев): провал теста не вводит в Ярость", async () => {
    const a = actor();
    await exited(a);
    captured.nextRoll = 99;
    await rollQuickToAngerTest(a);
    expect(a.system.inRage).toBe(false);
    expect(captured.warnings.at(-1)).toContain("повторный вход");
  });

  it("Вспыльчивость: без выхода тот же провал вводит в Ярость", async () => {
    const a = actor();
    captured.nextRoll = 99;
    await rollQuickToAngerTest(a);
    expect(a.system.inRage).toBe(true);
  });

  it("Вспыльчивость в новом бою снова работает", async () => {
    const a = actor();
    await exited(a);
    globalThis.game.combat = { id: "combat-2", round: 1 };
    captured.nextRoll = 99;
    await rollQuickToAngerTest(a);
    expect(a.system.inRage).toBe(true);
  });

  it("Кхорнгор: намеренный срыв не вводит в Ярость", async () => {
    grant("subrace.khorngor.rage");
    const a = actor();
    await exited(a);
    captured.confirmAnswer = true;
    await khorngorRageTest(a);
    expect(a.system.inRage).toBe(false);
  });

  it("Миролюбец: успех Воли−20 не вводит в Ярость", async () => {
    const a = actor();
    await exited(a);
    captured.nextRoll = 1;
    await rollPacifismTest(a);
    expect(a.system.inRage).toBe(false);
  });

  it("Гвозди Мясника: вход не гейтится вовсе", async () => {
    const a = actor({ items: [NAILS] });
    await exited(a);
    captured.nextRoll = 99;
    await rollNailsTest(a);
    expect(a.system.inRage).toBe(true);
  });

  it("владелец Frenzy — то же самое, что и остальные", async () => {
    const a = actor({ items: [FRENZY] });
    await exited(a);
    captured.nextRoll = 99;
    await rollQuickToAngerTest(a);
    expect(a.system.inRage).toBe(false);
  });
});
