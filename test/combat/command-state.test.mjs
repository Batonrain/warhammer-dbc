// test/combat/command-state.test.mjs
//
// Командование в живом мире (глава «Командование», wdbc-x1nz.2): бонус
// Команды доходит до броска подчинённого через общий сбор правил, Команда
// гаснет в начале следующего Хода отдающего, провал Морали снимает Команды.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../support/foundry-stub.mjs";
import { resetCaptured, captured } from "../support/foundry-stub.mjs";
import { commandNodesFor, expireCommandsAtTurnStart, handleMoraleFailure, revertMoraleFailure,
         clearCommandsOnCombatEnd, commandEffectOn, COMMAND_LOST_FLAG } from "../../module/combat/command-state.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { packDocById } from "../support/pack-doc.mjs";

function doc(uuid, type, system, extra = {}) {
  const flags = {};
  const d = {
    uuid, type, name: uuid, isOwner: true, items: [], system, flags,
    updates: [],
    getFlag: (_ns, k) => flags[k],
    async setFlag(_ns, k, v) { flags[k] = v; },
    async unsetFlag(_ns, k) { delete flags[k]; },
    async update(u) {
      this.updates.push(u);
      for (const [path, v] of Object.entries(u)) {
        if (path.startsWith("flags.warhammer-dbc.")) {
          const k = path.split(".").pop();
          if (k.startsWith("-=")) delete flags[k.slice(2)]; else flags[k] = v;
          continue;
        }
        const keys = path.replace(/^system\./, "").split(".");
        let n = this.system;
        while (keys.length > 1) n = (n[keys[0]] ??= {}, n[keys.shift()]);
        n[keys[0]] = v;
      }
    },
    ...extra
  };
  return d;
}

let soldier, sarge, squad, realFromUuidSync, realActors, realCombat;

beforeEach(() => {
  resetCaptured();
  soldier = doc("Actor.s", "character", {
    characteristics: { wp: { total: 30 }, per: { bonus: 4 }, ag: { total: 35 } }, conditions: {} });
  sarge = doc("Actor.c", "character", {
    characteristics: { wp: { total: 50 }, fel: { bonus: 4 } }, conditions: {},
    command: { presence: {}, shortCommand: {}, detailCommand: {} } });
  squad = doc("Actor.sq", "squad", {
    posts: { commander: { uuid: "Actor.c" } },
    members: [{ id: "m1", uuid: "Actor.s" }],
    presence: { active: true, benefit: "morale" },
    shortCommand: { active: true, key: "inspire", successes: 3, giverUuid: "Actor.c", combatId: "cb", round: 1 },
    detailCommand: { active: false, picks: [] }
  });
  realFromUuidSync = globalThis.fromUuidSync;
  realActors = game.actors; realCombat = game.combat;
  const map = { "Actor.s": soldier, "Actor.c": sarge, "Actor.sq": squad };
  globalThis.fromUuidSync = u => map[u] ?? null;
  game.actors = [soldier, sarge, squad];
  game.combat = { id: "cb", round: 1, combatant: null };
  game.user.id = "u1";
  globalThis.ChatMessage = { create: async m => captured.chat.push(m), getSpeaker: () => ({}) };
});

afterEach(() => {
  globalThis.fromUuidSync = realFromUuidSync;
  game.actors = realActors; game.combat = realCombat;
});

describe("бонус доходит до броска", () => {
  it("Воодушевление Отряда — автоматический модификатор атаки бойца", () => {
    const { autoMods } = resolveTest({ actor: soldier, kind: "attack", isMelee: false });
    const m = autoMods.find(x => x.ruleId === "command.short");
    expect(m?.value).toBe(3);
    expect(m.label).toContain("Воодушевление");
  });

  it("Воля Командира — к тесту Морали бойца (+20 = 50 − 30)", () => {
    const { autoMods } = resolveTest({ actor: soldier, kind: "skill", char: "wp", morale: true });
    expect(autoMods.find(x => x.ruleId === "command.presenceWill")?.value).toBe(20);
  });

  it("Безграничное Тщеславие Наги: Командование не доходит вовсе (command.cannotReceive)", () => {
    soldier.items = [{ type: "trait", name: "Vanity Unbound / Безграничное Тщеславие", system: {},
      flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
        { id: "e", kind: "capability", capabilityKey: "command.cannotReceive" }] }] } } }];
    expect(commandNodesFor(soldier)).toEqual([]);
    const { autoMods } = resolveTest({ actor: soldier, kind: "attack", isMelee: false });
    expect(autoMods.some(m => m.ruleId?.startsWith("command."))).toBe(false);
  });

  it("вопрос без броска (hasRuleFlag с пустым ctx) Команды не собирает", () => {
    expect(commandNodesFor(soldier)).toHaveLength(1);
    expect(resolveTest({ actor: soldier }).autoMods.some(m => m.ruleId?.startsWith("command."))).toBe(false);
  });
});

