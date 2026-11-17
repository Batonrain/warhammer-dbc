// test/combat/scatter-cheapshot-defence.test.mjs
// Книга, «Особые Свойства Оружия»:
//  • Разброс: Избегания от него на Короткой дистанции и в Упор (но не в
//    рукопашной) получают −20.
//  • Запрещённый Приём: Избегания от него тратят вдвое больше Успехов на
//    отмену каждого попадания.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("Разброс: штраф −20 к Избеганию", () => {
  function scatterGun() {
    const w = weaponFor({ weaponClass: "basic", damage: "1d10+5", damageType: "I", penetration: 0, weaponProps: [{ key: "scatter" }] });
    w.type = "weapon";
    return w;
  }
  const dodgeMod = () => Number(card().match(/wh-dodge-btn[^>]*data-extra-mod="(-?\d+)"/)?.[1]);

  it("на короткой дистанции — −20", async () => {
    const w = scatterGun(); const a = actorFor({ items: [w] });
    captured.dice = [10, 4];
    await _executeAttackRoll(a, w, "bs", 45, "single", null, { shortRange: true });
    expect(dodgeMod()).toBe(-20);
  });

  it("вне короткой дистанции — штрафа нет", async () => {
    const w = scatterGun(); const a = actorFor({ items: [w] });
    captured.dice = [10, 4];
    await _executeAttackRoll(a, w, "bs", 45, "single", null, {});
    expect(dodgeMod()).toBe(0);
  });

  it("стрельба в рукопашной — штрафа Разброса нет (там свой бонус цели)", async () => {
    const w = scatterGun(); const a = actorFor({ items: [w] });
    captured.dice = [10, 4, 3]; // + бонусный куб Разброса в рукопашной
    await _executeAttackRoll(a, w, "bs", 45, "single", null, { shortRange: true, meleeShot: true });
    expect(dodgeMod()).toBe(30);
  });
});

describe("Запрещённый Приём: Избегание вдвое дороже", () => {
  function whip(props) {
    const w = weaponFor({ weaponClass: "melee", damage: "1d10+3", damageType: "R", penetration: 0, weaponProps: props });
    w.type = "weapon";
    return w;
  }
  const costs = () => [...card().matchAll(/data-evade-cost="(\d+)"/g)].map(m => Number(m[1]));

  it("с Cheap Shot кнопки защиты несут цену 2", async () => {
    const w = whip([{ key: "cheapShot" }]); const a = actorFor({ items: [w] });
    captured.dice = [10, 4];
    await _executeAttackRoll(a, w, "ws", 45, "single", null, {});
    expect(costs().length).toBeGreaterThan(0);
    expect(costs().every(c => c === 2)).toBe(true);
  });

  it("без Cheap Shot — цена 1", async () => {
    const w = whip([]); const a = actorFor({ items: [w] });
    captured.dice = [10, 4];
    await _executeAttackRoll(a, w, "ws", 45, "single", null, {});
    expect(costs().every(c => c === 1)).toBe(true);
  });
});
