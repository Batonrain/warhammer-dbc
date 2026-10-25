// test/apps/war-cry.test.mjs
//
// War Cry / Боевой Клич (Sahara 3-5e84): кнопка на листе Таланта — 1 Усталости и
// карточка «рейтинг Страха 1 / +1 до начала следующего Хода». Сам рейтинг в
// производные данные не вносится (как Грозный Вопль): врагам решает стол.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { talentActionsHtml, runTalentAction, isWarCryItem } from "../../module/apps/talent-actions.mjs";

const warCry = () => ({
  id: "w1", type: "talent", name: "War Cry / Боевой Клич",
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: "social.core.warCry" }] }] } }
});

function actor(fearRating = 0) {
  const flags = {};
  const a = {
    id: "a", name: "Горлопан", items: [], effects: [],
    system: { fearRating, fatigue: { value: 0, max: 0 }, characteristics: { t: { total: 40, bonus: 4 }, wp: { total: 40, bonus: 4 } }, conditions: {} },
    getFlag: (ns, k) => flags[`${ns}.${k}`],
    setFlag: async (ns, k, v) => { flags[`${ns}.${k}`] = v; },
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let t = a;
        for (const p of parts.slice(0, -1)) t = (t[p] ??= {});
        t[parts.at(-1)] = value;
      }
    }
  };
  return a;
}

beforeEach(resetCaptured);

describe("Боевой клич", () => {
  it("кнопка только на листе этого Таланта у владельца-актора", () => {
    expect(isWarCryItem(warCry())).toBe(true);
    expect(talentActionsHtml(warCry(), actor())).toContain('data-talent-action="warCry"');
    expect(talentActionsHtml(warCry(), null)).toBe("");
    expect(talentActionsHtml({ type: "talent", name: "Прочий", flags: {} }, actor())).toBe("");
  });

  it("клик: +1 Усталости и карточка «Страх 1» без собственного рейтинга", async () => {
    const a = actor(0);
    expect(await runTalentAction("warCry", warCry(), a)).toBe(true);
    expect(a.system.fatigue.value).toBe(1);
    expect(captured.chat.at(-1).content).toContain("рейтинг Страха <b>1</b>");
  });

  it("при собственном рейтинге — «N → N+1»", async () => {
    const a = actor(2);
    await runTalentAction("warCry", warCry(), a);
    expect(captured.chat.at(-1).content).toContain("2 → 3");
  });

  it("чужой предмет не запускает клич и Усталости не даёт", async () => {
    const a = actor();
    expect(await runTalentAction("warCry", { type: "talent", name: "Прочее", flags: {} }, a)).toBe(false);
    expect(a.system.fatigue.value).toBe(0);
  });
});
