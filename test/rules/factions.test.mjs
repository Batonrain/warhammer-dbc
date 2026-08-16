import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  indexFactions, factionChain, factionDepth,
  isSameOrDescendant, anySameOrDescendant, factionKey, factionKeyFromName, factionChildren,
  factionParentKey, factionAlsoKeys, factionAncestors, factionServants
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

// Двойная принадлежность: Караул Смерти по устройству — Астартес, по службе —
// Ордо Ксенос, и правило обязано доставать его с обеих сторон.
describe("дополнительные принадлежности (alsoIn)", () => {
  const map = indexFactions([
    { key: "imperium", name: "Империум" },
    { key: "adeptus-astartes", parent: "imperium", name: "Адептус Астартес" },
    { key: "inquisition", parent: "imperium", name: "Инквизиция" },
    { key: "ordo-xenos", parent: "inquisition", name: "Ордо Ксенос" },
    { key: "deathwatch", parent: "adeptus-astartes", alsoIn: ["ordo-xenos"], name: "Караул Смерти" }
  ]);

  it("читаются только строки, мусор отбрасывается", () => {
    expect(factionAlsoKeys({ system: { alsoIn: [" ordo-xenos ", "", 5, null] } })).toEqual(["ordo-xenos"]);
    expect(factionAlsoKeys({})).toEqual([]);
  });

  it("предки собираются по обеим линиям", () => {
    expect([...factionAncestors("deathwatch", map)].sort()).toEqual(
      ["adeptus-astartes", "deathwatch", "imperium", "inquisition", "ordo-xenos"]);
  });

  it("правило по службе срабатывает так же, как по составу", () => {
    expect(isSameOrDescendant("deathwatch", "adeptus-astartes", map)).toBe(true);
    expect(isSameOrDescendant("deathwatch", "inquisition", map)).toBe(true);
    expect(isSameOrDescendant("deathwatch", "ordo-xenos", map)).toBe(true);
  });

  it("отбор по-прежнему односторонний", () => {
    expect(isSameOrDescendant("ordo-xenos", "deathwatch", map)).toBe(false);
    expect(isSameOrDescendant("adeptus-astartes", "deathwatch", map)).toBe(false);
  });

  // Дерево обязано остаться деревом: схема происхождения и глубина идут по
  // основной линии, иначе лесенку пришлось бы превращать в граф.
  it("дерево и глубина считают только основную линию", () => {
    expect(factionChain("deathwatch", map)).toEqual(["deathwatch", "adeptus-astartes", "imperium"]);
    expect(factionDepth("deathwatch", map)).toBe(3);
  });

  it("служащие — обратная сторона связи, вассалами они не считаются", () => {
    expect(factionServants("ordo-xenos", map).map(f => f.name)).toEqual(["Караул Смерти"]);
    expect(factionChildren("ordo-xenos", map)).toEqual([]);
    expect(factionChildren("adeptus-astartes", map).map(f => f.key)).toEqual(["deathwatch"]);
  });

  it("кольцо из дополнительных ссылок обход не роняет", () => {
    const loop = indexFactions([
      { key: "a", alsoIn: ["b"] },
      { key: "b", alsoIn: ["a"] }
    ]);
    expect([...factionAncestors("a", loop)].sort()).toEqual(["a", "b"]);
  });
});

describe("factionParentKey", () => {
  it("читает ключ родителя у предмета и у литерала", () => {
    expect(factionParentKey({ system: { parent: "chaos" } })).toBe("chaos");
    expect(factionParentKey({ parent: " chaos " })).toBe("chaos");
  });

  // В старой записи в поле мог оказаться объект: строкой он превращается в
  // «[object Object]», и показывать это принадлежностью нельзя — сослаться на
  // такой ключ всё равно не на что.
  it("мусор вместо ключа считается пустотой", () => {
    expect(factionParentKey({ system: { parent: {} } })).toBe("");
    expect(factionParentKey({ system: { parent: "[object Object]" } })).toBe("");
    expect(factionParentKey({ system: { parent: null } })).toBe("");
    expect(factionParentKey(null)).toBe("");
  });

  it("такой родитель не строит цепочку", () => {
    const map = indexFactions([{ key: "orphan", parent: "[object Object]" }, f("chaos")]);
    expect(factionChain("orphan", map)).toEqual(["orphan"]);
  });
});

