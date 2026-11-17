// test/combat/attack-dirge-of-despair.test.mjs
//
// Песнь Отчаянья (Талант Шумового Десантника, Sahara 1-54b9) в combat/attack.mjs: пока флаг
// включён, звуковое оружие получает Concussive (3), а урон попадания падает до 0.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const damageOnButton = () => Number(card().match(/class="[^"]*wh-apply-dmg-btn[^"]*"[^>]*data-damage="(\d+)"/)?.[1]
  ?? card().match(/data-damage="(\d+)"/)?.[1]);

const singer = (dirge, weapon) => {
  const flags = dirge ? { "warhammer-dbc.dirgeOfDespair": true } : {};
  const actor = actorFor({ items: [weapon], characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35) } });
  actor.getFlag = (scope, key) => flags[`${scope}.${key}`];
  return actor;
};

const sonic = props => weaponFor({ weaponClass: "basic", damage: "1d10+4", penetration: 2, weaponProps: props },
  { name: "Sonic Blaster / Звуковой Бластер" });
const bolter = () => weaponFor({ weaponClass: "basic", damage: "1d10+4", penetration: 2 }, { name: "Bolter / Болтер" });

async function shoot(actor, weapon) {
  captured.dice = [20, 6, 6, 6];
  await _executeAttackRoll(actor, weapon, "bs", 90, "single", null, {});
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Песнь Отчаянья в атаке", () => {
  it("выключена: звуковое оружие бьёт как обычно, Оглушающего нет", async () => {
    const w = sonic([]);
    await shoot(singer(false, w), w);
    expect(damageOnButton()).toBeGreaterThan(0);
    expect(card()).not.toContain("Оглушающее");
  });

  it("включена: урон 0 и Оглушающее (3)", async () => {
    const w = sonic([]);
    await shoot(singer(true, w), w);
    expect(damageOnButton()).toBe(0);
    expect(card()).toContain("Оглушающее (3)");
    expect(card()).toContain("Песнь Отчаянья");
  });

  it("уже имеющееся Оглушающее выше трёх не понижается", async () => {
    const w = sonic([{ key: "concussive", rating: 5 }]);
    await shoot(singer(true, w), w);
    expect(card()).toContain("Оглушающее (5)");
  });

  it("не звуковое оружие Песня не трогает", async () => {
    const w = bolter();
    await shoot(singer(true, w), w);
    expect(damageOnButton()).toBeGreaterThan(0);
    expect(card()).not.toContain("Оглушающее");
  });
});
