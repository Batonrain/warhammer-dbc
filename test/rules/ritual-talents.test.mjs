// Цена ритуала на карточке и Таланты Оккультиста (остаток Талантов, 20.11.2026).
import { describe, it, expect } from "vitest";
import { splitCostDice, warprodPick, ritualCostText, scapegoatFor, divineMaskGod, divineMaskSeconds,
         brainwashedAssistants, hasWarprod } from "../../module/rules/ritual-talents.mjs";

const T = name => ({ type: "talent", name });

describe("кубики в прозе цены", () => {
  it("находит 1d5 и 3d10, остальное — текст", () => {
    const p = splitCostDice("Все участники получают +1d5 Порчи и 3d10 урона в W.");
    expect(p.filter(x => x.formula).map(x => x.formula)).toEqual(["1d5", "3d10"]);
    expect(p.map(x => x.text ?? x.raw).join("")).toBe("Все участники получают +1d5 Порчи и 3d10 урона в W.");
  });
  it("модификатор после кубика и кириллическая д", () => {
    expect(splitCostDice("урон 2d10+5 в T").find(x => x.formula).formula).toBe("2d10+5");
    expect(splitCostDice("1д5 Усталости").find(x => x.formula).formula).toBe("1d5");
  });
  it("слова с «д» и числом не принимаются за кубики", () => {
    expect(splitCostDice("Ход 2, год 5").some(x => x.formula)).toBe(false);
  });
});

describe("Варпоотвод", () => {
  it("из двух берётся меньший", () => expect(warprodPick(17, 9)).toBe(9));
  it("опознаётся по имени", () => expect(hasWarprod({ items: [T("Warprod / Варпоотвод")] })).toBe(true));
});

describe("текст цены", () => {
  const item = { system: { cost: "Нет.", failureCost: "Ритуалист получает 1d5 Усталости." } };
  it("«Нет.» не показывается", () => expect(ritualCostText(item, true)).toBe(""));
  it("на провале — цена ошибки", () => expect(ritualCostText(item, false)).toMatch(/1d5/));
});

describe("Козёл Отпущения", () => {
  const a = { items: [T("Scapegoat / Козёл Отпущения")],
    flags: { "warhammer-dbc": { scapegoat: { ritualName: "Ритуал Крови", uuid: "A.x", name: "Раб" } } } };
  it("только для своего ритуала", () => {
    expect(scapegoatFor(a, "ритуал крови")?.name).toBe("Раб");
    expect(scapegoatFor(a, "Другой")).toBeNull();
  });
  it("без Таланта метка не действует", () => expect(scapegoatFor({ ...a, items: [] }, "Ритуал Крови")).toBeNull());
});

describe("Божественная Маска", () => {
  const a = { items: [T("Divine Mask / Божественная Маска")], system: { corruptionBonus: 3 },
    flags: { "warhammer-dbc": { divineMask: { god: "nurgle", until: 1000 } } } };
  it("действует до срока", () => {
    expect(divineMaskGod(a, 999)?.god).toBe("nurgle");
    expect(divineMaskGod(a, 1000)).toBeNull();
  });
  it("срок — Cor.b часов", () => expect(divineMaskSeconds(a)).toBe(3 * 3600));
});

describe("Промывка Мозгов", () => {
  it("добровольцы — ассистенты из списка промытых", () => {
    const a = { flags: { "warhammer-dbc": { brainwashed: [{ uuid: "A.1", name: "Жертва" }] } } };
    expect(brainwashedAssistants(a, [{ uuid: "A.1", name: "Жертва" }, { uuid: "A.2", name: "Другой" }]).map(x => x.name))
      .toEqual(["Жертва"]);
  });
});
