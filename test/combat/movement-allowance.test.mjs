// test/combat/movement-allowance.test.mjs
//
// Лимит пути токена (wdbc-l2urs): каждое Действие Движения, объявленное
// кнопкой, дописывает в flags.warhammer-dbc.moveAllowanceThisTurn свою
// дистанцию (SPD×N из листа) — сумма и есть бюджет Хода для блокировки в
// combat/path-limit.mjs. Здесь — что именно записывает каждое объявление и
// что провалившееся/запрещённое движение ничего не записывает.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  declareHalfMove, declareFullMove, declareCharge, declareRun, declareDisengage,
  declareVault, declareDuckAndCover, declareBreach, declareReposition,
  grantMoveAllowance, _resolveJump, _resolveClimb, _resolveSwim, movementMenuItems
} from "../../module/combat/movement-actions.mjs";
import { resolveAssassinStrikeClick } from "../../module/combat/assassin-strike.mjs";
import { resolvePressSuccess } from "../../module/combat/feint-press.mjs";
import {
  MOVE_ALLOWANCE_FLAG, PATH_LIMIT_OFF_FLAG, readAllowance
} from "../../module/rules/movement-path.mjs";
import { turnStartFlagClears, TURN_SCOPED_FLAG_KEYS } from "../../module/rules/turn-flags.mjs";

const NS = "warhammer-dbc";
const talent = name => ({ id: `t-${name}`, type: "talent", name });

function fighter({ items = [], system = {}, ap = 4 } = {}) {
  const flags = {};
  const list = [...items];
  const a = {
    id: "a1", uuid: "Actor.a1", name: "Бегун", type: "character", items: list,
    system: {
      actionPoints: { value: ap, max: ap },
      conditions: {},
      characteristics: { ag: { total: 40, bonus: 4 }, s: { total: 40, bonus: 4 } },
      skills: { acrobatics: { total: 40 }, athletics: { total: 40 } },
      movement: { halfMove: 4, move: 8, charge: 12, run: 24, sprintRun: 48 },
      ...system
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; },
    getActiveTokens: () => [],
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".");
        let node = a;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    }
  };
  list.get = id => list.find(i => i.id === id) ?? null;
  for (const it of list) it.parent = a;
  return a;
}

const allowanceOf = a => readAllowance(a.getFlag(NS, MOVE_ALLOWANCE_FLAG));
const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => { resetCaptured(); globalThis.game.combat = { started: true, id: "c1", round: 1 }; });
afterEach(() => { resetCaptured(); globalThis.game.combat = undefined; globalThis.game.user = {}; });

describe("grantMoveAllowance", () => {
  it("дописывает дистанцию и складывает с прежними", async () => {
    const a = fighter();
    await grantMoveAllowance(a, "half", 4);
    await grantMoveAllowance(a, "full", 8);
    expect(allowanceOf(a)).toMatchObject({ total: 12, entries: [{ kind: "half", meters: 4 }, { kind: "full", meters: 8 }] });
  });

  it("нулевая/мусорная дистанция и актор без setFlag — ничего не пишут и не падают", async () => {
    const a = fighter();
    await grantMoveAllowance(a, "half", 0);
    await grantMoveAllowance(a, "half", undefined);
    expect(a.getFlag(NS, MOVE_ALLOWANCE_FLAG)).toBeUndefined();
    await expect(grantMoveAllowance({ system: {} }, "half", 4)).resolves.toBeUndefined();
    await expect(grantMoveAllowance(null, "half", 4)).resolves.toBeUndefined();
  });

  it("флаг входит в реестр меток Хода и гасится в начале следующего Хода", () => {
    expect(TURN_SCOPED_FLAG_KEYS).toContain(MOVE_ALLOWANCE_FLAG);
    const a = fighter();
    a.flags = { [NS]: { [MOVE_ALLOWANCE_FLAG]: { total: 4, entries: [] } } };
    expect(turnStartFlagClears(a)).toEqual({ [`flags.${NS}.-=${MOVE_ALLOWANCE_FLAG}`]: null });
  });
});

