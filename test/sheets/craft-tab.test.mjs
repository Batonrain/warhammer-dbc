// test/sheets/craft-tab.test.mjs
//
// wdbc-42a6, регресс найден живой проверкой: `root.querySelector('[data-tab=
// "craft"]')` в activateCraftListeners находит навигационную ссылку вкладки
// (`<a data-tab="craft">` в nav.sheet-tabs — она раньше по DOM, чем сама
// вкладка), а не содержимое (`<div class="tab craft-tab" data-tab="craft">`)
// — ни один обработчик внутри вкладки КРАФТ не вешался, кнопки молчали.
// Заглушка listenerRoot (foundry-stub.mjs) индексирует узлы по селектору
// один-в-один и не может воспроизвести эту неоднозначность (два элемента
// отвечают одному и тому же селектору) — поэтому здесь свой минимальный
// root, честно моделирующий именно эту коллизию.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { activateCraftListeners, craftTabContext } from "../../module/sheets/tabs/craft.mjs";
import { RESEARCH_JOURNAL_FLAG } from "../../module/rules/research-findings.mjs";

function fakeButton() {
  const handlers = {};
  return {
    dataset: {},
    addEventListener: (event, fn) => { handlers[event] = fn; },
    click() { handlers.click?.({ currentTarget: this }); }
  };
}

/** Навигационная ссылка вкладки — как настоящий `<a>`, без кнопок внутри. */
function navLink() {
  return { dataset: { tab: "craft" }, querySelectorAll: () => [] };
}

/** Содержимое вкладки — несёт саму кнопку «Новый проект». */
function contentDiv(addProjectBtn) {
  return {
    dataset: { tab: "craft" },
    querySelectorAll: sel => (sel === "[data-act=add-project]" ? [addProjectBtn] : [])
  };
}

/** Корень листа: `[data-tab="craft"]` находит ссылку (как в реальном DOM —
 *  она раньше по документу), `.tab[data-tab="craft"]` — саму вкладку. */
function sheetRoot(addProjectBtn) {
  const nav = navLink();
  const content = contentDiv(addProjectBtn);
  return {
    querySelector: sel => (sel === '.tab[data-tab="craft"]' ? content : nav)
  };
}

function sheet() {
  const s = { actor: { id: "actor-1" }, renders: 0 };
  s.render = () => { s.renders += 1; };
  return s;
}

describe("activateCraftListeners: селектор вкладки не путает ссылку и содержимое", () => {
  it("клик по «Новый проект» реально добавляет проект (регресс: раньше молчал)", () => {
    const addProjectBtn = fakeButton();
    const root = sheetRoot(addProjectBtn);
    const s = sheet();

    activateCraftListeners(root, s);
    addProjectBtn.click();

    expect(s._craftModel.projects).toHaveLength(2);
    expect(s.renders).toBe(1);
  });
});

// Журнал Исследований (module/rules/research-findings.mjs) — читается ТОЛЬКО
// на вкладке листа, не в отдельном окне «Мастерская» (у того нет одного
// владельца-актора). Новое сверху; hasItem — находка жива в инвентаре этого
// актора прямо сейчас (не просто ID в старой записи).
describe("craftTabContext: Журнал Исследований", () => {
  function actorWithJournal(log, ownedItemIds = []) {
    const items = { get: id => (ownedItemIds.includes(id) ? { id } : null) };
    return {
      id: "actor-1", items,
      getFlag: (scope, key) => (scope === "warhammer-dbc" && key === RESEARCH_JOURNAL_FLAG ? log : undefined)
    };
  }

  it("пустой Журнал — пустой список, без падения", async () => {
    const s = { actor: actorWithJournal(undefined) };
    const ctx = await craftTabContext(s);
    expect(ctx.craftResearchJournal).toEqual([]);
  });

  it("записи — новые сверху, hasItem только у реально живущих в инвентаре", async () => {
    const log = [
      { kind: "blueprint", kindLabel: "Чертёж", title: "Первая", itemId: "it1", itemName: "Первая" },
      { kind: "lore", kindLabel: "Изучение", studyTarget: "Logic → Scholastic Lore (Xenos)", itemId: null, itemName: "" },
      { kind: "blueprint", kindLabel: "Чертёж", title: "Третья", itemId: "it-gone", itemName: "Третья" }
    ];
    const s = { actor: actorWithJournal(log, ["it1"]) };
    const ctx = await craftTabContext(s);

    expect(ctx.craftResearchJournal).toHaveLength(3);
    expect(ctx.craftResearchJournal[0].title).toBe("Третья");
    expect(ctx.craftResearchJournal[0].hasItem).toBe(false); // it-gone больше не на акторе
    expect(ctx.craftResearchJournal[2].itemName).toBe("Первая");
    expect(ctx.craftResearchJournal[2].hasItem).toBe(true);
    expect(ctx.craftResearchJournal[1].studyTarget).toBe("Logic → Scholastic Lore (Xenos)");
  });
});
