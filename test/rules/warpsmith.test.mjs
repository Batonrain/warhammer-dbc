
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  hasIronCage, hasWarpforgedPlate, hasSigilOfDominion, hasCellOfShame, hasEmpyreanWhip, hasForgeOfOne, hasRunDown,
  hasWarpsmithAbility, techUseTotal, daemonLoreTotal, commandOnIntTotal, cageThreshold, cellThreshold, whipThreshold,
  resistThreshold, cageRange, cageHours, brokenOf, isCaged, isBroken, cageFlag, cageMatured, brokenFlagMatured, holdsSigilFor,
  isBrokenFor, isBrokenBySmith, brokenAutoFail, demonNameMatches, findBrokenDominionTarget, sigilItemData, isCellDevice,
  cellFlag, cellBrokenFree, regenIntervalSeconds, regenPlan, runDownChanges, clampRoll, BROKEN_FLAG, SIGIL_FLAG, CELL_FLAG,
  RUN_DOWN_CHAR_KEYS
} from "../../module/rules/warpsmith.mjs";

const TRAITS = "packs-src/traits/Элитные_архетипы/Варп_Кузнец";
const TALENTS = "packs-src/talents/Элитные_архетипы/Варп_Кузнец";
const CAGE = packDocById(TRAITS, "mqxtrmWBRyXWJVbK");
const PLATE = packDocById(TRAITS, "gjtQQj1JT1qmI7r0");
const SIGIL = packDocById(TALENTS, "HomKz0NcpyFEF5VS");
const CELL = packDocById(TALENTS, "ChFKmUcfnSd12E8t");
const WHIP = packDocById(TALENTS, "uQd6TF9OQmWbwU9x");
const FORGE = packDocById(TALENTS, "R474RGCtmYO0eZQh");
const RUN = packDocById(TALENTS, "1O3S4uusfAoIFnNq");

const itemOf = (doc, flags = {}) => ({ type: doc.type, name: doc.name, flags: { ...doc.flags, "warhammer-dbc": { ...(doc.flags?.["warhammer-dbc"] ?? {}), ...flags } },
  getFlag: (s, k) => ({ ...(doc.flags?.[s] ?? {}), ...flags })[k] });

const actorOf = ({ uuid = "Actor.smith", name = "Кузнец", items = [], int = 50, intB = 5, wp = 40, wpB = 4, fel = 30, t = 50, tb = 5,
  techUse = 60, command = 35, lore = 55, flags = {} } = {}) => ({
  uuid, name, items,
  system: {
    characteristics: { int: { total: int, bonus: intB }, wp: { total: wp, bonus: wpB }, fel: { total: fel, bonus: 3 }, t: { total: t, bonus: tb } },
    skills: { techUse: { total: techUse }, command: { total: command } },
    groupSkills: { forbiddenLore: [{ specialty: "Daemons", rank: "known", total: lore }] }
  },
  getFlag: (s, k) => (s === "warhammer-dbc" ? flags[k] : undefined)
});

describe("опознание способностей", () => {
  it("каждая способность — по настоящей записи пака", () => {
    expect(hasIronCage(actorOf({ items: [itemOf(CAGE)] }))).toBe(true);
    expect(hasWarpforgedPlate(actorOf({ items: [itemOf(PLATE)] }))).toBe(true);
    expect(hasSigilOfDominion(actorOf({ items: [itemOf(SIGIL)] }))).toBe(true);
    expect(hasCellOfShame(actorOf({ items: [itemOf(CELL)] }))).toBe(true);
    expect(hasEmpyreanWhip(actorOf({ items: [itemOf(WHIP)] }))).toBe(true);
    expect(hasForgeOfOne(actorOf({ items: [itemOf(FORGE)] }))).toBe(true);
    expect(hasRunDown(actorOf({ items: [itemOf(RUN)] }))).toBe(true);
  });

  it("нет предмета — нет способности", () => {
    const plain = actorOf();
    expect(hasIronCage(plain)).toBe(false);
    expect(hasWarpsmithAbility(plain)).toBe(false);
    expect(hasWarpsmithAbility(actorOf({ items: [itemOf(RUN)] }))).toBe(true);
  });

  it("Запись Конструктора на предметах ведёт к ключу способности", () => {
    for (const [doc, key] of [[CAGE, "ability.ironCage"], [PLATE, "ability.warpforgedPlate"], [SIGIL, "ability.sigilOfDominion"],
      [CELL, "ability.cellOfShame"], [WHIP, "ability.empyreanWhip"], [FORGE, "ability.forgeOfOne"], [RUN, "ability.runDown"]]) {
      const keys = (doc.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries.map(e => e.capabilityKey));
      expect(keys).toContain(key);
    }
  });
});

