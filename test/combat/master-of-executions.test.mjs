// test/combat/master-of-executions.test.mjs
//
// Мастер Казней (Sahara 1-54b9): Туманоходец (запрет в Терминаторской броне, «не дальше от цели», выход из Захвата),
// Туманный Прыжок (цель, дальность Unnatural Senses, решение ГМа, базовый контакт, Натиск), Спаситель Туманов
// (обмен местами при телепорте и после перехвата Fanatic, ГМ-релей), Взор Охотника, «Психопатия» Целеустремлённого
// Охотника. Предметы актора — НАСТОЯЩИЕ документы packs-src, схема актора — настоящая.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { declareTalentMove, talentMoveRows } from "../../module/combat/talent-move.mjs";
import {
  fanaticSavior, huntersSightRows, useHuntersSight, performSaviorSwapWrite
} from "../../module/combat/master-of-executions.mjs";
import { checkTargetWrite, performTargetWrite } from "../../module/combat/gm-relay.mjs";
import { grantStartingDisorder } from "../../module/sheets/tabs/disorders.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const NS = "warhammer-dbc";
const TRAITS = "packs-src/traits/Элитные_архетипы/Мастер_Казней";
const TALENTS = "packs-src/talents/Элитные_архетипы/Мастер_Казней";
const DOCS = {
  leap: () => packDocById(TALENTS, "GT0mCLQ13cgAwr9y"),
  savior: () => packDocById(TALENTS, "X2jE56CGvNbtHSg5"),
  marked: () => packDocById(TALENTS, "Bxm4rknKzewAo9sG"),
  walker: () => packDocById(TRAITS, "jCGAtzhmoeqgUbbC"),
  sight: () => packDocById(TRAITS, "9o6Ux4E19zCmt4gt"),
  single: () => packDocById(TRAITS, "SMFzhi92ZMmAx2pB"),
  senses: rating => {
    const d = packDocById("packs-src/traits", "7x1jLzfRKXuA0vew");
    return { ...d, system: { ...d.system, rating } };
  },
  aegis: () => packDocById("packs-src/armor/Астартес/Броня/Терминаторская", "zWrnp0yUuNetd2cf")
};

const GRID = { size: 100, distance: 1 };
const scene = { grid: GRID, tokens: [] };

function makeActor(docs, { name = "Мастер Казней", uuid = "Actor.moe", ap = 2, trophy = 2, helpless = false, extra = {}, disposition = null } = {}) {
  const flags = {};
  const items = docs.map((d, i) => ({ id: `i${i}`, name: d.name, type: d.type, system: d.system, flags: d.flags ?? {}, getFlag: (s, k) => d.flags?.[s]?.[k] }));
  items.get = () => null;
  const sys = new ACTOR_DATA_MODELS.character({}).toObject();
  Object.assign(sys.actionPoints, { value: ap, max: 2 });
  Object.assign(sys.reactions, { value: 2, max: 2, defenseValue: 0 });
  sys.characteristics.per.bonus = 4;
  sys.trophyPoints.value = trophy;
  Object.assign(sys.movement, { halfMove: 3, move: 6, charge: 9, run: 18 });
  if (helpless) sys.conditions.helpless = true;
  const a = {
    id: uuid.split(".").at(-1), uuid, name, type: "character", items, isOwner: true, hasPlayerOwner: disposition === 1,
    system: sys, flags,
    getFlag: (s, k) => flags[`${s}.${k}`],
    setFlag: async (s, k, v) => { flags[`${s}.${k}`] = v; },
    unsetFlag: async (s, k) => { delete flags[`${s}.${k}`]; },
    getActiveTokens: () => [],
    testUserPermission: () => true,
    update: async data => {
      for (const [p, v] of Object.entries(data)) {
        const keys = p.split(".");
        let node = a;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = v;
      }
    },
    ...extra
  };
  return a;
}

