// test/rules/fear-ignore.test.mjs
//
// «Игнорировать Страх» — одно место для трёх путей книги (память сцены и
// автоуспех по Infamy/своему Страху — стр. 53, Стальное Сердце — wdbc-tsz6)
// и для их отмены «не может игнорировать этот Страх» (Затронутый Варпом,
// субмутация 1, wdbc-1rno.26; решение владельца 02.10.2026 — снимаются все три).

import { describe, it, expect } from "vitest";
import { fearIgnore } from "../../module/rules/fear-ignore.mjs";

describe("fearIgnore: обычный Страх — три пути книги", () => {
  it("ничего не сработало — тест по настоящему рейтингу", () => {
    expect(fearIgnore({ rating: 3, important: true })).toEqual(
      { rating: 3, skip: false, autoPass: false, cancelled: [] });
  });

  it("память сцены: был тест против Страха 3 — Страх 3 и ниже не тестируется", () => {
    expect(fearIgnore({ rating: 3, faced: 3 }).skip).toBe(true);
    expect(fearIgnore({ rating: 2, faced: 3 }).skip).toBe(true);
    expect(fearIgnore({ rating: 4, faced: 3 }).skip).toBe(false);
  });

  it("бесплатный переброс Демона — не новая встреча, память сцены его не отсекает", () => {
    expect(fearIgnore({ rating: 3, faced: 3, free: true }).skip).toBe(false);
  });

  it("Важный с Infamy 60 против Страха 3 — автоуспех; Обычный — нет", () => {
    expect(fearIgnore({ rating: 3, important: true, infamy: 60 }).autoPass).toBe(true);
    expect(fearIgnore({ rating: 3, important: true, infamy: 59 }).autoPass).toBe(false);
    expect(fearIgnore({ rating: 3, important: false, infamy: 60 }).autoPass).toBe(false);
  });

  it("Важный со своим Страхом 3 против Страха 3 — автоуспех", () => {
    expect(fearIgnore({ rating: 3, important: true, ownFear: 3 }).autoPass).toBe(true);
    expect(fearIgnore({ rating: 3, important: true, ownFear: 2 }).autoPass).toBe(false);
  });

  it("Стальное Сердце: Страх 3 считается Страхом 2, Страх 1 — игнорируется", () => {
    expect(fearIgnore({ rating: 3, steelHeart: true })).toMatchObject({ rating: 2, autoPass: false });
    expect(fearIgnore({ rating: 1, steelHeart: true })).toMatchObject({ rating: 0, autoPass: true });
  });

  it("Стальное Сердце снижает и порог Infamy: Страх 3 → порог Страха 2 (40+)", () => {
    expect(fearIgnore({ rating: 3, important: true, infamy: 40, steelHeart: true }).autoPass).toBe(true);
  });
});

describe("fearIgnore: «не может игнорировать этот Страх» снимает все три пути", () => {
  const all = { rating: 3, important: true, infamy: 80, ownFear: 4, faced: 4, steelHeart: true };

  it("всё сразу — тест есть, автоуспеха нет, рейтинг настоящий", () => {
    expect(fearIgnore({ ...all, unignorable: true })).toMatchObject(
      { rating: 3, skip: false, autoPass: false });
  });

  it("отменённые пути перечислены — для подписи в карточке", () => {
    expect(fearIgnore({ ...all, unignorable: true }).cancelled.sort())
      .toEqual(["infamy", "ownFear", "scene", "steelHeart"]);
  });

  it("по одному: память сцены", () => {
    expect(fearIgnore({ rating: 3, faced: 3, unignorable: true }))
      .toMatchObject({ skip: false, cancelled: ["scene"] });
  });

  it("по одному: Infamy", () => {
    expect(fearIgnore({ rating: 3, important: true, infamy: 60, unignorable: true }))
      .toMatchObject({ autoPass: false, cancelled: ["infamy"] });
  });

  it("по одному: свой Страх", () => {
    expect(fearIgnore({ rating: 3, important: true, ownFear: 3, unignorable: true }))
      .toMatchObject({ autoPass: false, cancelled: ["ownFear"] });
  });

  it("по одному: Стальное Сердце — рейтинг не снижается", () => {
    expect(fearIgnore({ rating: 3, steelHeart: true, unignorable: true }))
      .toMatchObject({ rating: 3, autoPass: false, cancelled: ["steelHeart"] });
  });

  it("ничего бы не сработало — отменять нечего, подписи нет", () => {
    expect(fearIgnore({ rating: 3, important: true, unignorable: true }).cancelled).toEqual([]);
  });
});
