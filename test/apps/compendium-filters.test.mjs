import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { matchesFilters, normalizePick } from "../../module/apps/compendium-filters.mjs";

/** Узел дерева обозревателя — обычный литерал, никакого Foundry. */
const item = (over = {}) => ({
  id: "x", name: "Предмет", type: "gear", folderId: null,
  armorType: undefined, availability: 0, properties: [], ...over
});

let errors;
beforeEach(() => { errors = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { errors.mockRestore(); });

describe("matchesFilters", () => {
  it("без условий подходит всё", () => {
    expect(matchesFilters(item(), {})).toBe(true);
    expect(matchesFilters(item(), undefined)).toBe(true);
  });

  it("условие со значением null не считается заданным", () => {
    expect(matchesFilters(item({ type: "gear" }), { type: null })).toBe(true);
  });

  it("все условия должны выполниться разом, а не любое", () => {
    const it1 = item({ type: "weapon", availability: 3 });
    expect(matchesFilters(it1, { type: "weapon", maxAvailability: 3 })).toBe(true);
    expect(matchesFilters(it1, { type: "weapon", maxAvailability: 2 })).toBe(false);
  });

  it("неизвестное условие не подходит и жалуется", () => {
    expect(matchesFilters(item(), { такогоНет: 1 })).toBe(false);
    expect(errors).toHaveBeenCalled();
  });

  describe("type", () => {
    it("одиночное значение и список читаются одинаково", () => {
      expect(matchesFilters(item({ type: "faction" }), { type: "faction" })).toBe(true);
      expect(matchesFilters(item({ type: "faction" }), { type: ["weapon", "faction"] })).toBe(true);
      expect(matchesFilters(item({ type: "gear" }), { type: ["weapon", "faction"] })).toBe(false);
    });
  });

  describe("folderId", () => {
    it("сравнивает папку компендиума", () => {
      expect(matchesFilters(item({ folderId: "abc" }), { folderId: "abc" })).toBe(true);
      expect(matchesFilters(item({ folderId: "abc" }), { folderId: "xyz" })).toBe(false);
    });

    // Ветка «Рукопашное/Стрелковое — любое» (compendium-browser.mjs,
    // weaponTypeFolderIds) раскрывается в список её листьев ДО фильтра —
    // список должен матчить любой из них, тем же приёмом, что у type выше.
    it("список папок читается как «любая из перечисленных»", () => {
      expect(matchesFilters(item({ folderId: "leaf1" }), { folderId: ["leaf1", "leaf2"] })).toBe(true);
      expect(matchesFilters(item({ folderId: "leaf2" }), { folderId: ["leaf1", "leaf2"] })).toBe(true);
      expect(matchesFilters(item({ folderId: "leaf3" }), { folderId: ["leaf1", "leaf2"] })).toBe(false);
    });
  });

  describe("weaponProp", () => {
    it("ищет свойство по ключу", () => {
      const w = item({ properties: [{ key: "tearing" }, { key: "reliable" }] });
      expect(matchesFilters(w, { weaponProp: "tearing" })).toBe(true);
      expect(matchesFilters(w, { weaponProp: "unwieldy" })).toBe(false);
    });

    it("предмет без свойств не падает", () => {
      expect(matchesFilters(item({ properties: undefined }), { weaponProp: "tearing" })).toBe(false);
    });
  });

  describe("maxAvailability", () => {
    it("пропускает не выше порога, включая равное", () => {
      expect(matchesFilters(item({ availability: 2 }), { maxAvailability: 3 })).toBe(true);
      expect(matchesFilters(item({ availability: 3 }), { maxAvailability: 3 })).toBe(true);
      expect(matchesFilters(item({ availability: 4 }), { maxAvailability: 3 })).toBe(false);
    });

    it("порог 0 не читается как «условия нет»", () => {
      expect(matchesFilters(item({ availability: 1 }), { maxAvailability: 0 })).toBe(false);
      expect(matchesFilters(item({ availability: 0 }), { maxAvailability: 0 })).toBe(true);
    });
  });

  describe("minAvailability", () => {
    it("пропускает не ниже порога, включая равное", () => {
      expect(matchesFilters(item({ availability: 3 }), { minAvailability: 2 })).toBe(true);
      expect(matchesFilters(item({ availability: 2 }), { minAvailability: 2 })).toBe(true);
      expect(matchesFilters(item({ availability: 1 }), { minAvailability: 2 })).toBe(false);
    });

    it("вместе с maxAvailability задаёт диапазон («Редкость 2-4» — Очки Снаряжения)", () => {
      const filters = { minAvailability: 2, maxAvailability: 4 };
      expect(matchesFilters(item({ availability: 1 }), filters)).toBe(false);
      expect(matchesFilters(item({ availability: 2 }), filters)).toBe(true);
      expect(matchesFilters(item({ availability: 4 }), filters)).toBe(true);
      expect(matchesFilters(item({ availability: 5 }), filters)).toBe(false);
    });
  });
});

describe("normalizePick", () => {
  it("без режима выбора — null", () => {
    expect(normalizePick(null)).toBeNull();
    expect(normalizePick(undefined)).toBeNull();
  });

  it("умолчания: один предмет, без пояснения", () => {
    expect(normalizePick({ pack: "weapons" })).toEqual({
      pack: "weapons", filters: {}, count: 1, prompt: "",
      budget: { mode: "count", value: 1 }
    });
  });

  // Прежняя форма `count: N` — это бюджет в штуках; переписывать рабочие
  // вызовы Конструктора ради новой записи незачем.
  it("count переезжает в бюджет штуками", () => {
    expect(normalizePick({ pack: "talents", count: 7 }).budget)
      .toEqual({ mode: "count", value: 7 });
  });

  it("бюджет опытом задаётся явно и count не перебивает его", () => {
    expect(normalizePick({ pack: "psychic-powers", budget: { mode: "xp", value: 500 } }).budget)
      .toEqual({ mode: "xp", value: 500 });
  });

  it("прежняя плоская форма переезжает в filters — вызовы Конструктора не правились", () => {
    const got = normalizePick({
      pack: "weapons", weaponFolderId: "f1", weaponProp: "tearing",
      armorType: "power", maxAvailability: 4
    });
    expect(got.filters).toEqual({
      folderId: "f1", weaponProp: "tearing", armorType: "power", maxAvailability: 4
    });
  });

  it("новая форма проходит как есть", () => {
    expect(normalizePick({ filters: { type: "faction" } }).filters).toEqual({ type: "faction" });
  });

  it("pack не обязателен — фильтры работают и без привязки к паку", () => {
    expect(normalizePick({ filters: { type: "faction" } }).pack).toBeNull();
  });

  it("count меньше единицы или мусор — это один предмет", () => {
    expect(normalizePick({ count: 0 }).count).toBe(1);
    expect(normalizePick({ count: -3 }).count).toBe(1);
    expect(normalizePick({ count: "три" }).count).toBe(1);
    expect(normalizePick({ count: 3 }).count).toBe(3);
  });

  it("prompt всегда строка", () => {
    expect(normalizePick({}).prompt).toBe("");
    expect(normalizePick({ prompt: "Выберите 3 ордена" }).prompt).toBe("Выберите 3 ордена");
  });
});
