// test/sheets/disorders-fear-dialog.test.mjs
//
// Диалог теста Страха (wdbc-lfho): поле Infamy раньше открывалось с дефолтом
// 0, молча отключая авто-успех «Infamy ≥ X» у персонажа, у которого Очки
// Бесчестия реально накоплены — предзаполняем из актора, поле остаётся
// редактируемым руками.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { openFearDialog, fearDialogDefaults } from "../../module/sheets/tabs/disorders.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

function makeActor({ fate = 0, inf = 0 } = {}) {
  return { type: "character", name: "Подставной", items: [],
    system: { characteristics: { wp: { total: 40 }, inf: { total: inf } }, fate: { value: fate } } };
}

beforeEach(resetCaptured);

// Стр. 53: пороги автоуспеха 20+…80+ — это характеристика Infamy, а не пул
// Очков Бесчестия (он не больше Inf.b и до 20 не дотягивает). Раньше
// (wdbc-lfho) подставлялись Очки — автоуспех по Infamy не срабатывал никогда.
describe("openFearDialog: поле Infamy — характеристика Inf, не Очки Бесчестия", () => {
  it("Inf 45 при 3 Очках Бесчестия — в поле 45", () => {
    openFearDialog(makeActor({ fate: 3, inf: 45 }));
    expect(captured.dialog.content).toContain('id="fear-infamy" type="number" value="45"');
  });

  it("без характеристики — 0", () => {
    openFearDialog(makeActor({ fate: 3 }));
    expect(captured.dialog.content).toContain('id="fear-infamy" type="number" value="0"');
  });
});

describe("fearDialogDefaults: рейтинг и «Демон» берутся из выделенного источника", () => {
  it("без источника — Страх 1, не Демон", () => {
    const d = fearDialogDefaults(makeActor(), null);
    expect(d.rating).toBe(1);
    expect(d.demon).toBe(false);
  });

  it("источник со Страхом 3 и Чертой Daemonic — Страх 3, Демон", () => {
    const src = { type: "character", system: { fearRating: 3 },
      items: [{ type: "trait", name: "Daemonic (4) / Демонический (4)" }] };
    expect(fearDialogDefaults(makeActor(), src)).toMatchObject({ rating: 3, demon: true });
  });

  it("«Daemonic Armament» — не Черта Daemonic", () => {
    const src = { type: "character", system: { fearRating: 2 },
      items: [{ type: "trait", name: "Daemonic Armament" }] };
    expect(fearDialogDefaults(makeActor(), src).demon).toBe(false);
  });

  it("актор типа daemon — Демон; рейтинг выше 4 обрезается до 4", () => {
    expect(fearDialogDefaults(makeActor(), { type: "daemon", system: { fearRating: 6 }, items: [] }))
      .toMatchObject({ rating: 4, demon: true });
  });

  it("персонаж без игрока-владельца — Обычный", () => {
    expect(fearDialogDefaults({ ...makeActor(), hasPlayerOwner: false }).important).toBe(false);
    expect(fearDialogDefaults({ ...makeActor(), hasPlayerOwner: true }).important).toBe(true);
  });

  it("выделенный источник подставляет рейтинг в выпадающий список диалога", () => {
    game.user.targets = new Set([{ actor: { type: "daemon", system: { fearRating: 3 }, items: [] } }]);
    try {
      openFearDialog(makeActor());
      expect(captured.dialog.content).toContain('<option value="3" selected>');
      expect(captured.dialog.content).toContain('id="fear-prop-demon" type="checkbox" checked');
    } finally { game.user.targets = undefined; }
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
