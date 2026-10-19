// test/combat/radiation-combat.test.mjs
//
// wdbc-x1nz.10: Rad (X), вторая половина текста книги (core.json, Особые
// Свойства Оружия): «Живые существа, получившие за один бой 10 и более урона
// в T от радиации, должны после боя пройти тест на T+0, или получить лучевую
// болезнь». Счётчик «за бой» — флаг на акторе с id боя; разбор — по концу боя
// (hooks.mjs, deleteCombat).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { combatRadiationAfterHit, combatRadiationDue, COMBAT_RAD_FLAG }
  from "../../module/rules/radiation-combat.mjs";
import { applyRadHit, resolveCombatRadiation } from "../../module/combat/radiation.mjs";

function makeActor({ t = 40, flags: initial = {} } = {}) {
  const flags = { ...initial };
  const actor = {
    uuid: "Actor.a1", name: "Скитарий", type: "character", isOwner: true, items: [],
    system: { characteristics: { t: { total: t } }, charLoss: { t: 0 }, charLossAt: {}, conditions: {} },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async data => {
      captured.updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const m = path.match(/^flags\.warhammer-dbc\.(-=)?(.+)$/);
        if (m) { if (m[1]) delete flags[m[2]]; else flags[m[2]] = value; continue; }
        if (path === "system.charLoss.t") actor.system.charLoss.t = value;
      }
    }
  };
  return actor;
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.time = { worldTime: 1000 };
});
afterEach(() => { delete globalThis.game.combat; delete globalThis.game.combats; delete globalThis.game.users; });

/** Бой, где актор — участник. game.combat (бой, открытый в трекере) — нарочно другой. */
function inCombat(actor, id = "c1") {
  globalThis.game.combat = { id: "viewed-other", started: true, combatants: [] };
  globalThis.game.combats = [
    globalThis.game.combat,
    { id, started: true, combatants: [{ actor }] }
  ];
}

describe("счётчик радиационного урона за бой (чистые функции)", () => {
  it("копится в пределах одного боя", () => {
    const a = combatRadiationAfterHit(null, "c1", 4);
    expect(a).toEqual({ combatId: "c1", amount: 4 });
    expect(combatRadiationAfterHit(a, "c1", 7)).toEqual({ combatId: "c1", amount: 11 });
  });

  it("новый бой начинает счёт заново — остаток прошлого боя не тянется", () => {
    expect(combatRadiationAfterHit({ combatId: "old", amount: 9 }, "c2", 3)).toEqual({ combatId: "c2", amount: 3 });
  });

  it("тест после боя — с 10 и более, только за этот бой", () => {
    expect(combatRadiationDue({ combatId: "c1", amount: 10 }, "c1")).toBe(true);
    expect(combatRadiationDue({ combatId: "c1", amount: 9 }, "c1")).toBe(false);
    expect(combatRadiationDue({ combatId: "c0", amount: 30 }, "c1")).toBe(false);
    expect(combatRadiationDue(null, "c1")).toBe(false);
  });
});

