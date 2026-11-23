// test/rules/horror-split.test.mjs
// Sahara 578-1f7a: Разделение Ужасов (Розовый → 2 Синих → 2 Серных; Радужный → 2
// Розовых) и Локус Трансмогрификации (3 вместо 2).
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { horrorSplitInto, horrorSplitCount, horrorSplitBlocked, hasHorrorSplit, heraldLocusRadius } from "../../module/rules/horror-split.mjs";
import { horrorSplitButtonHtml } from "../../module/combat/horror-split.mjs";

const split = { type: "talent", name: "Разделение" };
const horror = (name, extra = {}) => ({ uuid: `Actor.${name}`, name, items: [split], system: { rank: "lesser" }, ...extra });

describe("во что разваливается Ужас", () => {
  it("Розовый → Синие, Синий → Серные, Возвышенный → Розовые", () => {
    expect(horrorSplitInto(horror("Pink Horror / Розовый Ужас"))).toBe("Синий Ужас");
    expect(horrorSplitInto(horror("Blue Horror / Синий Ужас"))).toBe("Серный Ужас");
    expect(horrorSplitInto(horror("Pink Horror / Розовый Ужас", { system: { rank: "exalted" } }))).toBe("Розовый Ужас");
  });
  it("без «Разделения» — никуда", () => {
    expect(hasHorrorSplit({ items: [] })).toBe(false);
    expect(horrorSplitInto({ name: "Розовый Ужас", items: [] })).toBe(null);
  });
  it("2, под Локусом Трансмогрификации — 3", () => {
    expect(horrorSplitCount(false)).toBe(2);
    expect(horrorSplitCount(true)).toBe(3);
  });
  it("священное и варп-оружие, Выжигание, нестабильность — не делится", () => {
    expect(horrorSplitBlocked({ sanctified: true })).toBe(true);
    expect(horrorSplitBlocked({ warpWeapon: true })).toBe(true);
    expect(horrorSplitBlocked({ soulBurn: true })).toBe(true);
    expect(horrorSplitBlocked({})).toBe(false);
  });
  it("радиус Локуса — ½W герольда", () => {
    expect(heraldLocusRadius({ system: { characteristics: { wp: { total: 57 } } } })).toBe(28);
  });
});

describe("кнопка на карточке урона", () => {
  it("ниже 0 Ран — кнопка с числом и видом", () => {
    const html = horrorSplitButtonHtml(horror("Pink Horror / Розовый Ужас"), { crossedZero: true });
    expect(html).toContain('data-count="2"');
    expect(html).toContain('data-into="Синий Ужас"');
  });
  it("варп-оружием или выше 0 — нет кнопки", () => {
    expect(horrorSplitButtonHtml(horror("Розовый Ужас"), { crossedZero: true, warpWeapon: true })).toBe("");
    expect(horrorSplitButtonHtml(horror("Розовый Ужас"), { crossedZero: false })).toBe("");
  });
});

describe("Бестиарий", () => {
  it("Синий Ужас есть: Раны 9, Daemonic (2), Разделение, Синее Пламя", () => {
    const dir = "packs-src/bestiary/Демоны_Хаоса/Тзинч";
    const f = readdirSync(dir).find(n => n.startsWith("Blue_Horror"));
    const d = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
    expect(d.system.wounds.max).toBe(9);
    expect(d.system.characteristics.ws.total).toBe(21);
    const names = d.items.map(i => i.name);
    expect(names).toContain("Daemonic (2)");
    expect(names).toContain("Разделение");
    expect(names).toContain("Blue Fire / Синее Пламя");
    expect(new Set(d.items.map(i => i._id)).size).toBe(d.items.length);
  });
});
