// test/combat/free-attack.test.mjs
//
// Свободная атака (wdbc-2xku): кто из врагов личного масштаба потерял Базовый/
// Глубокий контакт с двигающимся токеном получает предложение потратить
// Реакцию (раз в Раунд); «Выход из Боя» гасит это одним разовым флагом.
// Хуки Foundry (Hooks.on) заглушка не исполняет — поэтому проверяется не
// initFreeAttackHooks, а функции, которые его callback'и зовут напрямую.

import "../support/foundry-stub.mjs";
import { resetCaptured, captured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  enemyContactTokenDocs, processTokenMove, offerFreeAttack,
  resolveFreeAttackClick, initFreeAttackHooks, FREE_ATTACK_CAPABILITY
} from "../../module/combat/free-attack.mjs";

const HOSTILE = -1, FRIENDLY = 1;

/** Подставной актор с рабочими getFlag/setFlag/unsetFlag/update (пути через точку). */
function fakeActor({ type = "character", flags = {}, uuid = "Actor.stub", name = type, ...system } = {}) {
  const flagStore = structuredClone(flags);
  const walk = (obj, parts) => parts.reduce((o, k) => o?.[k], obj);
  const actor = {
    type, uuid, name, isOwner: true, system,
    getFlag: (scope, key) => walk(flagStore[scope], String(key).split(".")),
    setFlag: async (scope, key, value) => {
      flagStore[scope] ??= {};
      const parts = String(key).split(".");
      let node = flagStore[scope];
      for (const k of parts.slice(0, -1)) node = (node[k] ??= {});
      node[parts.at(-1)] = value;
    },
    unsetFlag: async (scope, key) => {
      const bag = flagStore[scope];
      if (!bag) return;
      const parts = String(key).split(".");
      let node = bag;
      for (const k of parts.slice(0, -1)) node = node?.[k];
      if (node) delete node[parts.at(-1)];
    },
    // Пути через точку от КОРНЯ актора ("system.reactions.value"), как у
    // настоящего actor.update — не от system напрямую (stubDocument, тот же приём).
    update: async (changes = {}) => {
      for (const [path, value] of Object.entries(changes)) {
        const keys = path.split(".");
        let node = actor;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    }
  };
  return actor;
}

/** Токен-заглушка: те же единицы, что использует tokenRect (x/y/width/height). */
function token({ id, x = 0, y = 0, width = 2, height = 2, disposition = HOSTILE, actor = null, name = id } = {}) {
  const uuid = `Scene.s.Token.${id}`;
  const doc = { id, x, y, width, height, disposition, actor, name, uuid };
  // setTarget — тот же метод, что у настоящего Token: Foundry v14 убрала
  // User#updateTokenTargets, и таргет ставится только так (см. combat/aim.mjs).
  doc.object = { id, uuid, targetedBy: null,
    setTarget(state, opts = {}) { this.targetedBy = state ? { opts } : null; } };
  return { document: doc };
}

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] }, ready: true };
  globalThis.game.combat = undefined;
  globalThis.game.user = { id: "u1" };
});

