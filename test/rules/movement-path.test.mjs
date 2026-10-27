// test/rules/movement-path.test.mjs
//
// Измеритель пути токена за Ход (wdbc-l2urs): чистая арифметика лимита —
// без Foundry. Сам путь меряет ядро Foundry v14 (movement.history/passed в
// хуке preMoveToken, с диагоналями сетки сцены); здесь — что считать лимитом
// и когда он вообще действует. Обвязка хука — test/combat/path-limit.test.mjs.

import { describe, it, expect } from "vitest";
import {
  PATH_LIMIT_MODES, PATH_LIMIT_DEFAULT, PATH_LIMIT_ACTOR_TYPES, PATH_LIMITED_METHODS,
  normalizePathLimitMode, emptyAllowance, readAllowance, addAllowance,
  pathBudget, evaluatePath, moveDegreeFromPath, exceedsNormalRun,
  fmtMeters, pathLimitMessage, walkedMeters, actionCostMultiplier,
  forcedMoveOptions, isForcedMove, displaceToken, TELEPORT_ACTION, DISPLACE_ACTION
} from "../../module/rules/movement-path.mjs";

// SPD 3: Полудвижение 3, Полное 6, Натиск 9, Бег 18 (таблица «Движение в бою»).
const SPD3 = { halfMove: 3, move: 6, charge: 9, run: 18 };

const base = (over = {}) => ({
  mode: "soft", gm: false, actorOff: false, method: "dragging", teleport: false,
  recorded: true, ownTurn: true, used: 0, step: 2, allowance: null, movement: SPD3,
  ceiling: Infinity, ...over
});

describe("режимы лимита пути", () => {
  it("три режима, по умолчанию — soft", () => {
    expect(PATH_LIMIT_MODES).toEqual(["off", "soft", "strict"]);
    expect(PATH_LIMIT_DEFAULT).toBe("soft");
  });

  it("неизвестное значение настройки не отключает лимит молча — берётся умолчание", () => {
    expect(normalizePathLimitMode("strict")).toBe("strict");
    expect(normalizePathLimitMode("off")).toBe("off");
    expect(normalizePathLimitMode("что-то")).toBe("soft");
    expect(normalizePathLimitMode(undefined)).toBe("soft");
    expect(normalizePathLimitMode(true)).toBe("soft");
  });

  it("лимит только для актёров с экономикой действий и меню Движения (Орда/Техника — мимо)", () => {
    expect(PATH_LIMIT_ACTOR_TYPES).toEqual(["character", "daemon", "demonPrince", "minion"]);
    expect(PATH_LIMIT_ACTOR_TYPES).not.toContain("horde");
    expect(PATH_LIMIT_ACTOR_TYPES).not.toContain("vehicle");
  });

  it("волей игрока считаются только перетаскивание и клавиши; API/HUD/откат/вставка — нет", () => {
    expect(PATH_LIMITED_METHODS).toEqual(["dragging", "keyboard"]);
  });
});

describe("записи объявленных Движений", () => {
  it("пустая запись — ноль", () => {
    expect(emptyAllowance()).toEqual({ total: 0, entries: [] });
  });

  it("складывает дистанции объявленных Движений за Ход", () => {
    let r = emptyAllowance();
    r = addAllowance(r, "half", 3);
    r = addAllowance(r, "full", 6);
    expect(r.total).toBe(9);
    expect(r.entries).toEqual([{ kind: "half", meters: 3 }, { kind: "full", meters: 6 }]);
  });

  it("не меняет исходную запись и отбрасывает мусор", () => {
    const r0 = emptyAllowance();
    const r1 = addAllowance(r0, "half", 3);
    expect(r0.total).toBe(0);
    expect(r1).not.toBe(r0);
    expect(addAllowance(r1, "run", 0)).toBe(r1);
    expect(addAllowance(r1, "run", -4)).toBe(r1);
    expect(addAllowance(r1, "run", NaN)).toBe(r1);
    expect(addAllowance(r1, "run", "abc")).toBe(r1);
  });

  it("readAllowance чинит битое значение флага", () => {
    expect(readAllowance(undefined)).toEqual({ total: 0, entries: [] });
    expect(readAllowance(null)).toEqual({ total: 0, entries: [] });
    expect(readAllowance(7)).toEqual({ total: 0, entries: [] });
    expect(readAllowance({ total: "5", entries: "нет" })).toEqual({ total: 5, entries: [] });
    expect(readAllowance({ total: -3 })).toEqual({ total: 0, entries: [] });
  });
});

