// test/apps/game-session.test.mjs
//
// isRoundCapabilityAvailable/markRoundCapabilityUsed — Раз-в-Раунд возможности
// актора (флаг из реестра правил, без предмета-носителя). В отличие от
// isRuleUsageUsed/markRuleUsageUsed (scope "scene"/"session"), раунд не
// откатывается кнопкой ГМа: запоминается номер раунда использования и
// сравнивается с текущим game.combat.round.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { isRoundCapabilityAvailable, markRoundCapabilityUsed, resetUsageLimit, refillFatePools } from "../../module/apps/game-session.mjs";

/** Актор с минимальным getFlag/setFlag — как у настоящего Foundry-документа. */
function actorWithFlags() {
  const store = {};
  return {
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; }
  };
}

afterEach(() => { globalThis.game.combat = undefined; });

describe("isRoundCapabilityAvailable", () => {
  it("без активного Combat считается доступной — раунд отследить нечем", () => {
    const actor = actorWithFlags();
    expect(isRoundCapabilityAvailable(actor, "technique.baseFullAttack")).toBe(true);
  });

  it("доступна, пока не отмечена использованной", () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorWithFlags();
    expect(isRoundCapabilityAvailable(actor, "technique.baseFullAttack")).toBe(true);
  });

  it("после markRoundCapabilityUsed недоступна в том же Раунде", async () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorWithFlags();
    await markRoundCapabilityUsed(actor, "technique.baseFullAttack");
    expect(isRoundCapabilityAvailable(actor, "technique.baseFullAttack")).toBe(false);
  });

  it("новый Раунд возвращает доступность", async () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorWithFlags();
    await markRoundCapabilityUsed(actor, "technique.baseFullAttack");

    globalThis.game.combat = { round: 2 };
    expect(isRoundCapabilityAvailable(actor, "technique.baseFullAttack")).toBe(true);
  });

  it("метка одной возможности не трогает другую", async () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorWithFlags();
    await markRoundCapabilityUsed(actor, "technique.baseFullAttack");
    expect(isRoundCapabilityAvailable(actor, "autoHit.melee.oncePerRound")).toBe(true);
  });
});

describe("markRoundCapabilityUsed", () => {
  it("без актора или без Combat ничего не пишет", async () => {
    await expect(markRoundCapabilityUsed(null, "technique.baseFullAttack")).resolves.toBeUndefined();

    const actor = actorWithFlags();
    await markRoundCapabilityUsed(actor, "technique.baseFullAttack");
    expect(actor.getFlag("warhammer-dbc", "usageLimits.technique-baseFullAttack")).toBeUndefined();
  });
});

// ── resetUsageLimit — кнопки «🎬 Новая сцена»/«⏻ Конец сессии» ──────────────
// wdbc-f4jt: с появлением кнопки «▶ Запустить» (mechanics.mjs) флаг
// перезарядки scene/session-записи kind:"script" живёт НА ПРЕДМЕТЕ, а не
// акторе — эти тесты проверяют, что resetUsageLimit теперь читает и оттуда
// тоже (раньше сканировался только actor.getFlag), и что сбрасывает не
// только used, но и count (счётчик «до N раз», module/rules/cooldown.mjs).

function setPath(root, path, value) {
  const parts = path.split(".");
  let cur = root;
  for (const p of parts.slice(0, -1)) { cur[p] ??= {}; cur = cur[p]; }
  cur[parts.at(-1)] = value;
}
function getPath(root, path) {
  return path.split(".").reduce((o, k) => o?.[k], root);
}

function mockDoc(id, warhammerFlags = {}) {
  const flags = { "warhammer-dbc": JSON.parse(JSON.stringify(warhammerFlags)) };
  return {
    id,
    getFlag: (scope, key) => getPath(flags, `${scope}.${key}`),
    update: async patch => { for (const [p, v] of Object.entries(patch)) setPath({ flags }, p, v); }
  };
}

function mockActor(warhammerFlags, items) {
  const doc = mockDoc("actor1", warhammerFlags);
  doc.items = items;
  doc.updateEmbeddedDocuments = async (type, updates) => {
    for (const { _id, ...patch } of updates) {
      const it = items.find(i => i.id === _id);
      if (!it) continue;
      for (const [p, v] of Object.entries(patch)) setPath(it.__root, p, v);
    }
  };
  return doc;
}

function mockItem(id, warhammerFlags = {}) {
  const flags = { "warhammer-dbc": JSON.parse(JSON.stringify(warhammerFlags)) };
  return {
    id,
    __root: { flags },
    getFlag: (scope, key) => getPath(flags, `${scope}.${key}`)
  };
}

