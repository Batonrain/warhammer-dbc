// test/combat/reaper-chain.test.mjs
//
// Жнец (Reaper, Таланты «Рукопашные», Sahara 3-8dc5): кнопка на карточке урона и замер по токенам.
//   — карточка урона: Натиск + цель выведена из строя + непотраченные Атаки → кнопка;
//   — клик (startReaperFollow): выцеленный токен, замер по сцене (Полудвижение от начальной цели,
//     дистанция Натиска за вычетом пройденного), отказ при нехватке токенов/сцены;
//   — карточка атаки несёт метку Натиска (data-charge-base).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { startReaperFollow, measureReaperStep, offerReaperAfterKill, LAST_DAMAGE_CHARGE_FLAG } from "../../module/combat/reaper-chain.mjs";
import { REAPER_CHAIN_FLAG } from "../../module/rules/melee-talents.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const reaperTalent = { id: "t-reaper", name: "Reaper / Жнец", type: "talent", system: {} };

let registry, prevFromUuid, prevCanvas, prevCombat;
beforeEach(() => {
  resetCaptured(); setTargets([]);
  registry = {}; prevFromUuid = globalThis.fromUuid; globalThis.fromUuid = async u => registry[u] ?? null;
  prevCanvas = globalThis.canvas; prevCombat = game.combat;
});
afterEach(() => { globalThis.fromUuid = prevFromUuid; globalThis.canvas = prevCanvas; game.combat = prevCombat; });

describe("карточка атаки: метка Натиска на кнопке урона", () => {
  async function swing(baseKey) {
    const w = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10" });
    const actor = actorFor({ items: [w], characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) } });
    captured.dice = [10, 5, 5, 5, 5, 5];
    await _executeAttackRoll(actor, w, "ws", 45, "melee", null, { baseKey });
  }
  it("Натиск — data-charge-base=1", async () => {
    await swing("charge");
    expect(card()).toContain('data-charge-base="1"');
  });
  it("Стандартная Атака — 0", async () => {
    await swing("standard");
    expect(card()).toContain('data-charge-base="0"');
  });
});

