import { describe, it, expect } from "vitest";
import {
  ROSTER_BLOCKS, blockForActorType, factionItemOf, groupRoster
} from "../../module/apps/faction-roster.mjs";

/** Подставной актор с предметами-фракциями: литерал, никакого Foundry. */
const actor = (name, type, keys = []) => ({
  uuid: `Actor.${name}`, name, type, img: `${name}.webp`,
  items: keys.map((key, i) => ({ id: `it${i}`, type: "faction", system: { key } }))
});

const world = [
  actor("Кор", "character", ["chaos"]),
  actor("Демон", "daemon", ["chaos"]),
  actor("Принц", "demonPrince", ["chaos"]),
  actor("Отряд", "squad", ["chaos"]),
  actor("Часть", "formation", ["chaos"]),
  actor("Орда", "horde", ["chaos"]),
  actor("Танк", "vehicle", ["chaos"]),
  actor("Крейсер", "ship", ["chaos"]),
  actor("Система", "starSystem", ["chaos"]),
  actor("Чужой", "character", ["imperium"]),
  actor("Ничей", "character", [])
];

describe("блоки состава", () => {
  it("каждый тип актора попадает ровно в один блок", () => {
    const seen = ROSTER_BLOCKS.flatMap(b => b.types || []);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("типы разложены по блокам как в задаче", () => {
    expect(blockForActorType("character").key).toBe("lights");
    expect(blockForActorType("demonPrince").key).toBe("lights");
    expect(blockForActorType("horde").key).toBe("troops");
    expect(blockForActorType("vehicle").key).toBe("garage");
    expect(blockForActorType("ship").key).toBe("fleet");
    expect(blockForActorType("starSystem").key).toBe("domains");
  });

  it("неизвестный тип не попадает никуда", () => {
    expect(blockForActorType("unknown")).toBeNull();
    expect(blockForActorType(undefined)).toBeNull();
  });

  // Вассалы — единственный блок не про акторов: там нижестоящие фракции.
  it("блок вассалов собирает фракции, а не акторов", () => {
    expect(ROSTER_BLOCKS.find(b => b.key === "vassals").faction).toBe(true);
  });
});

describe("factionItemOf", () => {
  it("находит предмет-принадлежность по ключу", () => {
    expect(factionItemOf(actor("Кор", "character", ["chaos"]), "chaos").id).toBe("it0");
  });

  it("чужая фракция и пустой актор не считаются", () => {
    expect(factionItemOf(actor("Кор", "character", ["imperium"]), "chaos")).toBeNull();
    expect(factionItemOf(null, "chaos")).toBeNull();
  });
});

describe("groupRoster", () => {
  const children = [
    { uuid: "Compendium.f.2", name: "Легионы-предатели", img: "l.webp", system: { key: "traitor-legions" } }
  ];
  const roster = groupRoster("chaos", world, children, t => `тип:${t}`);

  it("персонажи, демоны и принцы идут в Светочей", () => {
    expect(roster.lights.map(m => m.name)).toEqual(["Демон", "Кор", "Принц"]);
  });

  it("отряды, части и орды — в Войска", () => {
    expect(roster.troops.map(m => m.name)).toEqual(["Орда", "Отряд", "Часть"]);
  });

  it("техника, корабли и небесные тела — по своим блокам", () => {
    expect(roster.garage.map(m => m.name)).toEqual(["Танк"]);
    expect(roster.fleet.map(m => m.name)).toEqual(["Крейсер"]);
    expect(roster.domains.map(m => m.name)).toEqual(["Система"]);
  });

  it("вассалы приходят отдельным списком, а не из акторов", () => {
    expect(roster.vassals.map(m => m.name)).toEqual(["Легионы-предатели"]);
    expect(roster.vassals[0].key).toBe("traitor-legions");
  });

  it("чужая фракция и актор без принадлежности в состав не попадают", () => {
    const names = Object.values(roster).flat().map(m => m.name);
    expect(names).not.toContain("Чужой");
    expect(names).not.toContain("Ничей");
  });

  // Строка состава должна уметь снять принадлежность, а для этого ей нужен
  // id того самого предмета на акторе.
  it("строка помнит предмет-принадлежность и подпись типа", () => {
    expect(roster.lights[1]).toMatchObject({ name: "Кор", itemId: "it0", typeLabel: "тип:character" });
  });

  it("без ключа состав пуст, но блоки на месте", () => {
    const empty = groupRoster("", world, children);
    expect(Object.keys(empty)).toEqual(ROSTER_BLOCKS.map(b => b.key));
    expect(Object.values(empty).flat()).toEqual([]);
  });
});