describe("enemyContactTokenDocs: контакт личного масштаба", () => {
  it("враг-персонаж вплотную — попадает в список", () => {
    const mover = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY, actor: fakeActor({ type: "character" }) });
    const enemy = token({ id: "e", x: 2, y: 0, disposition: HOSTILE, actor: fakeActor({ type: "character" }) });
    canvas.tokens.placeables = [mover, enemy];
    expect(enemyContactTokenDocs(mover.document).map(d => d.id)).toEqual(["e"]);
  });

  it("враг-техника (не личный масштаб) не считается", () => {
    const mover  = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY, actor: fakeActor({ type: "character" }) });
    const enemyV = token({ id: "v", x: 2, y: 0, disposition: HOSTILE, actor: fakeActor({ type: "vehicle" }) });
    canvas.tokens.placeables = [mover, enemyV];
    expect(enemyContactTokenDocs(mover.document)).toEqual([]);
  });

  it("союзник вплотную не считается", () => {
    const mover = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY, actor: fakeActor({ type: "character" }) });
    const ally  = token({ id: "a", x: 2, y: 0, disposition: FRIENDLY, actor: fakeActor({ type: "character" }) });
    canvas.tokens.placeables = [mover, ally];
    expect(enemyContactTokenDocs(mover.document)).toEqual([]);
  });

  it("враг далеко — не в контакте", () => {
    const mover = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY, actor: fakeActor({ type: "character" }) });
    const enemy = token({ id: "e", x: 30, y: 30, disposition: HOSTILE, actor: fakeActor({ type: "character" }) });
    canvas.tokens.placeables = [mover, enemy];
    expect(enemyContactTokenDocs(mover.document)).toEqual([]);
  });
});

describe("processTokenMove: разрыв контакта", () => {
  it("уходящий разрывает контакт с врагом — предлагает Свободную атаку", async () => {
    const enemyActor = fakeActor({ type: "character", uuid: "Actor.enemy", name: "Культист" });
    const enemy = token({ id: "e", x: 2, y: 0, disposition: HOSTILE, actor: enemyActor, name: "Культист" });
    const mover = token({ id: "m", x: 20, y: 20, disposition: FRIENDLY, actor: fakeActor({ type: "character" }), name: "Герой" });
    canvas.tokens.placeables = [mover, enemy];

    const broken = await processTokenMove(mover.document, new Set(["e"]));

    expect(broken.map(d => d.id)).toEqual(["e"]);
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Свободная атака");
    expect(captured.chat[0].content).toContain("Культист");
  });

  it("контакт остался — ничего не предлагает", async () => {
    const enemy = token({ id: "e", x: 2, y: 0, disposition: HOSTILE, actor: fakeActor({ type: "character" }) });
    const mover = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY, actor: fakeActor({ type: "character" }) });
    canvas.tokens.placeables = [mover, enemy];

    const broken = await processTokenMove(mover.document, new Set(["e"]));

    expect(broken).toEqual([]);
    expect(captured.chat.length).toBe(0);
  });

  it("флаг disengageActive («Выход из Боя») гасит предложение и снимается сам", async () => {
    const moverActor = fakeActor({ type: "character", flags: { "warhammer-dbc": { disengageActive: true } } });
    const enemy = token({ id: "e", x: 2, y: 0, disposition: HOSTILE, actor: fakeActor({ type: "character" }) });
    const mover = token({ id: "m", x: 20, y: 20, disposition: FRIENDLY, actor: moverActor });
    canvas.tokens.placeables = [mover, enemy];

    const broken = await processTokenMove(mover.document, new Set(["e"]));

    expect(broken).toEqual([]);
    expect(captured.chat.length).toBe(0);
    expect(moverActor.getFlag("warhammer-dbc", "disengageActive")).toBeUndefined();
  });
});

describe("offerFreeAttack: экономика действия реагирующего", () => {
  it("тип без экономики действий (Орда/Техника/...) — не предлагает", async () => {
    const reactor = fakeActor({ type: "horde" });
    await offerFreeAttack(token({ id: "e", actor: reactor }).document, token({ id: "m" }).document);
    expect(captured.chat.length).toBe(0);
  });

  it("Свободная атака уже потрачена в этом Раунде — не предлагает повторно", async () => {
    globalThis.game.combat = { started: true, round: 3 };
    const reactor = fakeActor({
      type: "character",
      flags: { "warhammer-dbc": { usageLimits: { [FREE_ATTACK_CAPABILITY]: { round: 3 } } } }
    });
    await offerFreeAttack(token({ id: "e", actor: reactor }).document, token({ id: "m" }).document);
    expect(captured.chat.length).toBe(0);
  });

  it("вне Раунда (нет активного Combat) — предлагает", async () => {
    const reactor = fakeActor({ type: "character" });
    await offerFreeAttack(token({ id: "e", actor: reactor }).document, token({ id: "m", name: "Цель" }).document);
    expect(captured.chat.length).toBe(1);
  });
});

