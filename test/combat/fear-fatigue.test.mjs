// test/combat/fear-fatigue.test.mjs
//
// Тест Страха (wdbc-lfho): порог wp+ratingMod+mod+difficulty раньше не знал
// про Усталость — уставший персонаж должен был вспомнить про свой −10 и
// вписать его в «Доп. мод.» руками. Тест дороги, которой этот штраф теперь
// доезжает до порога и виден в карточке результата.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { _executeFearRoll } from "../../module/combat/fear.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

function makeActor({ fatigue = 0, wp = 40 } = {}) {
  return {
    id: "a1", name: "Подставной",
    items: [],
    system: {
      characteristics: { wp: { total: wp } },
      fatigue: { value: fatigue, max: 0 },
      fate: { value: 0 }
    },
    getFlag: () => undefined
  };
}

beforeEach(resetCaptured);

describe("_executeFearRoll: Усталость в пороге теста Страха", () => {
  it("не уставший — порог без штрафа", async () => {
    captured.nextRoll = 99; // гарантированный провал, чтобы дойти до конца без лишних веток
    await _executeFearRoll(makeActor({ fatigue: 0, wp: 40 }), 1, "important", 0, 0);
    const msg = captured.chat.at(-1);
    expect(msg.content).toContain("Порог: <b>50</b>"); // 40 + важный(+10) + 0
    expect(msg.content).not.toContain("Усталость");
  });

  it("уставший — порог падает на 10, и это видно в карточке", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor({ fatigue: 1, wp: 40 }), 1, "important", 0, 0);
    const msg = captured.chat.at(-1);
    expect(msg.content).toContain("Порог: <b>40</b>"); // 40 + 10 − 10
    expect(msg.content).toContain("😓 Усталость");
  });

  it("Infamy ≥ порога рейтинга — авто-успех, штраф Усталости уже неважен", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor({ fatigue: 5, wp: 40 }), 1, "important", 20, 0);
    const msg = captured.chat.at(-1);
    expect(msg.content).toContain("выстоял");
  });
});

describe("_executeFearRoll: Стальное Сердце — все рейтинги Страха на 1 меньше (wdbc-tsz6)", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });
  const grantSteelHeart = () => {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "test.rule", when: {}, effects: [{ kind: "grantFlag", target: "mutation.heartOfSteel" }] }
    ]);
  };

  it("Страх 1 (эффективно 0) — игнорируется полностью, автоуспех", async () => {
    grantSteelHeart();
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor({ fatigue: 0, wp: 40 }), 1, "important", 0, 0);
    expect(captured.chat.at(-1).content).toContain("выстоял");
  });

  it("Страх 2 (эффективно Страх 1): порог считается по пониженному рейтингу, не по исходному", async () => {
    grantSteelHeart();
    captured.nextRoll = 99;
    // Страх 1 важный: +10 (см. FEAR_RATINGS). Порог = 40 (wp) + 10 = 50, не
    // 40+0=40, каким был бы порог настоящего Страха 2 (important:0).
    await _executeFearRoll(makeActor({ fatigue: 0, wp: 40 }), 2, "important", 0, 0);
    const msg = captured.chat.at(-1);
    expect(msg.content).toContain("Порог: <b>50</b>");
  });

  it("без Стального Сердца тот же Страх 1 не автопасс, порог считается по настоящему рейтингу", async () => {
    clearRuleSources();
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor({ fatigue: 0, wp: 40 }), 1, "important", 0, 0);
    const msg = captured.chat.at(-1);
    expect(msg.content).not.toContain("выстоял");
    expect(msg.content).toContain("Порог: <b>50</b>"); // 40 + важный(+10)
  });
});
