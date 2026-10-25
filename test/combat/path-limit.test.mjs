// test/combat/path-limit.test.mjs
//
// Лимит пути токена за Ход (wdbc-l2urs): обвязка хуков preMoveToken/moveToken
// Foundry v14 поверх чистого правила (test/rules/movement-path.test.mjs).
// Форма movement и tokenDoc — как у настоящего ядра (client/documents/token.mjs,
// TokenPreMovementOperation): history/passed с cost и waypoints, method,
// recorded; tokenDoc.combatant.parent — бой, в котором токен.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import {
  pathLimitMode, isPathLimitedActor, checkPreMove, onPreMoveToken, onMoveToken, _resetPathLimitNotices
} from "../../module/combat/path-limit.mjs";
import { MOVE_ALLOWANCE_FLAG, PATH_LIMIT_OFF_FLAG, RAN_METERS_FLAG } from "../../module/rules/movement-path.mjs";

const SPD3 = { halfMove: 3, move: 6, charge: 9, run: 18, altitude: "landed" };
const ACTIONS = { walk: {}, fly: {}, blink: { teleport: true }, displace: { teleport: true } };

/** Актор-двойник: флаги в памяти, как в free-attack.test.mjs. */
function fakeActor({ type = "character", movement = SPD3, flags = {}, mount = "", items = [] } = {}) {
  const store = { ...flags };
  const actor = {
    name: "Гарн", type, items: Object.assign([...items], { contents: items }),
    system: { movement: { ...movement }, mount: { uuid: mount }, characteristics: {}, skills: {} },
    getFlag: (scope, key) => store[key],
    setFlag: async (scope, key, value) => { store[key] = value; },
    _store: store
  };
  return actor;
}

function fakeToken({ actor = fakeActor(), ownTurn = true, started = true, inCombat = true } = {}) {
  const tokenDoc = { id: "tok1", name: "Гарн", actor };
  tokenDoc.combatant = inCombat
    ? { parent: { started, combatant: { tokenId: ownTurn ? "tok1" : "other" } } }
    : null;
  return tokenDoc;
}

/** movement в форме ядра: used — уже пройдено за Ход, step — просимый отрезок. */
function move({ used = 0, step = 2, method = "dragging", recorded = true, actions = ["walk"] } = {}) {
  return {
    method, recorded,
    history: { cost: used, distance: used },
    passed: { cost: step, distance: step, waypoints: actions.map(action => ({ action })) }
  };
}

let infos;
beforeEach(() => {
  resetCaptured();
  _resetPathLimitNotices();
  infos = [];
  globalThis.ui.notifications.info = m => infos.push(String(m));
  globalThis.game.user = { id: "u1", isGM: false };
  globalThis.game.settings.get = (scope, key) => {
    if (scope === "core" && key === "rollMode") return "roll";
    if (scope === "warhammer-dbc" && key === "movementPathLimit") return globalThis.__mode ?? "soft";
    return undefined;
  };
  globalThis.CONFIG.Token = { movement: { actions: ACTIONS } };
  globalThis.__mode = "soft";
});
afterEach(() => {
  delete globalThis.__mode;
  delete globalThis.CONFIG.Token;
  globalThis.game.user = {};
});

describe("pathLimitMode", () => {
  it("читает настройку мира; сбой чтения — умолчание, а не «выключено»", () => {
    globalThis.__mode = "strict";
    expect(pathLimitMode()).toBe("strict");
    globalThis.game.settings.get = () => { throw new Error("настройка не зарегистрирована"); };
    expect(pathLimitMode()).toBe("soft");
  });
});

describe("isPathLimitedActor", () => {
  it("персонаж, демон, принц демона, миньон — да", () => {
    for (const type of ["character", "daemon", "demonPrince", "minion"]) {
      expect(isPathLimitedActor(fakeActor({ type }))).toBe(true);
    }
  });
  it("Орда и Техника — нет; без актора — нет", () => {
    expect(isPathLimitedActor(fakeActor({ type: "horde" }))).toBe(false);
    expect(isPathLimitedActor(fakeActor({ type: "vehicle" }))).toBe(false);
    expect(isPathLimitedActor(null)).toBe(false);
  });
  it("всадник (едет на скакуне) — нет: его скорость — скорость скакуна", () => {
    expect(isPathLimitedActor(fakeActor({ mount: "Actor.abc" }))).toBe(false);
  });
});

