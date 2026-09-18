// test/apps/wrapped-in-chaos.test.mjs
//
// Wrapped in Chaos/Укутанный в Хаос (wdbc-1rno) — Группа A: "4-5" Дымовая
// Завеса. placeSmokeZone (Foundry Region-размещение, интерактивно) мокается
// модулем — реального canvas.regions в тестовой заглушке нет, как и у
// существующего вызова этого же примитива в hooks.mjs (там тоже не тестируется).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../../module/regions/difficult-terrain.mjs", async (importOriginal) => ({
  ...(await importOriginal()),
  placeSmokeZone: vi.fn(),
  getTerrainInfoForToken: vi.fn()
}));

const { placeSmokeZone, getTerrainInfoForToken } = await import("../../module/regions/difficult-terrain.mjs");
const { activateWrappedInChaos, sweepSweetMistExpiry, useStabilizeRealityRending, stabilizeRealityRendingButtonHtml } =
  await import("../../module/apps/wrapped-in-chaos.mjs");

function makeActor(name = "Носитель", { items = [], wounds = { value: 10, max: 20 } } = {}) {
  const flags = {};
  const actor = {
    name, items,
    system: { wounds: { ...wounds } },
    getFlag: (ns, key) => flags[key],
    setFlag: async (ns, key, value) => { flags[key] = value; },
    update: async data => {
      for (const [path, v] of Object.entries(data)) {
        const parts = path.split(".");
        let node = actor;
        for (const p of parts.slice(0, -1)) node = (node[p] ??= {});
        node[parts.at(-1)] = v;
      }
    }
  };
  return actor;
}
function makeItem(submutationLabel = "") {
  const flags = {};
  return {
    name: "Wrapped in Chaos / Укутанный в Хаос", type: "mutation", system: { submutation: { label: submutationLabel } },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; }
  };
}
function makeWeapon(id, name, weaponProps = []) {
  const flags = {};
  const weapon = {
    id, name, type: "weapon", system: { weaponClass: "melee", weaponProps: weaponProps.map(p => ({ ...p })) },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    update: async data => { if (data["system.weaponProps"]) weapon.system.weaponProps = data["system.weaponProps"]; }
  };
  return weapon;
}

beforeEach(() => {
  resetCaptured();
  placeSmokeZone.mockReset();
  getTerrainInfoForToken.mockReset();
  getTerrainInfoForToken.mockReturnValue({ inTerrain: false, props: [], extraMod: 0 });
});
afterEach(() => { globalThis.canvas = {}; delete globalThis.game.combat; });

describe("activateWrappedInChaos — диспетчер", () => {
  it("субмутация ещё не брошена — предупреждает", async () => {
    await activateWrappedInChaos(makeActor(), makeItem(""));
    expect(captured.warnings.at(-1)).toContain("не брошена");
  });

  it("субмутация без кода (напр. «9» Рассечение Реальности) — честное предупреждение", async () => {
    await activateWrappedInChaos(makeActor(), makeItem("9"));
    expect(captured.warnings.at(-1)).toContain("пока не подключена");
  });
});

describe("Дымовая Завеса (\"4-5\")", () => {
  it("размещает шаблон Smoke(5), постит карточку", async () => {
    placeSmokeZone.mockResolvedValue({ name: "Дымовая Завеса" });
    await activateWrappedInChaos(makeActor(), makeItem("4-5"));

    expect(placeSmokeZone).toHaveBeenCalledTimes(1);
    expect(placeSmokeZone.mock.calls[0][1]).toBe("Дымовая Завеса");
    expect(captured.chat.at(-1).content).toContain("Smoke(5)");
  });

  it("отменённое размещение (null) — карточка не постится", async () => {
    placeSmokeZone.mockResolvedValue(null);
    await activateWrappedInChaos(makeActor(), makeItem("4-5"));
    expect(captured.chat).toHaveLength(0);
  });
});

