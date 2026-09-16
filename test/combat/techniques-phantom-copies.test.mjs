// test/combat/techniques-phantom-copies.test.mjs
//
// Фантомные Копии (Wrapped in Chaos "2-3", wdbc-1rno): +20 на тесты Финта
// владельцу — тот же гейт по имени техники, что уже даёт Танец Обмана
// (module/combat/techniques.mjs, тест-сосед techniques-dance-of-deception).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor } from "../support/combat-fixtures.mjs";
import { _showContestDialog } from "../../module/combat/techniques.mjs";
import { MELEE_CONTESTS } from "../../module/constants/combat.mjs";

beforeEach(() => resetCaptured());

const phantomCopiesItem = { type: "mutation", name: "Wrapped in Chaos / Укутанный в Хаос",
  system: { submutation: { label: "2-3" } },
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: "mutation.wrappedInChaos", label: "" }
  ] }] } } };

describe("_showContestDialog — Фантомные Копии, разметка", () => {
  it("Финт с «2-3» — +20 уже в базовом значении, заметка о бонусе показана", async () => {
    // WS 45 по умолчанию у actorFor(), Стойка standard — wsBonus 0.
    const actor = actorFor({ items: [phantomCopiesItem] });
    await _showContestDialog(actor, MELEE_CONTESTS.feint);
    const html = captured.dialog.content;
    expect(html).toContain('value="65"'); // 45 + 20
    expect(html).toContain("+20, уже учтён выше");
  });

  it("Давление — не Финт, бонус не применяется даже с «2-3»", async () => {
    const actor = actorFor({ items: [phantomCopiesItem] });
    await _showContestDialog(actor, MELEE_CONTESTS.press);
    const html = captured.dialog.content;
    expect(html).toContain('value="45"');
    expect(html).not.toContain("уже учтён выше");
  });

  it("без «2-3» — Финт без бонуса", async () => {
    const actor = actorFor({});
    await _showContestDialog(actor, MELEE_CONTESTS.feint);
    const html = captured.dialog.content;
    expect(html).toContain('value="45"');
    expect(html).not.toContain("уже учтён выше");
  });
});
