// test/combat/forced-next-move.test.mjs
//
// Тумблер «следующий сдвиг — вынужденный» (wdbc-98xsv): толчок и перевозку
// стол делает ручным перетаскиванием (method «dragging»), система не отличит
// его от хода игрока. Игрок заранее включает тумблер на актора — ровно ОДИН
// следующий сдвиг (все отрезки одного перетаскивания) не блокируется лимитом
// пути, не метит «подвигался» и не лежит в пройденном пути для следующих шагов.
// Состояние — в памяти клиента (module/combat/forced-next-move.mjs); обвязка
// хуков — combat/path-limit.mjs.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isNextMoveForced, setNextMoveForced, toggleNextMoveForced, clearNextMoveForced,
  rememberForcedMovement, forcedMovementIds, nextMoveForcedEntries, onNextMoveForcedChange
} from "../../module/combat/forced-next-move.mjs";
import {
  checkPreMove, onPreMoveToken, onMoveToken, _resetPathLimitNotices
} from "../../module/combat/path-limit.mjs";
import { isForcedMove, walkedMeters } from "../../module/rules/movement-path.mjs";

const ACTIONS = { walk: {}, blink: { teleport: true }, displace: { teleport: true } };

function fakeActor(uuid = "Actor.a1") {
  const store = {};
  return {
    uuid, name: "Гарн", type: "character", items: [],
    system: { movement: { halfMove: 3, move: 6, charge: 9, run: 18, altitude: "landed" }, mount: { uuid: "" }, characteristics: {}, skills: {} },
    getFlag: (_s, key) => store[key],
    setFlag: async (_s, key, value) => { store[key] = value; }
  };
}
function fakeToken(actor = fakeActor()) {
  return { id: "tok1", name: "Гарн", actor, combatant: { parent: { started: true, combatant: { tokenId: "tok1" } } } };
}

const wp = (x, y, extra = {}) => ({ x, y, elevation: 0, action: "walk", cost: 0, userId: "u1", movementId: "mv0", ...extra });
function moveWp({ id = "mvN", history = [], passed = [], pending = [], method = "dragging" } = {}) {
  return {
    id, method, recorded: true, origin: { x: 0, y: 0 },
    history: { cost: 999, distance: 999, recorded: { waypoints: history }, unrecorded: { waypoints: [] } },
    passed: { cost: 999, distance: 999, waypoints: passed },
    pending: { waypoints: pending }
  };
}

beforeEach(() => {
  resetCaptured();
  _resetPathLimitNotices();
  clearNextMoveForced();
  globalThis.ui.notifications.info = () => {};
  globalThis.game.user = { id: "u1", isGM: false };
  globalThis.game.settings.get = (scope, key) =>
    (scope === "warhammer-dbc" && key === "movementPathLimit") ? "soft" : undefined;
  globalThis.CONFIG.Token = { movement: { actions: ACTIONS } };
});
afterEach(() => {
  clearNextMoveForced();
  delete globalThis.CONFIG.Token;
  globalThis.game.user = {};
});

describe("состояние тумблера", () => {
  it("по умолчанию выключен; включается и выключается; ключ — актор", () => {
    expect(isNextMoveForced("Actor.a1")).toBe(false);
    expect(toggleNextMoveForced("Actor.a1", "Гарн")).toBe(true);
    expect(isNextMoveForced("Actor.a1")).toBe(true);
    expect(isNextMoveForced("Actor.a2")).toBe(false);
    expect(toggleNextMoveForced("Actor.a1")).toBe(false);
    expect(isNextMoveForced("Actor.a1")).toBe(false);
  });
  it("без ключа ничего не включает", () => {
    expect(toggleNextMoveForced(undefined)).toBe(false);
    expect(nextMoveForcedEntries()).toEqual([]);
  });
  it("список включённых для индикатора: ключ и имя", () => {
    setNextMoveForced("Actor.a1", true, "Гарн");
    setNextMoveForced("Actor.a2", true, "Рыжий");
    expect(nextMoveForcedEntries()).toEqual([{ key: "Actor.a1", name: "Гарн" }, { key: "Actor.a2", name: "Рыжий" }]);
  });
  it("подписчик слышит каждое изменение, в том числе общий сброс", () => {
    const seen = [];
    const off = onNextMoveForcedChange(entries => seen.push(entries.length));
    setNextMoveForced("Actor.a1", true, "Гарн");
    clearNextMoveForced();
    off();
    setNextMoveForced("Actor.a1", true, "Гарн");
    expect(seen).toEqual([1, 0]);
  });
  it("общий сброс убирает и запомненные вынужденные сдвиги", () => {
    rememberForcedMovement("Actor.a1", "mv5");
    expect(forcedMovementIds("Actor.a1").has("mv5")).toBe(true);
    clearNextMoveForced();
    expect(forcedMovementIds("Actor.a1").size).toBe(0);
  });
});

