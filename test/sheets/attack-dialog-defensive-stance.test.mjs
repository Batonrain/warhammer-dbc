// test/sheets/attack-dialog-defensive-stance.test.mjs
//
// Стойка Защитная + щит (стр. 15, wdbc-x1nz.2.66.6): «атака доп. оружием
// при экипированном щите становится Полным действием вместо Полудействия»
// и «не даёт совершать Натиск» — раньше атака (уже разрешённая наличием
// щита, wdbc-x1nz.2.66 базовый гейт) списывала обычное 1 ОД и Натиск
// оставался доступен.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

// isEncounterActive()/hasActionEconomy() (module/combat/action-economy.mjs)
// требуют активный game.combat И actor.type === "character" — иначе
// spendActionPoints тихо ничего не списывает (действует вне боя честно).
function shieldedAttacker(extra = {}) {
  const shield = { id: "shield-1", type: "weapon",
    system: { weaponClass: "melee", equipped: true, shieldAP: 5 }, getFlag: () => undefined };
  const sword = weaponFor({ weaponClass: "melee" });
  const a = actorFor({
    items: [sword, shield], fatigue: { value: 0 }, aiming: "none",
    meleeStance: "defensive", actionPoints: { value: 2, max: 2 }, ...extra
  });
  a.type = "character";
  a.updates = [];
  a.update = async data => { a.updates.push(data); };
  a.getFlag = () => undefined;
  a.setFlag = async () => {};
  return { actor: a, sword };
}

function attackForm(fields = {}, checks = {}) {
  return fakeForm({ "#atk-char": "bs", "#atk-modifier": "0", "#atk-aim": "", ...fields }, checks);
}

async function pressRoll(promise, fields = {}, checks = {}) {
  await captured.press("roll", attackForm(fields, checks));
  return promise;
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = { round: 1, started: true };
});
afterEach(() => { globalThis.game.combat = undefined; });

describe("Защитная Стойка + щит: атака доп. оружием — Полное действие (2 ОД), не Полудействие (1 ОД)", () => {
  it("Стандартная Атака списывает 2 ОД, не 1", async () => {
    const { actor, sword } = shieldedAttacker();
    captured.dice = [10, 5];
    const p = showAttackDialog(actor, sword);
    await pressRoll(p, {});
    expect(actor.updates).toContainEqual({ "system.actionPoints.value": 0 }); // 2 − 2
  });

  it("та же связка, но Стандартная Стойка (без Защитной) — списывает обычный 1 ОД", async () => {
    const { actor, sword } = shieldedAttacker({ meleeStance: "standard" });
    captured.dice = [10, 5];
    const p = showAttackDialog(actor, sword);
    await pressRoll(p, {});
    expect(actor.updates).toContainEqual({ "system.actionPoints.value": 1 }); // 2 − 1
  });
});

describe("Защитная Стойка: Натиск недоступен", () => {
  it("пилюли Базы не предлагают «Натиск» в Защитной Стойке", () => {
    const { actor, sword } = shieldedAttacker();
    showAttackDialog(actor, sword);
    expect(captured.dialog.content).not.toMatch(/name="atk-base" value="charge"/);
  });

  it("в Стандартной Стойке Натиск по-прежнему доступен (регресс)", () => {
    const { actor, sword } = shieldedAttacker({ meleeStance: "standard" });
    showAttackDialog(actor, sword);
    const html = captured.dialog.content;
    expect(html).toMatch(/name="atk-base" value="charge"/);
    expect(html).not.toMatch(/name="atk-base" value="charge"[^>]*disabled/);
  });
});
