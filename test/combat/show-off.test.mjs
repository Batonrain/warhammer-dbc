// test/combat/show-off.test.mjs
//
// Рисовка (Show-Off, Таланты «Рукопашные», Sahara 3-8dc5), обвязка combat/show-off.mjs:
//   — кнопка вкладки Боя: гейт по ОД;
//   — выбор целей по токенам в контакте (до F.b) и запуск общего встречного теста с ценой 1 ОД;
//   — победа над целью: запрет Командования на цели и кнопка свободной атаки на 5+ Успехов.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";

const contestCalls = [];
let contactDocs = [];
vi.mock("../../module/combat/techniques.mjs", () => ({
  _showContestDialog: async (actor, techDef) => { contestCalls.push({ actor, techDef }); }
}));
vi.mock("../../module/combat/free-attack.mjs", () => ({
  enemyContactTokenDocs: () => contactDocs,
  friendlyContactTokenDocs: () => [], lockingContactTokenDocs: () => [], allContactTokenDocs: () => []
}));

const { triggerShowOff, showOffGate, resolveShowOffSuccess, hasShowOff, SHOW_OFF_CONTEST, SHOW_OFF_CARD_FLAG }
  = await import("../../module/combat/show-off.mjs");
const { COMMAND_SUPPRESSED_FLAG } = await import("../../module/rules/command-suppression.mjs");
const { CARD_ONCE_FLAGS } = await import("../../module/combat/card-once.mjs");

const showOffTalent = { id: "t-so", name: "Show-Off / Рисовка", type: "talent", system: {} };
const card = () => captured.chat.at(-1)?.content ?? "";

function hero({ fel = 4, items = [showOffTalent], ap = 2 } = {}) {
  const a = actorFor({ items, characteristics: { fel: { total: fel * 10, bonus: fel } },
    actionPoints: { value: ap, max: 2 }, conditions: {} });
  a.uuid = "Actor.hero"; a.type = "character"; a.name = "Рисующийся";
  const flags = {};
  a.getFlag = (s, k) => flags[k]; a.setFlag = async (s, k, v) => { flags[k] = v; };
  a.getActiveTokens = () => [{ uuid: "Scene.s.Token.hero", id: "hero", actor: a }];
  return a;
}
const foe = (n, name = "Враг" + n) => {
  const actor = { uuid: "Actor." + n, name, getFlag: () => undefined, update: async () => {}, isOwner: true };
  return { uuid: "Scene.s.Token." + n, name, actor };
};

let warns, prevCombat;
beforeEach(() => {
  resetCaptured(); setTargets([]); contestCalls.length = 0; contactDocs = [];
  warns = []; ui.notifications.warn = m => warns.push(m);
  prevCombat = game.combat; game.combat = undefined;
});
afterEach(() => { game.combat = prevCombat; });

describe("данные", () => {
  it("отметка карточки внесена в белый список сокета", () => {
    expect(CARD_ONCE_FLAGS).toContain(SHOW_OFF_CARD_FLAG);
  });
  it("определение встречного теста: WS vs WS, Полудействие 1 ОД", () => {
    expect(SHOW_OFF_CONTEST.defaultChar).toBe("ws");
    expect(SHOW_OFF_CONTEST.allowedChars).toEqual(["ws"]);
    expect(SHOW_OFF_CONTEST.apCost).toBe(1);
    expect(SHOW_OFF_CONTEST.wsBonus).toBe(0);
  });
  it("Талант опознаётся по имени, без Таланта кнопки нет", () => {
    expect(hasShowOff(hero())).toBe(true);
    expect(hasShowOff(hero({ items: [] }))).toBe(false);
  });
});

describe("гейт кнопки", () => {
  it("в начатом бою без ОД — кнопка закрыта с причиной; вне боя — открыта", () => {
    game.combat = { started: true };
    expect(showOffGate(hero({ ap: 0 })).disabled).toBe(true);
    expect(showOffGate(hero({ ap: 1 })).disabled).toBe(false);
    game.combat = undefined;
    expect(showOffGate(hero({ ap: 0 })).disabled).toBe(false);
  });
});