describe("пороги тестов", () => {
  const smith = actorOf();

  it("Железная Клеть: Tech-Use−10 против W+0", () => {
    expect(techUseTotal(smith)).toBe(60);
    expect(cageThreshold(smith)).toBe(50);
    expect(cageThreshold(smith, -5)).toBe(45);
    expect(resistThreshold(actorOf({ wp: 62 }))).toBe(62);
    expect(resistThreshold(actorOf({ wp: 62 }), 10)).toBe(72);
  });

  it("нет Навыка Tech-Use — берётся Интеллект", () => {
    const a = actorOf({ int: 44 });
    delete a.system.skills.techUse;
    expect(techUseTotal(a)).toBe(44);
  });

  it("Ячейка Позора: For.Lore (Daemons)−20; нет Навыка — null", () => {
    expect(daemonLoreTotal(smith)).toBe(55);
    expect(cellThreshold(smith)).toBe(35);
    const none = actorOf();
    none.system.groupSkills = { forbiddenLore: [] };
    expect(cellThreshold(none)).toBeNull();
    expect(whipThreshold(none)).toBeNull();
  });

  it("Command(I): Command считается на Интеллекте вместо Товарищества", () => {
    expect(commandOnIntTotal(smith)).toBe(35 + 50 - 30);
  });

  it("Эмпирейная Плеть: наименьший из For.Lore−20 и Command(I)−10", () => {
    expect(whipThreshold(smith)).toBe(Math.min(55 - 20, 55 - 10));
    const weakLore = actorOf({ lore: 30 });
    expect(whipThreshold(weakLore)).toBe(10);
    const weakCommand = actorOf({ command: 10, lore: 80 });
    expect(whipThreshold(weakCommand)).toBe(Math.min(60, 10 + 50 - 30 - 10));
    expect(whipThreshold(smith, 5)).toBe(40);
  });

  it("дальность — I.b метров, срок — W.b демона часов (не меньше часа)", () => {
    expect(cageRange(smith)).toBe(5);
    expect(cageHours(actorOf({ wpB: 7 }))).toBe(7);
    expect(cageHours(actorOf({ wpB: 0 }))).toBe(1);
  });
});