describe("каждое объявление записывает свою дистанцию (SPD из листа: 4/8/12/24)", () => {
  it("Полудвижение — SPD×1", async () => {
    const a = fighter(); await declareHalfMove(a);
    expect(allowanceOf(a)).toMatchObject({ total: 4, entries: [{ kind: "half", meters: 4 }] });
  });

  it("Полное Движение — SPD×2", async () => {
    const a = fighter(); await declareFullMove(a);
    expect(allowanceOf(a)).toMatchObject({ total: 8, entries: [{ kind: "full", meters: 8 }] });
  });

  it("Стрельба от Бедра — то же Полное Движение", async () => {
    const a = fighter(); await declareFullMove(a, { hipShooting: true });
    expect(allowanceOf(a).total).toBe(8);
  });

  it("Натиск — SPD×3", async () => {
    const a = fighter(); await declareCharge(a);
    expect(allowanceOf(a)).toMatchObject({ total: 12, entries: [{ kind: "charge", meters: 12 }] });
  });

  it("Бег — SPD×6", async () => {
    const a = fighter(); await declareRun(a);
    expect(allowanceOf(a)).toMatchObject({ total: 24, entries: [{ kind: "run", meters: 24 }] });
  });

  it("Выход из Боя — SPD×1", async () => {
    const a = fighter(); await declareDisengage(a);
    expect(allowanceOf(a)).toMatchObject({ total: 4, entries: [{ kind: "disengage", meters: 4 }] });
  });

  it("Вольт — SPD×1 (с Пружинящей Стойкой +4)", async () => {
    const a = fighter(); await declareVault(a);
    expect(allowanceOf(a)).toMatchObject({ total: 4, entries: [{ kind: "vault", meters: 4 }] });
    const b = fighter({ system: { meleeStance: "springing" } }); await declareVault(b);
    expect(allowanceOf(b).total).toBe(8);
  });

  it("Перебежка — SPD×2", async () => {
    const a = fighter(); await declareDuckAndCover(a);
    expect(allowanceOf(a)).toMatchObject({ total: 8, entries: [{ kind: "duck", meters: 8 }] });
  });

  it("Полудвижение и Полное в одном Ходу складываются: 4 + 8 = 12", async () => {
    const a = fighter(); await declareHalfMove(a); await declareFullMove(a);
    expect(allowanceOf(a).total).toBe(12);
  });
});

describe("Бег со Спринтом: дальность по ответу игрока", () => {
  const SPRINT = "Sprint / Спринт";
  const runWith = async (a, action) => {
    const p = declareRun(a);
    await flush();
    await captured.press(action, {});
    await p;
  };

  it("«нет» — обычный Бег SPD×6 (24 м), дальше не пустят", async () => {
    const a = fighter({ items: [talent(SPRINT)] });
    await runWith(a, "normal");
    expect(allowanceOf(a)).toMatchObject({ total: 24, entries: [{ kind: "run", meters: 24 }] });
  });

  it("«да» — SPD×12 (48 м)", async () => {
    const a = fighter({ items: [talent(SPRINT)] });
    await runWith(a, "far");
    expect(allowanceOf(a)).toMatchObject({ total: 48 });
  });
});

describe("запрещённое или проваленное Движение ничего не записывает", () => {
  it("нет ОД", async () => {
    const a = fighter({ ap: 0 }); await declareFullMove(a);
    expect(a.getFlag(NS, MOVE_ALLOWANCE_FLAG)).toBeUndefined();
  });

  it("потеряны обе ноги", async () => {
    const a = fighter({ system: { conditions: { lostLegs: true, lostLegsCount: 2 } } });
    await declareHalfMove(a);
    expect(a.getFlag(NS, MOVE_ALLOWANCE_FLAG)).toBeUndefined();
  });

  it("Повален: Натиск и Бег запрещены", async () => {
    const a = fighter({ system: { conditions: { prone: true } } });
    await declareCharge(a); await declareRun(a);
    expect(a.getFlag(NS, MOVE_ALLOWANCE_FLAG)).toBeUndefined();
  });

  it("без обеих стоп провалил бросок равновесия — движения нет", async () => {
    captured.nextRoll = 95;
    const a = fighter({ system: { conditions: { lostFeet: true, lostFeetCount: 2 } } });
    await declareHalfMove(a);
    expect(a.getFlag(NS, MOVE_ALLOWANCE_FLAG)).toBeUndefined();
  });
});

describe("Смена Позиции и Прорыв — Полудвижение (SPD×1)", () => {
  it("Смена Позиции в первом Раунде", async () => {
    const a = fighter({ items: [talent("Reposition / Смена Позиции")] });
    await declareReposition(a);
    expect(allowanceOf(a)).toMatchObject({ entries: [{ kind: "reposition", meters: 4 }] });
  });

  it("Прорыв (Талант + щит в руке + Защитная Стойка)", async () => {
    const shield = { id: "sh1", type: "weapon", name: "Щит", system: { equipped: true, weaponClass: "melee", shieldAP: 4 } };
    const a = fighter({ items: [talent("Breacher / Прорыватель"), shield], system: { meleeStance: "defensive" } });
    await declareBreach(a);
    expect(allowanceOf(a)).toMatchObject({ entries: [{ kind: "breach", meters: 4 }] });
  });
});

