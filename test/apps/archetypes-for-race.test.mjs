// test/apps/archetypes-for-race.test.mjs
//
// archetypesForRace раньше знала только Астартес/Азуриане/Друкхари/Арлекин/
// Человек — Сслит, Иннари и Полуэльдар всегда получали пустой список, а
// Друкхари не различал субрасу (Мандрагора/Развалина/Истиннорождённый видели
// один и тот же полный список). Таблица доступа (Книга Аэльдари: Ответвления)
// разводит их по-разному — эти тесты закрепляют разведённое поведение.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { archetypesForRace } from "../../module/apps/archetypes.mjs";

const keysOf = entries => entries.map(([k]) => k).sort();

describe("archetypesForRace: субрасы Друкхари", () => {
  it("без субрасы (Недорождённый) — всё, кроме Придворного", () => {
    expect(keysOf(archetypesForRace("drukhari"))).toEqual(
      ["drAlchemist", "drAssassin", "drDuelist", "drFreebooter", "drKabalite", "drOutcast", "drPitFighter"].sort()
    );
  });

  it("Истиннорождённый — весь список, включая Придворного", () => {
    expect(keysOf(archetypesForRace("drukhari", { subrace: "truebornDrukhari" }))).toEqual(
      ["drAlchemist", "drAssassin", "drCourtier", "drDuelist", "drFreebooter", "drKabalite", "drOutcast", "drPitFighter"].sort()
    );
  });

  it("Мандрагора — только три архетипа", () => {
    expect(keysOf(archetypesForRace("drukhari", { subrace: "mandrake" }))).toEqual(
      ["drAssassin", "drOutcast", "drPitFighter"].sort()
    );
  });

  it("Развалина — шесть архетипов, без Дуэлянта и Придворного", () => {
    expect(keysOf(archetypesForRace("drukhari", { subrace: "wrack" }))).toEqual(
      ["drAlchemist", "drAssassin", "drFreebooter", "drKabalite", "drOutcast", "drPitFighter"].sort()
    );
  });
});

describe("archetypesForRace: Сслит — не пустой список", () => {
  it("получает 5 архетипов Друкхари (без Алхимика/Кабалита/Придворного)", () => {
    expect(keysOf(archetypesForRace("sslyth"))).toEqual(
      ["drAssassin", "drDuelist", "drFreebooter", "drOutcast", "drPitFighter"].sort()
    );
  });
});

describe("archetypesForRace: Иннари — наследует список Прошлого", () => {
  it("без Прошлого — пустой список", () => {
    expect(archetypesForRace("ynnari")).toEqual([]);
  });

  it("с Прошлым Азуриани — список Азуриани", () => {
    const ynnari = keysOf(archetypesForRace("ynnari", { pastRace: "azuriane" }));
    const azuriane = keysOf(archetypesForRace("azuriane"));
    expect(ynnari).toEqual(azuriane);
    expect(ynnari.length).toBeGreaterThan(0);
  });

  it("с Прошлым Друкхари — список Недорождённого (Прошлое не несёт субрасу)", () => {
    expect(keysOf(archetypesForRace("ynnari", { pastRace: "drukhari" }))).toEqual(
      keysOf(archetypesForRace("drukhari"))
    );
  });
});

describe("archetypesForRace: Полуэльдар — люди + Азуриани + Друкхари", () => {
  it("список непустой и включает хотя бы один архетип из каждой ветки", () => {
    const entries = archetypesForRace("halfEldar");
    const races = new Set(entries.map(([, a]) => a.race));
    expect(races.has("azuriane")).toBe(true);
    expect(races.has("drukhari")).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });
});

// Пересохранение шапки не должно стирать уже выбранный архетип, даже если
// текущий фильтр доступа (субраса/вайтлист) его больше не отдаёт: селектор
// обязан удержать выбор, иначе submit пишет "" поверх system.archetype.
describe("archetypeSheetContext: удержание текущего архетипа", () => {
  it("архетип вне списка субрасы остаётся выбранным в селекторе", async () => {
    const { archetypeSheetContext } = await import("../../module/apps/archetypes.mjs");
    // Мандрагоре drCourtier недоступен, но у актора он уже выбран.
    const actor = { system: { race: "drukhari", subrace: "mandrake", archetype: "drCourtier" } };
    const ctx = archetypeSheetContext(actor);
    const opts = ctx.groups.flatMap(g => g.opts);
    const cur = opts.find(o => o.selected);
    expect(cur?.key).toBe("drCourtier");
  });

  it("доступный архетип выбран как раньше", async () => {
    const { archetypeSheetContext } = await import("../../module/apps/archetypes.mjs");
    const actor = { system: { race: "drukhari", subrace: "mandrake", archetype: "drAssassin" } };
    const ctx = archetypeSheetContext(actor);
    const opts = ctx.groups.flatMap(g => g.opts);
    expect(opts.find(o => o.selected)?.key).toBe("drAssassin");
  });
});