let registry;
function addToken(actor, x, y, { width = 1, height = 1, disposition = -1, stopAt = null, result = true } = {}) {
  const t = {
    id: `t_${actor.id}`, uuid: `Scene.s.Token.t_${actor.id}`, x, y, width, height, parent: scene, actor, disposition,
    moves: [], updates: [],
    move: async destination => {
      t.moves.push(destination);
      if (stopAt !== null) { t.x = stopAt; return false; }
      if (result) { t.x = destination.x; t.y = destination.y; }
      return result;
    },
    update: async data => { t.updates.push(data); Object.assign(t, data); }
  };
  scene.tokens.push(t);
  registry[t.uuid] = t;
  actor.getActiveTokens = () => [t];
  return t;
}
const target = (...docs) => { globalThis.game.user.targets = new Set(docs.map(d => ({ document: d }))); };
const allowancePresent = a => a.getFlag(NS, "moveAllowanceThisTurn");

async function pressWhenOpen(action, form = {}) {
  for (let i = 0; i < 40 && !captured.dialog; i++) await new Promise(r => setTimeout(r, 0));
  await captured.press(action, form);
}

function leapKit({ extraDocs = [], preyAt = 1000, preyActor = {}, senses = 20, hunterOpts = {} } = {}) {
  const hunter = makeActor([DOCS.leap(), DOCS.walker(), DOCS.senses(senses), ...extraDocs], hunterOpts);
  const prey = makeActor([], { name: "Чемпион", uuid: "Actor.prey", ...preyActor });
  const hTok = addToken(hunter, 0, 0, { disposition: 1 });
  const pTok = addToken(prey, preyAt, 0);
  target(pTok);
  return { hunter, prey, hTok, pTok };
}

beforeEach(() => {
  resetCaptured();
  registry = {};
  scene.tokens = [];
  globalThis.game.combat = { started: true, id: "c1", round: 1 };
  globalThis.game.user = { id: "u1", isGM: true, targets: new Set() };
  globalThis.game.users = [{ id: "u1", isGM: true }, { id: "u2", isGM: false }];
  globalThis.fromUuid = async u => registry[u] ?? null;
  globalThis.canvas = { ready: true, grid: GRID, scene: { grid: GRID, tokens: [] } };
});
afterEach(() => {
  globalThis.game.combat = undefined;
  globalThis.game.user = {};
  globalThis.fromUuid = async () => null;
  delete globalThis.canvas;
});