describe("Жнец: Натиск убил цель — смерть констатирована", () => {
  const victim = ({ wounds = 5 } = {}) => {
    const ch = total => ({ total, bonus: Math.floor(total / 10) });
    const store = {};
    return {
      id: "v", name: "Жертва", type: "character", uuid: "Actor.v", isOwner: true, token: { uuid: "Scene.s.Token.victim" },
      system: {
        absorption: { head: 0, body: 0, rightArm: 0, leftArm: 0, leftLeg: 0, rightLeg: 0, toughnessBonus: 0, propFlags: {}, armorOnly: {} },
        characteristics: { s: ch(50), t: ch(40), wp: ch(40), ag: ch(40), int: ch(40) },
        wounds: { value: wounds, critical: 0, max: 20 }, fate: { value: 2 }, cover: { ap: 0 },
        armorCorrosion: { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 },
        actionPoints: { value: 2, max: 2 }, conditions: {}, fatigue: { value: 0, max: 10 }, patronGod: "", size: 4
      },
      items: Object.assign([], { contents: [], get: () => null }), effects: Object.assign([], { contents: [] }),
      getFlag: (s2, k) => store[k], setFlag: async (s2, k, v) => { store[k] = v; }, unsetFlag: async (s2, k) => { delete store[k]; },
      getActiveTokens: () => [], async update() {}, async updateEmbeddedDocuments() { return []; }, store
    };
  };
  const fighter = ({ talents = [reaperTalent] } = {}) => {
    const store = {};
    return { id: "f", name: "Боец", type: "character", uuid: "Actor.f", system: {},
      items: Object.assign([...talents], { get: () => null }),
      getFlag: (s2, k) => store[k], setFlag: async (s2, k, v) => { store[k] = v; } };
  };
  const sword = f => ({ uuid: "Item.sword", name: "меч", system: { weaponClass: "melee" }, parent: f, actor: f });
  const hit = (f, v, extra = {}) => {
    registry["Actor.f"] = f;
    return applyDamageToActor(v, { rawDamage: 20, penetration: 0, damageType: "rending", hitLocation: "Торс",
      melee: true, chargeBase: true, attackerName: "Боец", attackerUuid: "Actor.f", weaponUuid: "Item.sword", ...extra });
  };

  describe("запись последнего удара на жертве", () => {
    it("Натиск: метка с атакующим, токеном жертвы, боем и Раундом; кнопки на карточке УРОНА уже нет", async () => {
      game.combat = { id: "cb", round: 2 };
      const v = victim();
      await hit(fighter(), v);
      expect(v.store[LAST_DAMAGE_CHARGE_FLAG]).toEqual({ attackerUuid: "Actor.f", tokenUuid: "Scene.s.Token.victim", combatId: "cb", round: 2 });
      expect(card()).not.toContain("wh-reaper-btn");     // убит ли — решает констатация смерти, не карточка урона
    });
    it("не Натиск: метки нет, прежняя стирается", async () => {
      const v = victim();
      await hit(fighter(), v, { chargeBase: false });
      expect(v.store[LAST_DAMAGE_CHARGE_FLAG]).toBeUndefined();
      await hit(fighter(), v);
      expect(v.store[LAST_DAMAGE_CHARGE_FLAG]).toBeDefined();
      await hit(fighter(), v, { chargeBase: false });
      expect(v.store[LAST_DAMAGE_CHARGE_FLAG]).toBeUndefined();
    });
    it("стрелковый удар метку не ставит", async () => {
      const v = victim();
      await hit(fighter(), v, { melee: false });
      expect(v.store[LAST_DAMAGE_CHARGE_FLAG]).toBeUndefined();
    });
  });

  describe("карточка «Жнец» после констатации смерти", () => {
    const killed = async (f, { round = 2, combatId = "cb" } = {}) => {
      game.combat = { id: "cb", round: 2 };
      const v = victim();
      await hit(f, v);
      game.combat = { id: combatId, round };
      return v;
    };
    it("Талант, Натиск, тот же Раунд — карточка с кнопкой: токен убитой, оружие, бой и Раунд", async () => {
      const f = fighter(); const v = await killed(f);
      expect(await offerReaperAfterKill(v, sword(f))).toBe(true);
      expect(card()).toContain("wh-reaper-btn");
      expect(card()).toContain('data-killed-token-uuid="Scene.s.Token.victim"');
      expect(card()).toContain('data-weapon-uuid="Item.sword"');
      expect(card()).toContain('data-combat-id="cb"');
      expect(card()).toContain('data-round="2"');
    });
    it("работает у обычного бойца: надбавки к лимиту Атак не нужно", async () => {
      const f = fighter(); f.system.attackLimitBonus = 0;
      expect(await offerReaperAfterKill(await killed(f), sword(f))).toBe(true);
    });
    it("метка снимается: вторая констатация той же смерти карточку не дублирует", async () => {
      const f = fighter(); const v = await killed(f);
      expect(await offerReaperAfterKill(v, sword(f))).toBe(true);
      expect(await offerReaperAfterKill(v, sword(f))).toBe(false);
    });
    it("смерть констатирована в другом Раунде (истёк от кровотечения позже) — нет", async () => {
      const f = fighter();
      expect(await offerReaperAfterKill(await killed(f, { round: 3 }), sword(f))).toBe(false);
      expect(card()).not.toContain("wh-reaper-btn");
    });
    it("другой бой — нет", async () => {
      const f = fighter();
      expect(await offerReaperAfterKill(await killed(f, { combatId: "other" }), sword(f))).toBe(false);
    });
    it("без Таланта — нет", async () => {
      const f = fighter({ talents: [] });
      expect(await offerReaperAfterKill(await killed(f), sword(f))).toBe(false);
    });
    it("последний удар был не Натиском — нет", async () => {
      const f = fighter(); game.combat = { id: "cb", round: 2 };
      const v = victim(); await hit(f, v, { chargeBase: false });
      expect(await offerReaperAfterKill(v, sword(f))).toBe(false);
    });
    it("добил не рукопашным оружием — нет", async () => {
      const f = fighter(); const v = await killed(f);
      expect(await offerReaperAfterKill(v, { ...sword(f), system: { weaponClass: "basic" } })).toBe(false);
    });
  });
});

// ── Замер по токенам ────────────────────────────────────────────────────────

const GRID = { size: 100, distance: 1 };
const tok = (id, xm, ym = 0, over = {}) => ({
  uuid: `Scene.s.Token.${id}`, id, name: id, x: xm * 100, y: ym * 100, width: 1, height: 1, elevation: 0,
  parent: { grid: GRID }, actor: { uuid: `Actor.${id}`, name: id }, movementHistory: [], ...over
});

