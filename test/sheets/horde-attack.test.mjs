// test/sheets/horde-attack.test.mjs
//
// Атака Орды считает урон своим кодом, но правило Бонуса Силы у неё то же, что
// у обычной атаки: Могучее ×2, Сдержанное 0. Правило живёт в meleeStrengthBonus
// (module/combat/attack-outcome.mjs) — здесь проверяется, что Орда даёт те же
// числа, чтобы вторую копию правила можно было снять (wdbc-ff4.11).
//
// Хватов у Орды нет, поэтому половинного Бонуса Силы («в полтора») тут не будет.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { WarhammerHordeSheet, hordeSecondaryThreshold } from "../../module/sheets/horde-sheet.mjs";

/** Орда: Магнитуда даёт добавочные кубы урона, здесь они не нужны. */
function hordeFor() {
  return actorFor({ derived: { magDamageDice: 0 } });
}

/** Вызов метода листа без самого листа: ему нужен только this.actor. */
function hordeAttack(actor, weapon) {
  return WarhammerHordeSheet.prototype._executeHordeAttack.call(
    { actor }, weapon, "ws", 50, true, 3);
}

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("бонус Силы в атаке Орды", () => {
  const melee = props => weaponFor(
    { weaponClass: "melee", damage: "1d10+2", penetration: 2, weaponProps: props },
    { name: "Цепной меч" });

  it("обычное оружие добавляет S.b целиком", async () => {
    captured.dice = [30, 5];
    await hordeAttack(hordeFor(), melee([]));
    expect(card()).toContain("S.b +4");
  });

  it("Могучее удваивает S.b", async () => {
    captured.dice = [30, 5];
    await hordeAttack(hordeFor(), melee([{ key: "mighty" }]));
    expect(card()).toContain("S.b +8");
  });

  it("Сдержанное убирает S.b", async () => {
    captured.dice = [30, 5];
    await hordeAttack(hordeFor(), melee([{ key: "contained" }]));
    expect(card()).toContain("S.b +0");
  });
});

// Ослеплённая Орда (wdbc-x1nz.2.89, хвост сверки «Статусы»): у Орды свой
// бросок, мимо общего исхода теста — автопровал читается на листе.
describe("Ослеплённая Орда", () => {
  const gun = () => weaponFor({ weaponClass: "basic", damage: "1d10", penetration: 0, weaponProps: [] },
    { name: "Лазган" });

  it("стрельба с автопровалом — промах даже на броске ниже Порога", async () => {
    captured.dice = [5, 5];
    await WarhammerHordeSheet.prototype._executeHordeAttack.call(
      { actor: hordeFor() }, gun(), "bs", 50, false, 3, { autoFail: true });
    expect(card()).toContain("Автопровал: Орда Ослеплена");
    expect(card()).toContain("Промах");
  });

  it("без автопровала тот же бросок — попадание", async () => {
    captured.dice = [5, 5];
    await WarhammerHordeSheet.prototype._executeHordeAttack.call(
      { actor: hordeFor() }, gun(), "bs", 50, false, 3);
    expect(card()).not.toContain("Автопровал");
    expect(card()).toContain("Попадание");
  });

  it("тест BS Ослеплённой Орды — автопровал в карточке", async () => {
    captured.dice = [5];
    const actor = actorFor({ conditions: { blinded: true } });
    await WarhammerHordeSheet.prototype._rollTest.call(
      { actor }, { label: "BS", threshold: 50, prefix: "BS", ctx: { kind: "skill", char: "bs" } });
    expect(card()).toContain("Автопровал");
    expect(card()).toContain("Провал");
  });

  it("тест BS зрячей Орды на том же броске — успех", async () => {
    captured.dice = [5];
    await WarhammerHordeSheet.prototype._rollTest.call(
      { actor: actorFor({ conditions: {} }) }, { label: "BS", threshold: 50, prefix: "BS", ctx: { kind: "skill", char: "bs" } });
    expect(card()).not.toContain("Автопровал");
    expect(card()).toContain("Успех");
  });
});

// «Атаки Орды»: до Магнитуда/5 персонажей — у каждой цели свой бросок и своя
// кнопка урона, привязанная к ней (data-force-target).
describe("атака Орды по нескольким целям", () => {
  const sword = () => weaponFor({ weaponClass: "melee", damage: "1d10", penetration: 0, weaponProps: [] },
    { name: "Тесак" });
  const target = name => ({ ...actorFor({}), name, uuid: `Actor.${name}` });

  it("по карточке на каждую нацеленную цель, не больше лимита", async () => {
    setTargets([target("А"), target("Б"), target("В")]);
    captured.dice = [30, 5, 30, 5, 30, 5];
    const before = captured.chat.length;
    await WarhammerHordeSheet.prototype._executeHordeAttack.call(
      { actor: hordeFor() }, sword(), "ws", 50, true, 2);
    const cards = captured.chat.slice(before).map(c => c.content);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toContain("→ А");
    expect(cards[1]).toContain("→ Б");
    expect(cards[1]).toContain('data-force-target="Actor.Б"');
  });

  it("одна цель — как раньше: одна карточка, цель выбирается кнопкой", async () => {
    setTargets([target("А")]);
    captured.dice = [30, 5];
    await WarhammerHordeSheet.prototype._executeHordeAttack.call(
      { actor: hordeFor() }, sword(), "ws", 50, true, 3);
    expect(card()).not.toContain("data-force-target");
  });
});

