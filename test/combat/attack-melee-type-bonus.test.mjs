// test/combat/attack-melee-type-bonus.test.mjs
//
// Молот/Топор по лежащей или прижатой к стене цели (core.json, «Типы
// Рукопашного Оружия»): «+1d10 Dmg и получает свойство Concussive(–1)/
// Felling(2), или +1 к рейтингу, если оно уже имело это свойство». «Лежащая»
// — статус Повержен цели (авточтение); «прижата к стене» — галочка ГМа
// (opts.targetAgainstWall, attack-dialog.mjs::targetAgainstWallHtml, см.
// test/sheets/attack-dialog-target-against-wall.test.mjs).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

// S.b 0 (Сила 9) — чтобы урон в карточке был чистым «база + доп. кубик»,
// без отдельного слагаемого Бонуса Силы, путающего арифметику теста.
function meleeActor(items) {
  return actorFor({ items, characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) } });
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Молот по лежащей/у стены цели: +1d10 Dmg и Concussive", () => {
  it("цель Повержена, оружие без Concussive — +1d10 урона, Concussive(-1) (тест T+10)", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Молот", damage: "1d10" });
    const actor  = meleeActor([weapon]);
    setTargets([actorFor({ conditions: { prone: true } })]);
    captured.dice = [10, 5, 7]; // 10 — попадание; 5 — база; 7 — доп. кубик бонуса.

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).toContain('data-damage="12"');
    expect(card()).toContain('data-wp-test-mod="10"'); // rating -1 × testPerRating -10
  });

  it("цель не Повержена и без галочки «у стены» — бонуса нет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Молот", damage: "1d10" });
    const actor  = meleeActor([weapon]);
    setTargets([actorFor()]);
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).toContain('data-damage="5"');
    expect(card()).not.toContain("Оглушающее");
  });

  it("галочка «цель у стены» (ГМ) заменяет автостатус Повержен — тот же бонус", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Молот", damage: "1d10" });
    const actor  = meleeActor([weapon]);
    setTargets([actorFor()]);
    captured.dice = [10, 5, 7];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, { targetAgainstWall: true });

    expect(card()).toContain('data-damage="12"');
  });

  it("оружие уже с Concussive(2) — становится Concussive(3), не новым(-1)", async () => {
    const weapon = weaponFor({
      weaponClass: "melee", meleeCategory: "Молот", damage: "1d10",
      weaponProps: [{ key: "concussive", rating: 2 }]
    });
    const actor  = meleeActor([weapon]);
    setTargets([actorFor({ conditions: { prone: true } })]);
    captured.dice = [10, 5, 7];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).toContain('data-wp-test-mod="-30"'); // rating 3 × -10
  });
});

describe("Топор по лежащей/у стены цели: +1d10 Dmg и Felling", () => {
  it("цель Повержена, оружие без Felling — +1d10 урона, Felling(2)", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Топор", damage: "1d10" });
    const actor  = meleeActor([weapon]);
    setTargets([actorFor({ conditions: { prone: true } })]);
    captured.dice = [10, 5, 7];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).toContain('data-damage="12"');
    expect(card()).toContain('data-felling="2"');
  });

  it("оружие уже с Felling(5) — становится Felling(6), не новым(2)", async () => {
    const weapon = weaponFor({
      weaponClass: "melee", meleeCategory: "Топор", damage: "1d10",
      weaponProps: [{ key: "felling", rating: 5 }]
    });
    const actor  = meleeActor([weapon]);
    setTargets([actorFor({ conditions: { prone: true } })]);
    captured.dice = [10, 5, 7];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).toContain('data-felling="6"');
  });
});

describe("Молот/Топор-бонус: гейт по типу оружия", () => {
  it("Меч по Поваленной цели — бонуса нет (не Молот/Топор)", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", damage: "1d10" });
    const actor  = meleeActor([weapon]);
    setTargets([actorFor({ conditions: { prone: true } })]);
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, {});

    expect(card()).toContain('data-damage="5"');
  });
});

// Виды Урона (wdbc-x1nz.2.80): I(Cr) «получает свойство Concussive (–1),
// попадая в голову» — или +1 к рейтингу, если оно уже было.
describe("I(Cr) по голове: Concussive(–1)", () => {
  const club = (props = []) => weaponFor({ weaponClass: "melee", damage: "1d10", damageSubtype: "crushing", weaponProps: props });

  it("попадание в голову — кнопка Оглушающего с тестом T+10", async () => {
    const weapon = club();
    captured.dice = [10, 5];               // 10 → «01» → Голова
    await _executeAttackRoll(meleeActor([weapon]), weapon, "ws", 45, "melee", null, {});
    expect(card()).toContain('data-wp-test-mod="10"');
  });

  it("попадание в торс — Оглушающего нет", async () => {
    const weapon = club();
    captured.dice = [4, 5];                // 4 → «40» → Торс
    await _executeAttackRoll(meleeActor([weapon]), weapon, "ws", 45, "melee", null, {});
    expect(card()).not.toContain("Оглушающее");
  });

  it("уже было Concussive(1) — становится (2)", async () => {
    const weapon = club([{ key: "concussive", rating: 1 }]);
    captured.dice = [10, 5];
    await _executeAttackRoll(meleeActor([weapon]), weapon, "ws", 45, "melee", null, {});
    expect(card()).toContain('data-wp-test-mod="-20"');
  });
});
