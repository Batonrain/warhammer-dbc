// test/combat/wrestler.test.mjs
//
// Wrestler / Борец (Пугилист, стр. 62; Sahara 3-eddb, развилка (б) в рекомендации):
// «Противники, пытающиеся Уклониться от его Захвата, должны перебрасывать
// успешные броски на Уклонение.» Режим "rerollSuccess" навязанного переброса:
// успешный бросок Уклонения перебрасывается, остаётся ВТОРОЙ (не «худший из
// двух», как у Локуса Кровопролития); проваленный остаётся как есть.
// Своя половина Таланта (переброс тестов Борьбы раз в Ход) не автоматизирована.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { _performDodge } from "../../module/combat/defense.mjs";
import { wrestlerDodgeReroll } from "../../module/rules/pugilist-talents.mjs";

const WRESTLER = { id: "wr", name: "Wrestler / Борец", type: "talent", system: {} };
const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
});

describe("wrestlerDodgeReroll: только Захват и только с Талантом", () => {
  it("Талант + Захват → rerollSuccess", () => {
    expect(wrestlerDodgeReroll(actorFor({ items: [WRESTLER] }), "grapple")).toBe("rerollSuccess");
  });
  it("Талант, но другой приём — пусто", () => {
    expect(wrestlerDodgeReroll(actorFor({ items: [WRESTLER] }), "stun")).toBe("");
    expect(wrestlerDodgeReroll(actorFor({ items: [WRESTLER] }), undefined)).toBe("");
  });
  it("Захват без Таланта — пусто", () => {
    expect(wrestlerDodgeReroll(actorFor({}), "grapple")).toBe("");
  });
});

describe("карточка Захвата Борца несёт навязанный переброс на кнопке Уклонения", () => {
  async function grappleCard({ talent }) {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Кулаки" });
    const attacker = actorFor({ items: talent ? [weapon, WRESTLER] : [weapon] });
    attacker.uuid = "Actor.attacker";
    const target = actorFor({});
    target.uuid = "Actor.target";
    target.getFlag = () => undefined;
    target.setFlag = async () => {};
    setTargets([target]);
    captured.dice = [10, 5];
    await _executeAttackRoll(attacker, weapon, "ws", 45, "melee", null, { techniqueOpts: { technique: "grapple" } });
    return card();
  }
  it("Борец: data-force-reroll=\"rerollSuccess\"", async () => {
    expect(await grappleCard({ talent: true })).toContain('data-force-reroll="rerollSuccess"');
  });
  it("без Таланта: атрибут пуст", async () => {
    const html = await grappleCard({ talent: false });
    expect(html).not.toContain('data-force-reroll="rerollSuccess"');
  });
});

describe("_performDodge: rerollSuccess", () => {
  // Ag 35 (actorFor), untrained −20 → Порог 15.
  const dodger = () => actorFor({});

  it("успешный бросок перебрасывается и остаётся ВТОРОЙ — пусть даже тоже успешный", async () => {
    captured.dice = [10, 12];                       // первый 10 ≤ 15 — успех, второй 12 — тоже успех, но им и считаем
    await _performDodge(dodger(), { forcedReroll: "rerollSuccess", hitsCount: 1 });
    expect(card()).toContain("Борец: успешный бросок переброшен, прежний 10");
    expect(card()).toContain("Уклонение успешно");
  });

  it("успешный бросок, второй провален — Уклонение провалено", async () => {
    captured.dice = [10, 90];
    await _performDodge(dodger(), { forcedReroll: "rerollSuccess", hitsCount: 1 });
    expect(card()).toContain("Уклонение провалено");
  });

  it("проваленный бросок остаётся как есть, второй кубик не бросается", async () => {
    captured.dice = [90, 5];                        // второе значение не должно быть использовано
    await _performDodge(dodger(), { forcedReroll: "rerollSuccess", hitsCount: 1 });
    expect(card()).toContain("Уклонение провалено");
    expect(card()).not.toContain("Борец:");
  });

  it("«худший из двух» Локуса Кровопролития не затронут (регрессия)", async () => {
    captured.dice = [10, 90];
    await _performDodge(dodger(), { forcedReroll: "keepWorst", hitsCount: 1 });
    expect(card()).toContain("Уклонение провалено");
    expect(card()).toContain("навязанный переброс, отброшено 10");
  });
});
