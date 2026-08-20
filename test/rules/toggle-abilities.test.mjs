import { describe, it, expect } from "vitest";
import {
  readToggleGroup, toggleParentId, isToggleOn, childrenOf, planToggle, toggleRows
} from "../../module/rules/toggle-abilities.mjs";

const SYSTEM = "warhammer-dbc";

/** Родитель группы: Талант «Локус Кхорна» с шестью эффектами на выбор. */
const parent = (mode = "one") => ({
  id: "locus", name: "Локус Кхорна",
  flags: { [SYSTEM]: { toggleGroup: { label: "Локус", mode } } }
});

/** Подспособность: отдельный предмет со ссылкой на родителя и состоянием. */
const child = (id, name, on = false, parentId = "locus") => ({
  id, name, system: { benefit: `${name} — эффект` },
  flags: { [SYSTEM]: { toggleOf: parentId, toggleOn: on } }
});

describe("описание группы подспособностей", () => {
  it("читается у родителя, режим по умолчанию — «одна из»", () => {
    expect(readToggleGroup(parent())).toEqual({ label: "Локус", mode: "one" });
    expect(readToggleGroup(parent("many")).mode).toBe("many");
  });

  it("у обычного Таланта группы нет", () => {
    expect(readToggleGroup({ id: "x", name: "Frenzy", flags: {} })).toBeNull();
    expect(readToggleGroup(undefined)).toBeNull();
  });

  it("подписи хватает даже без label — иначе на листе была бы пустая шапка", () => {
    const bare = { flags: { [SYSTEM]: { toggleGroup: {} } } };
    expect(readToggleGroup(bare).label).toBe("Режимы");
  });
});

describe("родство и состояние", () => {
  it("подспособность знает своего родителя, обычный предмет — нет", () => {
    expect(toggleParentId(child("a", "Буйство"))).toBe("locus");
    expect(toggleParentId({ flags: {} })).toBe("");
  });

  it("включённость спрашивается только у подспособности", () => {
    expect(isToggleOn(child("a", "Буйство", true))).toBe(true);
    expect(isToggleOn(child("a", "Буйство", false))).toBe(false);
    // Флаг без родителя — не подспособность: у обычного предмета своя
    // активность (снаряжён/установлен), и её решает isItemActive.
    expect(isToggleOn({ flags: { [SYSTEM]: { toggleOn: true } } })).toBe(false);
  });

  it("дети отбираются по родителю, чужие не попадают", () => {
    const items = [child("a", "Буйство"), child("b", "Гнев"), child("c", "Грация", false, "other")];
    expect(childrenOf(items, "locus").map(i => i.id)).toEqual(["a", "b"]);
    expect(childrenOf(items, "")).toEqual([]);
  });
});

describe("planToggle: что станет включённым", () => {
  it("режим «одна из»: включение гасит соседа", () => {
    const items = [child("a", "Буйство", true), child("b", "Гнев"), child("c", "Грация")];
    expect(planToggle(readToggleGroup(parent()), items, "b", true))
      .toEqual([{ id: "a", on: false }, { id: "b", on: true }]);
  });

  it("не трогает тех, чьё состояние не меняется", () => {
    const items = [child("a", "Буйство", true), child("b", "Гнев"), child("c", "Грация")];
    const plan = planToggle(readToggleGroup(parent()), items, "a", true);
    expect(plan).toEqual([]);      // уже включена — писать нечего
  });

  it("повторное нажатие выключает: Герольд вправе не проецировать Локус", () => {
    const items = [child("a", "Буйство", true), child("b", "Гнев")];
    expect(planToggle(readToggleGroup(parent()), items, "a"))
      .toEqual([{ id: "a", on: false }]);
  });

  it("режим «сколько угодно» соседей не гасит", () => {
    const items = [child("a", "Буйство", true), child("b", "Гнев")];
    expect(planToggle(readToggleGroup(parent("many")), items, "b", true))
      .toEqual([{ id: "b", on: true }]);
  });

  it("выключение в режиме «одна из» соседей не будит", () => {
    const items = [child("a", "Буйство", true), child("b", "Гнев")];
    expect(planToggle(readToggleGroup(parent()), items, "a", false))
      .toEqual([{ id: "a", on: false }]);
  });

  it("неизвестная цель — пустой план, а не исключение", () => {
    const items = [child("a", "Буйство")];
    expect(planToggle(readToggleGroup(parent()), items, "нет-такого", true)).toEqual([]);
    expect(planToggle(readToggleGroup(parent()), items, "", true)).toEqual([]);
  });
});

describe("toggleRows: строки для листа", () => {
  it("собирает подписи, состояние и заголовок группы", () => {
    const items = [child("a", "Буйство", true), child("b", "Гнев")];
    const rows = toggleRows(items, parent());
    expect(rows.label).toBe("Локус");
    expect(rows.parentId).toBe("locus");
    expect(rows.rows).toEqual([
      { id: "a", name: "Буйство", on: true,  hint: "Буйство — эффект" },
      { id: "b", name: "Гнев",    on: false, hint: "Гнев — эффект" }
    ]);
  });

  it("у предмета без группы строк нет", () => {
    expect(toggleRows([], { id: "x", flags: {} })).toBeNull();
  });
});
