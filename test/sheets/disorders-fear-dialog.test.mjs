// test/sheets/disorders-fear-dialog.test.mjs
//
// Диалог теста Страха (wdbc-lfho): поле Infamy раньше открывалось с дефолтом
// 0, молча отключая авто-успех «Infamy ≥ X» у персонажа, у которого Очки
// Бесчестия реально накоплены — предзаполняем из актора, поле остаётся
// редактируемым руками.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { openFearDialog } from "../../module/sheets/tabs/disorders.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

function makeActor({ fate = 0 } = {}) {
  return { type: "character", name: "Подставной", items: [],
    system: { characteristics: { wp: { total: 40 } }, fate: { value: fate } } };
}

beforeEach(resetCaptured);

describe("openFearDialog: поле Infamy предзаполнено из актора", () => {
  it("Infamy 0 по умолчанию у персонажа без Очков Бесчестия", () => {
    openFearDialog(makeActor({ fate: 0 }));
    expect(captured.dialog.content).toContain('id="fear-infamy" type="number" value="0"');
  });

  it("накопленные Очки Бесчестия подставляются, а не 0", () => {
    openFearDialog(makeActor({ fate: 3 }));
    expect(captured.dialog.content).toContain('id="fear-infamy" type="number" value="3"');
  });
});

// targetActor (wdbc-1rno, 12.09.2026): Тест Страха книжно не привязан к
// конкретному токену, но если источник угрозы выделен на сцене — тот же
// приём, что у attack-dialog.mjs (game.user.targets) — cross-actor правила
// (Ненависть) должны увидеть его и предложить переброс галочкой.
describe("openFearDialog: источник угрозы едет в ctx.targetActor", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
    game.user.targets = undefined;
  });

  it("выделенный токен на сцене — правило с областью morale получает ctx.targetActor и всплывает галочкой", () => {
    clearRuleSources();
    const threat = { id: "threat-1", name: "Ненавистный" };
    registerRuleSource("test", (a, ctx) => ctx.targetActor
      ? [{ id: "test.moraleReroll", label: "Ненависть",
           effects: [{ kind: "rollMode", target: "morale", mode: "keepBest", rolls: 2, who: "self" }] }]
      : []);
    game.user.targets = new Set([{ actor: threat }]);
    openFearDialog(makeActor());
    expect(captured.dialog.content).toContain("Ненависть");
    expect(captured.dialog.content).toContain("rule-reroll-opt");
  });

  it("без выделенного токена — то же правило молчит, диалог как раньше", () => {
    clearRuleSources();
    registerRuleSource("test", (a, ctx) => ctx.targetActor
      ? [{ id: "test.moraleReroll", label: "Ненависть",
           effects: [{ kind: "rollMode", target: "morale", mode: "keepBest", rolls: 2, who: "self" }] }]
      : []);
    openFearDialog(makeActor());
    expect(captured.dialog.content).not.toContain("Ненависть");
  });
});