describe("Осквернённый Клинок (\"10\")", () => {
  it("нет рукопашного оружия — предупреждает", async () => {
    const actor = makeActor("Носитель", { items: [] });
    await activateWrappedInChaos(actor, makeItem("10"));
    expect(captured.warnings.at(-1)).toContain("нет рукопашного оружия");
  });

  it("наносит 1 непоглощ. урона себе, даёт Tainted выбранному оружию", async () => {
    const sword = makeWeapon("w1", "Меч", []);
    const actor = makeActor("Носитель", { items: [sword], wounds: { value: 10, max: 20 } });

    const promise = activateWrappedInChaos(actor, makeItem("10"));
    await captured.press("ok", { querySelector: sel => sel === "#ooc-blade" ? { value: "w1" } : null });
    await promise;

    expect(actor.system.wounds.value).toBe(9);
    expect(sword.system.weaponProps.map(p => p.key)).toEqual(["tainted"]);
    expect(sword.getFlag("warhammer-dbc", "wrappedInChaosTaintedAdded")).toBe(true);
  });

  it("оружие уже несёт Tainted — не дублирует свойство, урон всё равно наносится", async () => {
    const sword = makeWeapon("w1", "Осквернённый Меч", [{ key: "tainted" }]);
    const actor = makeActor("Носитель", { items: [sword] });

    const promise = activateWrappedInChaos(actor, makeItem("10"));
    await captured.press("ok", { querySelector: sel => sel === "#ooc-blade" ? { value: "w1" } : null });
    await promise;

    expect(sword.system.weaponProps.map(p => p.key)).toEqual(["tainted"]);
    expect(actor.system.wounds.value).toBe(9);
  });

  it("отмена диалога — ни урона, ни свойства", async () => {
    const sword = makeWeapon("w1", "Меч", []);
    const actor = makeActor("Носитель", { items: [sword] });

    const promise = activateWrappedInChaos(actor, makeItem("10"));
    await captured.press("cancel", { querySelector: () => null });
    await promise;

    expect(actor.system.wounds.value).toBe(10);
    expect(sword.system.weaponProps).toEqual([]);
  });
});

describe("Тень (\"1\") — телепорт в облако, только в темноте, раз в Раунд", () => {
  function makeTokenDoc(x = 0, y = 0) {
    const doc = {
      x, y, width: 1, height: 1, parent: {},
      update: async data => { Object.assign(doc, data); }
    };
    return doc;
  }
  function stubCanvas({ placedPoint = { x: 500, y: 0 }, gridSize = 100 } = {}) {
    globalThis.canvas = {
      ready: true,
      grid: { size: gridSize },
      regions: {
        placeRegion: async () => ({
          shapes: [{ x: placedPoint.x, y: placedPoint.y }],
          delete: async () => {}
        })
      }
    };
  }

  it("не в темноте — предупреждает, токен не двигается", async () => {
    getTerrainInfoForToken.mockReturnValue({ inTerrain: false, props: [], extraMod: 0 });
    stubCanvas();
    const actor = makeActor();
    const tokenDoc = makeTokenDoc();
    await activateWrappedInChaos(actor, makeItem("1"), tokenDoc);

    expect(captured.warnings.at(-1)).toContain("не в темноте");
    expect(tokenDoc.x).toBe(0);
  });

  it("в темноте, точка в радиусе — телепортирует токен (центр совмещён с точкой)", async () => {
    getTerrainInfoForToken.mockReturnValue({ inTerrain: true, props: [{ key: "dark", label: "Тьма", mod: -10 }], extraMod: -10 });
    // grid.size=100 → 1м = 100px; точка (500,0) от токена (0,0, центр 50,50) — 4.5м, в радиусе 10м.
    stubCanvas({ placedPoint: { x: 500, y: 0 } });
    const actor = makeActor();
    const tokenDoc = makeTokenDoc(0, 0);
    await activateWrappedInChaos(actor, makeItem("1"), tokenDoc);

    expect(tokenDoc.x).toBe(450); // 500 − ширина(1×100)/2
    expect(tokenDoc.y).toBe(-50);
    expect(captured.chat.at(-1).content).toContain("клубы дыма");
  });

  it("точка дальше 10м — предупреждает, не двигает токен", async () => {
    getTerrainInfoForToken.mockReturnValue({ inTerrain: true, props: [{ key: "dark", label: "Тьма", mod: -10 }], extraMod: -10 });
    stubCanvas({ placedPoint: { x: 2000, y: 0 } }); // 20м
    const actor = makeActor();
    const tokenDoc = makeTokenDoc(0, 0);
    await activateWrappedInChaos(actor, makeItem("1"), tokenDoc);

    expect(captured.warnings.at(-1)).toContain("вне облака");
    expect(tokenDoc.x).toBe(0);
  });

  it("отменённое размещение точки (null) — ничего не происходит", async () => {
    getTerrainInfoForToken.mockReturnValue({ inTerrain: true, props: [{ key: "dark", label: "Тьма", mod: -10 }], extraMod: -10 });
    globalThis.canvas = { ready: true, grid: { size: 100 }, regions: { placeRegion: async () => null } };
    const actor = makeActor();
    const tokenDoc = makeTokenDoc(0, 0);
    await activateWrappedInChaos(actor, makeItem("1"), tokenDoc);

    expect(tokenDoc.x).toBe(0);
    expect(captured.chat).toHaveLength(0);
  });

  it("второй раз в том же Раунде — предупреждает («раз в Ход»)", async () => {
    getTerrainInfoForToken.mockReturnValue({ inTerrain: true, props: [{ key: "dark", label: "Тьма", mod: -10 }], extraMod: -10 });
    stubCanvas({ placedPoint: { x: 500, y: 0 } });
    globalThis.game.combat = { round: 3 };
    const actor = makeActor();
    const tokenDoc = makeTokenDoc(0, 0);

    await activateWrappedInChaos(actor, makeItem("1"), tokenDoc);
    expect(captured.chat).toHaveLength(1);

    await activateWrappedInChaos(actor, makeItem("1"), tokenDoc);
    expect(captured.warnings.at(-1)).toContain("раз в Ход");
    expect(captured.chat).toHaveLength(1); // второй раз не сработал
  });

  it("нет токена на сцене — предупреждает", async () => {
    const actor = makeActor();
    await activateWrappedInChaos(actor, makeItem("1"), null);
    expect(captured.warnings.at(-1)).toContain("нет токена");
  });
});

