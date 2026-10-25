// test/sheets/deadeye-sharpshooter.test.mjs
//
// Deadeye Shot / В Яблочко и Sharpshooter / Меткий Стрелок (Стрелок; Sahara
// 3-5fbf): «Он уменьшает штраф на стрелковые атаки за Избирательные атаки или
// Размер цели ниже 0 на 10» (Меткий Стрелок — «еще на 10»).
// Избирательные — окно атаки (aimTargets); Размер цели — правила core.deadeyeSize
// и core.sharpshooterSize (предикат targetSizeMax).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { selectiveAimReduction, reducedAimPenalty } from "../../module/rules/gunner-talents.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { PREDICATES } from "../../module/rules/predicates.mjs";

const DEADEYE = { id: "de", name: "Deadeye Shot / В Яблочко", type: "talent", system: {} };
const SHARP   = { id: "ss", name: "Sharpshooter / Меткий Стрелок", type: "talent", system: {} };
const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});

function who(items) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none", race: "human" });
  a.updates = [];
  a.update = async data => { a.updates.push(data); };
  const store = {};
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  return a;
}
const rifle = () => weaponFor({ weaponClass: "basic", equipped: true, grips: "2р" }, { id: "gun", name: "Лазган" });

beforeEach(() => resetCaptured());

describe("скидка штрафа Избирательной атаки (чистые функции)", () => {
  it("В Яблочко −10, оба Таланта −20, без них 0; рукопашная не затронута", () => {
    expect(selectiveAimReduction(who([]), { isMelee: false })).toBe(0);
    expect(selectiveAimReduction(who([DEADEYE]), { isMelee: false })).toBe(10);
    expect(selectiveAimReduction(who([DEADEYE, SHARP]), { isMelee: false })).toBe(20);
    expect(selectiveAimReduction(who([byKey("rangedCore.core.deadeyeShot")]), { isMelee: false })).toBe(10);
    expect(selectiveAimReduction(who([byKey("rangedCore.core.sharpshooter")]), { isMelee: false })).toBe(10);
    expect(selectiveAimReduction(who([DEADEYE, SHARP]), { isMelee: true })).toBe(0);
  });
  it("штраф уменьшается, но выше нуля не поднимается", () => {
    expect(reducedAimPenalty(-15, 10)).toBe(-5);
    expect(reducedAimPenalty(-10, 20)).toBe(0);
    expect(reducedAimPenalty(-50, 20)).toBe(-30);
    expect(reducedAimPenalty(0, 10)).toBe(0);
  });
});

describe("окно атаки: пункты прицела", () => {
  it("без Талантов: прежние штрафы", () => {
    const w = rifle();
    showAttackDialog(who([w]), w);
    expect(captured.dialog.content).toContain('data-penalty="-10"');
    expect(captured.dialog.content).toContain('data-penalty="-20"');
    expect(captured.dialog.content).toContain("Торс (−10)");
  });
  it("В Яблочко: Торс 0, Нога −5, Рука −10, Голова −10, Глаз −40", () => {
    const w = rifle();
    showAttackDialog(who([DEADEYE, w]), w);
    const html = captured.dialog.content;
    expect(html).toMatch(/value="torso" data-penalty="0"[^>]*>Торс \(0\)/);
    expect(html).toMatch(/value="leg" data-penalty="-5"[^>]*>Нога \(-5\)/);
    expect(html).toMatch(/value="arm" data-penalty="-10"/);
    expect(html).toMatch(/value="head" data-penalty="-10"/);
    expect(html).toMatch(/value="eye" data-penalty="-40"/);
  });
  it("оба Таланта: Рука −0 (не выше нуля), Сочленение −20", () => {
    const w = rifle();
    showAttackDialog(who([DEADEYE, SHARP, w]), w);
    const html = captured.dialog.content;
    expect(html).toMatch(/value="arm" data-penalty="0"/);
    expect(html).toMatch(/value="joint" data-penalty="-20"/);
  });
  it("«— Без прицела —» остаётся 0", () => {
    const w = rifle();
    showAttackDialog(who([DEADEYE, w]), w);
    expect(captured.dialog.content).toMatch(/value="" data-penalty="0"/);
  });
});

describe("Размер цели ниже 0: правила core.deadeyeSize / core.sharpshooterSize", () => {
  const target = sizeMod => ({ system: { race: "human", characteristics: {}, sizeMod }, items: [] });
  const attack = (items, sizeMod, weaponClass = "basic") => resolveTest({
    actor: { system: { race: "human", characteristics: {} }, items },
    kind: "attack", weaponClass, weapon: { system: { weaponClass } }, isMelee: false, char: "bs", targetActor: target(sizeMod)
  }).mods.map(m => [m.ruleId, m.value]);

  it("предикат targetSizeMax: только с целью и по порогу", () => {
    const p = PREDICATES.targetSizeMax;
    expect(p({}, { targetActor: target(-1) }, -1)).toBe(true);
    expect(p({}, { targetActor: target(0) }, -1)).toBe(false);
    expect(p({}, { targetActor: target(-3) }, -2)).toBe(true);
    expect(p({}, {}, -1)).toBe(false);
  });
  it("без Таланта — только штраф за Размер", () => {
    expect(attack([], -1)).toEqual([["core.sizeToHit", -10]]);
  });
  it("В Яблочко: Размер −1 → штраф −10 и +10 (итог 0)", () => {
    const m = attack([DEADEYE], -1);
    expect(m).toContainEqual(["core.sizeToHit", -10]);
    expect(m).toContainEqual(["core.deadeyeSize", 10]);
  });
  it("Размер 0 и больше — Талант ничего не добавляет", () => {
    expect(attack([DEADEYE], 0).map(x => x[0])).not.toContain("core.deadeyeSize");
    expect(attack([DEADEYE], 1).map(x => x[0])).not.toContain("core.deadeyeSize");
  });
  it("Меткий Стрелок: Размер −1 — второго шага нет (штраф уже снят); Размер −2 — есть", () => {
    expect(attack([DEADEYE, SHARP], -1).map(x => x[0])).not.toContain("core.sharpshooterSize");
    const m = attack([DEADEYE, SHARP], -2);
    expect(m).toContainEqual(["core.deadeyeSize", 10]);
    expect(m).toContainEqual(["core.sharpshooterSize", 10]);
  });
  it("рукопашное оружие правилами не затронуто", () => {
    expect(attack([DEADEYE], -1, "melee").map(x => x[0])).not.toContain("core.deadeyeSize");
  });
});