// Лимит получателей: Command — «до F.b×2» подчинённых, с Air of Authority —
// «до F.b×20»; больше — выбирает игрок (порядок списка). Один хелпер на лист
// и на расчёт: leadership-talents.mjs::commandCapacity.
describe("лимит получателей Командования", () => {
  const AOA = { type: "talent", name: "Air of Authority / Аура Власти", system: {} };
  const filler = n => Array.from({ length: n }, (_, i) => ({ id: `f${i}`, uuid: `Actor.f${i}` }));

  it("Отряд: F.b 4 → восьмой по списку внутри лимита, девятый сверх", () => {
    squad.system.members = [...filler(7), { id: "m1", uuid: "Actor.s" }];   // индекс 7
    expect(commandNodesFor(soldier)[0].overCapacity).toBe(false);
    squad.system.members = [...filler(8), { id: "m1", uuid: "Actor.s" }];   // индекс 8
    expect(commandNodesFor(soldier)[0].overCapacity).toBe(true);
  });

  it("Отряд: с Air of Authority у Командира лимит F.b×20 — девятый уже внутри", () => {
    squad.system.members = [...filler(8), { id: "m1", uuid: "Actor.s" }];
    sarge.items = [AOA];
    expect(commandNodesFor(soldier)[0].overCapacity).toBe(false);
    squad.system.members = [...filler(80), { id: "m1", uuid: "Actor.s" }];   // индекс 80
    expect(commandNodesFor(soldier)[0].overCapacity).toBe(true);
  });

  it("командир сброда: тот же лимит, Air of Authority его снимает до ×20", () => {
    squad.system.members = [];
    soldier.flags.commandedBy = { uuid: "Actor.c" };
    sarge.system.followers = [...filler(8), { uuid: "Actor.s" }];            // индекс 8
    expect(commandNodesFor(soldier)[0].overCapacity).toBe(true);
    sarge.items = [AOA];
    expect(commandNodesFor(soldier)[0].overCapacity).toBe(false);
  });

  it("Дрессировка: лимит P.b как был, Air of Authority на него не влияет", () => {
    squad.system.members = [];
    soldier.flags.commandedBy = { uuid: "Actor.c" };
    sarge.system.command.training = true;
    sarge.system.characteristics.per = { bonus: 3 };
    sarge.system.followers = [...filler(3), { uuid: "Actor.s" }];            // индекс 3
    sarge.items = [AOA];
    expect(commandNodesFor(soldier)[0].overCapacity).toBe(true);
    sarge.system.followers = [...filler(2), { uuid: "Actor.s" }];
    expect(commandNodesFor(soldier)[0].overCapacity).toBe(false);
  });
});