describe("checkPreMove: шаги на своём Ходу", () => {
  it("без объявления: в Полудвижение (3 м) пускает, за ним — блок", () => {
    const tok = fakeToken();
    expect(checkPreMove(tok, move({ used: 0, step: 3 }), { mode: "soft", actions: ACTIONS })).toMatchObject({ applies: true, allowed: true });
    expect(checkPreMove(tok, move({ used: 2, step: 3 }), { mode: "soft", actions: ACTIONS })).toMatchObject({ applies: true, allowed: false, limit: 3 });
  });

  it("объявлено Полное Движение (6 м) — лимит 6", () => {
    const actor = fakeActor({ flags: { [MOVE_ALLOWANCE_FLAG]: { total: 6, entries: [{ kind: "full", meters: 6 }] } } });
    const tok = fakeToken({ actor });
    expect(checkPreMove(tok, move({ used: 4, step: 2 }), { actions: ACTIONS }).allowed).toBe(true);
    expect(checkPreMove(tok, move({ used: 4, step: 3 }), { actions: ACTIONS }).allowed).toBe(false);
  });

  it("не свой Ход — лимита нет", () => {
    expect(checkPreMove(fakeToken({ ownTurn: false }), move({ step: 99 }), { actions: ACTIONS })).toMatchObject({ applies: false, reason: "notOwnTurn" });
  });

  it("токен вне боя или бой не начат — лимита нет", () => {
    expect(checkPreMove(fakeToken({ inCombat: false }), move({ step: 99, recorded: false }), { actions: ACTIONS }).applies).toBe(false);
    expect(checkPreMove(fakeToken({ started: false }), move({ step: 99, recorded: false }), { actions: ACTIONS }).applies).toBe(false);
  });

  it("принудительный сдвиг, скрипт, HUD, откат — не по воле игрока: не блокируются", () => {
    for (const method of ["api", "hud", "undo", "paste"]) {
      expect(checkPreMove(fakeToken(), move({ step: 99, method }), { actions: ACTIONS })).toMatchObject({ applies: false, reason: "method" });
    }
  });

  it("телепорт (blink/displace) — не блокируется, обычная ходьба рядом — блокируется", () => {
    expect(checkPreMove(fakeToken(), move({ step: 99, actions: ["blink"] }), { actions: ACTIONS })).toMatchObject({ applies: false, reason: "teleport" });
    expect(checkPreMove(fakeToken(), move({ step: 99, actions: ["displace", "displace"] }), { actions: ACTIONS }).applies).toBe(false);
    expect(checkPreMove(fakeToken(), move({ step: 99, actions: ["walk", "blink"] }), { actions: ACTIONS }).applies).toBe(true);
  });

  it("флаг актора «без лимита» — лимита нет", () => {
    const actor = fakeActor({ flags: { [PATH_LIMIT_OFF_FLAG]: true } });
    expect(checkPreMove(fakeToken({ actor }), move({ step: 99 }), { actions: ACTIONS })).toMatchObject({ applies: false, reason: "actorOff" });
  });

  it("Орда и всадник — null (вне лимита)", () => {
    expect(checkPreMove(fakeToken({ actor: fakeActor({ type: "horde" }) }), move(), { actions: ACTIONS })).toBeNull();
    expect(checkPreMove(fakeToken({ actor: fakeActor({ mount: "Actor.x" }) }), move(), { actions: ACTIONS })).toBeNull();
  });

  it("стоимость Infinity (непроходимо) падает на дистанцию, а не в NaN", () => {
    const m = move({ used: 0, step: 2 });
    m.passed.cost = Infinity; m.passed.distance = 2;
    expect(checkPreMove(fakeToken(), m, { actions: ACTIONS })).toMatchObject({ step: 2, allowed: true });
  });
});