describe("Туманный Прыжок: в базовый контакт с добычей, как Натиск", () => {
  it("прыжок к отмеченной цели: токен в контакте, Очко Трофеев списано, ОД не списаны, База «Натиск», метки Хода", async () => {
    const { hunter, hTok, prey } = leapKit();
    const p = declareTalentMove(hunter, "mistLeap", "leap");
    await pressWhenOpen("ok"); // решение ГМа «достойна ли добыча»
    expect(await p).toBe(true);
    expect(hTok.moves[0].action).toBe("blink");
    expect(hTok.x).toBeCloseTo(900);
    expect(hTok.y).toBeCloseTo(0);
    expect(hunter.system.trophyPoints.value).toBe(1);
    expect(hunter.system.actionPoints.value).toBe(2);
    expect(hunter.system.meleeBase).toBe("charge");
    expect(hunter.flags[NS].fastMoveThisTurn).toBe(true);
    expect(hunter.getFlag(NS, "movedThisTurn")).toBeTruthy();
    expect(hunter.getFlag(NS, "chargeChecked")).toBe("c1:1");
    expect(allowancePresent(hunter)).toBeUndefined();
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Натиском");
    expect(card).toContain(prey.name);
  });

  it("без выцеленной добычи — отказ, ничего не потрачено", async () => {
    const { hunter, hTok } = leapKit();
    target();
    expect(await declareTalentMove(hunter, "mistLeap", "leap")).toBe(false);
    expect(captured.warnings.at(-1)).toContain("выцельте");
    expect(hTok.moves).toHaveLength(0);
    expect(hunter.system.trophyPoints.value).toBe(2);
  });

  it("без Трейта Mistwalker — отказ: книга телепортирует им", async () => {
    const hunter = makeActor([DOCS.leap(), DOCS.senses(20)]);
    const prey = makeActor([], { name: "Чемпион", uuid: "Actor.prey" });
    const hTok = addToken(hunter, 0, 0);
    target(addToken(prey, 500, 0));
    expect(await declareTalentMove(hunter, "mistLeap", "leap")).toBe(false);
    expect(captured.warnings.at(-1)).toContain("Mistwalker");
    expect(hTok.moves).toHaveLength(0);
  });

  it("добыча дальше зоны Unnatural Senses — отказ; у отмеченной добычи зона в километрах", async () => {
    const far = leapKit({ preyAt: 5000, senses: 20 }); // 50 м > 20 м
    expect(await declareTalentMove(far.hunter, "mistLeap", "leap")).toBe(false);
    expect(captured.warnings.at(-1)).toContain("Unnatural Senses");
    expect(far.hTok.moves).toHaveLength(0);

    resetCaptured();
    scene.tokens = [];
    const marked = leapKit({ preyAt: 5000, senses: 20, extraDocs: [DOCS.marked()] });
    await marked.hunter.setFlag(NS, "markedPrey", { targetUuid: marked.prey.uuid, tokenUuid: marked.pTok.uuid, name: marked.prey.name });
    expect(await declareTalentMove(marked.hunter, "mistLeap", "leap")).toBe(true);
    expect(marked.hTok.x).toBeCloseTo(4900);
    expect(captured.dialog).toBeNull(); // отмеченная добыча уже признана достойной — ГМ не спрашивают
  });

  it("ГМ решил «не достойна» — ничего не потрачено", async () => {
    const { hunter, hTok } = leapKit();
    const p = declareTalentMove(hunter, "mistLeap", "leap");
    await pressWhenOpen("no");
    expect(await p).toBe(false);
    expect(hTok.moves).toHaveLength(0);
    expect(hunter.system.trophyPoints.value).toBe(2);
    expect(hunter.system.meleeBase).not.toBe("charge");
  });

  it("убитая цель, повален, Терминаторская броня — отказ", async () => {
    const dead = leapKit();
    dead.prey.flags[`${NS}.deceased`] = true;
    expect(await declareTalentMove(dead.hunter, "mistLeap", "leap")).toBe(false);
    expect(captured.warnings.at(-1)).toContain("убита");

    resetCaptured(); scene.tokens = [];
    const prone = leapKit();
    prone.hunter.system.conditions.prone = true;
    expect(await declareTalentMove(prone.hunter, "mistLeap", "leap")).toBe(false);
    expect(captured.warnings.at(-1)).toContain("Повален");

    resetCaptured(); scene.tokens = [];
    const armoured = leapKit({ extraDocs: [{ ...DOCS.aegis(), system: { ...DOCS.aegis().system, equipped: true } }] });
    expect(await declareTalentMove(armoured.hunter, "mistLeap", "leap")).toBe(false);
    expect(captured.warnings.at(-1)).toContain("Терминаторской");
    expect(armoured.hTok.moves).toHaveLength(0);
  });

  it("уже в базовом контакте — телепорт не нужен, Натиск и Очко всё равно засчитаны", async () => {
    const { hunter, hTok } = leapKit({ preyAt: 100 });
    const p = declareTalentMove(hunter, "mistLeap", "leap");
    await pressWhenOpen("ok");
    expect(await p).toBe(true);
    expect(hTok.moves).toHaveLength(0);
    expect(hunter.system.meleeBase).toBe("charge");
    expect(hunter.system.trophyPoints.value).toBe(1);
    expect(captured.chat.at(-1).content).toContain("не понадобился");
  });

  it("союзник в таргете не принимается за добычу", async () => {
    const hunter = makeActor([DOCS.leap(), DOCS.walker(), DOCS.senses(20)]);
    const friend = makeActor([], { name: "Друг", uuid: "Actor.friend" });
    addToken(hunter, 0, 0);
    target(addToken(friend, 500, 0, { disposition: 1 }));
    expect(await declareTalentMove(hunter, "mistLeap", "leap")).toBe(false);
    expect(captured.warnings.at(-1)).toContain("выцельте");
  });

  it("стена остановила прыжок — Натиск не засчитан; из Захвата прыжок выходит", async () => {
    const { hunter, hTok, prey } = leapKit({ extraDocs: [DOCS.marked()] });
    hTok.move = async () => { hTok.x = 200; return false; };
    hunter.system.conditions.grappling = true;
    await hunter.setFlag(NS, "markedPrey", { targetUuid: prey.uuid, tokenUuid: "x" });
    const partner = makeActor([], { uuid: "Actor.grab" });
    registry[partner.uuid] = partner;
    globalThis.fromUuidSync = u => registry[u] ?? null;
    hunter.flags[`${NS}.grapplePartnerUuid`] = partner.uuid;
    expect(await declareTalentMove(hunter, "mistLeap", "leap")).toBe(true);
    expect(hunter.system.meleeBase).not.toBe("charge");
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Натиск не засчитан");
    expect(card).toContain("Вышел из Захвата");
    globalThis.fromUuidSync = () => null;
  });

  it("в Защитной Стойке (без Натиска) прыжок отказывает", async () => {
    const { hunter, hTok } = leapKit();
    hunter.system.meleeStance = "defensive";
    expect(await declareTalentMove(hunter, "mistLeap", "leap")).toBe(false);
    expect(captured.warnings.at(-1)).toContain("Стойке");
    expect(hTok.moves).toHaveLength(0);
  });

  it("нужны 2 ОД в запасе (Натиск — Полное действие), но при прыжке они не списываются", async () => {
    const { hunter, hTok } = leapKit({ hunterOpts: { ap: 1 } });
    expect(talentMoveRows(hunter).find(r => r.move.id === "leap").gate.reason).toContain("ОД");
    expect(await declareTalentMove(hunter, "mistLeap", "leap")).toBe(false);
    expect(hTok.moves).toHaveLength(0);
  });

  it("токен упёрся в стену вплотную (ядро отклонило) — Очко и Натиск не засчитаны", async () => {
    const hunter = makeActor([DOCS.leap(), DOCS.walker(), DOCS.senses(20), DOCS.marked()]);
    const prey = makeActor([], { name: "Чемпион", uuid: "Actor.prey" });
    const hTok = addToken(hunter, 0, 0, { result: false });
    const pTok = addToken(prey, 1000, 0);
    target(pTok);
    await hunter.setFlag(NS, "markedPrey", { targetUuid: prey.uuid, tokenUuid: pTok.uuid });
    expect(await declareTalentMove(hunter, "mistLeap", "leap")).toBe(false);
    expect(hTok.moves).toHaveLength(1);
    expect(hunter.system.trophyPoints.value).toBe(2);
    expect(hunter.system.meleeBase).not.toBe("charge");
  });
});