// «Может одновременно стрелять и атаковать в рукопашной одним действием»:
// второе оружие бросается со своей характеристикой и столбцом условий своего
// вида атаки; Подавленная Орда стреляет с −20.
describe("совместная атака Орды — порог второго оружия", () => {
  const horde = (conditions = {}) => ({ system: { characteristics: { ws: { total: 35 }, bs: { total: 25 } }, conditions }, items: [] });
  const gun = { system: { weaponClass: "basic" } };
  const blade = { system: { weaponClass: "melee" } };

  it("характеристика и столбец условий — своего вида атаки", () => {
    expect(hordeSecondaryThreshold(horde(), gun, { modifier: 5, checkedLabels: ["Цель лежит"] })).toBe(25 + 5 - 20);
    expect(hordeSecondaryThreshold(horde(), blade, { modifier: 5, checkedLabels: ["Цель лежит"] })).toBe(35 + 5 + 20);
  });

  it("Подавленная — −20 к стрельбе, рукопашной не касается", () => {
    expect(hordeSecondaryThreshold(horde({ pinned: true }), gun)).toBe(5);
    expect(hordeSecondaryThreshold(horde({ pinned: true }), blade)).toBe(35);
  });
});

// Орда «действует как один персонаж, имеющий обычный запас ОД»: атака —
// Полудействие, одна за Ход; совместная атака (стрельба + рукопашная) — то же
// одно действие.
describe("атака Орды тратит ОД", () => {
  const blade = () => weaponFor({ weaponClass: "melee", damage: "1d10", penetration: 0, weaponProps: [] }, { name: "Тесак" });
  const gun   = () => weaponFor({ weaponClass: "basic", damage: "1d10", penetration: 0, weaponProps: [] }, { name: "Автоган" });
  const form = (pairId = "") => ({
    querySelector: sel => ({ "#h-threshold": { value: "40" }, "#h-modifier": { value: "0" }, "#h-pair": { value: pairId } })[sel] ?? null,
    querySelectorAll: () => []
  });
  function hordeWith(items, ap = 2) {
    const flags = {};
    const actor = actorFor({ items, derived: { magDamageDice: 0 }, actionPoints: { value: ap, max: 2 } });
    actor.type = "horde";
    actor.getFlag = (_s, k) => flags[k];
    actor.setFlag = async (_s, k, v) => { flags[k] = v; };
    actor.update = async data => { if (data["system.actionPoints.value"] !== undefined) actor.system.actionPoints.value = data["system.actionPoints.value"]; };
    return actor;
  }
  const sheet = actor => ({
    actor,
    _executeHordeAttack: WarhammerHordeSheet.prototype._executeHordeAttack,
    _meleeTargets: n => ({ targets: n, note: "" })
  });
  const opts = w => ({ w, key: "ws", isMelee: true, targets: 2, blind: false, meleeTargets: 2, rangedShots: 1 });

  beforeEach(() => { globalThis.game.combat = { started: true }; });

  it("атака списывает 1 ОД, вторая в тот же Ход отклоняется", async () => {
    const b = blade();
    const actor = hordeWith([b]);
    captured.dice = [30, 5];
    expect(await WarhammerHordeSheet.prototype._confirmHordeAttack.call(sheet(actor), form(), opts(b))).toBe(true);
    expect(actor.system.actionPoints.value).toBe(1);
    expect(await WarhammerHordeSheet.prototype._confirmHordeAttack.call(sheet(actor), form(), opts(b))).toBe(false);
    expect(actor.system.actionPoints.value).toBe(1);
  });

  it("стрельба и рукопашная одним действием — две карточки за 1 ОД", async () => {
    const b = blade(), g = gun();
    const actor = hordeWith([b, g]);
    captured.dice = [30, 5, 30, 5];
    const before = captured.chat.length;
    await WarhammerHordeSheet.prototype._confirmHordeAttack.call(sheet(actor), form(g.id), opts(b));
    expect(captured.chat.length - before).toBe(2);
    expect(actor.system.actionPoints.value).toBe(1);
  });

  it("без ОД — атаки нет", async () => {
    const b = blade();
    const actor = hordeWith([b], 0);
    expect(await WarhammerHordeSheet.prototype._confirmHordeAttack.call(sheet(actor), form(), opts(b))).toBe(false);
  });
});