describe("метка Сломленного", () => {
  const smith = actorOf();
  const demon = actorOf({ uuid: "Actor.demon", name: "Bloodletter / Кровопуск", wpB: 6 });

  it("клеть ставит срок W.b часов от момента", () => {
    const flag = cageFlag(smith, demon, 1000, ["Scene.s.Token.t.Actor.smith"]);
    expect(flag).toMatchObject({ smithUuid: "Actor.smith", state: "caged", since: 1000, until: 1000 + 6 * 3600, freeWill: false });
    expect(flag.smithUuids).toEqual(["Actor.smith", "Scene.s.Token.t.Actor.smith"]);
    expect(cageMatured(flag, 1000 + 6 * 3600 - 1)).toBe(false);
    expect(cageMatured(flag, 1000 + 6 * 3600)).toBe(true);
    expect(brokenFlagMatured(flag).state).toBe("broken");
  });

  it("созревшей клетью считается только заарканенный, не Сломленный и не пустая метка", () => {
    expect(cageMatured(null, 1e9)).toBe(false);
    expect(cageMatured({ state: "broken", until: 0 }, 1e9)).toBe(false);
  });

  it("чтение метки: caged / broken", () => {
    const caged = actorOf({ flags: { [BROKEN_FLAG]: { state: "caged", smithUuid: "Actor.smith" } } });
    const broken = actorOf({ flags: { [BROKEN_FLAG]: { state: "broken", smithUuid: "Actor.smith" } } });
    expect(isCaged(caged)).toBe(true);
    expect(isBroken(caged)).toBe(false);
    expect(isBroken(broken)).toBe(true);
    expect(brokenOf(actorOf())).toBeNull();
  });

  it("Сломлен для Кузнеца и для держателя Печати, но не для чужака и не пока заарканен", () => {
    const flag = { state: "broken", smithUuid: "Actor.smith", smithUuids: ["Actor.smith"] };
    const broken = actorOf({ uuid: "Actor.demon", flags: { [BROKEN_FLAG]: flag } });
    const caged = actorOf({ uuid: "Actor.demon", flags: { [BROKEN_FLAG]: { ...flag, state: "caged" } } });
    const stranger = actorOf({ uuid: "Actor.stranger", name: "Чужак" });
    const holder = actorOf({ uuid: "Actor.holder", name: "Держатель", items: [{ type: "gear", name: "Печать", getFlag: (s, k) => (k === SIGIL_FLAG ? { demonUuid: "Actor.demon" } : undefined) }] });
    expect(isBrokenFor(broken, smith)).toBe(true);
    expect(isBrokenBySmith(broken, smith)).toBe(true);
    expect(isBrokenFor(broken, holder)).toBe(true);
    expect(isBrokenBySmith(broken, holder)).toBe(false);
    expect(isBrokenFor(broken, stranger)).toBe(false);
    expect(isBrokenFor(caged, smith)).toBe(false);
  });

  it("Кузнец узнаётся и по другому uuid того же бойца (токен и мировой актор)", () => {
    const flag = { state: "broken", smithUuid: "Actor.smith", smithUuids: ["Actor.smith", "Scene.s.Token.t.Actor.smith"] };
    const broken = actorOf({ uuid: "Actor.demon", flags: { [BROKEN_FLAG]: flag } });
    const tokenSmith = { uuid: "Scene.s.Token.t.Actor.smith", name: "Кузнец", items: [] };
    expect(isBrokenFor(broken, tokenSmith, a => new Set([a.uuid]))).toBe(true);
  });

  it("автопровал встречного теста только по W", () => {
    const flag = { state: "broken", smithUuid: "Actor.smith" };
    const broken = actorOf({ uuid: "Actor.demon", flags: { [BROKEN_FLAG]: flag } });
    expect(brokenAutoFail(broken, smith, "wp")).toBe(true);
    expect(brokenAutoFail(broken, smith, "ws")).toBe(false);
    expect(brokenAutoFail(broken, actorOf({ uuid: "Actor.x" }), "wp")).toBe(false);
  });

  it("держатель Печати — только для того демона, с которым она связана", () => {
    const holder = actorOf({ uuid: "Actor.h", items: [{ type: "gear", name: "Печать", getFlag: (s, k) => (k === SIGIL_FLAG ? { demonUuid: "Actor.demon" } : undefined) }] });
    expect(holdsSigilFor(holder, demon)).toBe(true);
    expect(holdsSigilFor(holder, actorOf({ uuid: "Actor.other" }))).toBe(false);
  });
});

describe("имя демона в ритуале и поиск цели Владычества", () => {
  it("сопоставляет двуязычные имена по любой половине", () => {
    expect(demonNameMatches("Bloodletter / Кровопуск", "Кровопуск")).toBe(true);
    expect(demonNameMatches("Bloodletter / Кровопуск", "Bloodletter")).toBe(true);
    expect(demonNameMatches("Кровопуск", "Bloodletter / Кровопуск")).toBe(true);
    expect(demonNameMatches("Кровопуск", "Хорнгор")).toBe(false);
    expect(demonNameMatches("", "Кровопуск")).toBe(false);
  });

  it("находит Сломленного этим Кузнецом демона с таким именем среди кандидатов", () => {
    const smith = actorOf();
    const broken = (uuid, name, smithUuid = "Actor.smith") => actorOf({ uuid, name, flags: { [BROKEN_FLAG]: { state: "broken", smithUuid } } });
    const a = broken("Actor.a", "Bloodletter / Кровопуск");
    const b = broken("Actor.b", "Horror / Ужас", "Actor.other");
    const c = actorOf({ uuid: "Actor.c", name: "Кровопуск" });
    expect(findBrokenDominionTarget(smith, "Кровопуск", [c, b, a])).toBe(a);
    expect(findBrokenDominionTarget(smith, "Ужас", [a, b, c])).toBeNull();
    expect(findBrokenDominionTarget(smith, "Хорнгор", [a, b, c])).toBeNull();
  });
});