describe("factionChildren", () => {
  it("отдаёт только следующую ступень, без внуков", () => {
    expect(factionChildren("chaos", byKey).map(f => f.key)).toEqual(["traitor-legions"]);
    expect(factionChildren("traitor-legions", byKey).map(f => f.key)).toEqual(["word-bearers"]);
  });

  it("у листа дерева вассалов нет", () => {
    expect(factionChildren("word-bearers-host-6-company-3", byKey)).toEqual([]);
  });

  it("пустой ключ и неизвестная фракция дают пустой список", () => {
    expect(factionChildren("", byKey)).toEqual([]);
    expect(factionChildren("imperium", byKey)).toEqual([]);
  });

  // Порядок — по ПОДПИСИ, а не по ключу: список читает человек, и ключ у него
  // перед глазами не стоит.
  it("несколько вассалов идут по алфавиту подписей", () => {
    const map = indexFactions([
      f("traitor-legions", "chaos"),
      { key: "world-eaters",  parent: "traitor-legions", name: "Пожиратели Миров" },
      { key: "night-lords",   parent: "traitor-legions", name: "Повелители Ночи" },
      { key: "word-bearers",  parent: "traitor-legions", name: "Несущие Слово" }
    ]);
    expect(factionChildren("traitor-legions", map).map(f => f.name))
      .toEqual(["Несущие Слово", "Повелители Ночи", "Пожиратели Миров"]);
  });
});

describe("factionKeyFromName", () => {
  it("переводит русскую подпись в латинский ключ", () => {
    expect(factionKeyFromName("Несущие Слово")).toBe("nesuschie-slovo");
    expect(factionKeyFromName("Инквизиция")).toBe("inkviziciya");
  });

  it("латиница и цифры остаются как есть", () => {
    expect(factionKeyFromName("Word Bearers")).toBe("word-bearers");
    expect(factionKeyFromName("VI воинство")).toBe("vi-voinstvo");
  });

  it("знаки препинания и лишние пробелы схлопываются в один дефис", () => {
    expect(factionKeyFromName("  Легионы — предатели!  ")).toBe("legiony-predateli");
    // «ё» приравнена к «е»: ключ читается, а различать их незачем — он не
    // подпись, а идентификатор.
    expect(factionKeyFromName("Адептус Механикус / Тёмный")).toBe("adeptus-mehanikus-temnyi");
  });

  // Два узла с одним ключом означают потерянную ветку дерева: indexFactions
  // оставит первый и пожалуется, поэтому повтор разводится номером.
  it("занятый ключ получает номер", () => {
    expect(factionKeyFromName("Хаос", ["haos"])).toBe("haos-2");
    expect(factionKeyFromName("Хаос", ["haos", "haos-2"])).toBe("haos-3");
  });

  it("свободный ключ номера не получает", () => {
    expect(factionKeyFromName("Хаос", ["chaos", "imperium"])).toBe("haos");
  });

  it("от названия может ничего не остаться — тогда общий запасной ключ", () => {
    expect(factionKeyFromName("")).toBe("faction");
    expect(factionKeyFromName("«…»")).toBe("faction");
    expect(factionKeyFromName(null)).toBe("faction");
  });

  it("длинное название обрезается и не заканчивается дефисом", () => {
    const key = factionKeyFromName("Орден ".repeat(20));
    expect(key.length).toBeLessThanOrEqual(48);
    expect(key.endsWith("-")).toBe(false);
  });
});
