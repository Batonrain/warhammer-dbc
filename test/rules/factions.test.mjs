import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  indexFactions, factionChain, factionDepth,
  isSameOrDescendant, anySameOrDescendant, factionKey
} from "../../module/rules/factions.mjs";

/**
 * Подставная фракция — обычный литерал, никакого Foundry. Ровно то дерево,
 * что лежит затравкой в packs-src/factions: Хаос → Легионы-предатели →
 * Несущие Слово → VI воинство → III рота.
 */
const f = (key, parent = "") => ({ key, parent });

const TREE = [
  f("chaos"),
  f("traitor-legions", "chaos"),
  f("word-bearers", "traitor-legions"),
  f("word-bearers-host-6", "word-bearers"),
  f("word-bearers-host-6-company-3", "word-bearers-host-6")
];

const byKey = indexFactions(TREE);

let errors;
beforeEach(() => { errors = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { errors.mockRestore(); });

describe("factionKey", () => {
  it("читает ключ и у литерала, и у предмета Foundry", () => {
    expect(factionKey({ key: "chaos" })).toBe("chaos");
    expect(factionKey({ system: { key: "chaos" } })).toBe("chaos");
  });

  it("нет ключа — пустая строка, а не undefined", () => {
    expect(factionKey({})).toBe("");
    expect(factionKey(null)).toBe("");
  });
});

describe("indexFactions", () => {
  it("собирает карту по ключам", () => {
    expect(byKey.size).toBe(5);
    expect(byKey.get("word-bearers").parent).toBe("traitor-legions");
  });

  it("запись без ключа пропускается", () => {
    expect(indexFactions([{ parent: "chaos" }]).size).toBe(0);
  });

  it("повтор ключа: побеждает первая запись и есть жалоба", () => {
    const map = indexFactions([f("chaos"), { key: "chaos", parent: "другое" }]);
    expect(map.size).toBe(1);
    expect(map.get("chaos").parent).toBe("");
    expect(errors).toHaveBeenCalled();
  });
});

describe("factionChain", () => {
  it("от роты до корня — все пять уровней по порядку", () => {
    expect(factionChain("word-bearers-host-6-company-3", byKey)).toEqual([
      "word-bearers-host-6-company-3",
      "word-bearers-host-6",
      "word-bearers",
      "traitor-legions",
      "chaos"
    ]);
  });

  it("у корня цепочка из него одного", () => {
    expect(factionChain("chaos", byKey)).toEqual(["chaos"]);
  });

  it("неизвестный ключ — пустая цепочка", () => {
    expect(factionChain("нет-такой", byKey)).toEqual([]);
    expect(factionChain("", byKey)).toEqual([]);
  });

  it("ссылка на незаведённую фракцию просто обрывает цепочку, без жалобы", () => {
    const map = indexFactions([f("рота", "воинство-которого-нет")]);
    expect(factionChain("рота", map)).toEqual(["рота"]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("цикл не вешает обход и жалуется", () => {
    const map = indexFactions([f("a", "b"), f("b", "a")]);
    expect(factionChain("a", map)).toEqual(["a", "b"]);
    expect(errors).toHaveBeenCalled();
  });

  it("работает и на предметах Foundry, где ключи лежат в system", () => {
    const map = indexFactions([
      { system: { key: "chaos", parent: "" } },
      { system: { key: "word-bearers", parent: "chaos" } }
    ]);
    expect(factionChain("word-bearers", map)).toEqual(["word-bearers", "chaos"]);
  });
});

describe("factionDepth", () => {
  it("корень — 1, рота — 5", () => {
    expect(factionDepth("chaos", byKey)).toBe(1);
    expect(factionDepth("word-bearers-host-6-company-3", byKey)).toBe(5);
  });

  it("неизвестной фракции — 0", () => {
    expect(factionDepth("нет-такой", byKey)).toBe(0);
  });
});

describe("isSameOrDescendant", () => {
  it("сама фракция подходит под себя", () => {
    expect(isSameOrDescendant("word-bearers", "word-bearers", byKey)).toBe(true);
  });

  it("потомок подходит под предка: Ненависть к Хаосу достаёт роту", () => {
    expect(isSameOrDescendant("word-bearers-host-6-company-3", "chaos", byKey)).toBe(true);
  });

  it("предок НЕ подходит под потомка: Ненависть к роте не достаёт весь Хаос", () => {
    expect(isSameOrDescendant("chaos", "word-bearers-host-6-company-3", byKey)).toBe(false);
  });

  it("соседняя ветка не подходит", () => {
    const map = indexFactions([...TREE, f("world-eaters", "traitor-legions")]);
    expect(isSameOrDescendant("world-eaters", "word-bearers", map)).toBe(false);
    expect(isSameOrDescendant("world-eaters", "traitor-legions", map)).toBe(true);
  });

  it("пустая искомая фракция не подходит никому", () => {
    expect(isSameOrDescendant("chaos", "", byKey)).toBe(false);
  });
});

describe("anySameOrDescendant", () => {
  it("подходит, если подошла хоть одна фракция актора", () => {
    expect(anySameOrDescendant(["империум", "word-bearers"], "chaos", byKey)).toBe(true);
  });

  it("не подходит, если не подошла ни одна", () => {
    expect(anySameOrDescendant(["империум"], "chaos", byKey)).toBe(false);
    expect(anySameOrDescendant([], "chaos", byKey)).toBe(false);
  });
});
