// test/combat/charge-from-attack.test.mjs
//
// Натиск как База в окне атаки (а не через HUD-кнопку declareCharge): те же два
// хода Талантов Стрелка, что и у HUD — тест Подавления Прикрывающего Огня у
// бывшего противника стрелка и бесплатный выстрел Стрельбы на Бегу (Sahara
// covering-fire-hip-shooting п.1, pyromaniac-20 п.4).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor } from "../support/combat-fixtures.mjs";
import { chargeAttackGate, chargeAttackStarted, markChargeChecked } from "../../module/combat/free-shot.mjs";
import { CHARGE_CHECKED_FLAG, RUN_AND_GUN_PENDING_FLAG } from "../../module/rules/run-and-gun.mjs";
import { COVERING_FIRE_MARKS_FLAG } from "../../module/rules/gunner-talents.mjs";
import { TURN_SCOPED_FLAGS } from "../../module/rules/turn-flags.mjs";

const NS = "warhammer-dbc";
const RAG = { id: "rag", name: "Run and Gun / Стрельба на Бегу", type: "talent", system: {} };
const rifle = { id: "r1", name: "Лазган", type: "weapon",
  system: { weaponClass: "basic", equipped: true, rof_single: 1 } };

function who(items = [], name = "Враг") {
  const a = actorFor({ items, wp: 40 });
  a.uuid = "Actor.charger"; a.name = name; a.type = "character"; a.isOwner = true;
  a.system.conditions = { pinned: false };
  const store = {};
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  a.update = async () => {};
  a.store = store;
  a.getActiveTokens = () => [{ uuid: "Scene.s.Token.f1" }];
  return a;
}
function shooterWithMarks() {
  const s = who([], "Стрелок");
  s.uuid = "Actor.shooter";
  s.store[`${NS}.${COVERING_FIRE_MARKS_FLAG}`] = { "Scene.s.Token.f1": { mod: 10, actorUuid: "Actor.charger", name: "Враг" } };
  return s;
}

beforeEach(() => { resetCaptured(); globalThis.game.combat = undefined; });
afterEach(() => { globalThis.game.combat = undefined; });

describe("Натиск из окна атаки: тест Подавления Прикрывающего Огня", () => {
  it("метка на враге: вопрос и бросок Подавления; 'да' + провал — Натиск не удался", async () => {
    const foe = who();
    globalThis.game.combat = { id: "c1", round: 2, started: true, combatants: [{ actor: shooterWithMarks() }] };
    captured.confirmAnswer = true;
    captured.nextRoll = 99;                      // гарантированный провал теста Подавления
    const res = await chargeAttackGate(foe);
    expect(captured.chat.some(m => m.content.includes("Прикрывающий Огонь"))).toBe(true);
    expect(res.ok).toBe(false);
    expect(foe.store[`${NS}.${CHARGE_CHECKED_FLAG}`]).toBe("c1:2:failed");   // провал не отмечается проверенным, но запоминается
    // вторая попытка в этом же Раунде (окно после HUD и наоборот) теста не повторяет — Натиск не удался
    const n = captured.chat.length;
    const again = await chargeAttackGate(foe);
    expect(again.ok).toBe(false);
    expect(captured.chat.length).toBe(n);
  });

  it("успех теста: Натиск разрешён и в этом Раунде проверка больше не повторяется", async () => {
    const foe = who();
    globalThis.game.combat = { id: "c1", round: 2, started: true, combatants: [{ actor: shooterWithMarks() }] };
    captured.confirmAnswer = true;
    captured.nextRoll = 1;
    const first = await chargeAttackGate(foe);
    expect(first).toEqual({ ok: true, first: true });
    expect(foe.store[`${NS}.${CHARGE_CHECKED_FLAG}`]).toBe("c1:2");
    const chatBefore = captured.chat.length;
    const again = await chargeAttackGate(foe);
    expect(again).toEqual({ ok: true, first: false });
    expect(captured.chat.length).toBe(chatBefore);                       // второй бросок не делается
  });

  it("HUD-Натиск (declareCharge) уже отметил проверку — окно её не повторяет", async () => {
    const foe = who();
    globalThis.game.combat = { id: "c1", round: 2, started: true, combatants: [{ actor: shooterWithMarks() }] };
    await markChargeChecked(foe);
    const res = await chargeAttackGate(foe);
    expect(res).toEqual({ ok: true, first: false });
    expect(captured.chat.length).toBe(0);
  });

  it("новый Раунд — метка прошлого Раунда не защищает", async () => {
    const foe = who();
    foe.store[`${NS}.${CHARGE_CHECKED_FLAG}`] = "c1:1";
    globalThis.game.combat = { id: "c1", round: 2, started: true, combatants: [{ actor: shooterWithMarks() }] };
    captured.confirmAnswer = true;
    captured.nextRoll = 1;
    const res = await chargeAttackGate(foe);
    expect(res.first).toBe(true);
    expect(captured.chat.length).toBeGreaterThan(0);
  });

  it("вне боя метка не ставится: проверка идёт каждый раз", async () => {
    const foe = who();
    const res = await chargeAttackGate(foe);
    expect(res).toEqual({ ok: true, first: true });
    expect(foe.store[`${NS}.${CHARGE_CHECKED_FLAG}`]).toBeUndefined();
  });
});