describe("Туманоходец: запреты, цель отсчёта, Захват, обмен местами", () => {
  const pickAt = (x, y) => { globalThis.canvas.regions = { placeRegion: async () => ({ shapes: [{ x, y }], delete: async () => {} }) }; };

  it("в Терминаторской броне телепорт запрещён: ничего не потрачено, «раз в Раунд» цело", async () => {
    const hunter = makeActor([DOCS.walker(), { ...DOCS.aegis(), system: { ...DOCS.aegis().system, equipped: true } }]);
    const tok = addToken(hunter, 0, 0);
    pickAt(350, 50);
    expect(await declareTalentMove(hunter, "mistwalker", "mist")).toBe(false);
    expect(captured.warnings.at(-1)).toContain("Терминаторской");
    expect(tok.moves).toHaveLength(0);
    hunter.items.find(i => i.type === "armor").system.equipped = false;
    expect(await declareTalentMove(hunter, "mistwalker", "mist")).toBe(true);
  });

  it("нельзя уйти дальше от выцеленного врага, чем начал; ближе — можно", async () => {
    const hunter = makeActor([DOCS.walker()]);
    const tok = addToken(hunter, 0, 0);
    const foe = makeActor([], { name: "Враг", uuid: "Actor.foe" });
    target(addToken(foe, 1000, 0)); // враг в 10 м справа
    pickAt(-250, 50); // 3 м влево: от врага уже 13 м
    expect(await declareTalentMove(hunter, "mistwalker", "mist")).toBe(false);
    expect(captured.warnings.at(-1)).toContain("дальше");
    expect(tok.moves).toHaveLength(0);
    pickAt(350, 50); // 3 м вправо: ближе к врагу
    expect(await declareTalentMove(hunter, "mistwalker", "mist")).toBe(true);
    expect(tok.moves).toHaveLength(1);
  });

  it("без целей отсчёта ограничение не мешает", async () => {
    const hunter = makeActor([DOCS.walker()]);
    addToken(hunter, 0, 0);
    pickAt(-250, 50);
    expect(await declareTalentMove(hunter, "mistwalker", "mist")).toBe(true);
  });

  it("выход из Захвата: Состояние и флаги Борьбы сняты с обоих, карточка называет путы вручную", async () => {
    const hunter = makeActor([DOCS.walker()]);
    const partner = makeActor([], { name: "Захватчик", uuid: "Actor.grab" });
    addToken(hunter, 0, 0);
    hunter.system.conditions.grappling = true;
    hunter.flags[`${NS}.grapplePartnerUuid`] = partner.uuid;
    partner.flags[`${NS}.grapplePartnerUuid`] = hunter.uuid;
    partner.system = { conditions: { grappling: true } };
    registry[partner.uuid] = partner;
    globalThis.fromUuidSync = u => registry[u] ?? null;
    pickAt(350, 50);
    expect(await declareTalentMove(hunter, "mistwalker", "mist")).toBe(true);
    expect(hunter.system.conditions.grappling).toBeFalsy();
    expect(hunter.flags[NS]["-=grapplePartnerUuid"]).toBeNull();
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Вышел из Захвата");
    expect(card).toContain("Путы");
    globalThis.fromUuidSync = () => null;
  });

  function swapKit({ helpless = false, allyAt = 300 } = {}) {
    const hunter = makeActor([DOCS.walker(), DOCS.savior()], { disposition: 1 });
    const ally = makeActor([], { name: "Союзник", uuid: "Actor.ally", helpless });
    const hTok = addToken(hunter, 0, 0, { disposition: 1 });
    const aTok = addToken(ally, allyAt, 0, { disposition: 1 });
    target(aTok);
    return { hunter, ally, hTok, aTok };
  }

  it("Спаситель Туманов: токены меняются местами, согласие спрашивается, точку выбирать не нужно", async () => {
    const { hunter, hTok, aTok } = swapKit();
    const p = declareTalentMove(hunter, "mistwalker", "mist");
    await pressWhenOpen("swap");
    expect(await p).toBe(true);
    expect(captured.dialog.content).toContain("согласна");
    expect(hTok.x).toBeCloseTo(300);
    expect(aTok.x).toBe(0);
    expect(aTok.moves[0]).toMatchObject({ x: 0, y: 0 });
    expect(aTok.moves[0].action).toBe("displace"); // телепорт без стен, не ходьба: Свободная Атака не срабатывает
    expect(captured.chat.at(-1).content).toContain("Поменялся местами");
  });

  it("Беспомощному союзнику согласие не нужно — диалог это говорит", async () => {
    const { hunter } = swapKit({ helpless: true });
    const p = declareTalentMove(hunter, "mistwalker", "mist");
    await pressWhenOpen("swap");
    await p;
    expect(captured.dialog.content).toContain("Беспомощна");
    expect(captured.dialog.content).not.toContain("должна быть согласна");
  });

  it("«Обычный телепорт» выбирает точку как раньше; «Отмена» ничего не тратит", async () => {
    const { hunter, hTok, aTok } = swapKit();
    pickAt(-250, 50);
    const p = declareTalentMove(hunter, "mistwalker", "mist");
    await pressWhenOpen("tele");
    expect(await p).toBe(true);
    expect(hTok.x).toBeCloseTo(-300);
    expect(aTok.updates).toHaveLength(0);

    resetCaptured(); scene.tokens = [];
    const kit = swapKit();
    const q = declareTalentMove(kit.hunter, "mistwalker", "mist");
    await pressWhenOpen("cancel");
    expect(await q).toBe(false);
    expect(kit.hTok.moves).toHaveLength(0);
    expect(talentMoveRows(kit.hunter)[0].gate.ok).toBe(true);
  });

  it("без Спасителя Туманов союзник в таргете просто не предлагается: обычный телепорт", async () => {
    const hunter = makeActor([DOCS.walker()], { disposition: 1 });
    const ally = makeActor([], { name: "Союзник", uuid: "Actor.ally" });
    const hTok = addToken(hunter, 0, 0, { disposition: 1 });
    target(addToken(ally, 300, 0, { disposition: 1 }));
    pickAt(-250, 50);
    expect(await declareTalentMove(hunter, "mistwalker", "mist")).toBe(true);
    expect(captured.dialog).toBeNull();
    expect(hTok.x).toBeCloseTo(-300);
  });

  it("союзник дальше P.b — обмен не предлагается", async () => {
    const { hunter } = swapKit({ allyAt: 1000 });
    pickAt(-250, 50);
    expect(await declareTalentMove(hunter, "mistwalker", "mist")).toBe(true);
    expect(captured.dialog).toBeNull();
  });
});