// Движение в форме ядра с отрезками (waypoints): у каждой точки x/y/action/cost/userId.
const wp = (x, y, extra = {}) => ({ x, y, elevation: 0, action: "walk", cost: 0, userId: "u1", ...extra });
function moveWp({ history = [], passed = [], method = "dragging" } = {}) {
  return {
    method, recorded: true, origin: { x: 0, y: 0 },
    history: { cost: 999, distance: 999, recorded: { waypoints: history }, unrecorded: { waypoints: [] } },
    passed: { cost: 999, distance: 999, waypoints: passed }
  };
}
// Форма CONFIG.Token.movement.actions ПОСЛЕ инициализации ядра: costMultiplier стёрт,
// осталась getCostFunction (client/game.mjs::#initializeMovementActions).
const ACTIONS2 = { ...ACTIONS,
  climb: { getCostFunction: () => cost => cost * 2 }, jump: { getCostFunction: () => cost => cost * 2 } };

describe("измеритель считает только то, что токен прошёл сам (находки ревью wdbc-l2urs)", () => {
  const verdict = (m, actor = fakeActor()) => checkPreMove(fakeToken({ actor }), m, { mode: "soft", actions: ACTIONS2 });

  it("ядро сводит всё в history.cost (999), мы берём по отрезкам", () => {
    const v = verdict(moveWp({ history: [wp(0, 0), wp(1, 0, { cost: 1 }), wp(2, 0, { cost: 1 })], passed: [wp(3, 0, { cost: 1 })] }));
    expect(v).toMatchObject({ used: 2, step: 1, allowed: true });
  });

  it("подъём/спуск на месте (Смена Высоты Летуна) пути по земле не добавляет", () => {
    const up = wp(0, 0, { elevation: 10, cost: 10 });
    const v = verdict(moveWp({ history: [wp(0, 0), up], passed: [wp(1, 0, { cost: 1 })] }));
    expect(v).toMatchObject({ used: 0, step: 1, allowed: true });
  });

  it("телепорт в истории (blink) бюджет не ест", () => {
    const v = verdict(moveWp({ history: [wp(0, 0), wp(12, 0, { cost: 12, action: "blink" })], passed: [wp(13, 0, { cost: 1 })] }));
    expect(v).toMatchObject({ used: 0, allowed: true });
  });

  it("отрезки, которые передвинул ГМ, бюджет игрока не едят", () => {
    globalThis.game.users = { get: id => ({ isGM: id === "gm" }) };
    const v = verdict(moveWp({ history: [wp(0, 0), wp(3, 0, { cost: 3, userId: "gm" })], passed: [wp(4, 0, { cost: 1 })] }));
    expect(v).toMatchObject({ used: 0, step: 1, allowed: true });
    globalThis.game.users = [];
  });

  it("климб/прыжок ядра с наценкой ×2 приводятся к метрам", () => {
    const v = verdict(moveWp({ history: [wp(0, 0)], passed: [wp(0, 1, { cost: 6, action: "climb" })] }));
    expect(v.step).toBe(3);
  });

  it("свои отрезки считаются и после чужих: игрок 2 м, ГМ 5 м, снова игрок 2 м — всего 4", () => {
    globalThis.game.users = { get: id => ({ isGM: id === "gm" }) };
    const hist = [wp(0, 0), wp(2, 0, { cost: 2 }), wp(7, 0, { cost: 5, userId: "gm" }), wp(9, 0, { cost: 2 })];
    const v = verdict(moveWp({ history: hist, passed: [wp(10, 0, { cost: 1 })] }));
    expect(v.used).toBe(4);
    globalThis.game.users = [];
  });

  it("персонаж без ног / Парализован (лист посчитал Движение = 0) — идти нельзя, а не «скорость неизвестна»", () => {
    const actor = fakeActor({ movement: { halfMove: 0, move: 0, charge: 0, run: 0, spdBreakdown: [] } });
    const v = verdict(moveWp({ history: [wp(0, 0)], passed: [wp(1, 0, { cost: 1 })] }), actor);
    expect(v).toMatchObject({ applies: true, allowed: false, limit: 0 });
    expect(onPreMoveToken(fakeToken({ actor }), moveWp({ history: [wp(0, 0)], passed: [wp(1, 0, { cost: 1 })] }))).toBe(false);
    expect(captured.warnings.at(-1)).toContain("не может идти");
  });

  it("лист Движения не считал (нет разбора SPD) — нуль значит «неизвестно», не блокируем", () => {
    const actor = fakeActor({ movement: { halfMove: 0, move: 0, charge: 0, run: 0 } });
    expect(verdict(moveWp({ history: [wp(0, 0)], passed: [wp(1, 0, { cost: 1 })] }), actor)).toMatchObject({ applies: false, reason: "unknownSpeed" });
  });
});

