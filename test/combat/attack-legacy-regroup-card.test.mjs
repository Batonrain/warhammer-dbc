// test/combat/attack-legacy-regroup-card.test.mjs
//
// Перегруппировка/vigilant 1-2, Оружие Наследия (wdbc-1rno.35, стр. 427):
// «После успешной атаки этим оружием (даже если цель Избежала её) персонаж
// может потратить Очко Бесчестия, чтобы перебросить свою Инициативу начиная
// со следующего Раунда» — здесь проверяется только проводка: попадание этим
// оружием кладёт кнопку в карточку атаки (клик — module/combat/legacy-
// weapon-regroup.mjs, отдельно протестирован в своём файле).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => { resetCaptured(); });

describe("Перегруппировка: кнопка карточки атаки", () => {
  it("попадание оружием с Мутацией — кнопка есть, с uuid атакующего", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Перегруппировка" }] } });
    const actor  = actorFor({ items: [weapon] });
    actor.uuid = "Actor.a1";
    captured.dice = [10, 5]; // попадание при пороге 45, урон 1d10+5
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).toContain("wh-legacy-regroup-btn");
    expect(card()).toContain('data-attacker-uuid="Actor.a1"');
  });

  it("промах тем же оружием — кнопки нет", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [{ name: "Перегруппировка" }] } });
    const actor  = actorFor({ items: [weapon] });
    actor.uuid = "Actor.a1";
    captured.dice = [99]; // промах при пороге 45
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).not.toContain("wh-legacy-regroup-btn");
  });

  it("попадание, но без Мутации — кнопки нет", async () => {
    const weapon = weaponFor({ legacy: { active: true, mutations: [] } });
    const actor  = actorFor({ items: [weapon] });
    actor.uuid = "Actor.a1";
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).not.toContain("wh-legacy-regroup-btn");
  });
});
