// test/combat/attack-wide-burst.test.mjs
//
// Стр. 35, wdbc-x1nz.2.53: «Широкая Очередь: персонаж стреляет Короткой или
// Длинной Очередью тестом BS+0/BS−10 соответственно, уменьшая RoF (но не
// расход боеприпасов) на 2 и накладывая штраф −20 на все попытки Уклонения
// от этой атаки. Если соответствующая RoF оружия меньше 3, эта атака не
// может использоваться.»

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const hits = () => {
  const m = [...card().matchAll(/data-damage="(\d+)"/g)];
  return m.map(x => Number(x[1]));
};

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Широкая Очередь (wdbc-x1nz.2.53)", () => {
  it("Короткая Очередь: RoF−2 режет потолок попаданий, не расход патронов", async () => {
    const weapon = weaponFor({ rof_semi: 4, magazineCur: 20 });
    const actor  = actorFor({ items: [weapon] });
    // Порог 55 (BS+0), rv=10 → deg=5 → ceil(5/2)=3, но потолок Очереди по
    // книге и без Широкой был бы rof_semi=4 — capped на 3 естественно;
    // возьмём rv поменьше, чтобы deg дал потолок ВЫШЕ урезанного RoF (2).
    captured.dice = [10, 3, 3]; // deg = floor((55-10)/10)+1 = 5 → ceil(5/2)=3
    await _executeAttackRoll(actor, weapon, "bs", 55, "semi", null, { wideBurst: true });

    expect(hits().length).toBe(2); // capped RoF (4-2), не 3 (естественный потолок ceil(deg/2))
    expect(weapon.system.magazineCur).toBe(16); // 20 − 4 (полный RoF, не урезанный)
  });

  it("без Широкой Очереди тот же бросок даёт естественный потолок и расход", async () => {
    const weapon = weaponFor({ rof_semi: 4, magazineCur: 20 });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 3, 3, 3];
    await _executeAttackRoll(actor, weapon, "bs", 55, "semi", null, {});

    expect(hits().length).toBe(3); // ceil(5/2)=3, ниже rof_semi=4 — не капается
    expect(weapon.system.magazineCur).toBe(16); // 20 − 4
  });

  it("даёт цели -20 к Уклонению (dodgeMod), но не к Парированию", async () => {
    const weapon = weaponFor({ rof_semi: 4 });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 3, 3];
    await _executeAttackRoll(actor, weapon, "bs", 55, "semi", null, { wideBurst: true });

    expect(card()).toMatch(/wh-dodge-btn"[^>]*data-extra-mod="-20"/);
    expect(card()).toMatch(/wh-parry-btn"[^>]*data-extra-mod="0"/);
  });

  it("базовый RoF < 3 — Широкая Очередь не применяется вовсе", async () => {
    const weapon = weaponFor({ rof_semi: 2, magazineCur: 20 });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [10, 3, 3];
    await _executeAttackRoll(actor, weapon, "bs", 55, "semi", null, { wideBurst: true });

    expect(hits().length).toBe(2); // ceil(deg/2) с deg=5 капнуто на rof_semi=2 без урезания
    expect(weapon.system.magazineCur).toBe(18); // 20 − 2, полный (неурезанный) расход
    expect(card()).toMatch(/wh-dodge-btn"[^>]*data-extra-mod="0"/);
  });

  it("Длинная Очередь: тот же -2 к потолку, полный расход патронов", async () => {
    const weapon = weaponFor({ rof_full: 5, magazineCur: 20 });
    const actor  = actorFor({ items: [weapon] });
    // Порог 40 (BS−10 уже применён вызывающей стороной), rv=1 → deg=4,
    // естественный потолок был бы min(4,5)=4, урезанный — min(4,3)=3.
    captured.dice = [1, 3, 3, 3];
    await _executeAttackRoll(actor, weapon, "bs", 40, "full", null, { wideBurst: true });

    expect(hits().length).toBe(3);
    expect(weapon.system.magazineCur).toBe(15); // 20 − 5, полный RoF
  });
});