// War Chant / Боевая Песнь: поющий командующий узла раздаёт все 3 эффекта
// Присутствия подчинённым, максимум W.b×2 (×20 с Air of Authority) по порядку
// списка. «Слышат» (геометрию) решает стол — как у «подпевать».
describe("Боевая Песнь (раздача Присутствия)", () => {
  const WC  = { type: "talent", name: "War Chant / Боевая Песнь", system: {} };
  const AOA = { type: "talent", name: "Air of Authority / Аура Власти", system: {} };
  const filler = n => Array.from({ length: n }, (_, i) => ({ id: `f${i}`, uuid: `Actor.f${i}` }));
  const MORALE = { kind: "skill", char: "wp", morale: true };

  beforeEach(() => {
    squad.system.presence = { active: false, benefit: "" };       // Командир ничего не отдавал
    squad.system.shortCommand = { active: false };
    sarge.system.characteristics.wp.bonus = 5;                     // W.b 5 → лимит 10
    sarge.items = [WC];
    sarge.flags.warChantSinging = true;
  });

  it("поёт: узел несёт chant {wp, cap, over:false}, Присутствие доходит без выбора Командира", () => {
    const [node] = commandNodesFor(soldier);
    expect(node.chant).toEqual({ wp: 50, cap: 10, over: false });
    expect(commandEffectOn(soldier, "presence:focus")).toBeTruthy();
    expect(commandEffectOn(soldier, "presence:extreme")).toBeTruthy();
    expect(commandEffectOn(soldier, "presence:morale")).toBeTruthy();
  });

  it("Воля певца доходит до теста Морали бойца (+20 = 50 − 30), бонусы Команд не удваиваются", () => {
    squad.system.shortCommand = { active: true, key: "inspire", successes: 3, giverUuid: "Actor.c", combatId: "cb", round: 1 };
    expect(resolveTest({ actor: soldier, kind: "skill", char: "wp", morale: true })
      .autoMods.find(x => x.ruleId === "command.presenceWill")?.value).toBe(20);
    expect(resolveTest({ actor: soldier, kind: "attack", isMelee: false })
      .autoMods.find(x => x.ruleId === "command.short")?.value).toBe(3);
  });

  it("не поёт (флага нет) или Таланта нет — песни нет", () => {
    delete sarge.flags.warChantSinging;
    expect(commandNodesFor(soldier)[0].chant).toBe(null);
    expect(commandEffectOn(soldier, "presence:focus")).toBe(null);
    sarge.flags.warChantSinging = true;
    sarge.items = [];
    expect(commandNodesFor(soldier)[0].chant).toBe(null);
  });

  it("лимит W.b×2 по порядку списка: десятый внутри, одиннадцатый сверх", () => {
    squad.system.members = [...filler(9), { id: "m1", uuid: "Actor.s" }];    // индекс 9
    sarge.system.characteristics.fel.bonus = 20;                              // F.b×2 не мешает
    expect(commandNodesFor(soldier)[0].chant.over).toBe(false);
    squad.system.members = [...filler(10), { id: "m1", uuid: "Actor.s" }];   // индекс 10
    const [node] = commandNodesFor(soldier);
    expect(node.chant.over).toBe(true);
    expect(commandEffectOn(soldier, "presence:focus")).toBe(null);
  });

  it("с Air of Authority лимит W.b×20 — одиннадцатый уже внутри", () => {
    sarge.system.characteristics.fel.bonus = 60;
    sarge.items = [WC, AOA];
    squad.system.members = [...filler(10), { id: "m1", uuid: "Actor.s" }];
    expect(commandNodesFor(soldier)[0].chant).toEqual({ wp: 50, cap: 100, over: false });
    squad.system.members = [...filler(100), { id: "m1", uuid: "Actor.s" }];
    expect(commandNodesFor(soldier)[0].chant.over).toBe(true);
  });

  it("лимит песни независим от F.b×2 Командования: сверх F.b×2 ничего не доходит даже внутри W.b×2", () => {
    squad.system.members = [...filler(8), { id: "m1", uuid: "Actor.s" }];    // индекс 8: F.b 4 → лимит 8
    const [node] = commandNodesFor(soldier);
    expect(node.overCapacity).toBe(true);
    expect(node.chant.over).toBe(false);
    expect(commandEffectOn(soldier, "presence:focus")).toBe(null);
  });

  it("певец играет и за командира сброда (followers)", () => {
    squad.system.members = [];
    soldier.flags.commandedBy = { uuid: "Actor.c" };
    sarge.system.followers = [{ uuid: "Actor.s" }];
    const [node] = commandNodesFor(soldier);
    expect(node.chant).toEqual({ wp: 50, cap: 10, over: false });
    expect(commandEffectOn(soldier, "presence:focus")).toBeTruthy();
    sarge.system.followers = [...filler(10), { uuid: "Actor.s" }];
    sarge.system.characteristics.fel.bonus = 20;
    expect(commandNodesFor(soldier)[0].chant.over).toBe(true);
  });

  it("узел без песни (обычный Отряд) chant = null — прежнее поведение", () => {
    delete sarge.flags.warChantSinging;
    squad.system.presence = { active: true, benefit: "morale" };
    expect(commandNodesFor(soldier)[0].chant).toBe(null);
    expect(commandEffectOn(soldier, "presence:focus")).toBe(null);
    expect(resolveTest({ actor: soldier, ...MORALE }).autoMods.find(x => x.ruleId === "command.presenceWill")?.value).toBe(20);
  });
});