describe("бюджет пути", () => {
  it("объявлено — лимит равен сумме объявленных Движений", () => {
    const allowance = { total: 9, entries: [{ kind: "half", meters: 3 }, { kind: "full", meters: 6 }] };
    const b = pathBudget({ allowance, movement: SPD3, mode: "soft" });
    expect(b).toMatchObject({ limit: 9, source: "declared", declared: true, capped: false });
  });

  it("soft: ничего не объявлено — по умолчанию Полудвижение", () => {
    const b = pathBudget({ allowance: null, movement: SPD3, mode: "soft" });
    expect(b).toMatchObject({ limit: 3, source: "default", declared: false });
  });

  it("strict: ничего не объявлено — ходить нельзя", () => {
    const b = pathBudget({ allowance: null, movement: SPD3, mode: "strict" });
    expect(b).toMatchObject({ limit: 0, source: "none" });
  });

  it("объявленное заменяет умолчание, а не прибавляется к нему", () => {
    const b = pathBudget({ allowance: { total: 6, entries: [{ kind: "full", meters: 6 }] }, movement: SPD3, mode: "soft" });
    expect(b.limit).toBe(6);
  });

  it("потолок Надёжной Поступи (3×SPD) режет сумму объявленных Движений", () => {
    // Полное (6) + Натиск (9) = 15, но пешком не более 9 за Ход.
    const allowance = { total: 15, entries: [{ kind: "full", meters: 6 }, { kind: "charge", meters: 9 }] };
    const b = pathBudget({ allowance, movement: SPD3, mode: "soft", ceiling: 9 });
    expect(b).toMatchObject({ limit: 9, capped: true, ceiling: 9 });
  });

  it("потолок выше суммы — ничего не режет", () => {
    const b = pathBudget({ allowance: { total: 3, entries: [{ kind: "half", meters: 3 }] }, movement: SPD3, mode: "soft", ceiling: 9 });
    expect(b).toMatchObject({ limit: 3, capped: false });
  });
});

describe("evaluatePath: когда лимит действует", () => {
  it("режим off — лимита нет", () => {
    expect(evaluatePath(base({ mode: "off", step: 99 }))).toMatchObject({ applies: false, allowed: true, reason: "off" });
  });

  it("вне боя / история не пишется — лимита нет", () => {
    expect(evaluatePath(base({ recorded: false, step: 99 }))).toMatchObject({ applies: false, reason: "notRecorded" });
  });

  it("не свой Ход (Реакция, чужой Ход) — лимита нет", () => {
    expect(evaluatePath(base({ ownTurn: false, step: 99 }))).toMatchObject({ applies: false, reason: "notOwnTurn" });
  });

  it.each(["api", "hud", "undo", "paste", "config", undefined])(
    "не по воле игрока (method=%s: принудительный сдвиг, скрипт, откат) — лимита нет", method => {
      expect(evaluatePath(base({ method, step: 99 }))).toMatchObject({ applies: false, allowed: true, reason: "method" });
    });

  it("телепорт — лимита нет", () => {
    expect(evaluatePath(base({ teleport: true, step: 99 }))).toMatchObject({ applies: false, reason: "teleport" });
  });

  it("у актора флаг «без лимита» — лимита нет", () => {
    expect(evaluatePath(base({ actorOff: true, step: 99 }))).toMatchObject({ applies: false, reason: "actorOff" });
  });

  it("скорость актора неизвестна (Полудвижение 0 и ничего не объявлено) — не блокируем вслепую", () => {
    expect(evaluatePath(base({ movement: { halfMove: 0 }, step: 5 }))).toMatchObject({ applies: false, reason: "unknownSpeed" });
    expect(evaluatePath(base({ movement: null, step: 5 }))).toMatchObject({ applies: false, reason: "unknownSpeed" });
  });

  it.each(["dragging", "keyboard"])("method=%s в бою на своём Ходу — лимит действует", method => {
    expect(evaluatePath(base({ method })).applies).toBe(true);
  });
});

