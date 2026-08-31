// test/combat/fear-fatigue.test.mjs
//
// Тест Страха (wdbc-lfho): порог wp+ratingMod+mod+difficulty раньше не знал
// про Усталость — уставший персонаж должен был вспомнить про свой −10 и
// вписать его в «Доп. мод.» руками. Тест дороги, которой этот штраф теперь
// доезжает до порога и виден в карточке результата.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { _executeFearRoll } from "../../module/combat/fear.mjs";

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