describe("срок Команды", () => {
  it("гаснет в начале следующего Хода отдавшего, не раньше", async () => {
    // Тот же Раунд — ещё действует.
    await expireCommandsAtTurnStart({ id: "cb", round: 1, combatant: { actor: sarge } });
    expect(squad.system.shortCommand.active).toBe(true);
    // Ход другого бойца в следующем Раунде — действует.
    await expireCommandsAtTurnStart({ id: "cb", round: 2, combatant: { actor: soldier } });
    expect(squad.system.shortCommand.active).toBe(true);
    // Ход Командира в следующем Раунде — гаснет.
    await expireCommandsAtTurnStart({ id: "cb", round: 2, combatant: { actor: sarge } });
    expect(squad.system.shortCommand.active).toBe(false);
  });

  it("Брифинг гаснет на следующем Раунде на любом Ходу", async () => {
    squad.system.shortCommand.giverUuid = "briefing";
    await expireCommandsAtTurnStart({ id: "cb", round: 2, combatant: { actor: soldier } });
    expect(squad.system.shortCommand.active).toBe(false);
  });

  it("конец боя гасит и Присутствие", async () => {
    await clearCommandsOnCombatEnd({ combatants: [{ actor: soldier }] });
    expect(squad.system.presence.active).toBe(false);
    expect(squad.system.shortCommand.active).toBe(false);
  });
});

// Pack Consciousness / Сознание Стаи (Йигори): стая — Отряд, где у всех
// бойцов Черта; Черта из packs-src, чтобы возможность ехала с ней самой.
describe("стая Йигори (Сознание Стаи)", () => {
  const PACK_TRAIT = packDocById("packs-src/traits", "GXPSPdHzlYuusanK");
  const giveTrait = d => {
    const t = { id: "pc", name: PACK_TRAIT.name, type: "trait", system: PACK_TRAIT.system, flags: PACK_TRAIT.flags };
    d.items = Object.assign([t], { contents: [t] });
  };

  it("весь состав с Чертой — узел-стая, W наибольшая; Воодушевление вдвое", () => {
    const mate = doc("Actor.m", "character", { characteristics: { wp: { total: 44 } }, conditions: {} });
    giveTrait(soldier); giveTrait(mate);
    squad.system.members.push({ id: "m2", uuid: "Actor.m" });
    const map = { "Actor.s": soldier, "Actor.c": sarge, "Actor.sq": squad, "Actor.m": mate };
    globalThis.fromUuidSync = u => map[u] ?? null;

    const [node] = commandNodesFor(soldier);
    expect(node.pack).toEqual({ wp: 44 });
    const { autoMods } = resolveTest({ actor: soldier, kind: "attack", isMelee: false });
    expect(autoMods.find(x => x.ruleId === "command.short")?.value).toBe(6);
  });

  it("хоть один боец без Черты — не стая", () => {
    giveTrait(soldier);
    squad.system.members.push({ id: "m2", uuid: "Actor.c" }); // сержант без Черты
    expect(commandNodesFor(soldier)[0].pack).toBe(null);
  });
});

describe("провал Морали", () => {
  it("подчинённый: метка на актора — Команды до него больше не доходят", async () => {
    await handleMoraleFailure(soldier);
    expect(soldier.getFlag("warhammer-dbc", COMMAND_LOST_FLAG)).toEqual({ combatId: "cb", round: 1 });
    const { autoMods } = resolveTest({ actor: soldier, kind: "attack", isMelee: false });
    expect(autoMods.some(m => m.ruleId === "command.short")).toBe(false);
  });

  it("Командир: все отданные Команды сняты, в чате — «Скрыть трусость»", async () => {
    await handleMoraleFailure(sarge);
    expect(squad.system.presence.active).toBe(false);
    expect(squad.system.shortCommand.active).toBe(false);
    const card = captured.chat.at(-1);
    expect(card.content).toContain("wh-cmd-conceal");
    expect(card.flags["warhammer-dbc"].commandSnapshot.entries[0].uuid).toBe("Actor.sq");
  });

  it("Координатор Командования от провала Морали не теряет", async () => {
    squad.system.posts = { coordinator: { uuid: "Actor.c" } };
    await handleMoraleFailure(sarge);
    expect(squad.system.shortCommand.active).toBe(true);
  });
});

