import { describe, it, expect } from "vitest";
import {
  factionTarget, actorTypeTarget, allTarget, raceTarget, featureTarget, sameTarget,
  addTarget, removeTargetAt, targetLabel, factionRefs, targetMatches, anyTargetMatches,
  TARGET_FEATURES, patronTarget, actorPatronKey, PATRON_ANY
} from "../../module/rules/talent-targets.mjs";
import { indexFactions } from "../../module/rules/factions.mjs";

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

// Ненависть бывает не к организации, а к породе: «Hatred (Наги)» у Гарпии.
// Фракцией это не выразить — наг не вступает в наг, он ими рождается.
describe("raceTarget", () => {
  const map = indexFactions([]);
  const target = raceTarget("naga", "Нага");

  it("хранит ключ расы и подпись", () => {
    expect(target).toMatchObject({ kind: "race", value: "naga", name: "Нага", ref: "" });
  });

  it("без ключа цели нет", () => {
    expect(raceTarget("")).toBeNull();
    expect(raceTarget(null)).toBeNull();
  });

  it("срабатывает по расе актора цели", () => {
    expect(targetMatches(target, { targetActor: { system: { race: "naga" } } }, map)).toBe(true);
    expect(targetMatches(target, { targetActor: { system: { race: "human" } } }, map)).toBe(false);
  });

  // Ключи рас и субрас не пересекаются, поэтому одна цель проверяет оба поля:
  // «Ненависть к Париям» пишется так же, как «Ненависть к Нагам».
  it("срабатывает и по субрасе", () => {
    const pariah = raceTarget("pariah", "Пария");
    expect(targetMatches(pariah, { targetActor: { system: { race: "human", subrace: "pariah" } } }, map)).toBe(true);
    expect(targetMatches(pariah, { targetActor: { system: { race: "human" } } }, map)).toBe(false);
  });

  it("без цели броска не срабатывает", () => {
    expect(targetMatches(target, {}, map)).toBe(false);
  });

  it("цели соединены через «или»: раса рядом с фракцией", () => {
    const targets = [factionTarget(faction("word-bearers")), target];
    expect(anyTargetMatches(targets, { targetActor: { system: { race: "naga" }, items: [] } }, map)).toBe(true);
  });

  it("две расы различаются, одинаковые — нет", () => {
    expect(sameTarget(target, raceTarget("naga", "Другая подпись"))).toBe(true);
    expect(sameTarget(target, raceTarget("harpy"))).toBe(false);
    expect(sameTarget(target, actorTypeTarget("naga"))).toBe(false);
  });
});

// «Hatred (Psykers)» — не про организацию и не про породу, а про свойство.
describe("featureTarget", () => {
  const map = indexFactions([]);
  const psyker = featureTarget("psyker");

  it("берёт подпись из реестра, а не из вызова", () => {
    expect(psyker).toMatchObject({ kind: "feature", value: "psyker", name: TARGET_FEATURES.psyker.label });
  });

  it("незнакомый признак целью не становится", () => {
    expect(featureTarget("несуществующий")).toBeNull();
    expect(featureTarget("")).toBeNull();
  });

  it("срабатывает по полю листа", () => {
    expect(targetMatches(psyker, { targetActor: { system: { isPsyker: true } } }, map)).toBe(true);
    expect(targetMatches(psyker, { targetActor: { system: { isPsyker: false } } }, map)).toBe(false);
    expect(targetMatches(psyker, { targetActor: { system: {} } }, map)).toBe(false);
  });

  it("каждый признак реестра проверяет своё поле", () => {
    expect(targetMatches(featureTarget("possessed"), { targetActor: { system: { possessed: true } } }, map)).toBe(true);
    expect(targetMatches(featureTarget("techpriest"), { targetActor: { system: { isTechpriest: true } } }, map)).toBe(true);
    expect(targetMatches(featureTarget("rogueTrader"), { targetActor: { system: { isRogueTrader: true } } }, map)).toBe(true);
    // Признаки не путаются между собой.
    expect(targetMatches(featureTarget("possessed"), { targetActor: { system: { isPsyker: true } } }, map)).toBe(false);
  });

  it("без цели броска не срабатывает", () => {
    expect(targetMatches(psyker, {}, map)).toBe(false);
  });

  it("у каждого признака реестра есть подпись и проверка", () => {
    for (const [key, def] of Object.entries(TARGET_FEATURES)) {
      expect(def.label, key).toBeTruthy();
      expect(typeof def.test, key).toBe("function");
      expect(def.test(undefined), key).toBe(false);
    }
  });
});

// «Hatred (Khorne)» — не фракция: кхорнит из легиона и кхорнит-культист не
// состоят вместе нигде, кроме самого покровительства.
describe("patronTarget", () => {
  const map = indexFactions([]);
  const khorne = patronTarget("khorne", "Кхорн");
  const любой = patronTarget(PATRON_ANY);

  const демон = (key) => ({ type: "daemon", system: { allegiance: key } });
  const хаосит = (key) => ({ type: "character", system: { alignment: "heretic", patronGod: key } });
  const лоялист = () => ({ type: "character", system: { alignment: "loyalist", patronGod: "undivided" } });

  it("хранит ключ бога и подпись", () => {
    expect(khorne).toMatchObject({ kind: "patron", value: "khorne", name: "Кхорн" });
    expect(любой.name).toBe("Любой покровитель");
    expect(patronTarget("")).toBeNull();
  });

  it("срабатывает на демона и на хаосита с тем же покровителем", () => {
    expect(targetMatches(khorne, { targetActor: демон("khorne") }, map)).toBe(true);
    expect(targetMatches(khorne, { targetActor: хаосит("khorne") }, map)).toBe(true);
  });

  it("чужой бог не подходит", () => {
    expect(targetMatches(khorne, { targetActor: демон("nurgle") }, map)).toBe(false);
    expect(targetMatches(khorne, { targetActor: хаосит("tzeentch") }, map)).toBe(false);
  });

  // В схеме персонажа patronGod по умолчанию «Неделимый» у КАЖДОГО, поэтому
  // покровитель читается только при хаоситском мировоззрении — иначе Ненависть
  // к Неделимому срабатывала бы на всю Гвардию.
  it("у лоялиста покровителя нет, хотя поле заполнено", () => {
    expect(actorPatronKey(лоялист())).toBe("");
    expect(targetMatches(любой, { targetActor: лоялист() }, map)).toBe(false);
    expect(targetMatches(patronTarget("undivided", "Неделимый"), { targetActor: лоялист() }, map)).toBe(false);
  });

  it("«любой покровитель» ловит всякого, у кого он есть", () => {
    expect(targetMatches(любой, { targetActor: демон("slaanesh") }, map)).toBe(true);
    expect(targetMatches(любой, { targetActor: хаосит("undivided") }, map)).toBe(true);
    expect(targetMatches(любой, { targetActor: { system: {} } }, map)).toBe(false);
    expect(targetMatches(любой, {}, map)).toBe(false);
  });

  it("покровители различаются между собой и не путаются с признаком", () => {
    expect(sameTarget(khorne, patronTarget("khorne", "иначе подписан"))).toBe(true);
    expect(sameTarget(khorne, patronTarget("nurgle"))).toBe(false);
    expect(sameTarget(khorne, featureTarget("psyker"))).toBe(false);
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