function gasMask(equipped = true) {
  return { type: "gear", name: "Gas Mask / Противогаз", system: { equipped, gearCategory: "head" } };
}
function tokenOf(actor, x, y) {
  return { id: actor.name, hidden: false, actor, x, y, width: 1, height: 1 };
}
function sceneOf(tokens) {
  const grid = { size: 100, distance: 1, type: 0 };
  const parent = { tokens: Object.assign(tokens.slice(), { contents: tokens }), grid };
  for (const t of tokens) t.parent = parent;
  return parent;
}

describe("Сладкий Туман (\"6\") — газ радиусом 3м, снимок в момент активации", () => {
  afterEach(() => { delete globalThis.game.time; delete globalThis.game.actors; });

  it("вдыхает Туман — Состояние + срок истечения worldTime+3ч", async () => {
    Object.assign(globalThis.game, { time: { worldTime: 1000 } });
    const actor = makeActor("Носитель");
    await activateWrappedInChaos(actor, makeItem("6"), null);

    expect(actor.system.conditions.sweetMist).toBe(true);
    expect(actor.system.conditions.sweetMistExpiresAt).toBe(1000 + 3 * 3600);
    expect(captured.chat.at(-1).content).toContain("Сладкий Туман");
  });

  it("Респиратор/Противогаз — иммунитет, Состояние не ставится", async () => {
    Object.assign(globalThis.game, { time: { worldTime: 0 } });
    const actor = makeActor("Носитель", { items: [gasMask()] });
    await activateWrappedInChaos(actor, makeItem("6"), null);

    expect(actor.system.conditions?.sweetMist).toBeUndefined();
    expect(captured.chat.at(-1).content).toContain("защищены");
  });

  it("несколько целей в радиусе — все затронуты, кроме защищённого противогазом", async () => {
    Object.assign(globalThis.game, { time: { worldTime: 0 } });
    const caster = makeActor("Кастер");
    const near = makeActor("Рядом");
    const protected_ = makeActor("Защищённый", { items: [gasMask()] });
    const casterToken = tokenOf(caster, 0, 0);
    const nearToken = tokenOf(near, 0, 0);
    const protectedToken = tokenOf(protected_, 0, 0);
    sceneOf([casterToken, nearToken, protectedToken]);

    await activateWrappedInChaos(caster, makeItem("6"), casterToken);

    expect(caster.system.conditions.sweetMist).toBe(true);
    expect(near.system.conditions.sweetMist).toBe(true);
    expect(protected_.system.conditions?.sweetMist).toBeUndefined();
  });
});