describe("Прыжок и Карабканье: дальность броска — тоже путь", () => {
  it("Горизонтальный прыжок с разбега: успех даёт S.b + Успехи метров", async () => {
    captured.nextRoll = 5;               // успех, степень = 4 (порог 40: (40−5)/10 → 3+1)
    const a = fighter();
    await _resolveJump(a, "hrun", 40, 0, 0, 4);
    const entry = allowanceOf(a).entries[0];
    expect(entry.kind).toBe("jump");
    expect(entry.meters).toBeGreaterThan(4);
  });

  it("Вертикальный прыжок и проваленный — пути по горизонтали не добавляют", async () => {
    captured.nextRoll = 5;
    const a = fighter();
    await _resolveJump(a, "vplace", 40, 0, 0, 4);
    expect(a.getFlag(NS, MOVE_ALLOWANCE_FLAG)).toBeUndefined();
    captured.nextRoll = 99;
    const b = fighter();
    await _resolveJump(b, "hrun", 40, 0, 0, 4);
    expect(b.getFlag(NS, MOVE_ALLOWANCE_FLAG)).toBeUndefined();
  });

  it("Карабканье: успех — SPD/2 + Успехи; провал (падение) — ничего", async () => {
    captured.nextRoll = 5;
    const a = fighter();
    await _resolveClimb(a, "simple", 40, 40, 0, 4);
    const entry = allowanceOf(a).entries[0];
    expect(entry.kind).toBe("climb");
    expect(entry.meters).toBeGreaterThan(2);
    captured.nextRoll = 99;
    const b = fighter();
    await _resolveClimb(b, "simple", 40, 40, 0, 4);
    expect(b.getFlag(NS, MOVE_ALLOWANCE_FLAG)).toBeUndefined();
  });
});

describe("Движения не из меню Движения тоже пишут бюджет (находка ревью wdbc-l2urs)", () => {
  it("Плавание: успех — SPD пловца в метрах (½S.b); провал — ничего", async () => {
    captured.nextRoll = 5;
    const a = fighter();
    await _resolveSwim(a, 40, false, false, 0, 4);
    expect(allowanceOf(a)).toMatchObject({ entries: [{ kind: "swim", meters: 2 }] });
    captured.nextRoll = 99;
    const b = fighter();
    await _resolveSwim(b, 40, false, false, 0, 4);
    expect(b.getFlag(NS, MOVE_ALLOWANCE_FLAG)).toBeUndefined();
  });

  it("Удар Ассасина: свободное Полудвижение при успехе — SPD×1 в бюджет", async () => {
    const a = fighter({ items: [talent("Assassin Strike / Удар Ассасина")] });
    a.isOwner = true;
    globalThis.fromUuid = async uuid => (uuid === a.uuid ? a : null);
    captured.dice = [25];
    await resolveAssassinStrikeClick(a.uuid);
    expect(allowanceOf(a)).toMatchObject({ entries: [{ kind: "assassin", meters: 4 }] });
  });

  it("Давление: давящий может последовать за целью — до потолка сдвига; Огневая Угроза — нет", async () => {
    const actor = fighter();
    const target = fighter({ system: { movement: { halfMove: 3 } } });
    await resolvePressSuccess(actor, { deg: 7, target });
    expect(allowanceOf(actor)).toMatchObject({ entries: [{ kind: "press", meters: 3 }] });
    const threat = fighter();
    await resolvePressSuccess(threat, { deg: 7, target, noFollow: true });
    expect(threat.getFlag(NS, MOVE_ALLOWANCE_FLAG)).toBeUndefined();
  });
});

describe("пункт меню Движения «Лимит пути» — только ГМу", () => {
  it("игрок его не видит", () => {
    globalThis.game.user = { isGM: false };
    const keys = movementMenuItems(fighter()).map(i => i.key);
    expect(keys).not.toContain("pathLimitToggle");
  });

  it("ГМ видит и переключает флаг «без лимита» на акторе", async () => {
    globalThis.game.user = { isGM: true };
    const a = fighter();
    const item = movementMenuItems(a).find(i => i.key === "pathLimitToggle");
    expect(item).toBeTruthy();
    expect(item.label).toContain("снять");
    await item.action();
    expect(a.getFlag(NS, PATH_LIMIT_OFF_FLAG)).toBe(true);
    const back = movementMenuItems(a).find(i => i.key === "pathLimitToggle");
    expect(back.label).toContain("вернуть");
    await back.action();
    expect(a.getFlag(NS, PATH_LIMIT_OFF_FLAG)).toBeFalsy();
  });
});