describe("resolveFreeAttackClick: клик по кнопке в чате", () => {
  it("списывает Реакцию, отмечает Раунд и назначает цель кликнувшему", async () => {
    globalThis.game.combat = { started: true, round: 1 };
    const reactor = fakeActor({ type: "character", reactions: { value: 1, max: 1, defenseValue: 0, defenseMax: 0 } });
    const moverDoc = token({ id: "m", name: "Беглец" }).document;
    globalThis.fromUuid = async uuid => (uuid === reactor.uuid ? reactor : (uuid === moverDoc.uuid ? moverDoc : null));
    globalThis.game.user = { id: "u1" };

    await resolveFreeAttackClick(reactor.uuid, moverDoc.uuid);

    expect(reactor.system.reactions.value).toBe(0);
    expect(reactor.getFlag("warhammer-dbc", `usageLimits.${FREE_ATTACK_CAPABILITY}`)?.round).toBe(1);
    // Цель назначена через Token#setTarget: на game.user.updateTokenTargets
    // (метода в v14 нет) клик падал ПОСЛЕ списания Реакции — реагирующий
    // платил, а цель не выбиралась. Прежняя версия этого теста мокала
    // несуществующий метод и потому ошибку не видела.
    expect(moverDoc.object.targetedBy).toEqual({ opts: { user: globalThis.game.user, releaseOthers: true } });
  });

  it("нет Реакции — предупреждает и не тратит Раунд", async () => {
    globalThis.game.combat = { started: true, round: 1 };
    const reactor = fakeActor({ type: "character", reactions: { value: 0, max: 1, defenseValue: 0, defenseMax: 0 } });
    globalThis.fromUuid = async uuid => (uuid === reactor.uuid ? reactor : null);

    await resolveFreeAttackClick(reactor.uuid, "Scene.s.Token.x");

    expect(captured.warnings.some(w => w.includes("не хватает Реакции"))).toBe(true);
    expect(reactor.getFlag("warhammer-dbc", `usageLimits.${FREE_ATTACK_CAPABILITY}`)).toBeUndefined();
  });

  it("уже потрачена в этом Раунде — предупреждает и не трогает Реакцию", async () => {
    globalThis.game.combat = { started: true, round: 5 };
    const reactor = fakeActor({
      type: "character", reactions: { value: 1, max: 1, defenseValue: 0, defenseMax: 0 },
      flags: { "warhammer-dbc": { usageLimits: { [FREE_ATTACK_CAPABILITY]: { round: 5 } } } }
    });
    globalThis.fromUuid = async uuid => (uuid === reactor.uuid ? reactor : null);

    await resolveFreeAttackClick(reactor.uuid, "Scene.s.Token.x");

    expect(captured.warnings.some(w => w.includes("уже потрачена"))).toBe(true);
    expect(reactor.system.reactions.value).toBe(1);
  });
});