describe("выбор целей по токенам", () => {
  it("врагов не больше F.b — против всех сразу, один встречный тест", async () => {
    contactDocs = [foe(1), foe(2)];
    await triggerShowOff(hero({ fel: 3 }));
    expect(contestCalls).toHaveLength(1);
    const { techDef } = contestCalls[0];
    expect(techDef.opponents().map(a => a.uuid)).toEqual(["Actor.1", "Actor.2"]);
    expect(techDef.apCost).toBe(1);
    expect(typeof techDef.onSuccess).toBe("function");
  });
  it("врагов больше F.b, цели не выбраны — отказ без броска", async () => {
    contactDocs = [foe(1), foe(2), foe(3)];
    await triggerShowOff(hero({ fel: 2 }));
    expect(contestCalls).toHaveLength(0);
    expect(warns.join(" ")).toContain("выцельте");
  });
  it("врагов больше F.b, выцелены двое — берутся они", async () => {
    contactDocs = [foe(1), foe(2), foe(3)];
    game.user = { ...game.user, targets: new Set([{ document: contactDocs[2] }, { document: contactDocs[0] }]) };
    await triggerShowOff(hero({ fel: 2 }));
    expect(contestCalls[0].techDef.opponents().map(a => a.uuid)).toEqual(["Actor.3", "Actor.1"]);
  });
  it("выцелено больше F.b — отказ", async () => {
    contactDocs = [foe(1), foe(2), foe(3)];
    game.user = { ...game.user, targets: new Set(contactDocs.map(d => ({ document: d }))) };
    await triggerShowOff(hero({ fel: 2 }));
    expect(contestCalls).toHaveLength(0);
    expect(warns.join(" ")).toContain("не больше 2");
  });
  it("врага в контакте нет — отказ («находясь в рукопашной»)", async () => {
    await triggerShowOff(hero());
    expect(contestCalls).toHaveLength(0);
    expect(warns.join(" ")).toContain("контакте");
  });
  it("нет токена персонажа — отказ с причиной", async () => {
    const a = hero(); a.getActiveTokens = () => []; a.token = null;
    await triggerShowOff(a);
    expect(contestCalls).toHaveLength(0);
    expect(warns.join(" ")).toContain("токен");
  });
  it("F.b = 0 — отказ", async () => {
    contactDocs = [foe(1)];
    await triggerShowOff(hero({ fel: 0 }));
    expect(contestCalls).toHaveLength(0);
  });
});

describe("победа над целью", () => {
  const sword = () => {
    const w = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", equipped: true });
    w.uuid = "Item.sword";
    return w;
  };
  async function win(margin, deg, { weapon = sword() } = {}) {
    const actor = hero({ items: [showOffTalent, ...(weapon ? [weapon] : [])] });
    const t = foe(1).actor;
    const flags = {};
    t.getFlag = (s, k) => flags[k]; t.setFlag = async (s, k, v) => { flags[k] = v; };
    t.update = async u => { for (const [p, v] of Object.entries(u)) flags[p.split(".").pop()] = v; };
    await resolveShowOffSuccess(actor, { deg, target: t, margin });
    return { actor, t, flags };
  }
  beforeEach(() => { game.combat = { id: "cb", round: 3 }; });
  it("любая победа — на цели метка запрета Командования с Рисующимся и Раундом", async () => {
    const { flags } = await win(1, 1);
    expect(flags[COMMAND_SUPPRESSED_FLAG]).toEqual({ giverUuid: "Actor.hero", combatId: "cb", round: 3 });
    expect(card()).toContain("теряет все преимущества Командования");
    expect(card()).not.toContain("wh-show-off-attack-btn");
  });
  it("перевес 5+ Успехов — кнопка свободной атаки по этой цели надетым рукопашным", async () => {
    await win(5, 6);
    expect(card()).toContain("wh-show-off-attack-btn");
    expect(card()).toContain('data-target-uuid="Actor.1"');
    expect(card()).toContain('data-weapon-uuid="Item.sword"');
    expect(card()).toContain('data-attacker-uuid="Actor.hero"');
  });
  it("перевес 4 — кнопки нет", async () => {
    await win(4, 8);
    expect(card()).not.toContain("wh-show-off-attack-btn");
  });
  it("победа меньшим провалом (Успехов у инициатора нет) — кнопки нет", async () => {
    await win(7, 0);
    expect(card()).not.toContain("wh-show-off-attack-btn");
  });
  it("перевес 5+, но рукопашного оружия нет — честная строка вместо кнопки", async () => {
    await win(6, 6, { weapon: null });
    expect(card()).not.toContain("wh-show-off-attack-btn");
    expect(card()).toContain("надетого рукопашного оружия нет");
  });
  it("цели нет — предупреждение, ничего не пишется", async () => {
    await resolveShowOffSuccess(hero(), { deg: 3, target: null, margin: 3 });
    expect(warns.join(" ")).toContain("цель Рисовки не найдена");
  });
});
