// 3-b530: Предусмотрительность (Foresight) — кнопка «Обдумать 5 мин», флаг, +10 на следующий тест I.
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { situationalRules } from "../../module/rules/situational.mjs";
import {
  talentActionsHtml, runTalentAction, clearForesight, foresightReady, isForesightItem
} from "../../module/apps/talent-actions.mjs";

const foresightTalent = () => ({
  id: "f1", type: "talent", name: "Foresight / Предусмотрительность",
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: "sage.core.foresight" }] }] } }
});

function actor() {
  const flags = {};
  return {
    id: "a", name: "Мудрец", items: [], system: {},
    getFlag: (ns, k) => flags[`${ns}.${k}`],
    setFlag: async (ns, k, v) => { flags[`${ns}.${k}`] = v; },
    unsetFlag: async (ns, k) => { delete flags[`${ns}.${k}`]; }
  };
}

beforeEach(resetCaptured);

describe("Предусмотрительность", () => {
  it("кнопка есть только на листе этого Таланта и только у владельца-актора", () => {
    expect(isForesightItem(foresightTalent())).toBe(true);
    expect(talentActionsHtml(foresightTalent(), actor())).toContain('data-talent-action="foresight"');
    expect(talentActionsHtml(foresightTalent(), null)).toBe("");
    expect(talentActionsHtml({ type: "talent", name: "Другой", flags: {} }, actor())).toBe("");
  });

  it("кнопка ставит флаг и пишет карточку; +10 только на тест I, не на другие характеристики", async () => {
    const a = actor();
    expect(await runTalentAction("foresight", foresightTalent(), a)).toBe(true);
    expect(foresightReady(a)).toBe(true);
    expect(captured.chat.at(-1).content).toContain("+10");

    const int = situationalRules(a, { char: "int" }).find(r => r.id === "situational.foresight");
    expect(int?.effects[0].value).toBe(10);
    expect(situationalRules(a, { char: "wp" }).some(r => r.id === "situational.foresight")).toBe(false);
  });

  it("без кнопки бонуса нет; после теста флаг гаснет", async () => {
    const a = actor();
    expect(situationalRules(a, { char: "int" }).some(r => r.id === "situational.foresight")).toBe(false);
    await runTalentAction("foresight", foresightTalent(), a);
    await clearForesight(a);
    expect(foresightReady(a)).toBe(false);
    expect(situationalRules(a, { char: "int" }).some(r => r.id === "situational.foresight")).toBe(false);
  });

  it("чужой предмет не запускает действие", async () => {
    const a = actor();
    expect(await runTalentAction("foresight", { type: "talent", name: "Прочее", flags: {} }, a)).toBe(false);
    expect(foresightReady(a)).toBe(false);
  });
});
