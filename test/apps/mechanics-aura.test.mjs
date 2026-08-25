// test/apps/mechanics-aura.test.mjs
//
// kind:"aura" — Конструктор МЕХАНИКА подключён к готовому движку живой ауры
// (module/regions/auras.mjs, wdbc-1pa.1). Сама запись ничего не эмбедит и не
// создаёт ActiveEffect — syncAuraFlag только настраивает
// flags.warhammer-dbc.aura предмета в формате, который движок читает живьём:
// {radius, affects, includesSelf, grant:[uuid,...]}. Пример из книги —
// «Аура Жизни» (Дар Слаанеш): Regeneration(1) себе И всем живым существам
// (в т.ч. врагам) в радиусе 3м.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyItemMechanics } from "../../module/apps/mechanics.mjs";

const FLAG = "warhammer-dbc";

const andGroup = (...entries) => ({ id: "g1", operator: "AND", entries });
const auraEntry = (id, { radius, affects = "allies", includesSelf = false, sourceUuid, rating = "", when = null } = {}) => ({
  id, kind: "aura", auraRadius: radius, auraAffects: affects, auraIncludesSelf: includesSelf,
  sourceUuid, sourceName: "Regeneration / Регенерация (X)", sourceImg: "icons/svg/aura.svg", rating, when
});

function itemOnActor({ mechanics = [], characteristics = {}, corruptionBonus = 0, aura = null } = {}) {
  const own = { mechanics, aura };
  const actor = new Actor();
  actor.system = { characteristics, corruptionBonus };
  actor.items = [];
  actor.createEmbeddedDocuments = async () => [];

  const item = {
    id: "item-1", type: "mutation", name: "Аура Жизни",
    system: { submutation: { label: "" } }, parent: actor, effects: [],
    getFlag: (_s, k) => own[k],
    setFlag: async (_s, k, v) => { own[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete own[k]; return true; },
    update: async () => item,
    createEmbeddedDocuments: async () => [],
    deleteEmbeddedDocuments: async () => []
  };
  return item;
}

beforeEach(() => {
  globalThis.game.user = { isGM: true };
  globalThis.game.packs = new Map();
});

describe("syncAuraFlag через applyItemMechanics", () => {
  it("Аура Жизни: радиус 3м, себя включает, союзникам — flags.aura настроен", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(auraEntry("e1", {
        radius: "3", affects: "all", includesSelf: true, rating: "1",
        sourceUuid: "Compendium.warhammer-dbc.traits.Item.6cf11ucGdzYt6ndt"
      }))]
    });
    await applyItemMechanics(item);
    expect(item.getFlag(FLAG, "aura")).toEqual({
      managed: true, radius: 3, affects: "all", includesSelf: true,
      grant: [{ uuid: "Compendium.warhammer-dbc.traits.Item.6cf11ucGdzYt6ndt", rating: 1 }]
    });
  });

  it("запись без rating — grant несёт rating:null (клонируем как есть)", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(auraEntry("e1", {
        radius: "3", sourceUuid: "Compendium.warhammer-dbc.traits.Item.x"
      }))]
    });
    await applyItemMechanics(item);
    expect(item.getFlag(FLAG, "aura").grant).toEqual([
      { uuid: "Compendium.warhammer-dbc.traits.Item.x", rating: null }
    ]);
  });

  it("радиус формулой (cor) считается по актору", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(auraEntry("e1", {
        radius: "cor", sourceUuid: "Compendium.warhammer-dbc.traits.Item.x"
      }))],
      corruptionBonus: 7
    });
    await applyItemMechanics(item);
    expect(item.getFlag(FLAG, "aura").radius).toBe(7);
  });

  it("без записей kind:aura — флаг не заводится", async () => {
    const item = itemOnActor({ mechanics: [] });
    await applyItemMechanics(item);
    expect(item.getFlag(FLAG, "aura")).toBeFalsy();
  });

  it("незавершённая запись (нет sourceUuid) не считается — флаг пуст", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(auraEntry("e1", { radius: "3", sourceUuid: "" }))]
    });
    await applyItemMechanics(item);
    expect(item.getFlag(FLAG, "aura")).toBeFalsy();
  });

  it("несколько записей kind:aura — grant собирается в один список, радиус/область у первой", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(
        auraEntry("e1", { radius: "5", affects: "enemies", sourceUuid: "Compendium.warhammer-dbc.traits.Item.a" }),
        auraEntry("e2", { radius: "9", affects: "all", sourceUuid: "Compendium.warhammer-dbc.traits.Item.b" })
      )]
    });
    await applyItemMechanics(item);
    const flag = item.getFlag(FLAG, "aura");
    expect(flag.radius).toBe(5);
    expect(flag.affects).toBe("enemies");
    expect(flag.grant).toEqual([
      { uuid: "Compendium.warhammer-dbc.traits.Item.a", rating: null },
      { uuid: "Compendium.warhammer-dbc.traits.Item.b", rating: null }
    ]);
  });

  it("флаг снимается, если записи kind:aura убрали из Механики", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(auraEntry("e1", { radius: "3", sourceUuid: "Compendium.warhammer-dbc.traits.Item.x" }))]
    });
    await applyItemMechanics(item);
    expect(item.getFlag(FLAG, "aura")).toBeTruthy();

    item.own = item.own; // no-op, readability
    await item.update({}); // имитация правки предмета
    // Очищаем Механику и прогоняем снова — та же живая пересинхронизация.
    item.getFlag = (_s, k) => (k === "mechanics" ? [] : (k === "aura" ? item.__aura : undefined));
    item.setFlag = async (_s, k, v) => { if (k === "aura") item.__aura = v; return v; };
    item.unsetFlag = async (_s, k) => { if (k === "aura") item.__aura = undefined; return true; };
    item.__aura = { managed: true, radius: 3, affects: "allies", includesSelf: false, grant: ["Compendium.warhammer-dbc.traits.Item.x"] };
    await applyItemMechanics(item);
    expect(item.getFlag(FLAG, "aura")).toBeFalsy();
  });

  it("ручной флаг (без managed) переживает синхронизацию без записей kind:aura", async () => {
    // Ауру, настроенную ГМом руками до Конструктора, снимать нельзя.
    const item = itemOnActor({ mechanics: [] });
    const manual = { radius: 5, affects: "allies", includesSelf: false, grant: ["Item.abc"] };
    item.getFlag = (_s, k) => (k === "mechanics" ? [] : (k === "aura" ? item.__aura : undefined));
    item.setFlag = async (_s, k, v) => { if (k === "aura") item.__aura = v; return v; };
    item.unsetFlag = async (_s, k) => { if (k === "aura") item.__aura = undefined; return true; };
    item.__aura = manual;
    await applyItemMechanics(item);
    expect(item.getFlag(FLAG, "aura")).toEqual(manual);
  });

  it("гейт when.submutations — аура включена только при своей строке", async () => {
    const item = itemOnActor({
      mechanics: [andGroup(auraEntry("e1", {
        radius: "3", sourceUuid: "Compendium.warhammer-dbc.traits.Item.x",
        when: { negate: false, conditions: [], submutations: ["4"], negateSub: false }
      }))]
    });
    await applyItemMechanics(item);
    expect(item.getFlag(FLAG, "aura")).toBeFalsy(); // субмутация ещё не выбрана

    item.system.submutation.label = "4";
    await applyItemMechanics(item);
    expect(item.getFlag(FLAG, "aura")).toBeTruthy();
  });
});
