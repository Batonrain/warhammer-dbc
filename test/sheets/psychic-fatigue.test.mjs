// test/sheets/psychic-fatigue.test.mjs
//
// Психотест (wdbc-lfho): порог charVal+5×эPR раньше не знал про Усталость —
// контрпример уже был рядом (activateNavigatorPower её учитывает), а общий
// путь манифестации силы — нет. Тест дороги, которой штраф теперь доезжает
// до порога и виден в карточке результата.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { executePsychotest } from "../../module/sheets/tabs/psychic.mjs";

function makeActor({ fatigue = 0, wp = 40 } = {}) {
  return {
    id: "a1", name: "Псайкер",
    items: [],
    system: {
      characteristics: { wp: { total: wp }, t: { bonus: 3 } },
      fatigue: { value: fatigue, max: 0 },
      psyker: { class: "bound", currentRating: 3, rating: 3, sustain: 0 },
      corruption: { value: 0 },
      corruptionBonus: 0
    },
    getFlag: () => undefined,
    update: async () => {}
  };
}

const item = {
  name: "Тестовая сила", system: { powerType: "utility", discipline: "" },
  update: async () => {}
};

const baseOpts = { mPR: 2, prMod: 0, mode: "normal", path: "", modifier: 0, eldar: false,
  pushChoice: 1, damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1 };

beforeEach(resetCaptured);

describe("executePsychotest: Усталость в пороге манифестации", () => {
  it("не уставший — порог без штрафа: 40 + 5×2", async () => {
    captured.nextRoll = 99;
    await executePsychotest(makeActor({ fatigue: 0 }), item, baseOpts);
    const msg = captured.chat.at(-1);
    expect(msg.content).toContain("Порог: <b>50</b>");
    expect(msg.content).not.toContain("Усталость");
  });

  it("уставший — порог падает на 10, и это видно в карточке", async () => {
    captured.nextRoll = 99;
    await executePsychotest(makeActor({ fatigue: 1 }), item, baseOpts);
    const msg = captured.chat.at(-1);
    expect(msg.content).toContain("Порог: <b>40</b>");
    expect(msg.content).toContain("😓 Усталость");
  });
});
