// test/combat/techniques-contest.test.mjs
//
// Агрессивная Стойка (стр. 15): «+10 на все тесты WS, кроме встречных тестов
// против Финта». Давление — тоже WS vs WS контест, но не Финт, поэтому
// бонус ему положен; Повалить/Напролом — тесты Athletics, бонус WS их не
// касается вовсе. _showContestDialog не рендерит DOM (Dialog — заглушка,
// см. foundry-stub.mjs) — единственное, что можно и нужно проверить, это
// содержимое собранной разметки.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor } from "../support/combat-fixtures.mjs";
import { _showContestDialog } from "../../module/combat/techniques.mjs";
import { MELEE_CONTESTS } from "../../module/constants/combat.mjs";

beforeEach(() => resetCaptured());

function selfValue() {
  const m = (captured.dialog?.content ?? "").match(/id="contest-self"[^>]*value="(-?\d+)"/);
  return m ? Number(m[1]) : null;
}

describe("_showContestDialog — бонус Стойки", () => {
  it("Давление в Агрессивной Стойке получает +10 WS", async () => {
    const actor = actorFor({ meleeStance: "aggressive" });
    await _showContestDialog(actor, MELEE_CONTESTS.press);
    expect(selfValue()).toBe(55); // ws 45 + 10
    expect(captured.dialog.content).toContain("Агрессивная");
  });

  it("Финт в Агрессивной Стойке бонус НЕ получает — книга явно исключает его", async () => {
    const actor = actorFor({ meleeStance: "aggressive" });
    await _showContestDialog(actor, MELEE_CONTESTS.feint);
    expect(selfValue()).toBe(45); // ws 45, без бонуса
    expect(captured.dialog.content).not.toContain("Стойка: Агрессивная");
  });

  it("Повалить/Напролом — тесты Athletics, Стойка на них не влияет", async () => {
    const actor = actorFor({ meleeStance: "aggressive" });
    await _showContestDialog(actor, MELEE_CONTESTS.knockdown);
    expect(selfValue()).toBe(40); // s 40, без бонуса WS
  });

  it("Стандартная Стойка не даёт бонуса Давлению", async () => {
    const actor = actorFor({ meleeStance: "standard" });
    await _showContestDialog(actor, MELEE_CONTESTS.press);
    expect(selfValue()).toBe(45);
  });
});

// wdbc-u0by (Truth-Seer/Defiance): диалог Состязаний раньше вообще не читал
// реестр правил (та же дыра, что была у Парирования, module/combat/defense.mjs
// до фикса) — опциональный переброс не мог появиться, даже если у актора был
// Талант/Дар, дающий его. Область считается по характеристике ПО УМОЛЧАНИЮ
// контеста (Финт/Давление — "ws").
describe("_showContestDialog — опциональные перебросы правил (wdbc-u0by)", () => {
  it("предмет с kind:reroll, скоуп char:ws — галочка появляется в разметке Финта", async () => {
    const dancer = { type: "talent", name: "Truth-Seer", system: {},
      flags: { "warhammer-dbc": { mechanics: [{ id: "g1", operator: "AND", entries: [
        { id: "e1", kind: "reroll", rerollScope: "char", rerollChar: "ws", rerollMode: "keepBest", rerollWho: "self", label: "Правдовидец" }
      ] }] } } };
    const actor = actorFor({ items: [dancer] });
    await _showContestDialog(actor, MELEE_CONTESTS.feint);
    expect(captured.dialog.content).toContain("rule-reroll-opt");
    expect(captured.dialog.content).toContain("Правдовидец");
  });

  it("нет подходящего предмета — блока перебросов в разметке нет", async () => {
    const actor = actorFor({});
    await _showContestDialog(actor, MELEE_CONTESTS.feint);
    expect(captured.dialog.content).not.toContain("rule-reroll-opt");
  });
});