describe("замер Жнеца по токенам", () => {
  const actor = { system: { movement: { charge: 9, halfMove: 3 } } };
  it("Полудвижение от начальной цели и Натиск в пределах — можно; метры считаются по сетке сцены", () => {
    const a = tok("a", 0), first = tok("first", 1), next = tok("next", 3);
    const r = measureReaperStep({ actor, attackerDoc: a, initialDoc: first, nextDoc: next });
    expect(r.initialToNext).toBeCloseTo(2, 5);          // центр — центр: 3 − 1
    expect(r.attackerToNext).toBeCloseTo(2, 5);         // 3 м центров минус два радиуса по 0,5 м
    expect(r.verdict.ok).toBe(true);
  });
  it("следующий дальше Полудвижения (SPD 3) от начальной цели — отказ", () => {
    const r = measureReaperStep({ actor, attackerDoc: tok("a", 0), initialDoc: tok("first", 1), nextDoc: tok("next", 5) });
    expect(r.initialToNext).toBeCloseTo(4, 5);
    expect(r.verdict.ok).toBe(false);
  });
  it("клетка сетки считается по distance сцены (2 м на клетку)", () => {
    const g = { size: 100, distance: 2 };
    const mk = (id, xm) => tok(id, xm, 0, { parent: { grid: g } });
    const r = measureReaperStep({ actor, attackerDoc: mk("a", 0), initialDoc: mk("first", 1), nextDoc: mk("next", 2) });
    expect(r.initialToNext).toBeCloseTo(2, 5);          // 1 клетка × 2 м
  });
  it("пройденное по истории за Ход вычитается из Натиска", () => {
    const hist = [{ x: 0, y: 0, cost: 0, action: "walk" }, { x: 100, y: 0, cost: 8, action: "walk" }];
    const a = tok("a", 0, 0, { movementHistory: hist });
    const r = measureReaperStep({ actor, attackerDoc: a, initialDoc: tok("first", 1), nextDoc: tok("next", 3) });
    expect(r.walked).toBeCloseTo(8, 5);
    expect(r.verdict.ok).toBe(false);                    // 8 + 2 > 9
    expect(r.verdict.problems.join(" ")).toContain("Натиска");
  });
  it("отрезки, пройденные под управлением ГМа (NPC), тоже считаются в Натиск", () => {
    const realUsers = game.users; game.users = { get: id => ({ isGM: id === "gm1" }) };
    try {
      const hist = [{ x: 0, y: 0, cost: 0, action: "walk", userId: "gm1" }, { x: 100, y: 0, cost: 8, action: "walk", userId: "gm1" }];
      const r = measureReaperStep({ actor, attackerDoc: tok("a", 0, 0, { movementHistory: hist }), initialDoc: tok("first", 1), nextDoc: tok("next", 3) });
      expect(r.walked).toBeCloseTo(8, 5);
      expect(r.verdict.ok).toBe(false);
    } finally { game.users = realUsers; }
  });
  it("нет сетки сцены или токена — отказ, а не молчаливое «можно»", () => {
    const noGrid = tok("a", 0, 0, { parent: null });
    globalThis.canvas = {};
    expect(measureReaperStep({ actor, attackerDoc: noGrid, initialDoc: tok("f", 1), nextDoc: tok("n", 2) }).verdict.ok).toBe(false);
    expect(measureReaperStep({ actor, attackerDoc: tok("a", 0), initialDoc: null, nextDoc: tok("n", 2) }).verdict.ok).toBe(false);
  });
});