describe("Спаситель Туманов: перехват удара Fanatic", () => {
  function fanaticKit({ helpless = false, targetAt = 100 } = {}) {
    const fanatic = makeActor([DOCS.savior()], { name: "Фанатик", uuid: "Actor.fan", disposition: 1 });
    const victim = makeActor([], { name: "Цель удара", uuid: "Actor.victim", helpless });
    const fTok = addToken(fanatic, 200, 0, { disposition: 1 });
    const vTok = addToken(victim, 0, 0, { disposition: 1 });
    return { fanatic, victim, fTok, vTok };
  }

  it("Fanatic и цель меняются местами, ГМ-релей двигает токен цели", async () => {
    const { fanatic, fTok, vTok } = fanaticKit();
    expect(await fanaticSavior(fanatic, vTok.uuid)).toBe(true);
    expect(fTok.x).toBeCloseTo(0);
    expect(vTok.x).toBe(200);
    expect(captured.chat.at(-1).content).toContain("меняется местами");
  });

  it("цель не согласна — токены на месте", async () => {
    const { fanatic, fTok, vTok } = fanaticKit();
    captured.confirmAnswer = false;
    expect(await fanaticSavior(fanatic, vTok.uuid)).toBe(false);
    expect(fTok.moves).toHaveLength(0);
    expect(vTok.updates).toHaveLength(0);
  });

  it("Беспомощную цель не спрашивают", async () => {
    const { fanatic, vTok } = fanaticKit({ helpless: true });
    captured.confirmAnswer = false;
    expect(await fanaticSavior(fanatic, vTok.uuid)).toBe(true);
    expect(captured.dialog).toBeNull();
  });

  it("без Таланта и слишком далеко — отказ", async () => {
    const { victim, vTok } = fanaticKit();
    const plain = makeActor([], { uuid: "Actor.plain" });
    addToken(plain, 100, 0);
    expect(await fanaticSavior(plain, vTok.uuid)).toBe(false);
    expect(captured.warnings.at(-1)).toContain("Mist Savior");

    resetCaptured(); scene.tokens = [];
    const far = fanaticKit();
    far.fTok.x = 5000;
    expect(await fanaticSavior(far.fanatic, far.vTok.uuid)).toBe(false);
    expect(captured.warnings.at(-1)).toContain("дальше");
    expect(victim).toBeTruthy();
  });

  it("стена остановила токен — цель не переставляется", async () => {
    const { fanatic, vTok } = fanaticKit();
    fanatic.getActiveTokens()[0].move = async () => false;
    expect(await fanaticSavior(fanatic, vTok.uuid)).toBe(false);
    expect(vTok.updates).toHaveLength(0);
  });
});

