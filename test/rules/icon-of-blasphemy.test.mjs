import { describe, it, expect } from "vitest";
import { isIconOfBlasphemyItem } from "../../module/rules/icon-of-blasphemy.mjs";

describe("isIconOfBlasphemyItem", () => {
  it("совпадает по двуязычному имени пака, регистронезависимо", () => {
    expect(isIconOfBlasphemyItem({ type: "mutation", name: "Icon of Blasphemy / Икона Богохульства" })).toBe(true);
    expect(isIconOfBlasphemyItem({ type: "mutation", name: "icon of blasphemy / икона богохульства" })).toBe(true);
  });

  it("совпадает и по одной только английской половине", () => {
    expect(isIconOfBlasphemyItem({ type: "mutation", name: "Icon of Blasphemy" })).toBe(true);
  });

  it("другой тип предмета — false, даже с тем же именем", () => {
    expect(isIconOfBlasphemyItem({ type: "trait", name: "Icon of Blasphemy / Икона Богохульства" })).toBe(false);
  });

  it("другое имя — false", () => {
    expect(isIconOfBlasphemyItem({ type: "mutation", name: "Illusion of Normality / Иллюзия Нормальности" })).toBe(false);
  });

  it("нет предмета — false", () => {
    expect(isIconOfBlasphemyItem(null)).toBe(false);
    expect(isIconOfBlasphemyItem(undefined)).toBe(false);
  });
});