describe("applyRadHit: попадание Рад в бою пишет счётчик", () => {
  it("два попадания в одном бою — счётчик складывается под боем, где цель участник", async () => {
    const actor = makeActor();
    inCombat(actor);
    captured.dice = [3];
    await applyRadHit(actor, { formula: "1d5", label: "Рад" });
    captured.dice = [5];
    await applyRadHit(actor, { formula: "1d5", label: "Рад" });
    expect(actor.system.charLoss.t).toBe(8);
    expect(actor.getFlag("warhammer-dbc", COMBAT_RAD_FLAG)).toEqual({ combatId: "c1", amount: 8 });
  });

  it("вне боя урон наносится, но в счёт «за бой» не идёт", async () => {
    const actor = makeActor();
    // Бой в трекере идёт, но цель в нём не участвует.
    globalThis.game.combat = { id: "c1", started: true, combatants: [] };
    globalThis.game.combats = [globalThis.game.combat];
    captured.dice = [3];
    await applyRadHit(actor, { formula: "1d5", label: "Рад" });
    expect(actor.system.charLoss.t).toBe(3);
    expect(actor.getFlag("warhammer-dbc", COMBAT_RAD_FLAG)).toBeUndefined();
  });

  it("иммунитет к радиации — ни урона, ни счётчика", async () => {
    const actor = makeActor();
    inCombat(actor);
    actor.items = [{
      type: "trait", name: "Рад Печь", system: {},
      // Механика — группы с entries, как пишет Конструктор.
      flags: { "warhammer-dbc": { mechanics: [{ entries: [{ kind: "condition", condMode: "immunity", condKey: "radiation" }] }] } },
      getFlag(scope, key) { return this.flags?.[scope]?.[key]; }
    }];
    await applyRadHit(actor, { formula: "1d5", label: "Рад" });
    expect(captured.rolls.length).toBe(0);
    expect(actor.system.charLoss.t).toBe(0);
    expect(captured.chat.some(c => String(c.content).includes("Иммунитет"))).toBe(true);
  });

  it("Техника без экипажа: у самой машины T нет — урона нет, о чём сказано в чате", async () => {
    const vehicle = { uuid: "Actor.v1", name: "Химера", type: "vehicle", items: [], system: {},
      getFlag: () => undefined, update: async d => { captured.updates.push(d); } };
    await applyRadHit(vehicle, { formula: "1d5", label: "Рад" });
    expect(captured.rolls.length).toBe(0);
    expect(captured.updates.length).toBe(0);
    expect(captured.chat.length).toBe(1);
  });
});

describe("resolveCombatRadiation: конец боя", () => {
  const combatOf = (...actors) => ({ id: "c1", combatants: actors.map(actor => ({ actor })) });

  it("10+ за бой, тест T+0 провален — лучевая болезнь, счётчик снят", async () => {
    const actor = makeActor({ t: 30, flags: { [COMBAT_RAD_FLAG]: { combatId: "c1", amount: 12 } } });
    captured.dice = [55];
    await resolveCombatRadiation(combatOf(actor));
    expect(captured.rolls).toEqual(["1d100"]);
    expect(actor.getFlag("warhammer-dbc", "radiationSickness")).toBe(true);
    expect(actor.getFlag("warhammer-dbc", COMBAT_RAD_FLAG)).toBeUndefined();
    expect(captured.chat[0].content).toContain("лучевая болезнь");
  });

  it("10+ за бой, тест пройден — болезни нет", async () => {
    const actor = makeActor({ t: 30, flags: { [COMBAT_RAD_FLAG]: { combatId: "c1", amount: 10 } } });
    captured.dice = [30];
    await resolveCombatRadiation(combatOf(actor));
    expect(actor.getFlag("warhammer-dbc", "radiationSickness")).toBeUndefined();
    expect(actor.getFlag("warhammer-dbc", COMBAT_RAD_FLAG)).toBeUndefined();
  });

  it("меньше 10 — без теста, счётчик просто снят", async () => {
    const actor = makeActor({ flags: { [COMBAT_RAD_FLAG]: { combatId: "c1", amount: 9 } } });
    await resolveCombatRadiation(combatOf(actor));
    expect(captured.rolls.length).toBe(0);
    expect(captured.chat.length).toBe(0);
    expect(actor.getFlag("warhammer-dbc", COMBAT_RAD_FLAG)).toBeUndefined();
  });

  it("счётчик другого боя этот бой не трогает", async () => {
    const actor = makeActor({ flags: { [COMBAT_RAD_FLAG]: { combatId: "other", amount: 15 } } });
    await resolveCombatRadiation(combatOf(actor));
    expect(captured.rolls.length).toBe(0);
    expect(actor.getFlag("warhammer-dbc", COMBAT_RAD_FLAG)).toEqual({ combatId: "other", amount: 15 });
  });

  it("второй ГМ в сети — бросает только активный ГМ, без двойного теста", async () => {
    const actor = makeActor({ t: 30, flags: { [COMBAT_RAD_FLAG]: { combatId: "c1", amount: 12 } } });
    globalThis.game.users = { activeGM: { isSelf: false } };
    await resolveCombatRadiation(combatOf(actor));
    expect(captured.rolls.length).toBe(0);
    expect(actor.getFlag("warhammer-dbc", COMBAT_RAD_FLAG)).toEqual({ combatId: "c1", amount: 12 });
  });

  // Решение владельца 02.10.2026: «радиация — не болезнь» — Демоны и
  // Демоны-Принцы после боя тест T+0 не бросают. Здесь проверяется только
  // снятие теста; иммунитет к самому урону у Черты Daemonic из пака —
  // test/combat/radiation-daemonic.test.mjs.
  describe("Демоны и Демоны-Принцы не бросают T+0", () => {
    const daemonish = (patch, items = []) => {
      const a = makeActor({ t: 30, flags: { [COMBAT_RAD_FLAG]: { combatId: "c1", amount: 15 } } });
      Object.assign(a, patch);
      a.items = items;
      return a;
    };
    const trait = name => ({ type: "trait", name, system: {} });

    it.each([
      ["Демон (тип daemon)", { type: "daemon" }, []],
      ["Демон-Принц", { type: "demonPrince" }, []],
      ["персонаж с Чертой Daemonic", {}, [trait("Daemonic / Демоническое")]]
    ])("%s: теста нет, болезни нет, счётчик снят", async (_n, patch, items) => {
      const actor = daemonish(patch, items);
      captured.dice = [99];
      await resolveCombatRadiation(combatOf(actor));
      expect(captured.rolls.length).toBe(0);
      expect(actor.getFlag("warhammer-dbc", "radiationSickness")).toBeUndefined();
      expect(actor.getFlag("warhammer-dbc", COMBAT_RAD_FLAG)).toBeUndefined();
    });

    it("контроль: обычный человек с теми же 15 урона — тест бросается", async () => {
      const actor = daemonish({});
      captured.dice = [99];
      await resolveCombatRadiation(combatOf(actor));
      expect(captured.rolls).toEqual(["1d100"]);
      expect(actor.getFlag("warhammer-dbc", "radiationSickness")).toBe(true);
    });

    it("«Машину» не исключаем: решения владельца нет — тест бросается", async () => {
      const actor = daemonish({}, [trait("Machine / Машина")]);
      captured.dice = [99];
      await resolveCombatRadiation(combatOf(actor));
      expect(captured.rolls).toEqual(["1d100"]);
    });
  });
});

