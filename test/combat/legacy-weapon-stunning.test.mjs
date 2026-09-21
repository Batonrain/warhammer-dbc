// test/combat/legacy-weapon-stunning.test.mjs
//
// Ошеломляющее/fearsome 7-7, Оружие Наследия, стрелковая ветка (wdbc-1rno.35,
// стр. 427), второе предложение: «Если цель Уклонилась, бросьте 1d10+Inf.b —
// если пробивает Поглощение, попадание без урона с Concussive(0).»

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { stunningLegacyButtonHtml, rollStunningLegacyCheck } from "../../module/combat/legacy-weapon-stunning.mjs";

beforeEach(() => resetCaptured());

function stunningWeapon(owner, overrides = {}) {
  return {
    id: "w1", uuid: "Item.w1", name: "Разящий Автогун", type: "weapon", parent: owner,
    system: { weaponClass: "basic", damage: "1d10+3", legacy: { active: true, mutations: [{ name: "Ошеломляющее" }] }, ...overrides }
  };
}

function ownerActor(infBonus = 4) {
  return { name: "Стрелок", system: { characteristics: { inf: { bonus: infBonus } } } };
}

/** Одинаковое Поглощение на всех локациях — тест не завязан на то, куда именно попал d100. */
function defenderActor({ ap = 0, toughnessBonus = 0 } = {}) {
  return {
    name: "Цель",
    system: {
      absorption: {
        head: ap, body: ap, leftArm: ap, rightArm: ap, leftLeg: ap, rightLeg: ap,
        toughnessBonus
      }
    }
  };
}

describe("stunningLegacyButtonHtml", () => {
  it("стрелковое с Мутацией — кнопка есть, несёт itemUuid и defenderUuid", () => {
    const w = stunningWeapon(ownerActor());
    const html = stunningLegacyButtonHtml(w, "Actor.defender1");
    expect(html).toContain("wh-legacy-stunning-btn");
    expect(html).toContain('data-item-uuid="Item.w1"');
    expect(html).toContain('data-defender-uuid="Actor.defender1"');
  });

  it("рукопашное с той же Мутацией — пусто", () => {
    const w = stunningWeapon(ownerActor(), { weaponClass: "melee" });
    expect(stunningLegacyButtonHtml(w, "Actor.defender1")).toBe("");
  });

  it("без Мутации — пусто", () => {
    const w = stunningWeapon(ownerActor());
    w.system.legacy.mutations = [];
    expect(stunningLegacyButtonHtml(w, "Actor.defender1")).toBe("");
  });

  it("нет defenderUuid — пусто", () => {
    const w = stunningWeapon(ownerActor());
    expect(stunningLegacyButtonHtml(w, "")).toBe("");
  });
});

describe("rollStunningLegacyCheck", () => {
  it("пробивает Поглощение — карточка сообщает об успехе", async () => {
    const owner = ownerActor(4);
    const weapon = stunningWeapon(owner);
    const defender = defenderActor({ ap: 2, toughnessBonus: 0 });
    captured.dice = [9, 10]; // 1d10=9 (+4 Inf.b = 13) против Поглощения 2 (одинаково на всех локациях)
    await rollStunningLegacyCheck(weapon, defender);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Пробито");
  });

  it("не пробивает — карточка сообщает, что Уклонение остаётся полным успехом", async () => {
    const owner = ownerActor(0);
    const weapon = stunningWeapon(owner);
    const defender = defenderActor({ ap: 20, toughnessBonus: 5 });
    captured.dice = [1, 10]; // 1d10=1 (+0 Inf.b = 1) против Поглощения 20
    await rollStunningLegacyCheck(weapon, defender);
    expect(captured.chat.at(-1).content).toContain("Не пробито");
  });

  it("нет владельца оружия (item.parent) — предупреждает, не падает", async () => {
    const weapon = stunningWeapon(null);
    await rollStunningLegacyCheck(weapon, defenderActor());
    expect(captured.chat.length).toBe(0); // до карточки не дошло
  });

  it("нет защищавшегося — предупреждает, не падает", async () => {
    const weapon = stunningWeapon(ownerActor());
    await rollStunningLegacyCheck(weapon, null);
    expect(captured.chat.length).toBe(0);
  });
});