// wdbc-8zi (п.7 и п.3): раньше проверялась только логика, которую зовут
// колбэки initFreeAttackHooks (processTokenMove выше), не сама подписка на
// Hooks.on — Hooks.on в foundry-stub.mjs no-op, поэтому колбэки ловятся
// локальным перехватчиком (тот же приём, что в regions/
// scene-live-recalc.test.mjs). Заодно закрывает п.3: протухание записи по
// TTL и очистка на deleteToken — до этих тестов у обеих веток не было ни
// одной проверки.
describe("initFreeAttackHooks: подписка на Foundry-хуки", () => {
  let handlers;
  beforeEach(() => {
    handlers = {};
    globalThis.Hooks.on = (name, fn) => { (handlers[name] ??= []).push(fn); };
    globalThis.game.user = { id: "u1" };
    initFreeAttackHooks();
  });

  function fire(name, ...args) {
    return Promise.all((handlers[name] || []).map(fn => fn(...args)));
  }

  it("регистрирует preUpdateToken/updateToken/deleteToken", () => {
    expect(handlers.preUpdateToken?.length).toBe(1);
    expect(handlers.updateToken?.length).toBe(1);
    expect(handlers.deleteToken?.length).toBe(1);
  });

  it("полный цикл через хуки — разрыв контакта предлагает Свободную атаку", async () => {
    globalThis.game.combat = { started: true, round: 1 };
    // Реагирующий (кто теряет контакт) должен реально мочь потратить Реакцию —
    // isEncounterActive() уже true (game.combat.started), поэтому
    // canSpendReaction смотрит на настоящие system.reactions (тот же приём,
    // что у resolveFreeAttackClick выше).
    const enemyActor = fakeActor({
      type: "character", uuid: "Actor.enemy", name: "Культист",
      reactions: { value: 1, max: 1, defenseValue: 0, defenseMax: 0 }
    });
    const enemy = token({ id: "e", x: 2, y: 0, disposition: HOSTILE, actor: enemyActor, name: "Культист" });
    const mover = token({ id: "m", x: 0, y: 0, disposition: FRIENDLY, actor: fakeActor({ type: "character" }), name: "Герой" });
    canvas.tokens.placeables = [mover, enemy];

    fire("preUpdateToken", mover.document, { x: 20, y: 20 });
    mover.document.x = 20; mover.document.y = 20; // токен физически передвинут за тот же вызов

    await fire("updateToken", mover.document, { x: 20, y: 20 }, {}, "u1");

    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Свободная атака");
  });

  it("deleteToken чистит запись ДО апдейта (п.3) — отменённый драг не всплывает контактом", async () => {
    globalThis.game.combat = { started: true, round: 1 };
    const enemy = token({ id: "e2", x: 2, y: 0, disposition: HOSTILE, actor: fakeActor({ type: "character" }) });
    const mover = token({ id: "m2", x: 0, y: 0, disposition: FRIENDLY, actor: fakeActor({ type: "character" }) });
    canvas.tokens.placeables = [mover, enemy];

    fire("preUpdateToken", mover.document, { x: 20, y: 20 });
    // Апдейт так и не пришёл (отменённый драг/удаление ГМ-ом прямо во время
    // хода) — вместо него токен удалён.
    fire("deleteToken", mover.document);

    mover.document.x = 20; mover.document.y = 20;
    await fire("updateToken", mover.document, { x: 20, y: 20 }, {}, "u1");

    expect(captured.chat.length).toBe(0);
  });

  it("протухшая по TTL запись (п.3) не всплывает в чужом апдейте", async () => {
    vi.useFakeTimers();
    try {
      globalThis.game.combat = { started: true, round: 1 };
      const enemy = token({ id: "e3", x: 2, y: 0, disposition: HOSTILE, actor: fakeActor({ type: "character" }) });
      const mover = token({ id: "m3", x: 0, y: 0, disposition: FRIENDLY, actor: fakeActor({ type: "character" }) });
      const other = token({ id: "o3", x: 100, y: 100, disposition: FRIENDLY, actor: fakeActor({ type: "character" }) });
      canvas.tokens.placeables = [mover, enemy, other];

      fire("preUpdateToken", mover.document, { x: 20, y: 20 });
      vi.advanceTimersByTime(6000); // > PRE_MOVE_TTL_MS (5с)
      // Чужой preUpdateToken (даже для другого токена) чистит протухшие
      // записи целиком, в т.ч. запись mover — protuхание не завязано на
      // конкретный tokenId.
      fire("preUpdateToken", other.document, { x: 101, y: 100 });

      mover.document.x = 20; mover.document.y = 20;
      await fire("updateToken", mover.document, { x: 20, y: 20 }, {}, "u1");

      expect(captured.chat.length).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
