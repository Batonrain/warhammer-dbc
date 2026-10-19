// test/combat/fear-resilience.test.mjs
//
// Талант Стойкости «Сопротивление» (глава 3), специализация Fear: +10 на тест
// Страха (combat/fear.mjs помечает его тегом fearTest, отдельным от общего
// morale — Запугивание/Пытки/Подавление этот бонус не получают).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { _executeFearRoll } from "../../module/combat/fear.mjs";

const resistance = spec => ({ type: "talent", name: "Resistance / Сопротивление", system: { specialization: spec }, flags: {} });

function makeActor(items = [], wp = 40) {
  return {
    id: "a1", name: "Подставной", items,
    system: { characteristics: { wp: { total: wp } }, fatigue: { value: 0, max: 0 }, fate: { value: 0 } },
    getFlag: () => undefined, update: async () => {},
    effects: [], createEmbeddedDocuments: async () => []
  };
}

beforeEach(resetCaptured);

describe("Сопротивление (Fear): порог теста Страха", () => {
  it("с Fear: 40 + важный(+10) + 10 = 60, строка видна в карточке", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor([resistance("Fear")]), 1, "important", 0, 0);
    const msg = captured.chat.at(-1).content;
    expect(msg).toContain("<label>Порог</label><b>60</b>");
    expect(msg).toContain("Сопротивление (Fear)");
  });

  it("с другой специализацией порог обычный 50", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor([resistance("Poison, Cold")]), 1, "important", 0, 0);
    expect(captured.chat.at(-1).content).toContain("<label>Порог</label><b>50</b>");
  });

  it("без Таланта порог обычный 50", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor(), 1, "important", 0, 0);
    expect(captured.chat.at(-1).content).toContain("<label>Порог</label><b>50</b>");
  });
});