// Провал, который потом отменили (переброс Демона / «Вера в прошлое» у теста
// Страха), не должен оставлять потерянное Командование.
describe("отмена провала Морали", () => {
  it("подчинённый: метка снята, Команда снова доходит до броска", async () => {
    const undo = await handleMoraleFailure(soldier);
    await revertMoraleFailure(undo);
    expect(soldier.getFlag("warhammer-dbc", COMMAND_LOST_FLAG)).toBeUndefined();
    const { autoMods } = resolveTest({ actor: soldier, kind: "attack", isMelee: false });
    expect(autoMods.some(m => m.ruleId === "command.short")).toBe(true);
  });

  it("подчинённый: прежняя метка (более ранний провал) остаётся", async () => {
    await soldier.setFlag("warhammer-dbc", COMMAND_LOST_FLAG, { combatId: "cb", round: 0 });
    const undo = await handleMoraleFailure(soldier);
    await revertMoraleFailure(undo);
    expect(soldier.getFlag("warhammer-dbc", COMMAND_LOST_FLAG)).toEqual({ combatId: "cb", round: 0 });
  });

  it("Командир: Команды возвращены, карточка «Командир дрогнул» убрана", async () => {
    let deleted = false;
    globalThis.ChatMessage.create = async m => { captured.chat.push(m); return { id: "msg1" }; };
    const realMessages = game.messages;
    game.messages = { get: id => id === "msg1" ? { isOwner: true, delete: async () => { deleted = true; } } : null };
    try {
      const undo = await handleMoraleFailure(sarge);
      expect(squad.system.shortCommand.active).toBe(false);
      await revertMoraleFailure(undo);
      expect(squad.system.presence.active).toBe(true);
      expect(squad.system.shortCommand).toMatchObject({ active: true, successes: 3 });
      expect(deleted).toBe(true);
    } finally { game.messages = realMessages; }
  });

  it("терять было нечего — отката нет", async () => {
    const loner = doc("Actor.x", "character", { conditions: {} });
    expect(await handleMoraleFailure(loner)).toBeNull();
  });
});

describe("Залповый Огонь", () => {
  it("третий подчинённый по одной цели — тест Подавления +20", async () => {
    const { afterSubordinateAttack } = await import("../../module/combat/command-state.mjs");
    squad.system.detailCommand = { active: true, picks: ["volley"] };
    const b = doc("Actor.b", "character", { characteristics: { wp: { total: 30 }, per: { bonus: 4 } }, conditions: {} });
    const c = doc("Actor.d", "character", { characteristics: { wp: { total: 30 }, per: { bonus: 4 } }, conditions: {} });
    const enemy = doc("Actor.e", "character", { characteristics: {}, conditions: {} });
    squad.system.members.push({ id: "m2", uuid: "Actor.b" }, { id: "m3", uuid: "Actor.d" });
    const map = { "Actor.s": soldier, "Actor.c": sarge, "Actor.sq": squad, "Actor.b": b, "Actor.d": c, "Actor.e": enemy };
    globalThis.fromUuidSync = u => map[u] ?? null;
    game.actors = [soldier, sarge, squad, b, c, enemy];
    for (const a of [soldier, b]) await afterSubordinateAttack(a, { isMelee: false, defenderActor: enemy });
    expect(captured.chat.some(m => String(m.content).includes("Залповый Огонь"))).toBe(false);
    await afterSubordinateAttack(c, { isMelee: false, defenderActor: enemy });
    expect(captured.chat.at(-1).content).toContain("Тест Подавления (+20)");
  });
});