describe("ГМ-релей saviorSwap", () => {
  const initiatorWithSavior = () => makeActor([DOCS.savior()], { uuid: "Actor.fan" });

  it("допускает только узкую запись и только инициатора с Талантом", () => {
    const ctx = { initiatorOwned: true, initiator: initiatorWithSavior() };
    const op = { kind: "saviorSwap", tokenUuid: "Scene.s.Token.a", x: 10, y: 20 };
    expect(checkTargetWrite(op, ctx).ok).toBe(true);
    expect(checkTargetWrite({ ...op, extra: 1 }, ctx).ok).toBe(false);
    expect(checkTargetWrite({ ...op, x: "10" }, ctx).ok).toBe(false);
    expect(checkTargetWrite({ ...op, tokenUuid: 5 }, ctx).ok).toBe(false);
    expect(checkTargetWrite(op, { ...ctx, initiator: makeActor([]) }).ok).toBe(false);
    expect(checkTargetWrite(op, { ...ctx, initiatorOwned: false }).ok).toBe(false);
  });

  it("исполнение: токен цели ставится на новое место только пока инициатор стоит на его месте и в пределах дальности", async () => {
    const init = initiatorWithSavior();
    const ally = makeActor([], { uuid: "Actor.ally" });
    const iTok = addToken(init, 300, 0);
    const aTok = addToken(ally, 300, 0);
    await performSaviorSwapWrite(ally, { kind: "saviorSwap", tokenUuid: aTok.uuid, x: 0, y: 0 }, init);
    expect(aTok.moves).toHaveLength(1);
    expect(aTok.x).toBe(0);

    aTok.moves.length = 0;
    await performSaviorSwapWrite(ally, { kind: "saviorSwap", tokenUuid: aTok.uuid, x: 9000, y: 0 }, init);
    expect(aTok.moves).toHaveLength(0); // дальше предела

    iTok.x = 3000; // инициатор не на месте союзника — обмена не было
    await performSaviorSwapWrite(ally, { kind: "saviorSwap", tokenUuid: aTok.uuid, x: 0, y: 0 }, init);
    expect(aTok.moves).toHaveLength(0);
  });

  it("чужого врага (другое отношение, не Беспомощный) релей не двигает; Беспомощного — двигает", async () => {
    const init = initiatorWithSavior();
    const foe = makeActor([], { uuid: "Actor.foe" });
    addToken(init, 300, 0, { disposition: 1 });
    const fTok = addToken(foe, 300, 0, { disposition: -1 });
    await performSaviorSwapWrite(foe, { kind: "saviorSwap", tokenUuid: fTok.uuid, x: 100, y: 0 }, init);
    expect(fTok.moves).toHaveLength(0);
    foe.system.conditions.helpless = true;
    await performSaviorSwapWrite(foe, { kind: "saviorSwap", tokenUuid: fTok.uuid, x: 100, y: 0 }, init);
    expect(fTok.moves).toHaveLength(1);
  });

  it("токен инициатора ищется на сцене цели, а не на холсте ГМа", async () => {
    const init = initiatorWithSavior();
    const ally = makeActor([], { uuid: "Actor.ally" });
    const iTok = addToken(init, 300, 0);
    init.getActiveTokens = () => []; // ГМ смотрит другую сцену
    const aTok = addToken(ally, 300, 0);
    await performSaviorSwapWrite(ally, { kind: "saviorSwap", tokenUuid: aTok.uuid, x: 100, y: 0 }, init);
    expect(aTok.x).toBe(100);
    expect(iTok).toBeTruthy();
  });

  it("performTargetWrite доводит запись до токена", async () => {
    const init = initiatorWithSavior();
    const ally = makeActor([], { uuid: "Actor.ally" });
    addToken(init, 300, 0);
    const aTok = addToken(ally, 300, 0);
    await performTargetWrite(ally, { kind: "saviorSwap", tokenUuid: aTok.uuid, x: 100, y: 0 }, init);
    expect(aTok.x).toBe(100);
  });
});