describe("sweepSweetMistExpiry", () => {
  afterEach(() => { delete globalThis.game.actors; delete globalThis.game.users; delete globalThis.game.user; });

  it("основной ГМ снимает истёкшее Состояние", async () => {
    const actor = makeActor("Носитель");
    actor.system.conditions = { sweetMist: true, sweetMistExpiresAt: 1000 };
    Object.assign(globalThis.game, { actors: [actor], users: { activeGM: { id: "gm1" } }, user: { id: "gm1" } });

    await sweepSweetMistExpiry(1500);

    expect(actor.system.conditions.sweetMist).toBe(false);
    expect(actor.system.conditions.sweetMistExpiresAt).toBe(0);
  });

  it("срок ещё не истёк — не трогает", async () => {
    const actor = makeActor("Носитель");
    actor.system.conditions = { sweetMist: true, sweetMistExpiresAt: 2000 };
    Object.assign(globalThis.game, { actors: [actor], users: { activeGM: { id: "gm1" } }, user: { id: "gm1" } });

    await sweepSweetMistExpiry(1500);

    expect(actor.system.conditions.sweetMist).toBe(true);
  });

  it("не основной ГМ (другой клиент) — ничего не делает", async () => {
    const actor = makeActor("Носитель");
    actor.system.conditions = { sweetMist: true, sweetMistExpiresAt: 1000 };
    Object.assign(globalThis.game, { actors: [actor], users: { activeGM: { id: "gm1" } }, user: { id: "player1" } });

    await sweepSweetMistExpiry(1500);

    expect(actor.system.conditions.sweetMist).toBe(true); // не тронуто — не тот клиент
  });
});

describe("useStabilizeRealityRending / stabilizeRealityRendingButtonHtml", () => {
  afterEach(() => { delete globalThis.game.actors; });

  it("не «Рассечение Реальности» — кнопка пустая, действие ничего не делает", async () => {
    const item = makeItem("4-5"); // Дымовая Завеса, не 9
    expect(stabilizeRealityRendingButtonHtml(item)).toBe("");
    await useStabilizeRealityRending(makeActor(), item);
    expect(item.getFlag("warhammer-dbc", "realityRendingExcluded")).toBeUndefined();
  });

  it("статус «Никто не исключён» до первой настройки", () => {
    const item = makeItem("9");
    expect(stabilizeRealityRendingButtonHtml(item)).toContain("Никто не исключён");
  });

  it("выбор союзников для исключения — пишет флаг, статус обновляется", async () => {
    const actor = makeActor("Кастер");
    const ally = makeActor("Союзник");
    ally.uuid = "Actor.ally"; ally.getActiveTokens = () => [{}];
    globalThis.game.actors = [actor, ally];

    const item = makeItem("9");
    const promise = useStabilizeRealityRending(actor, item);
    await captured.press("ok", {
      querySelectorAll: sel => sel === "#rr-excluded input:checked" ? [{ value: "Actor.ally" }] : []
    });
    await promise;

    expect(item.getFlag("warhammer-dbc", "realityRendingExcluded")).toEqual(["Actor.ally"]);
    expect(stabilizeRealityRendingButtonHtml(item)).toContain("Исключено: <b>1</b>");
  });

  it("отмена диалога — флаг не меняется", async () => {
    const actor = makeActor("Кастер");
    globalThis.game.actors = [actor];
    const item = makeItem("9");

    const promise = useStabilizeRealityRending(actor, item);
    await captured.press("cancel", { querySelectorAll: () => [] });
    await promise;

    expect(item.getFlag("warhammer-dbc", "realityRendingExcluded")).toBeUndefined();
  });
});