describe("Печать и Ячейка", () => {
  it("предмет Печати — снаряжение с флагом, имя экранировано", () => {
    const smith = actorOf({ name: "<b>Кузнец</b>" });
    const data = sigilItemData(smith, actorOf({ uuid: "Actor.demon", name: "Кровопуск" }));
    expect(data.type).toBe("gear");
    expect(data.name).toContain("Кровопуск");
    expect(data.flags["warhammer-dbc"][SIGIL_FLAG]).toEqual({ demonUuid: "Actor.demon", demonName: "Кровопуск", smithUuid: "Actor.smith" });
    expect(data.system.description).not.toContain("<b>Кузнец</b>");
    expect(data.system.description).toContain("&lt;b&gt;");
  });

  it("устройство с Ячейкой опознаётся по флагу", () => {
    expect(isCellDevice({ getFlag: (s, k) => (k === CELL_FLAG ? { demonUuid: "x" } : undefined) })).toBe(true);
    expect(isCellDevice({ getFlag: () => undefined })).toBe(false);
    expect(isCellDevice(null)).toBe(false);
  });

  it("вырвавшийся демон остаётся Сломленным со свободой воли", () => {
    expect(cellBrokenFree({ state: "broken", smithUuid: "s" })).toMatchObject({ state: "broken", freeWill: true });
    expect(cellFlag(actorOf(), actorOf({ uuid: "Actor.d", name: "Д" }), "Реактор")).toEqual({ demonUuid: "Actor.d", demonName: "Д", smithUuid: "Actor.smith", deviceName: "Реактор" });
  });
});

describe("регенерация Закалённых Варпом Лат", () => {
  it("раз в 20−T.b минут, не чаще раза в минуту", () => {
    expect(regenIntervalSeconds(actorOf({ tb: 5 }))).toBe(15 * 60);
    expect(regenIntervalSeconds(actorOf({ tb: 8 }))).toBe(12 * 60);
    expect(regenIntervalSeconds(actorOf({ tb: 25 }))).toBe(60);
  });

  it("план: целые тики лечат, остаток копится", () => {
    expect(regenPlan({ elapsed: 14 * 60, carry: 0, interval: 15 * 60, missing: 5 })).toEqual({ heal: 0, carry: 14 * 60 });
    expect(regenPlan({ elapsed: 60, carry: 14 * 60, interval: 15 * 60, missing: 5 })).toEqual({ heal: 1, carry: 0 });
    expect(regenPlan({ elapsed: 50 * 60, carry: 0, interval: 15 * 60, missing: 5 })).toEqual({ heal: 3, carry: 5 * 60 });
  });

  it("не лечит сверх недостающего и не копит, когда здоров", () => {
    expect(regenPlan({ elapsed: 600 * 60, carry: 0, interval: 15 * 60, missing: 2 })).toEqual({ heal: 2, carry: 0 });
    expect(regenPlan({ elapsed: 600 * 60, carry: 99, interval: 15 * 60, missing: 0 })).toEqual({ heal: 0, carry: 0 });
  });
});

describe("Загнать", () => {
  it("+30 ко всем десяти Характеристикам", () => {
    const changes = runDownChanges();
    expect(changes).toHaveLength(RUN_DOWN_CHAR_KEYS.length);
    expect(RUN_DOWN_CHAR_KEYS).toHaveLength(10);
    for (const c of changes) {
      expect(c).toMatchObject({ type: "add", value: 30 });
      expect(c.key).toMatch(/^system\.characteristics\.[a-z]+\.totalFx$/);
    }
  });

  it("расплата из сокета — только целые в потолке", () => {
    expect(clampRoll(30, 30)).toBe(30);
    expect(clampRoll(0, 5)).toBe(0);
    expect(clampRoll(31, 30)).toBeNull();
    expect(clampRoll(-1, 5)).toBeNull();
    expect(clampRoll("x", 5)).toBeNull();
    expect(clampRoll(2.5, 5)).toBe(2);
  });
});