describe("onPreMoveToken: блок и уведомление", () => {
  it("за лимитом — false и предупреждение «Лимит пути исчерпан»", () => {
    const res = onPreMoveToken(fakeToken(), move({ used: 3, step: 1 }));
    expect(res).toBe(false);
    expect(captured.warnings.some(w => w.includes("Лимит пути исчерпан"))).toBe(true);
    expect(captured.warnings.some(w => w.includes("Гарн"))).toBe(true);
  });

  it("внутри лимита — тихо пускает", () => {
    expect(onPreMoveToken(fakeToken(), move({ used: 0, step: 3 }))).toBeUndefined();
    expect(captured.warnings).toEqual([]);
  });

  it("режим off — не блокирует ничего", () => {
    globalThis.__mode = "off";
    expect(onPreMoveToken(fakeToken(), move({ used: 100, step: 100 }))).toBeUndefined();
    expect(captured.warnings).toEqual([]);
  });

  it("strict: ничего не объявлено — первый же шаг блокируется", () => {
    globalThis.__mode = "strict";
    expect(onPreMoveToken(fakeToken(), move({ step: 1 }))).toBe(false);
  });

  it("ГМ не блокируется, но перебор отмечается уведомлением", () => {
    globalThis.game.user = { id: "gm", isGM: true };
    expect(onPreMoveToken(fakeToken(), move({ used: 3, step: 4 }))).toBeUndefined();
    expect(captured.warnings).toEqual([]);
    expect(infos.some(m => m.includes("ГМ") && m.includes("4 м"))).toBe(true);
  });

  it("ГМ: напоминание о переборе один раз за Ход токена, а не на каждое перетаскивание", () => {
    globalThis.game.user = { id: "gm", isGM: true };
    const tok = fakeToken();
    onPreMoveToken(tok, move({ used: 3, step: 4 }));
    onPreMoveToken(tok, move({ used: 7, step: 4 }));
    onPreMoveToken(tok, move({ used: 11, step: 4 }));
    expect(infos).toHaveLength(1);
    // Следующий Ход — напомнить снова.
    tok.combatant.parent.turn = 3;
    onPreMoveToken(tok, move({ used: 3, step: 4 }));
    expect(infos).toHaveLength(2);
  });

  it("ГМ в пределах лимита — без уведомлений", () => {
    globalThis.game.user = { id: "gm", isGM: true };
    expect(onPreMoveToken(fakeToken(), move({ step: 1 }))).toBeUndefined();
    expect(infos).toEqual([]);
  });

  it("не свой Ход и принудительный сдвиг не блокируются даже в strict", () => {
    globalThis.__mode = "strict";
    expect(onPreMoveToken(fakeToken({ ownTurn: false }), move({ step: 50 }))).toBeUndefined();
    expect(onPreMoveToken(fakeToken(), move({ step: 50, method: "api" }))).toBeUndefined();
  });
});

