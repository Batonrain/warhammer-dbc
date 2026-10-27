// test/combat/talent-move.test.mjs
//
// Пункт меню «Движение по Таланту» (Sahara task-bbe1, решение владельца 27.10.2026): Таланты и
// Черты с Движением без своей механики пишут бюджет пути, платят Реакциями/ОД и ограничены «раз
// в Раунд/бой» по таблице rules/talent-moves.mjs. Предметы актора — НАСТОЯЩИЕ документы packs-src.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { declareTalentMove, talentMoveRows, showTalentMoveDialog } from "../../module/combat/talent-move.mjs";
import { movementMenuItems } from "../../module/combat/movement-actions.mjs";
import { MOVE_ALLOWANCE_FLAG, readAllowance } from "../../module/rules/movement-path.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const NS = "warhammer-dbc";
const ROOT = path.resolve(import.meta.dirname, "../..");

function packDoc(dir, idTail) {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => {
    const p = path.join(d, f.name);
    return f.isDirectory() ? walk(p) : (f.name.endsWith(`_${idTail}.json`) ? [p] : []);
  });
  const [file] = walk(path.join(ROOT, "packs-src", dir));
  if (!file) throw new Error(`нет ${idTail} в ${dir}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
// id документов паков (имя файла может поменяться, идентификатор — нет)
const DOCS = {
  dance:      () => packDoc("aeldari-talents", "BsLX5FYuabzEbIN6"),
  mercenary:  () => packDoc("traits", "YEaypvwq2nUSsNwu"),
  faolchu:    () => packDoc("talents", "N2wZL3ldU4Rme9Hn"),
  mistLeap:   () => packDoc("talents", "GT0mCLQ13cgAwr9y"),
  mistwalker: () => packDoc("traits", "jCGAtzhmoeqgUbbC")
};

function fighter(docs = [], { ap = 2, reactions = 2, spd = 3, trophy = 2 } = {}) {
  const flags = {};
  const items = docs.map((d, i) => ({ id: `i${i}`, name: d.name, type: d.type, system: d.system, flags: d.flags ?? {} }));
  const a = {
    id: "a1", uuid: "Actor.a1", name: "Танцор", type: "character", items: Object.assign(items, { contents: items }),
    // Система — из НАСТОЯЩЕЙ схемы персонажа (поля, которых в ней нет, фикстура не придумывает), поверх — значения.
    system: (() => {
      const sys = new ACTOR_DATA_MODELS.character({}).toObject();
      Object.assign(sys.actionPoints, { value: ap, max: 2 });
      Object.assign(sys.reactions, { value: reactions, max: 2, defenseValue: 0 });
      sys.characteristics.per.bonus = 4;
      sys.trophyPoints.value = trophy;
      Object.assign(sys.movement, { halfMove: spd, move: spd * 2, charge: spd * 3, run: spd * 6 });
      return sys;
    })(),
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; },
    getActiveTokens: () => [],
    update: async data => {
      for (const [p, v] of Object.entries(data)) {
        const keys = p.split(".");
        let node = a;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = v;
      }
    }
  };
  return a;
}
const allowance = a => readAllowance(a.getFlag(NS, MOVE_ALLOWANCE_FLAG));

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = { started: true, id: "c1", round: 1 };
  globalThis.game.user = { id: "u1", isGM: false };
});
afterEach(() => { globalThis.game.combat = undefined; delete globalThis.canvas; });

describe("walk: Танец Рассечения — бесплатный рывок на Полудвижение", () => {
  it("пишет Полудвижение (3 м) в бюджет пути, ОД не тратит, ставит «двигался»", async () => {
    const a = fighter([DOCS.dance()]);
    expect(await declareTalentMove(a, "danceOfCarnage", "carnage")).toBe(true);
    expect(allowance(a)).toMatchObject({ total: 3, entries: [{ kind: "Танец Рассечения", meters: 3 }] });
    expect(a.system.actionPoints.value).toBe(2);
    expect(a.getFlag(NS, "movedThisTurn")).toBe(true);
    expect(a.getFlag(NS, "moveDegreeThisTurn")).toBe("half");
    expect(captured.chat.at(-1).content).toContain("Танец Рассечения");
    expect(captured.chat.at(-1).content).toContain("−30"); // что остаётся руками
  });

  it("у персонажа без Таланта — отказ, бюджет не пишется", async () => {
    const a = fighter([]);
    expect(await declareTalentMove(a, "danceOfCarnage", "carnage")).toBe(false);
    expect(a.getFlag(NS, MOVE_ALLOWANCE_FLAG)).toBeUndefined();
  });
});

describe("Скорость Сокола: «не двигался» меряется, а не подтверждается игроком", () => {
  it("флаг «двигался» стоит — Движение за Реакцию отказано, ничего не списано; игрок не двигался — проходит", async () => {
    const moved = fighter([DOCS.faolchu()], { reactions: 2 });
    await moved.setFlag(NS, "movedThisTurn", true);
    expect(await declareTalentMove(moved, "speedOfTheFaolchu", "reactionHalf")).toBe(false);
    expect(moved.system.reactions.value).toBe(2);
    expect(captured.warnings.at(-1)).toContain("Двигался");
    expect(talentMoveRows(moved).find(r => r.move.id === "reactionHalf").gate.ok).toBe(false);

    const still = fighter([DOCS.faolchu()], { reactions: 2 });
    expect(await declareTalentMove(still, "speedOfTheFaolchu", "reactionHalf")).toBe(true);
  });

  it("само Движение за Реакцию ставит «двигался»: второе подряд отказано (\"не активирует Талант\")", async () => {
    const a = fighter([DOCS.faolchu()], { reactions: 2 });
    expect(await declareTalentMove(a, "speedOfTheFaolchu", "reactionHalf")).toBe(true);
    expect(a.getFlag(NS, "movedThisTurn")).toBe(true);
    expect(await declareTalentMove(a, "speedOfTheFaolchu", "reactionHalf")).toBe(false);
  });

  it("реальный перемещённый токен (initMovedFlagTracking) выставляет тот же флаг — условие сверяется с ним", async () => {
    const handlers = {};
    const prevOn = globalThis.Hooks.on;
    globalThis.Hooks.on = (name, fn) => { (handlers[name] ??= []).push(fn); };
    const { initMovedFlagTracking } = await import("../../module/combat/movement-actions.mjs");
    initMovedFlagTracking();
    globalThis.Hooks.on = prevOn;
    const a = fighter([DOCS.faolchu()], { reactions: 2 });
    await Promise.all(handlers.updateToken.map(fn => fn({ actor: a }, { x: 100 }, {}, "u1")));
    expect(await declareTalentMove(a, "speedOfTheFaolchu", "reactionHalf")).toBe(false);
  });

  it("ГМ условие обходит", async () => {
    globalThis.game.user = { id: "gm", isGM: true };
    const a = fighter([DOCS.faolchu()], { reactions: 2 });
    await a.setFlag(NS, "movedThisTurn", true);
    expect(await declareTalentMove(a, "speedOfTheFaolchu", "reactionHalf")).toBe(true);
  });
});

describe("Скорость Сокола: Движение за Реакции, Свободную Атаку не провоцирует", () => {
  it("Полное за 2 Реакции: списывает обе, пишет 6 м, ставит флаг Выхода из Боя", async () => {
    const a = fighter([DOCS.faolchu()], { reactions: 2 });
    expect(await declareTalentMove(a, "speedOfTheFaolchu", "reactionFull")).toBe(true);
    expect(a.system.reactions.value).toBe(0);
    expect(allowance(a).total).toBe(6);
    expect(a.getFlag(NS, "disengageActive")).toBe(true);
    expect(a.getFlag(NS, "moveDegreeThisTurn")).toBe("full");
  });

  it("одной Реакции на Полное мало — ничего не списано и не записано", async () => {
    const a = fighter([DOCS.faolchu()], { reactions: 1 });
    expect(await declareTalentMove(a, "speedOfTheFaolchu", "reactionFull")).toBe(false);
    expect(a.system.reactions.value).toBe(1);
    expect(a.getFlag(NS, MOVE_ALLOWANCE_FLAG)).toBeUndefined();
    expect(captured.warnings.at(-1)).toContain("Реакций");
  });

  it("Полудвижение за 1 Реакцию — остаётся вторая", async () => {
    const a = fighter([DOCS.faolchu()], { reactions: 2 });
    await declareTalentMove(a, "speedOfTheFaolchu", "reactionHalf");
    expect(a.system.reactions.value).toBe(1);
    expect(allowance(a).total).toBe(3);
  });
});

describe("Наёмник Дела: бесплатное Полное Движение — 1-й Раунд, раз за бой", () => {
  it("в 1-м Раунде даёт 6 м; повторно в том же бою — нет", async () => {
    const a = fighter([DOCS.mercenary()]);
    expect(await declareTalentMove(a, "mercenaryOfTheMatter", "firstRoundFullMove")).toBe(true);
    expect(allowance(a).total).toBe(6);
    expect(await declareTalentMove(a, "mercenaryOfTheMatter", "firstRoundFullMove")).toBe(false);
    expect(allowance(a).total).toBe(6);
    expect(captured.warnings.at(-1)).toContain("в этом бою");
  });

  it("во 2-м Раунде — отказ", async () => {
    globalThis.game.combat.round = 2;
    const a = fighter([DOCS.mercenary()]);
    expect(await declareTalentMove(a, "mercenaryOfTheMatter", "firstRoundFullMove")).toBe(false);
    expect(captured.warnings.at(-1)).toContain("1-м Раунде");
  });
});

describe("teleport: Туманоходец и Туманный Прыжок — перенос токена, бюджет пути не трогается", () => {
  function sceneFor(actor, { stopAt = null, result = true } = {}) {
    const tokenDoc = {
      x: 0, y: 0, width: 1, height: 1, parent: {}, moves: [],
      move: async (destination, options) => {
        tokenDoc.moves.push({ destination, options });
        if (stopAt !== null) { tokenDoc.x = stopAt; return false; }
        if (result) { tokenDoc.x = destination.x; tokenDoc.y = destination.y; }
        return result;
      }
    };
    actor.getActiveTokens = () => [tokenDoc];
    return tokenDoc;
  }
  const pickAt = (x, y) => { globalThis.canvas = { ready: true, grid: { size: 100 }, regions: { placeRegion: async () => ({ shapes: [{ x, y }], delete: async () => {} }) } }; };

  it("Туманоходец (P.b 4): телепорт на 3 м — blink, без записи бюджета, раз в Раунд", async () => {
    const a = fighter([DOCS.mistwalker()]);
    const tok = sceneFor(a);
    pickAt(350, 50); // центр токена (50,50): 3 м
    expect(await declareTalentMove(a, "mistwalker", "mist")).toBe(true);
    expect(tok.moves[0].destination.action).toBe("blink");
    expect(a.getFlag(NS, MOVE_ALLOWANCE_FLAG)).toBeUndefined();
    expect(await declareTalentMove(a, "mistwalker", "mist")).toBe(false);
    expect(captured.warnings.at(-1)).toContain("в этом Раунде");
    expect(tok.moves).toHaveLength(1);
  });

  it("точка дальше P.b — отказ, «раз в Раунд» не потрачено", async () => {
    const a = fighter([DOCS.mistwalker()]);
    const tok = sceneFor(a);
    pickAt(1050, 50); // 10 м > 4
    expect(await declareTalentMove(a, "mistwalker", "mist")).toBe(false);
    expect(tok.moves).toHaveLength(0);
    pickAt(350, 50);
    expect(await declareTalentMove(a, "mistwalker", "mist")).toBe(true);
  });

  it("блокирующее Состояние (Оглушён) — Туманный Прыжок не телепортирует, пока цена не списывается", async () => {
    const a = fighter([DOCS.mistLeap()], { ap: 2 });
    a.system.conditions.stunned = true;
    const tok = sceneFor(a);
    pickAt(450, 50);
    expect(await declareTalentMove(a, "mistLeap", "leap")).toBe(false);
    expect(tok.moves).toHaveLength(0);
    expect(a.system.actionPoints.value).toBe(2);
  });

  it("токен вплотную к стене (ядро отклонило) — игрок получает объяснение", async () => {
    const a = fighter([DOCS.mistwalker()]);
    sceneFor(a, { result: false });
    pickAt(450, 50);
    await declareTalentMove(a, "mistwalker", "mist");
    expect(captured.warnings.at(-1)).toContain("стена");
  });

  it("отмена выбора точки — ничего не потрачено; Туманный Прыжок платит 2 ОД только после переноса", async () => {
    const a = fighter([DOCS.mistLeap()], { ap: 2 });
    const tok = sceneFor(a);
    globalThis.canvas = { ready: true, grid: { size: 100 }, regions: { placeRegion: async () => null } };
    expect(await declareTalentMove(a, "mistLeap", "leap")).toBe(false);
    expect(a.system.actionPoints.value).toBe(2);
    pickAt(2050, 50); // 20 м — потолка нет
    expect(await declareTalentMove(a, "mistLeap", "leap")).toBe(true);
    expect(a.system.actionPoints.value).toBe(0);
    expect(a.system.trophyPoints.value).toBe(1); // Очко Трофеев списано (было 2)
    expect(tok.moves[0].destination.action).toBe("blink");
    expect(captured.chat.at(-1).content).toContain("Трофеев");
  });

  it("без Очка Трофеев Туманный Прыжок отказывает до выбора точки: ничего не списано, токен на месте", async () => {
    const a = fighter([DOCS.mistLeap()], { ap: 2, trophy: 0 });
    const tok = sceneFor(a);
    pickAt(450, 50);
    expect(await declareTalentMove(a, "mistLeap", "leap")).toBe(false);
    expect(tok.moves).toHaveLength(0);
    expect(a.system.actionPoints.value).toBe(2);
    expect(captured.warnings.at(-1)).toContain("Очков Трофеев");
    // строка меню называет причину
    expect(talentMoveRows(a).find(r => r.move.id === "leap").gate.reason).toContain("Трофеев");
  });

  it("отказ ядра: Очко Трофеев не списывается", async () => {
    const a = fighter([DOCS.mistLeap()], { ap: 2, trophy: 1 });
    sceneFor(a, { result: false });
    pickAt(450, 50);
    await declareTalentMove(a, "mistLeap", "leap");
    expect(a.system.trophyPoints.value).toBe(1);
  });

  it("стена остановила токен на полпути — перенос засчитан, карточка называет стену", async () => {
    const a = fighter([DOCS.mistwalker()]);
    sceneFor(a, { stopAt: 200 });
    pickAt(450, 50);
    expect(await declareTalentMove(a, "mistwalker", "mist")).toBe(true);
    expect(captured.chat.at(-1).content).toContain("стена");
  });

  it("ядро отклонило перемещение — цена и «раз в Раунд» не тратятся", async () => {
    const a = fighter([DOCS.mistLeap()], { ap: 2 });
    sceneFor(a, { result: false });
    pickAt(450, 50);
    expect(await declareTalentMove(a, "mistLeap", "leap")).toBe(false);
    expect(a.system.actionPoints.value).toBe(2);
  });
});

describe("меню и диалог", () => {
  it("пункт «Движение по Таланту» виден в бою только носителям Таланта", () => {
    const keys = actor => movementMenuItems(actor).map(i => i.key);
    expect(keys(fighter([]))).not.toContain("talentMove");
    expect(keys(fighter([DOCS.dance()]))).toContain("talentMove");
    globalThis.game.combat = undefined;
    expect(keys(fighter([DOCS.dance()]))).not.toContain("talentMove");
  });

  it("talentMoveRows: недоступное названо причиной (Наёмник Дела во 2-м Раунде)", () => {
    globalThis.game.combat.round = 2;
    const [row] = talentMoveRows(fighter([DOCS.mercenary()]));
    expect(row.gate.ok).toBe(false);
    expect(row.gate.reason).toContain("1-м Раунде");
  });

  it("диалог: кнопка выбранного Движения запускает его", async () => {
    const a = fighter([DOCS.dance()]);
    const done = showTalentMoveDialog(a);
    await new Promise(r => setTimeout(r, 0));
    await captured.press("danceOfCarnage:carnage", {});
    await done;
    expect(allowance(a).total).toBe(3);
  });
});