// Решение владельца 02.10.2026: радиация по Технике бьёт по экипажу и
// пассажирам, а не по самой Технике (у неё нет Характеристики T).
describe("applyRadHit по Технике: урон X в T каждому на борту", () => {
  const seat = (id, role, uuid) => ({ id, role, uuid: uuid ?? "", name: "", img: "" });
  const vehicleWith = stations => ({
    uuid: "Actor.v1", name: "Химера", type: "vehicle", items: [],
    system: { stations }, getFlag: () => undefined, update: async d => { captured.updates.push(d); }
  });
  const crewMember = (uuid, name) => { const a = makeActor(); a.uuid = uuid; a.name = name; return a; };

  afterEach(() => { globalThis.fromUuid = async () => null; });

  const lookup = (...actors) => {
    globalThis.fromUuid = async u => actors.find(a => a.uuid === u) ?? null;
  };

  it("один бросок X, одинаковый урон в T у водителя и пассажира; пустые места пропускаются", async () => {
    const driver = crewMember("Actor.d", "Водитель");
    const pax = crewMember("Actor.p", "Пассажир");
    lookup(driver, pax);
    const veh = vehicleWith([seat("s1", "driver", "Actor.d"), seat("s2", "gunner"), seat("s3", "passenger", "Actor.p")]);
    captured.dice = [4];
    await applyRadHit(veh, { formula: "1d5", label: "Рад" });
    expect(captured.rolls).toEqual(["1d5"]);
    expect(driver.system.charLoss.t).toBe(4);
    expect(pax.system.charLoss.t).toBe(4);
  });

  it("экипаж в бою — урон идёт и в счёт «10+ за бой» каждого", async () => {
    const driver = crewMember("Actor.d", "Водитель");
    inCombat(driver);
    lookup(driver);
    captured.dice = [5];
    await applyRadHit(vehicleWith([seat("s1", "driver", "Actor.d")]), { formula: "1d5" });
    expect(driver.getFlag("warhammer-dbc", COMBAT_RAD_FLAG)).toEqual({ combatId: "c1", amount: 5 });
  });

  it("иммунный к радиации член экипажа урона не получает, остальные — получают", async () => {
    const immune = crewMember("Actor.i", "Рад-Печь");
    immune.items = [{
      type: "trait", name: "Рад Печь", system: {},
      flags: { "warhammer-dbc": { mechanics: [{ entries: [{ kind: "condition", condMode: "immunity", condKey: "radiation" }] }] } },
      getFlag(scope, key) { return this.flags?.[scope]?.[key]; }
    }];
    const other = crewMember("Actor.o", "Стрелок");
    lookup(immune, other);
    captured.dice = [3];
    await applyRadHit(vehicleWith([seat("s1", "driver", "Actor.i"), seat("s2", "gunner", "Actor.o")]), { formula: "1d5" });
    expect(immune.system.charLoss.t).toBe(0);
    expect(other.system.charLoss.t).toBe(3);
  });

  it("один и тот же человек на двух местах получает урон один раз", async () => {
    const a = crewMember("Actor.d", "Водитель");
    lookup(a);
    captured.dice = [2];
    await applyRadHit(vehicleWith([seat("s1", "driver", "Actor.d"), seat("s2", "commander", "Actor.d")]), { formula: "1d5" });
    expect(a.system.charLoss.t).toBe(2);
  });

  it("экипажа нет — броска нет, в чате честная карточка", async () => {
    await applyRadHit(vehicleWith([seat("s1", "driver"), seat("s2", "passenger")]), { formula: "1d5" });
    expect(captured.rolls.length).toBe(0);
    expect(captured.chat.length).toBe(1);
    expect(String(captured.chat[0].content)).toContain("На борту никого нет");
  });

  // Ревью 02.10.2026: токены персонажей по умолчанию НЕсвязанные. В месте
  // Техники лежит мировой uuid (посадили с боковой панели), а в бою стоит токен
  // с uuid «Scene.s.Token.t.Actor.x» — строгое сравнение не находило бой, и
  // экипаж выпадал из счёта «10+ за бой».
  it("несвязанный токен в бою: урон и счёт «за бой» ложатся на актора токена, а не на мирового", async () => {
    const world = crewMember("Actor.x", "Стрелок");
    const tokenActor = crewMember("Scene.s.Token.t.Actor.x", "Стрелок");
    tokenActor.isToken = true;
    tokenActor.token = { baseActor: world };
    globalThis.game.combats = [{ id: "c9", started: true, combatants: [{ actor: tokenActor }] }];
    lookup(world);
    captured.dice = [4];
    await applyRadHit(vehicleWith([seat("s1", "gunner", "Actor.x")]), { formula: "1d5" });
    expect(tokenActor.system.charLoss.t).toBe(4);
    expect(tokenActor.getFlag("warhammer-dbc", COMBAT_RAD_FLAG)).toEqual({ combatId: "c9", amount: 4 });
    expect(world.system.charLoss.t).toBe(0);
  });

  // Ревью 02.10.2026: кнопку жмёт владелец машины, а экипаж может быть чужим
  // персонажем — обновление чужого актора падает с ошибкой прав посреди цикла.
  it("член экипажа, которым нажавший не владеет, пропускается с пометкой; остальные получают урон", async () => {
    const foreign = crewMember("Actor.f", "Чужой стрелок");
    foreign.isOwner = false;
    const mine = crewMember("Actor.m", "Свой водитель");
    lookup(foreign, mine);
    captured.dice = [3];
    await applyRadHit(vehicleWith([seat("s1", "gunner", "Actor.f"), seat("s2", "driver", "Actor.m")]), { formula: "1d5" });
    expect(foreign.system.charLoss.t).toBe(0);
    expect(mine.system.charLoss.t).toBe(3);
    expect(String(captured.chat[0].content)).toContain("нет прав");
  });

  it("место занято, а актор не найден (удалён) — пропускается, остальные получают урон", async () => {
    const ok = crewMember("Actor.o", "Стрелок");
    lookup(ok);
    captured.dice = [3];
    await applyRadHit(vehicleWith([seat("s1", "driver", "Actor.gone"), seat("s2", "gunner", "Actor.o")]), { formula: "1d5" });
    expect(ok.system.charLoss.t).toBe(3);
  });
});