describe("Натиск из окна атаки: Стрельба на Бегу", () => {
  it("первая Атака Натиска взводит метку и кладёт в чат кнопку выстрела", async () => {
    const a = who([RAG, rifle]);
    globalThis.game.combat = { id: "c1", round: 1, started: true, combatants: [] };
    const { first } = await chargeAttackGate(a);
    await chargeAttackStarted(a, first);
    expect(a.store[`${NS}.${RUN_AND_GUN_PENDING_FLAG}`]).toBe(true);
    expect(captured.chat.at(-1).content).toContain('data-kind="runAndGun"');
  });

  it("повторная Атака в том же Раунде метку и карточку заново не выдаёт", async () => {
    const a = who([RAG, rifle]);
    globalThis.game.combat = { id: "c1", round: 1, started: true, combatants: [] };
    await markChargeChecked(a);
    const { first } = await chargeAttackGate(a);
    await chargeAttackStarted(a, first);
    expect(a.store[`${NS}.${RUN_AND_GUN_PENDING_FLAG}`]).toBeUndefined();
    expect(captured.chat.length).toBe(0);
  });

  it("без Таланта карточки нет", async () => {
    const a = who([rifle]);
    globalThis.game.combat = { id: "c1", round: 1, started: true, combatants: [] };
    const { first } = await chargeAttackGate(a);
    await chargeAttackStarted(a, first);
    expect(captured.chat.length).toBe(0);
  });
});

describe("стыковка", () => {
  const read = rel => fs.readFileSync(path.join(path.resolve(import.meta.dirname, "../.."), rel), "utf8");
  it("метка Раунда сбрасывается с Ходом", () => {
    expect(TURN_SCOPED_FLAGS).toHaveProperty(CHARGE_CHECKED_FLAG);
  });
  it("окно атаки зовёт проверку до списания ОД и взводит выстрел после", () => {
    const d = read("module/sheets/attack/dialog.mjs");
    expect(d).toMatch(/chargeAttackGate\(actor\)/);
    expect(d).toMatch(/chargeAttackStarted\(actor, chargeGate\.first\)/);
    expect(d.indexOf("chargeAttackGate(actor)")).toBeLessThan(d.indexOf("spendActionPoints(actor, apCost"));
    expect(d.indexOf("chargeAttackStarted(actor")).toBeGreaterThan(d.indexOf("spendActionPoints(actor, apCost"));
  });
  it("HUD-Натиск отмечает проверку", () => {
    expect(read("module/combat/movement-actions.mjs")).toMatch(/markChargeChecked\(actor\)/);
  });
});
