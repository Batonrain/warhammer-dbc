// test/combat/intimidate.test.mjs
//
// Запугивание (Intimidate) как встречная проверка книги: «Встречные тесты
// против Intimidate являются тестами Морали» — нападающий бросает Intimidate,
// цель отвечает тестом Морали (Воля+0), обе стороны сравниваются по степени
// (module/rules/test-kind.mjs::resolveOpposed). Саркофаг Дредноута (wdbc-drn)
// автоматически проходит тест Морали цели независимо от броска.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { intimidateThreshold, moraleThreshold, rollIntimidateContest } from "../../module/combat/intimidate.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

function actor({ name = "Актор", intimidate = 40, wp = 40 } = {}) {
  return {
    id: name, name, uuid: `Actor.${name}`,
    system: { skills: { intimidate: { total: intimidate } }, characteristics: { wp: { total: wp } } },
    getFlag: () => undefined
  };
}

beforeEach(resetCaptured);

describe("intimidateThreshold / moraleThreshold: чистый расчёт", () => {
  it("Intimidate нападающего + модификатор", () => {
    expect(intimidateThreshold(actor({ intimidate: 40 }), 10)).toBe(50);
    expect(intimidateThreshold(actor({ intimidate: 40 }))).toBe(40);
  });

  it("тест Морали цели — Воля + модификатор", () => {
    expect(moraleThreshold(actor({ wp: 35 }), -10)).toBe(25);
    expect(moraleThreshold(actor({ wp: 35 }))).toBe(35);
  });

  it("отсутствующие данные считаются нулём, не роняют расчёт", () => {
    expect(intimidateThreshold({})).toBe(0);
    expect(moraleThreshold({})).toBe(0);
  });
});

describe("rollIntimidateContest: встречная проверка", () => {
  it("нападающий преуспел сильнее — побеждает", async () => {
    captured.dice = [10, 60]; // атака: 10 (порог 50, успех), цель: 60 (порог 30, провал)
    const atk = actor({ intimidate: 50 });
    const tgt = actor({ wp: 30 });
    const { winner } = await rollIntimidateContest(atk, tgt);
    expect(winner).toBe("mine");
    const card = captured.chat.at(-1).content;
    expect(card).toContain("побеждает");
  });

  it("цель сопротивляется успешнее — побеждает цель", async () => {
    captured.dice = [95, 5]; // атака: провал (порог 50), цель: успех (порог 30)
    const atk = actor({ intimidate: 50 });
    const tgt = actor({ wp: 30 });
    const { winner } = await rollIntimidateContest(atk, tgt);
    expect(winner).toBe("theirs");
    const card = captured.chat.at(-1).content;
    expect(card).toContain("самообладание");
  });

  it("Саркофаг Дредноута: цель автоматически проходит тест Морали", async () => {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "test.rule", when: {}, effects: [{ kind: "grantFlag", target: "sarcophagus.autoPassFear" }] }
    ]);
    captured.dice = [10, 95]; // цель бросает 95 против порога 30 — без Саркофага провал
    const atk = actor({ intimidate: 50 });
    const tgt = actor({ wp: 30 });
    const { winner } = await rollIntimidateContest(atk, tgt);
    // Атакующий тоже преуспел (10 ≤ 50), но у цели авто-успех — margin решает степень.
    expect(winner).not.toBe(null);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Саркофаг Дредноута");
    clearRuleSources();
  });

  it("без возможности — тот же бросок цели проваливается как обычно", async () => {
    captured.dice = [10, 95];
    const atk = actor({ intimidate: 50 });
    const tgt = actor({ wp: 30 });
    await rollIntimidateContest(atk, tgt);
    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("Саркофаг Дредноута");
  });

  it("карточка называет обе стороны и учитывает модификаторы в порогах", async () => {
    captured.dice = [10, 60];
    const atk = actor({ name: "Дредноут", intimidate: 50 });
    const tgt = actor({ name: "Жертва", wp: 30 });
    await rollIntimidateContest(atk, tgt, { attackerMod: 5, targetMod: -5 });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Дредноут");
    expect(card).toContain("Жертва");
    expect(card).toContain("<b>55</b>"); // 50 + 5 (attackerMod)
    expect(card).toContain("<b>25</b>"); // 30 − 5 (targetMod)
  });
});
