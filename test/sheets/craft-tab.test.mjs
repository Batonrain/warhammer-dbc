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
import { activateCraftListeners } from "../../module/sheets/tabs/craft.mjs";

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