describe("Надёжная Поступь Сквата: потолок 3×SPD на реальный путь", () => {
  const TREAD = packDocById("packs-src/traits", "RZ8eDsBa4H4r9l99");
  const asItem = doc => ({ id: "t0", name: doc.name, type: doc.type, system: doc.system, flags: doc.flags });
  // SPD 3 → Натиск 9 м; Бег уже урезан до Натиска листом, поэтому run = 9.
  const squat = flags => fakeActor({ movement: { halfMove: 3, move: 6, charge: 9, run: 9, altitude: "landed" }, items: [asItem(TREAD)], flags });

  it("Полное (6) + Натиск (9) объявлены, но пешком не больше 9 м за Ход", () => {
    const actor = squat({ [MOVE_ALLOWANCE_FLAG]: { total: 15, entries: [{ kind: "full", meters: 6 }, { kind: "charge", meters: 9 }] } });
    const v = checkPreMove(fakeToken({ actor }), move({ used: 8, step: 2 }), { actions: ACTIONS });
    expect(v).toMatchObject({ allowed: false, limit: 9, capped: true });
    expect(checkPreMove(fakeToken({ actor }), move({ used: 8, step: 1 }), { actions: ACTIONS }).allowed).toBe(true);
  });

  it("без Надёжной Поступи те же 15 м доступны", () => {
    const actor = fakeActor({ flags: { [MOVE_ALLOWANCE_FLAG]: { total: 15, entries: [{ kind: "full", meters: 6 }, { kind: "charge", meters: 9 }] } } });
    expect(checkPreMove(fakeToken({ actor }), move({ used: 8, step: 2 }), { actions: ACTIONS })).toMatchObject({ allowed: true, limit: 15, capped: false });
  });

  it("в полёте (Приземная высота) потолок «пешком» не действует", () => {
    const actor = squat({ [MOVE_ALLOWANCE_FLAG]: { total: 15, entries: [{ kind: "full", meters: 15 }] } });
    actor.system.movement.altitude = "ground";
    expect(checkPreMove(fakeToken({ actor }), move({ used: 8, step: 4 }), { actions: ACTIONS })).toMatchObject({ allowed: true, capped: false });
  });

  it("сообщение о блоке называет Надёжную Поступь", () => {
    const actor = squat({ [MOVE_ALLOWANCE_FLAG]: { total: 15, entries: [{ kind: "full", meters: 6 }, { kind: "charge", meters: 9 }] } });
    expect(onPreMoveToken(fakeToken({ actor }), move({ used: 9, step: 1 }))).toBe(false);
    expect(captured.warnings.some(w => w.includes("Надёжная Поступь"))).toBe(true);
  });
});

describe("onMoveToken: категория Хода для Выстрела Навскидку", () => {
  const me = { id: "u1" };

  it("прошёл дальше Полудвижения — moveDegreeThisTurn = full", async () => {
    const actor = fakeActor();
    await onMoveToken(fakeToken({ actor }), move({ used: 2, step: 2 }), {}, me);
    expect(actor.getFlag("warhammer-dbc", "moveDegreeThisTurn")).toBe("full");
  });

  it("в пределах Полудвижения — категорию не трогает (Навскидку остаётся +1 ОД)", async () => {
    const actor = fakeActor();
    await onMoveToken(fakeToken({ actor }), move({ used: 1, step: 2 }), {}, me);
    expect(actor.getFlag("warhammer-dbc", "moveDegreeThisTurn")).toBeUndefined();
  });

  it("чужое перемещение (другой клиент), не свой Ход, принудительный сдвиг — не пишет", async () => {
    const a1 = fakeActor(); await onMoveToken(fakeToken({ actor: a1 }), move({ step: 9 }), {}, { id: "u2" });
    const a2 = fakeActor(); await onMoveToken(fakeToken({ actor: a2, ownTurn: false }), move({ step: 9 }), {}, me);
    const a3 = fakeActor(); await onMoveToken(fakeToken({ actor: a3 }), move({ step: 9, method: "api" }), {}, me);
    for (const a of [a1, a2, a3]) expect(a.getFlag("warhammer-dbc", "moveDegreeThisTurn")).toBeUndefined();
  });

  it("бежит (флаг «running») — запоминает, сколько метров пробежал, для Скоростной Внимательности", async () => {
    const actor = fakeActor({ flags: { running: true } });
    await onMoveToken(fakeToken({ actor }), move({ used: 4, step: 5 }), {}, me);
    expect(actor.getFlag("warhammer-dbc", RAN_METERS_FLAG)).toBe(9);
  });

  it("пробег только растёт: меньший итог не затирает больший", async () => {
    const actor = fakeActor({ flags: { running: true, [RAN_METERS_FLAG]: 12 } });
    await onMoveToken(fakeToken({ actor }), move({ used: 0, step: 3 }), {}, me);
    expect(actor.getFlag("warhammer-dbc", RAN_METERS_FLAG)).toBe(12);
  });

  it("не бежит — пробег не пишется", async () => {
    const actor = fakeActor();
    await onMoveToken(fakeToken({ actor }), move({ step: 9 }), {}, me);
    expect(actor.getFlag("warhammer-dbc", RAN_METERS_FLAG)).toBeUndefined();
  });

  it("измеряет и при выключенном лимите: это измеритель, а не только запрет", async () => {
    globalThis.__mode = "off";
    const actor = fakeActor();
    await onMoveToken(fakeToken({ actor }), move({ step: 9 }), {}, me);
    expect(actor.getFlag("warhammer-dbc", "moveDegreeThisTurn")).toBe("full");
  });
});