describe("resetUsageLimit", () => {
  it("actor-level usageLimits: сбрасывает used у совпадающего scope, не трогает другой", async () => {
    const actor = mockActor({ usageLimits: {
      faith: { scope: "scene", used: true },
      other: { scope: "session", used: true }
    } }, []);
    globalThis.game.actors = [actor];
    await resetUsageLimit("scene");
    expect(actor.getFlag("warhammer-dbc", "usageLimits").faith.used).toBe(false);
    expect(actor.getFlag("warhammer-dbc", "usageLimits").other.used).toBe(true);
  });

  it("item-level usageLimits (kind:\"script\" на предмете, wdbc-f4jt): тоже сбрасывается", async () => {
    const item = mockItem("i1", { usageLimits: { "mechScript-e1": { scope: "session", used: true } } });
    const actor = mockActor({}, [item]);
    globalThis.game.actors = [actor];
    await resetUsageLimit("session");
    expect(item.getFlag("warhammer-dbc", "usageLimits")["mechScript-e1"].used).toBe(false);
  });

  it("счётчик (count) сбрасывается в 0, а не только used", async () => {
    const item = mockItem("i1", { usageLimits: { "mechScript-e1": { scope: "session", count: 2 } } });
    const actor = mockActor({}, [item]);
    globalThis.game.actors = [actor];
    await resetUsageLimit("session");
    expect(item.getFlag("warhammer-dbc", "usageLimits")["mechScript-e1"].count).toBe(0);
  });

  it("старый формат usageLimit (единственное число, на предмете) продолжает работать", async () => {
    const item = mockItem("i1", { usageLimit: { scope: "scene", used: true } });
    const actor = mockActor({}, [item]);
    globalThis.game.actors = [actor];
    await resetUsageLimit("scene");
    expect(item.getFlag("warhammer-dbc", "usageLimit").used).toBe(false);
  });

  it("round/battle (scope не scene/session) не трогает — они сбрасываются сменой Раунда/боя, не кнопкой", async () => {
    const item = mockItem("i1", { usageLimits: { slowReload: { scope: "round", used: true, round: 1 } } });
    const actor = mockActor({}, [item]);
    globalThis.game.actors = [actor];
    await resetUsageLimit("scene");
    expect(item.getFlag("warhammer-dbc", "usageLimits").slowReload.used).toBe(true);
  });
});

// ── refillFatePools — «⏻ Конец сессии» восполняет Судьбу/Бесчестие ─────────
// wdbc-k1hc: у Хаосита (alignment "heretic") максимум пула — Inf.b, а не их
// собственный system.fate.max (тот у Хаосита посторонний, к делу не
// относится). Восполнение до fate.max откатывало бы пул не к реальному
// потолку персонажа.

function actorWithUpdate(type, system) {
  const doc = { type, system: JSON.parse(JSON.stringify(system)), updates: [] };
  doc.update = async patch => {
    doc.updates.push(patch);
    for (const [path, value] of Object.entries(patch)) {
      const parts = path.split(".").slice(1); // "system.fate.value" → ["fate","value"]
      let cur = doc.system;
      for (const p of parts.slice(0, -1)) { cur[p] ??= {}; cur = cur[p]; }
      cur[parts.at(-1)] = value;
    }
  };
  return doc;
}

describe("refillFatePools", () => {
  it("Хаосит: pull восполняется до Inf.b, не до fate.max", async () => {
    const actor = actorWithUpdate("character", {
      alignment: "heretic", fate: { value: 0, max: 3 }, characteristics: { inf: { bonus: 4 } }
    });
    globalThis.game.actors = [actor];
    await refillFatePools();
    expect(actor.system.fate.value).toBe(4);
  });

  it("обычный лоялист: pull восполняется до собственного fate.max, как раньше", async () => {
    const actor = actorWithUpdate("character", {
      alignment: "loyalist", fate: { value: 0, max: 3 }, characteristics: { inf: { bonus: 4 } }
    });
    globalThis.game.actors = [actor];
    await refillFatePools();
    expect(actor.system.fate.value).toBe(3);
  });

  it("Демон-Принц: system.dp.ip восполняется до Inf.b, fate.value не трогается", async () => {
    const actor = actorWithUpdate("demonPrince", {
      fate: { value: 0, max: 9 }, dp: { ip: 0 }, characteristics: { inf: { bonus: 5 } }
    });
    globalThis.game.actors = [actor];
    await refillFatePools();
    expect(actor.system.dp.ip).toBe(5);
    expect(actor.updates.some(u => "system.fate.value" in u)).toBe(false);
  });

  it("max 0 (нет Inf.b/fate.max) — update не вызывается вовсе", async () => {
    const actor = actorWithUpdate("character", { alignment: "loyalist", fate: { value: 0, max: 0 } });
    globalThis.game.actors = [actor];
    await refillFatePools();
    expect(actor.updates.length).toBe(0);
  });
});
