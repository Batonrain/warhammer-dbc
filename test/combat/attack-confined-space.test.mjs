// test/combat/attack-confined-space.test.mjs
//
// Тесное помещение (стр. 36, wdbc-x1nz.2.63): галочка ГМа в диалоге атаки,
// видна только Взрывному оружию (attack-dialog.mjs::confinedSpaceHtml).
// «Взрывы, наносящие X Dmg (damageType «blast»), получают +1d10 Dmg и
// увеличивают радиус на 50% (окр▲). Взрывы E Dmg получают Рвущее, а
// Оглушающие повышают рейтинг Concussive на 1.»

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Тесное помещение: радиус ×1.5 для X Dmg (wdbc-x1nz.2.63)", () => {
  it("confinedSpace + damageType blast — радиус 3→5 (×1.5, окр.▲) в шаблоне", async () => {
    const weapon = weaponFor({
      damage: "1d10", damageType: "blast", rof_single: 1,
      weaponProps: [{ key: "blast", rating: 3 }]
    });
    const actor = actorFor({ items: [weapon] });
    // rv=10 попадание; 5 — базовый урон 1d10; 7 — доп. кубик Тесного помещения
    // (X Dmg + confinedSpace тоже даёт +1d10, см. bonusDamageDice).
    captured.dice = [10, 5, 7];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { confinedSpace: true });

    expect(card()).toContain('data-meters="5"');
    expect(card()).toContain("отметьте всех в радиусе 5м");
  });

  it("без галочки — радиус остаётся 3", async () => {
    const weapon = weaponFor({
      damage: "1d10", damageType: "blast", rof_single: 1,
      weaponProps: [{ key: "blast", rating: 3 }]
    });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain('data-meters="3"');
  });

  it("confinedSpace, но damageType не blast (напр. impact) — радиус не растёт", async () => {
    const weapon = weaponFor({
      damage: "1d10", damageType: "impact", rof_single: 1,
      weaponProps: [{ key: "blast", rating: 3 }]
    });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { confinedSpace: true });

    expect(card()).toContain('data-meters="3"');
  });
});

describe("Тесное помещение: +1d10 урона для X Dmg (wdbc-x1nz.2.63)", () => {
  it("confinedSpace + damageType blast — второй кубик урона идёт в дополнительный бросок", async () => {
    const weapon = weaponFor({
      damage: "1d10", damageType: "blast", rof_single: 1,
      weaponProps: [{ key: "blast", rating: 3 }]
    });
    const actor = actorFor({ items: [weapon] });
    // rv=10 попадание; 5 — базовый урон 1d10; 7 — доп. кубик Тесного помещения.
    captured.dice = [10, 5, 7];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { confinedSpace: true });

    expect(card()).toContain('data-damage="12"'); // 5 + 7
  });
});

describe("Тесное помещение: Рвущее для E Dmg (wdbc-x1nz.2.63)", () => {
  it("confinedSpace + damageType energy — оружие получает Рвущее на этот выстрел", async () => {
    const weapon = weaponFor({
      damage: "1d10", damageType: "energy", rof_single: 1,
      weaponProps: [{ key: "blast", rating: 3 }]
    });
    const actor = actorFor({ items: [weapon] });
    // rv=10 попадание; Рвущее удваивает базовый кубик формулы (2d10kh1).
    captured.dice = [10, 5, 7];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { confinedSpace: true });

    expect(card()).toContain("Рвущее");
  });

  it("без confinedSpace — Рвущего нет", async () => {
    const weapon = weaponFor({
      damage: "1d10", damageType: "energy", rof_single: 1,
      weaponProps: [{ key: "blast", rating: 3 }]
    });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).not.toContain("Рвущее");
  });

  it("confinedSpace + damageType impact (не energy) — Рвущего нет", async () => {
    const weapon = weaponFor({
      damage: "1d10", damageType: "impact", rof_single: 1,
      weaponProps: [{ key: "blast", rating: 3 }]
    });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { confinedSpace: true });

    expect(card()).not.toContain("Рвущее");
  });
});

describe("Тесное помещение: Concussive рейтинг +1 (wdbc-x1nz.2.63)", () => {
  it("confinedSpace — рейтинг Оглушающего повышается на 1 (тест T−20 вместо T−10)", async () => {
    const weapon = weaponFor({
      damage: "1d10", damageType: "impact", rof_single: 1,
      weaponProps: [{ key: "blast", rating: 3 }, { key: "concussive", rating: 1 }]
    });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { confinedSpace: true });

    expect(card()).toContain('data-wp-test-mod="-20"');
  });

  it("без confinedSpace — рейтинг остаётся 1 (тест T−10)", async () => {
    const weapon = weaponFor({
      damage: "1d10", damageType: "impact", rof_single: 1,
      weaponProps: [{ key: "blast", rating: 3 }, { key: "concussive", rating: 1 }]
    });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain('data-wp-test-mod="-10"');
  });

  it("confinedSpace без Взрывного (не Blast-оружие) — Concussive не трогается", async () => {
    const weapon = weaponFor({
      damage: "1d10", damageType: "impact", rof_single: 1,
      weaponProps: [{ key: "concussive", rating: 1 }]
    });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { confinedSpace: true });

    expect(card()).toContain('data-wp-test-mod="-10"');
  });
});