// Живая проверка: токены по умолчанию НЕсвязанные — бросок идёт от актора
// токена (Scene.x.Token.y.Actor.z), а в Отряд положили мирового актора.
describe("несвязанные токены", () => {
  it("боец в Отряде мировым актором получает бонус, бросая от токена", () => {
    const tokenActor = doc("Scene.sc.Token.t1.Actor.s", "character", soldier.system,
      { isToken: true, id: "s", token: { baseActor: soldier } });
    const { autoMods } = resolveTest({ actor: tokenActor, kind: "attack", isMelee: false });
    expect(autoMods.find(m => m.ruleId === "command.short")?.value).toBe(3);
  });

  it("в Отряде актор токена — узнаётся и мировой лист (через активный токен)", () => {
    squad.system.members = [{ id: "m1", uuid: "Scene.sc.Token.t1.Actor.s" }];
    soldier.getActiveTokens = () => [{ actor: { uuid: "Scene.sc.Token.t1.Actor.s" } }];
    expect(commandNodesFor(soldier)).toHaveLength(1);
  });

  it("Команда, отданная с мирового листа, гаснет на Ходу токена командира", async () => {
    const sargeToken = doc("Scene.sc.Token.t2.Actor.c", "character", sarge.system,
      { isToken: true, id: "c", token: { baseActor: sarge } });
    await expireCommandsAtTurnStart({ id: "cb", round: 2, combatant: { actor: sargeToken } });
    expect(squad.system.shortCommand.active).toBe(false);
  });
});

// Приёмка #518–#526: бой из несвязанных токенов, а Отряд/Команды записаны
// мировыми uuid. Актор токена — копия мирового: запись в него (дельту) до
// мирового актора не доходит, а подчинённые читают именно мировой.
describe("несвязанные токены: конец боя, Ход, провал Морали", () => {
  const tokenOf = (base, t) => doc(`Scene.sc.Token.${t}.Actor.${base.uuid.slice(6)}`, base.type,
    structuredClone(base.system), { isToken: true, id: base.uuid.slice(6), token: { baseActor: base } });
  const nextWeek = () => { game.combat = { id: "cb2", round: 1, combatant: null }; };
  const shortMod = actor => resolveTest({ actor, kind: "attack", isMelee: false }).autoMods
    .find(m => m.ruleId === "command.short")?.value;

  it("удалённый бой гасит Команды Отряда — в новой сцене бойцы без +3 и «Воли Командира»", async () => {
    const soldierToken = tokenOf(soldier, "t1"), sargeToken = tokenOf(sarge, "t2");
    await clearCommandsOnCombatEnd({ id: "cb", combatants: [{ actor: soldierToken }, { actor: sargeToken }] });
    nextWeek();
    expect(shortMod(soldierToken)).toBeUndefined();
    const { autoMods } = resolveTest({ actor: soldierToken, kind: "skill", char: "wp", morale: true });
    expect(autoMods.some(m => m.ruleId === "command.presenceWill")).toBe(false);
  });

  describe("Команда командира с мирового листа («Под моим Присутствием»)", () => {
    let soldierToken, sargeToken;
    beforeEach(() => {
      game.actors = [soldier, sarge];
      sarge.system.followers = [{ uuid: "Actor.s" }];
      sarge.system.command = { presence: { active: true, benefit: "morale" }, detailCommand: {},
        shortCommand: { active: true, key: "inspire", successes: 3, combatId: "cb", round: 1 } };
      soldierToken = tokenOf(soldier, "t1"); sargeToken = tokenOf(sarge, "t2");
      soldierToken.flags.commandedBy = { uuid: "Actor.c" };
      expect(shortMod(soldierToken)).toBe(3);
    });

    it("конец боя токеном командира гасит мировую Команду", async () => {
      await clearCommandsOnCombatEnd({ id: "cb", combatants: [{ actor: soldierToken }, { actor: sargeToken }] });
      nextWeek();
      expect(shortMod(soldierToken)).toBeUndefined();
    });

    it("Ход токена командира в следующем Раунде гасит мировую Команду", async () => {
      await expireCommandsAtTurnStart({ id: "cb", round: 2, combatant: { actor: sargeToken } });
      expect(shortMod(soldierToken)).toBeUndefined();
    });

    it("провал Морали токена командира снимает мировую Команду", async () => {
      await handleMoraleFailure(sargeToken);
      expect(shortMod(soldierToken)).toBeUndefined();
      expect(captured.chat.at(-1).flags["warhammer-dbc"].commandSnapshot.entries.map(e => e.uuid)).toContain("Actor.c");
    });
  });

  it("Личная Команда получателю мировым uuid — +Успехи×5 и при броске от токена", () => {
    squad.system.shortCommand = { active: true, key: "personal", successes: 2, recipientUuid: "Actor.s",
      giverUuid: "Actor.c", combatId: "cb", round: 1 };
    expect(shortMod(tokenOf(soldier, "t1"))).toBe(10);
  });
});
