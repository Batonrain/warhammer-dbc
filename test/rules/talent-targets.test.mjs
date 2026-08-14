import { describe, it, expect } from "vitest";
import {
  factionTarget, actorTypeTarget, allTarget, sameTarget,
  addTarget, removeTargetAt, targetLabel, factionRefs
} from "../../module/rules/talent-targets.mjs";

const faction = (key, name = "Несущие Слово") => ({
  name, img: "icons/svg/aura.svg", system: { key }
});

describe("factionTarget", () => {
  it("собирает цель из предмета фракции, запоминая подпись и значок", () => {
    expect(factionTarget(faction("word-bearers"))).toEqual({
      kind: "faction", ref: "word-bearers", value: "",
      name: "Несущие Слово", img: "icons/svg/aura.svg"
    });
  });

  it("читает ключ и у литерала без system", () => {
    expect(factionTarget({ key: "chaos", name: "Хаос" }).ref).toBe("chaos");
  });

  it("без ключа цели нет — ссылаться не на что", () => {
    expect(factionTarget({ name: "Безымянная" })).toBeNull();
    expect(factionTarget(null)).toBeNull();
  });
});

describe("actorTypeTarget", () => {
  it("хранит тип и подпись отдельно", () => {
    expect(actorTypeTarget("vehicle", "Техника")).toMatchObject({
      kind: "actorType", value: "vehicle", name: "Техника", ref: ""
    });
  });

  it("без подписи показывает сам тип", () => {
    expect(actorTypeTarget("vehicle").name).toBe("vehicle");
  });

  it("пустой тип — не цель", () => {
    expect(actorTypeTarget("")).toBeNull();
  });
});

describe("sameTarget", () => {
  it("фракции сравниваются по ключу, а не по подписи", () => {
    const a = factionTarget(faction("word-bearers", "Несущие Слово"));
    const b = factionTarget(faction("word-bearers", "XVII легион"));
    expect(sameTarget(a, b)).toBe(true);
  });

  it("разные ключи — разные цели", () => {
    expect(sameTarget(factionTarget(faction("chaos")), factionTarget(faction("imperium")))).toBe(false);
  });

  it("виды не смешиваются", () => {
    expect(sameTarget(factionTarget(faction("chaos")), actorTypeTarget("vehicle"))).toBe(false);
  });

  it("«Все!» бывает только одно", () => {
    expect(sameTarget(allTarget(), allTarget())).toBe(true);
  });
});

describe("addTarget", () => {
  it("держит несколько целей разной природы в одном списке", () => {
    // «Hatred (Dark Mechanicum, Adeptus Mechanicus, Vehicles)» — один Талант.
    let list = [];
    list = addTarget(list, factionTarget(faction("dark-mechanicum", "Тёмный Механикум")));
    list = addTarget(list, factionTarget(faction("mechanicus", "Адептус Механикус")));
    list = addTarget(list, actorTypeTarget("vehicle", "Техника"));
    expect(list).toHaveLength(3);
    expect(list.map(t => t.kind)).toEqual(["faction", "faction", "actorType"]);
  });

  it("повтор не добавляется", () => {
    const t = factionTarget(faction("chaos"));
    expect(addTarget([t], factionTarget(faction("chaos")))).toHaveLength(1);
  });

  it("не меняет исходный список", () => {
    const list = [];
    addTarget(list, allTarget());
    expect(list).toHaveLength(0);
  });

  it("пустая цель ничего не ломает", () => {
    expect(addTarget([], null)).toEqual([]);
  });
});

describe("removeTargetAt", () => {
  const list = [factionTarget(faction("a", "A")), factionTarget(faction("b", "B"))];

  it("убирает по номеру", () => {
    expect(removeTargetAt(list, 0).map(t => t.ref)).toEqual(["b"]);
  });

  it("номер вне списка ничего не меняет", () => {
    expect(removeTargetAt(list, 5)).toHaveLength(2);
    expect(removeTargetAt(list, -1)).toHaveLength(2);
    expect(removeTargetAt(list, "нет")).toHaveLength(2);
  });
});

describe("targetLabel", () => {
  it("показывает подпись, а для «Все!» — своё слово", () => {
    expect(targetLabel(factionTarget(faction("chaos", "Хаос")))).toBe("Хаос");
    expect(targetLabel(actorTypeTarget("vehicle", "Техника"))).toBe("Техника");
    expect(targetLabel(allTarget())).toBe("Все!");
  });
});

describe("factionRefs", () => {
  it("берёт только фракции — дерево про остальные виды ничего не знает", () => {
    const list = [
      factionTarget(faction("chaos")), actorTypeTarget("vehicle"), allTarget()
    ];
    expect(factionRefs(list)).toEqual(["chaos"]);
  });
});