describe("Взор Охотника", () => {
  it("души в зоне Unnatural Senses со своей силой по Inf; вне зоны — нет, кроме отмеченной добычи; убитые и сам Охотник — нет", () => {
    const hunter = makeActor([DOCS.sight(), DOCS.senses(20), DOCS.marked()]);
    const hTok = addToken(hunter, 0, 0);
    const mk = (name, uuid, x, inf) => {
      const a = makeActor([], { name, uuid });
      a.system.characteristics.inf.total = inf;
      return addToken(a, x, 0);
    };
    mk("Слабый", "Actor.a", 500, 10);
    mk("Могучий", "Actor.b", 1000, 65);
    const far = mk("Далёкий великий", "Actor.c", 5000, 85);
    mk("Дальний простой", "Actor.d", 6000, 85);
    const dead = mk("Убитый", "Actor.e", 300, 90);
    dead.actor.flags[`${NS}.deceased`] = true;
    mk("Засада", "Actor.h", 200, 90).hidden = true;
    hunter.flags[`${NS}.markedPrey`] = { targetUuid: far.actor.uuid, tokenUuid: far.uuid };
    const { range, rows } = huntersSightRows(hunter, hTok);
    expect(range).toBe(20);
    expect(rows.map(r => [r.name, r.tier.key, r.marked])).toEqual([
      ["Слабый", "faint", false], ["Могучий", "mighty", false], ["Далёкий великий", "great", true]
    ]);
  });

  it("шёпот уходит владельцу и ГМу, а не всему столу", async () => {
    const hunter = makeActor([DOCS.sight(), DOCS.senses(20)]);
    addToken(hunter, 0, 0);
    const other = makeActor([], { name: "Некто", uuid: "Actor.z" });
    other.system.characteristics.inf.total = 45;
    addToken(other, 500, 0);
    hunter.testUserPermission = u => u.id === "u2";
    await useHuntersSight(hunter);
    const msg = captured.chat.at(-1);
    expect(msg.whisper).toEqual(expect.arrayContaining(["u1", "u2"]));
    expect(msg.content).toContain("Некто");
    expect(msg.content).toContain("заметная душа");
  });

  it("без Черты — предупреждение", async () => {
    const plain = makeActor([]);
    addToken(plain, 0, 0);
    await useHuntersSight(plain);
    expect(captured.warnings.at(-1)).toContain("Hunter Sight");
  });
});

