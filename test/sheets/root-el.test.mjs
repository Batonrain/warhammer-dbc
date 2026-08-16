// test/sheets/root-el.test.mjs
//
// Разворот корня, который приходит в обработчики листа.
//
// Ловушка: у листов на ApplicationV2 корень — <form>, а форма индексируется
// СВОИМИ ПОЛЯМИ, то есть `form[0]` — первый контрол. Привычное
// `root?.[0] ?? root` возвращало на такой форме кнопку, и слушатели вешались
// на неё: поле «Фракция» молчало — ни «＋», ни зона дропа не работали.
//
// Поэтому обёртка узнаётся по своему полю `jquery`, а не по наличию [0].

import { describe, it, expect } from "vitest";
import { rootEl } from "../../module/sheets/v2-helpers.mjs";

/** Форма листа: у неё есть [0] — её первый контрол. */
const formLike = button => ({ tagName: "FORM", 0: button, querySelector: () => null });
/** jQuery-обёртка: у неё есть собственное поле `jquery`. */
const jqLike = el => ({ jquery: "3.7", 0: el, length: 1 });

describe("rootEl", () => {
  it("форма листа возвращается сама, а не её первый контрол", () => {
    const button = { tagName: "BUTTON" };
    const form = formLike(button);
    expect(form[0]).toBe(button);            // вот она, ловушка
    expect(rootEl(form)).toBe(form);
  });

  it("jQuery-обёртка разворачивается в свой элемент", () => {
    const div = { tagName: "DIV" };
    expect(rootEl(jqLike(div))).toBe(div);
  });

  it("обычный элемент возвращается как есть", () => {
    const div = { tagName: "DIV" };
    expect(rootEl(div)).toBe(div);
  });

  it("пустое остаётся пустым, а не падает", () => {
    expect(rootEl(null)).toBe(null);
    expect(rootEl(undefined)).toBe(undefined);
  });
});