describe("evaluatePath: пускать или нет", () => {
  it("шаг внутри лимита — пускает", () => {
    const v = evaluatePath(base({ used: 0, step: 3 }));
    expect(v).toMatchObject({ applies: true, allowed: true, reason: "ok", limit: 3, total: 3, remaining: 3, over: 0 });
  });

  it("ровно в лимит — пускает; на сантиметр больше — тоже (дрейф дробей сетки)", () => {
    expect(evaluatePath(base({ used: 1.5, step: 1.5 })).allowed).toBe(true);
    expect(evaluatePath(base({ used: 1.5, step: 1.505 })).allowed).toBe(true);
  });

  it("за лимитом — блокирует и называет перебор", () => {
    const v = evaluatePath(base({ used: 2, step: 2 }));
    expect(v).toMatchObject({ applies: true, allowed: false, reason: "over", limit: 3, used: 2, step: 2, total: 4, remaining: 1 });
    expect(v.over).toBeCloseTo(1);
  });

  it("лимит исчерпан целиком — остаток 0", () => {
    const v = evaluatePath(base({ used: 3, step: 1 }));
    expect(v).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("история уже больше лимита (объявленное потеряно, GM сдвинул) — остаток не уходит в минус", () => {
    const v = evaluatePath(base({ used: 10, step: 1 }));
    expect(v.remaining).toBe(0);
    expect(v.allowed).toBe(false);
  });

  it("объявленное Полное Движение даёт 6 м: 4 + 2 пускает, 4 + 3 нет", () => {
    const allowance = { total: 6, entries: [{ kind: "full", meters: 6 }] };
    expect(evaluatePath(base({ allowance, used: 4, step: 2 })).allowed).toBe(true);
    expect(evaluatePath(base({ allowance, used: 4, step: 3 })).allowed).toBe(false);
  });

  it("strict без объявления блокирует любой шаг", () => {
    expect(evaluatePath(base({ mode: "strict", step: 0.5 }))).toMatchObject({ allowed: false, limit: 0 });
  });

  it("Надёжная Поступь: Бег объявлен на 9 м (уже урезан), но 4 м Полудвижения сверху не пройти", () => {
    const allowance = { total: 12, entries: [{ kind: "half", meters: 3 }, { kind: "run", meters: 9 }] };
    const v = evaluatePath(base({ allowance, ceiling: 9, used: 8, step: 2 }));
    expect(v).toMatchObject({ allowed: false, limit: 9, capped: true });
  });

  it("ГМ не блокируется, но перебор помечен (для сообщения «ГМ — пропущено»)", () => {
    const v = evaluatePath(base({ gm: true, used: 2, step: 5 }));
    expect(v).toMatchObject({ applies: true, allowed: true, gmBypass: true, reason: "over" });
    expect(v.over).toBeCloseTo(4);
  });

  it("ГМ в пределах лимита — просто пускает, без пометки", () => {
    expect(evaluatePath(base({ gm: true, step: 1 }))).toMatchObject({ allowed: true, gmBypass: false });
  });

  it("мусор вместо расстояний не превращается в блок", () => {
    expect(evaluatePath(base({ used: NaN, step: undefined }))).toMatchObject({ allowed: true, total: 0 });
  });
});

describe("walkedMeters: путь по отрезкам ядра", () => {
  const w = (x, y, cost, extra = {}) => ({ x, y, cost, action: "walk", userId: "p", ...extra });

  it("первая точка списка отрезка не даёт; дальше суммируются стоимости", () => {
    expect(walkedMeters([w(0, 0, 0), w(100, 0, 1.5), w(200, 0, 1)])).toBe(2.5);
  });

  it("start задаёт точку, от которой считается первый отрезок", () => {
    expect(walkedMeters([w(100, 0, 1)], { start: w(0, 0, 0) })).toBe(1);
  });

  it("наценка берётся в форме, какую оставляет ядро после инициализации: getCostFunction, а не costMultiplier", () => {
    const coreShaped = { climb: { getCostFunction: () => cost => cost * 2 }, walk: { getCostFunction: () => cost => cost } };
    expect(walkedMeters([w(0, 0, 0), w(0, 100, 6, { action: "climb" })], { actions: coreShaped })).toBe(3);
    expect(walkedMeters([w(0, 0, 0), w(100, 0, 6)], { actions: coreShaped })).toBe(6);
    expect(actionCostMultiplier({ getCostFunction: () => { throw new Error("нужен токен"); } })).toBe(1);
    expect(actionCostMultiplier(undefined)).toBe(1);
  });

  it("пустое и мусор — ноль", () => {
    expect(walkedMeters([])).toBe(0);
    expect(walkedMeters(undefined)).toBe(0);
    expect(walkedMeters([w(0, 0, 0), w(1, 0, NaN), w(2, 0, null)])).toBe(0);
  });

  it("без isGMUser ГМ-овские отрезки считаются, с ним — нет", () => {
    const list = [w(0, 0, 0), w(100, 0, 2, { userId: "gm" })];
    expect(walkedMeters(list)).toBe(2);
    expect(walkedMeters(list, { isGMUser: id => id === "gm" })).toBe(0);
  });

  it("телепорт и подъём на месте пропускаются, наценка действия снимается", () => {
    const actions = { blink: { teleport: true }, climb: { costMultiplier: 2 } };
    expect(walkedMeters([w(0, 0, 0), w(500, 0, 5, { action: "blink" })], { actions })).toBe(0);
    expect(walkedMeters([w(0, 0, 0), w(0, 0, 10, { elevation: 10 })], { actions })).toBe(0);
    expect(walkedMeters([w(0, 0, 0), w(0, 100, 4, { action: "climb" })], { actions })).toBe(2);
  });
});

// Принудительные и «особые» сдвиги токена (Sahara task-bbe1, п.3): сдвиг, сделанный не по воле
// владельца токена, не должен ни блокироваться лимитом, ни съедать чужой бюджет пути.
describe("принудительный сдвиг: флаг в опциях апдейта и action displace", () => {
  // Форма CONFIG.Token.movement.actions v14 (client/config.mjs): displace — teleport, cost ×0.
  const ACTIONS_CORE = {
    walk: {}, blink: { teleport: true },
    displace: { teleport: true, measure: false, walls: null, costMultiplier: 0 }
  };
  const w = (x, y, cost, extra = {}) => ({ x, y, cost, action: "walk", userId: "p", ...extra });

  it("forcedMoveOptions кладёт whDBC.forcedMove; isForcedMove читает только его", () => {
    expect(forcedMoveOptions()).toEqual({ whDBC: { forcedMove: true } });
    expect(isForcedMove(forcedMoveOptions())).toBe(true);
    expect(isForcedMove({ whDBC: { forcedMove: true, other: 1 } })).toBe(true);
    // чужие ключи, пустое и мусор — не «принудительно»
    for (const op of [undefined, null, {}, { forcedMove: true }, { whDBC: {} }, { whDBC: { forcedMove: false } }, { whDBC: "yes" }]) {
      expect(isForcedMove(op)).toBe(false);
    }
  });

  it("forcedMoveOptions не затирает чужие опции whDBC", () => {
    expect(forcedMoveOptions({ whDBC: { source: "roundhouse" } })).toEqual({ whDBC: { source: "roundhouse", forcedMove: true } });
  });

  it("evaluatePath: сдвиг помечен принудительным — лимита нет, даже если это «перетаскивание» за лимитом", () => {
    const over = base({ method: "dragging", used: 3, step: 99 });
    expect(evaluatePath(over)).toMatchObject({ applies: true, allowed: false });
    expect(evaluatePath({ ...over, forced: true })).toMatchObject({ applies: false, allowed: true, reason: "forced" });
  });

  it("отрезок displace от игрока (не ГМ) бюджет не ест, а ходьба рядом — ест", () => {
    // Ядро пишет displace со стоимостью 0, но защищаемся и от ненулевой: действие — телепорт.
    const forced = [w(0, 0, 0), w(500, 0, 5, { action: "displace" })];
    expect(walkedMeters(forced, { actions: ACTIONS_CORE })).toBe(0);
    expect(walkedMeters(forced, { actions: ACTIONS_CORE, isGMUser: () => false })).toBe(0);
    const walked = [w(0, 0, 0), w(500, 0, 5)];
    expect(walkedMeters(walked, { actions: ACTIONS_CORE, isGMUser: () => false })).toBe(5);
    // смесь: 2 м ногами, сдвиг на 7 м, ещё 1 м ногами — всего 3
    const mixed = [w(0, 0, 0), w(200, 0, 2), w(900, 0, 7, { action: "displace" }), w(1000, 0, 1)];
    expect(walkedMeters(mixed, { actions: ACTIONS_CORE })).toBe(3);
  });
});

describe("displaceToken: система двигает токен — как именно", () => {
  function fakeTokenDoc(result = true) {
    const calls = [];
    return { calls, move: async (destination, options) => { calls.push({ destination, options }); return result; } };
  }

  it("принудительный сдвиг: action blink (телепорт ядра, СТЕНЫ учитываются), method api и флаг whDBC.forcedMove", async () => {
    const tok = fakeTokenDoc();
    const ok = await displaceToken(tok, { x: 300, y: 400 });
    expect(ok).toBe(true);
    expect(tok.calls).toHaveLength(1);
    expect(tok.calls[0].destination).toEqual({ x: 300, y: 400, action: TELEPORT_ACTION });
    expect(TELEPORT_ACTION).toBe("blink");
    expect(tok.calls[0].options).toMatchObject({ method: "api", whDBC: { forcedMove: true } });
  });

  it("walls:false — action displace: ядро стены не проверяет (walls:null), токен встаёт ровно в точку", async () => {
    const tok = fakeTokenDoc();
    await displaceToken(tok, { x: 5, y: 6 }, { walls: false });
    expect(tok.calls[0].destination).toEqual({ x: 5, y: 6, action: DISPLACE_ACTION });
    expect(DISPLACE_ACTION).toBe("displace");
  });

  it("собственный телепорт (forced:false): blink для истории, но без флага принудительного", async () => {
    const tok = fakeTokenDoc();
    await displaceToken(tok, { x: 10, y: 20, hidden: false }, { forced: false });
    expect(tok.calls[0].destination).toEqual({ x: 10, y: 20, hidden: false, action: "blink" });
    expect(isForcedMove(tok.calls[0].options)).toBe(false);
    expect(tok.calls[0].options.method).toBe("api");
  });

  it("action из destination затирается: сдвиг не может «идти пешком» и съесть бюджет", async () => {
    const tok = fakeTokenDoc();
    await displaceToken(tok, { x: 1, y: 1, action: "walk" });
    expect(tok.calls[0].destination.action).toBe("blink");
  });

  it("лишние опции вызывающего доезжают, не затирая флаг; результат move возвращается как есть", async () => {
    const tok = fakeTokenDoc(false);
    const ok = await displaceToken(tok, { x: 1, y: 2 }, { options: { animate: false, whDBC: { source: "x" } } });
    expect(ok).toBe(false);
    expect(tok.calls[0].options).toMatchObject({ animate: false, method: "api", whDBC: { source: "x", forcedMove: true } });
  });

  it("нет токена или у него нет move — false, ничего не падает", async () => {
    expect(await displaceToken(null, { x: 1, y: 1 })).toBe(false);
    expect(await displaceToken({}, { x: 1, y: 1 })).toBe(false);
  });
});

describe("evaluatePath: нуль у посчитанного листа и у неизвестного", () => {
  it("speedKnown + нулевое Полудвижение — лимит нуль: идти нельзя", () => {
    expect(evaluatePath(base({ movement: { halfMove: 0 }, speedKnown: true, step: 1 })))
      .toMatchObject({ applies: true, allowed: false, limit: 0 });
  });
  it("сообщение для такого случая не просит «объявить Движение»", () => {
    const v = evaluatePath(base({ movement: { halfMove: 0 }, speedKnown: true, step: 1 }));
    expect(pathLimitMessage("Бор", v, null)).toContain("не может идти");
  });
});

describe("категория перемещения по измеренному пути (Выстрел Навскидку)", () => {
  it("не двигался — null", () => {
    expect(moveDegreeFromPath(0, 3)).toBeNull();
    expect(moveDegreeFromPath(0.001, 3)).toBeNull();
  });

  it("в пределах Полудвижения — half; чуть дальше — full", () => {
    expect(moveDegreeFromPath(2, 3)).toBe("half");
    expect(moveDegreeFromPath(3, 3)).toBe("half");
    expect(moveDegreeFromPath(3.005, 3)).toBe("half"); // дрейф дробей сетки
    expect(moveDegreeFromPath(3.5, 3)).toBe("full");
    expect(moveDegreeFromPath(18, 3)).toBe("full");
  });

  it("скорость неизвестна — null, а не ложное full", () => {
    expect(moveDegreeFromPath(5, 0)).toBeNull();
    expect(moveDegreeFromPath(5, undefined)).toBeNull();
  });

  it("дальше обычного Бега (Спринт)", () => {
    expect(exceedsNormalRun(18, 18)).toBe(false);
    expect(exceedsNormalRun(18.5, 18)).toBe(true);
    expect(exceedsNormalRun(30, 0)).toBe(false);
  });
});

describe("тексты", () => {
  it("fmtMeters: целые без хвоста, дроби с запятой, шум сетки обрезан", () => {
    expect(fmtMeters(3)).toBe("3");
    expect(fmtMeters(4.5)).toBe("4,5");
    expect(fmtMeters(4.5000001)).toBe("4,5");
    expect(fmtMeters(NaN)).toBe("0");
  });

  it("сообщение при объявленных Движениях называет их и предлагает объявить ещё", () => {
    const allowance = { total: 9, entries: [{ kind: "half", meters: 3 }, { kind: "full", meters: 6 }] };
    const v = evaluatePath(base({ allowance, used: 8, step: 3 }));
    const msg = pathLimitMessage("Брат Гарн", v, allowance);
    expect(msg).toContain("Лимит пути исчерпан");
    expect(msg).toContain("Брат Гарн");
    expect(msg).toContain("8 м из 9 м");
    expect(msg).toContain("Полудвижение 3 м");
    expect(msg).toContain("Полное Движение 6 м");
    expect(msg).toContain("ГМ");
  });

  it("сообщение без объявления: soft говорит про Полудвижение, strict — что ходить нечем", () => {
    const soft = pathLimitMessage("Гарн", evaluatePath(base({ used: 2, step: 3 })), null);
    expect(soft).toContain("не объявлено");
    expect(soft).toContain("Полудвижение");
    const strict = pathLimitMessage("Гарн", evaluatePath(base({ mode: "strict", step: 1 })), null);
    expect(strict).toContain("не объявлено");
    expect(strict).not.toContain("доступно только Полудвижение");
  });

  it("сообщение при потолке Надёжной Поступи называет его", () => {
    const allowance = { total: 15, entries: [{ kind: "full", meters: 6 }, { kind: "charge", meters: 9 }] };
    const v = evaluatePath(base({ allowance, ceiling: 9, used: 8, step: 3 }));
    const msg = pathLimitMessage("Бор", v, allowance);
    expect(msg).toContain("Надёжная Поступь");
    expect(msg).toContain("9 м");
  });
});