describe("onPreMoveToken: тумблер гасит учёт ровно одного сдвига", () => {
  const over = () => moveWp({ id: "mvForced", history: [wp(0, 0), wp(300, 0, { cost: 3 })], passed: [wp(800, 0, { cost: 5 })] });

  it("без тумблера сдвиг за лимитом блокируется (контроль, что тест не пустой)", () => {
    expect(onPreMoveToken(fakeToken(), over(), {})).toBe(false);
  });

  it("с тумблером — пропущен молча, опции помечены принудительными, тумблер сброшен", () => {
    const actor = fakeActor();
    setNextMoveForced(actor.uuid, true, actor.name);
    const options = {};
    expect(onPreMoveToken(fakeToken(actor), over(), options)).toBeUndefined();
    expect(captured.warnings).toEqual([]);
    expect(isForcedMove(options)).toBe(true);
    expect(isNextMoveForced(actor.uuid)).toBe(false);
  });

  it("следующий сдвиг без тумблера снова считается и блокируется", () => {
    const actor = fakeActor();
    setNextMoveForced(actor.uuid, true);
    onPreMoveToken(fakeToken(actor), over(), {});
    expect(onPreMoveToken(fakeToken(actor), over(), {})).toBe(false);
  });

  it("без объекта опций хук всё равно не блокирует этот сдвиг и сбрасывает тумблер", () => {
    const actor = fakeActor();
    setNextMoveForced(actor.uuid, true);
    expect(onPreMoveToken(fakeToken(actor), over())).toBeUndefined();
    expect(isNextMoveForced(actor.uuid)).toBe(false);
  });

  it("перетаскивание из нескольких отрезков (есть pending) держит тумблер до последнего отрезка", () => {
    const actor = fakeActor();
    setNextMoveForced(actor.uuid, true);
    const first = moveWp({ id: "mvA", passed: [wp(800, 0, { cost: 5 })], pending: [wp(1200, 0)] });
    expect(onPreMoveToken(fakeToken(actor), first, {})).toBeUndefined();
    expect(isNextMoveForced(actor.uuid)).toBe(true);
    const last = moveWp({ id: "mvB", passed: [wp(1200, 0, { cost: 4 })] });
    expect(onPreMoveToken(fakeToken(actor), last, {})).toBeUndefined();
    expect(isNextMoveForced(actor.uuid)).toBe(false);
  });

  it("перемещение не по воле игрока (api, hud) тумблер не тратит", () => {
    const actor = fakeActor();
    setNextMoveForced(actor.uuid, true);
    onPreMoveToken(fakeToken(actor), moveWp({ method: "api", passed: [wp(100, 0, { cost: 1 })] }), {});
    onPreMoveToken(fakeToken(actor), moveWp({ method: "hud", passed: [wp(100, 0, { cost: 1 })] }), {});
    expect(isNextMoveForced(actor.uuid)).toBe(true);
  });

  it("тумблер одного актора не снимает лимит с другого", () => {
    const a = fakeActor("Actor.a1"), b = fakeActor("Actor.a2");
    setNextMoveForced(a.uuid, true);
    expect(onPreMoveToken(fakeToken(b), over(), {})).toBe(false);
    expect(isNextMoveForced(a.uuid)).toBe(true);
  });

  it("режим off: лимита нет, но тумблер всё равно сгорает на этом сдвиге", () => {
    globalThis.game.settings.get = () => "off";
    const actor = fakeActor();
    setNextMoveForced(actor.uuid, true);
    onPreMoveToken(fakeToken(actor), over(), {});
    expect(isNextMoveForced(actor.uuid)).toBe(false);
  });
});

describe("вынужденный сдвиг не лежит в пройденном пути следующих шагов", () => {
  it("walkedMeters пропускает отрезки с запомненным movementId", () => {
    const list = [wp(0, 0), wp(500, 0, { cost: 5, movementId: "mvForced" }), wp(700, 0, { cost: 2, movementId: "mvOwn" })];
    expect(walkedMeters(list)).toBe(7);
    expect(walkedMeters(list, { skipMovementIds: new Set(["mvForced"]) })).toBe(2);
  });

  it("после тумблера собственный шаг на 2 м пускают: толчок на 8 м бюджет не съел", () => {
    const actor = fakeActor();
    setNextMoveForced(actor.uuid, true);
    onPreMoveToken(fakeToken(actor), moveWp({ id: "mvForced", passed: [wp(800, 0, { cost: 8 })] }), {});
    const history = [wp(0, 0), wp(800, 0, { cost: 8, movementId: "mvForced" })];
    const next = moveWp({ id: "mvOwn", history, passed: [wp(1000, 0, { cost: 2, movementId: "mvOwn" })] });
    expect(checkPreMove(fakeToken(actor), next, { mode: "soft", actions: ACTIONS })).toMatchObject({ used: 0, step: 2, allowed: true });
  });

  it("без тумблера тот же толчок бюджет съедает", () => {
    const actor = fakeActor();
    const history = [wp(0, 0), wp(800, 0, { cost: 8, movementId: "mvForced" })];
    const next = moveWp({ id: "mvOwn", history, passed: [wp(1000, 0, { cost: 2, movementId: "mvOwn" })] });
    expect(checkPreMove(fakeToken(actor), next, { mode: "soft", actions: ACTIONS })).toMatchObject({ used: 8, allowed: false });
  });

  it("moveToken: прежний вынужденный сдвиг не засчитывается в пробег Выстрела Навскидку", async () => {
    const actor = fakeActor();
    setNextMoveForced(actor.uuid, true);
    onPreMoveToken(fakeToken(actor), moveWp({ id: "mvForced", passed: [wp(800, 0, { cost: 8 })] }), {});
    const history = [wp(0, 0), wp(800, 0, { cost: 8, movementId: "mvForced" })];
    const next = moveWp({ id: "mvOwn", history, passed: [wp(900, 0, { cost: 1, movementId: "mvOwn" })] });
    await onMoveToken(fakeToken(actor), next, {}, { id: "u1" });
    expect(actor.getFlag("warhammer-dbc", "moveDegreeThisTurn")).toBeUndefined();
  });
});