describe("клик: startReaperFollow", () => {
  let warns;
  const attackerWith = (doc, { flags = {}, charge = 9, half = 3 } = {}) => {
    const store = { ...flags };
    return {
      uuid: "Actor.a", name: "Жнец", type: "character", system: { movement: { charge, halfMove: half } },
      getActiveTokens: () => [doc],
      getFlag: (s, k) => store[k], setFlag: async (s, k, v) => { store[k] = v; },
      sheet: { _showAttackDialog: vi.fn(async () => {}) }, store
    };
  };
  const target = d => { game.user = { ...game.user, targets: new Set(d ? [{ document: d }] : []) }; };
  beforeEach(() => {
    warns = []; ui.notifications.warn = m => warns.push(m);
    game.combat = undefined;
    registry["Scene.s.Token.killed"] = tok("killed", 1);
  });
  const claim = () => { const f = vi.fn(async () => true); return f; };

  it("цель в пределах — отметка карточки, начальная цель запомнена, окно атаки с Базой «Натиск» и reaperFollow", async () => {
    const a = tok("a", 0), next = tok("next", 3);
    const actor = attackerWith(a);
    target(next);
    const c = claim();
    const ok = await startReaperFollow(actor, { name: "меч" }, { killedTokenUuid: "Scene.s.Token.killed", claim: c });
    expect(ok).toBe(true);
    expect(c).toHaveBeenCalledOnce();
    expect(actor.store[REAPER_CHAIN_FLAG]).toBe("Scene.s.Token.killed");
    expect(actor.sheet._showAttackDialog).toHaveBeenCalledWith({ name: "меч" }, { forceBase: "charge", reaperFollow: true });
  });
  it("вторая убитая цель цепочки: начальной остаётся первая", async () => {
    registry["Scene.s.Token.first"] = tok("first", 0);
    const a = tok("a", 1), next = tok("next", 3);
    const actor = attackerWith(a, { flags: { [REAPER_CHAIN_FLAG]: "Scene.s.Token.first" } });
    target(next);
    expect(await startReaperFollow(actor, {}, { killedTokenUuid: "Scene.s.Token.killed", claim: claim() })).toBe(true);
    expect(actor.store[REAPER_CHAIN_FLAG]).toBe("Scene.s.Token.first");
  });
  it("цепочка: дальше Полудвижения от ПЕРВОЙ цели — отказ, даже если от второй близко", async () => {
    registry["Scene.s.Token.first"] = tok("first", 0);
    const actor = attackerWith(tok("a", 3), { flags: { [REAPER_CHAIN_FLAG]: "Scene.s.Token.first" } });
    target(tok("next", 4));                               // от убитой (x=1) — 3 м (в пределах SPD 3), от первой (x=0) — 4 м
    const c = claim();
    expect(await startReaperFollow(actor, {}, { killedTokenUuid: "Scene.s.Token.killed", claim: c })).toBe(false);
    expect(c).not.toHaveBeenCalled();
    expect(warns.join(" ")).toContain("Полудвижения");
    expect(actor.sheet._showAttackDialog).not.toHaveBeenCalled();
  });
  it("слишком далеко — отказ с числами, отметка карточки НЕ ставится, окно не открывается", async () => {
    const actor = attackerWith(tok("a", 0));
    target(tok("next", 20));
    const c = claim();
    expect(await startReaperFollow(actor, {}, { killedTokenUuid: "Scene.s.Token.killed", claim: c })).toBe(false);
    expect(c).not.toHaveBeenCalled();
    expect(warns.join(" ")).toMatch(/недосягаема/);
    expect(actor.sheet._showAttackDialog).not.toHaveBeenCalled();
  });
  it("цель не выцелена или это сама убитая — просим выцелить", async () => {
    const actor = attackerWith(tok("a", 0));
    target(null);
    expect(await startReaperFollow(actor, {}, { killedTokenUuid: "Scene.s.Token.killed", claim: claim() })).toBe(false);
    target(registry["Scene.s.Token.killed"]);
    expect(await startReaperFollow(actor, {}, { killedTokenUuid: "Scene.s.Token.killed", claim: claim() })).toBe(false);
    expect(warns.every(w => w.includes("выцельте"))).toBe(true);
  });
  it("нет токена атакующего на сцене — отказ", async () => {
    const actor = attackerWith(null);
    actor.getActiveTokens = () => [];
    target(tok("next", 3));
    expect(await startReaperFollow(actor, {}, { killedTokenUuid: "Scene.s.Token.killed", claim: claim() })).toBe(false);
    expect(warns.join(" ")).toContain("токен атакующего");
  });
  it("нет токена начальной цели (удалён со сцены) — отказ", async () => {
    delete registry["Scene.s.Token.killed"];
    const actor = attackerWith(tok("a", 0));
    target(tok("next", 3));
    expect(await startReaperFollow(actor, {}, { killedTokenUuid: "Scene.s.Token.killed", claim: claim() })).toBe(false);
    expect(warns.join(" ")).toContain("начальной цели");
  });
  it("кнопка из другого Раунда — отказ без замера (токен уже ходил дальше)", async () => {
    game.combat = { id: "cb", round: 5 };
    const actor = attackerWith(tok("a", 0));
    target(tok("next", 3));
    const c = claim();
    expect(await startReaperFollow(actor, {}, { killedTokenUuid: "Scene.s.Token.killed", combatId: "cb", round: 4, claim: c })).toBe(false);
    expect(c).not.toHaveBeenCalled();
    expect(warns.join(" ")).toContain("другому Раунду");
  });
  it("кнопка того же боя и Раунда — работает", async () => {
    game.combat = { id: "cb", round: 5 };
    const actor = attackerWith(tok("a", 0));
    target(tok("next", 3));
    expect(await startReaperFollow(actor, {}, { killedTokenUuid: "Scene.s.Token.killed", combatId: "cb", round: 5, claim: claim() })).toBe(true);
  });
});