describe("Целеустремлённый Охотник: Психопатия на Тяжести 0, не ниже 0", () => {
  function disorderActor() {
    const created = [];
    const a = {
      id: "a1", name: "Мастер", uuid: "Actor.a1", items: [], getFlag: () => undefined,
      createEmbeddedDocuments: async (type, docs) => docs.map(d => {
        const it = { ...d, id: `d${created.length}`, type: d.type, update: async patch => { for (const [k, v] of Object.entries(patch)) { const ks = k.split("."); let n = it; for (const x of ks.slice(0, -1)) n = n[x]; n[ks.at(-1)] = v; } } };
        created.push(it);
        a.items.push(it);
        return it;
      })
    };
    a.created = created;
    return a;
  }
  const source = () => ({ id: "src", name: "Single-Minded Hunter", getFlag: () => undefined, setFlag: async () => {} });

  it("создаёт Психопатию без броска таблицы: Тяжесть 0, предел 0, неизлечимо, помечена источником", async () => {
    const a = disorderActor();
    const res = await grantStartingDisorder(a, source(), { name: "Психопатия", severityMin: 0, incurable: true, label: "Целеустремлённый Охотник" });
    expect(res.ok).toBe(true);
    const [item] = a.created;
    expect(item.name).toBe("Психопатия");
    expect(item.type).toBe("mentalDisorder");
    expect(item.system).toMatchObject({ severity: 0, severityMin: 0, incurable: true });
    expect(item.flags[NS].grantedByItem).toBe("src");
    expect(captured.rolls).toHaveLength(0);
  });

  it("уже лежащая Психопатия не дублируется, но получает предел 0 и «неизлечимо»", async () => {
    const a = disorderActor();
    await a.createEmbeddedDocuments("Item", [{ name: "Психопатия", type: "mentalDisorder", system: { severity: -2, severityMin: null, incurable: false } }]);
    const res = await grantStartingDisorder(a, source(), { name: "Психопатия", severityMin: 0, incurable: true });
    expect(res.ok).toBe(true);
    expect(a.created).toHaveLength(1);
    expect(a.created[0].system).toMatchObject({ severityMin: 0, incurable: true });
  });

  it("неизвестное имя — отказ с объяснением, ничего не создано", async () => {
    const a = disorderActor();
    const res = await grantStartingDisorder(a, source(), { name: "Нет такого", severityMin: 0 });
    expect(res.ok).toBe(false);
    expect(a.created).toHaveLength(0);
  });
});
