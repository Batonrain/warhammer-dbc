// test/combat/melee-aim-talents.test.mjs
//
// Таланты «Рукопашные» главы 3 (Sahara 3-8dc5): Crippling Strike / Калечащий
// Удар (+2 к урону, если рукопашная атака наносит Отрицательные Раны — общий
// примитив с Crack Shot) и Sure Strike / Верный Удар + Precise Blow / Выверенный
// Удар (штраф рукопашной Избирательной атаки и малого Размера цели меньше на
// 10 и ещё на 10 — общий примитив со Стрелковыми В Яблочко / Меткий Стрелок).
//
// Каждый Талант опознаётся двумя путями: по ключу Возможности (у предмета
// испорчено имя) и по имени (снимок без записи Конструктора — «ловушка
// Desiccated»).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";
import { selectiveAimReduction } from "../../module/rules/gunner-talents.mjs";
import { cripplingStrikeBonus, crackShotBonus } from "../../module/rules/gunner-talents.mjs";
import { resolveTest } from "../../module/rules/resolve-test.mjs";

const byKey = key => ({
  id: "k-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const byName = name => ({ id: "n-" + name, name, type: "talent", system: {} });

const CRIPPLING = { key: "meleeCore.core.cripplingStrike", name: "Crippling Strike / Калечащий Удар" };
const SURE      = { key: "meleeCore.core.sureStrike",      name: "Sure Strike / Верный Удар" };
const PRECISE   = { key: "meleeCore.core.preciseBlow",     name: "Precise Blow / Выверенный Удар" };
const DEADEYE   = { key: "rangedCore.core.deadeyeShot",    name: "Deadeye Shot / В Яблочко" };

function who(items) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none", race: "human",
    characteristics: { ws: char(50), bs: char(45), s: char(40), t: char(40), ag: char(35) } });
  a.updates = [];
  a.update = async data => { a.updates.push(data); };
  const store = {};
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  return a;
}
const sword = () => weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10", equipped: true }, { id: "sw", name: "Меч" });
const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => resetCaptured());

describe("Калечащий Удар: величина прибавки на попадании", () => {
  it("рукопашная с Талантом (ключ и имя) несёт +2, без Таланта — 0", async () => {
    for (const t of [byKey(CRIPPLING.key), byName(CRIPPLING.name)]) {
      resetCaptured();
      const w = sword();
      const actor = who([w, t]);
      captured.dice = [20, 5];
      await _executeAttackRoll(actor, w, "ws", 50, "melee", null, {});
      expect(card()).toMatch(/data-neg-wounds-bonus="2"/);
      expect(card()).toContain("Калечащий Удар");
    }
    resetCaptured();
    const w = sword();
    captured.dice = [20, 5];
    await _executeAttackRoll(who([w]), w, "ws", 50, "melee", null, {});
    expect(card()).toMatch(/data-neg-wounds-bonus="0"/);
  });

  it("стрелковая атака Калечащего Удара не получает, а Пробивной Удар — рукопашной", () => {
    const actor = who([byName(CRIPPLING.name)]);
    expect(cripplingStrikeBonus(actor, { isMelee: true })).toBe(2);
    expect(cripplingStrikeBonus(actor, { isMelee: false })).toBe(0);
    expect(crackShotBonus(actor, { isMelee: false })).toBe(0);
    expect(cripplingStrikeBonus(who([]), { isMelee: true })).toBe(0);
  });
});

describe("Верный Удар / Выверенный Удар: скидка штрафа Избирательной атаки (рукопашная)", () => {
  it("−10 и −10 суммируются; стрелковая атака не затронута", () => {
    expect(selectiveAimReduction(who([]), { isMelee: true })).toBe(0);
    expect(selectiveAimReduction(who([byName(SURE.name)]), { isMelee: true })).toBe(10);
    expect(selectiveAimReduction(who([byKey(SURE.key), byKey(PRECISE.key)]), { isMelee: true })).toBe(20);
    expect(selectiveAimReduction(who([byName(SURE.name), byName(PRECISE.name)]), { isMelee: true })).toBe(20);
    expect(selectiveAimReduction(who([byName(SURE.name), byName(PRECISE.name)]), { isMelee: false })).toBe(0);
  });

  it("В Яблочко не работает в рукопашной", () => {
    expect(selectiveAimReduction(who([byName(DEADEYE.name)]), { isMelee: true })).toBe(0);
  });

  it("окно атаки: Торс 0, Нога −5, Рука −10 с Верным Ударом", () => {
    const w = sword();
    showAttackDialog(who([w, byName(SURE.name)]), w);
    const html = captured.dialog.content;
    expect(html).toMatch(/value="torso" data-penalty="0"[^>]*>Торс \(0\)/);
    expect(html).toMatch(/value="leg" data-penalty="-5"/);
    expect(html).toMatch(/value="arm" data-penalty="-10"/);
  });

  it("окно атаки без Таланта: прежние штрафы", () => {
    const w = sword();
    showAttackDialog(who([w]), w);
    expect(captured.dialog.content).toMatch(/value="torso" data-penalty="-10"/);
  });
});

describe("Размер цели ниже 0 в рукопашной: core.sureStrikeSize / core.preciseBlowSize", () => {
  const target = sizeMod => ({ system: { race: "human", characteristics: {}, sizeMod }, items: [] });
  const attack = (items, sizeMod, weaponClass = "melee") => resolveTest({
    actor: { system: { race: "human", characteristics: {} }, items },
    kind: "attack", weaponClass, weapon: { system: { weaponClass } }, isMelee: weaponClass === "melee", char: "ws", targetActor: target(sizeMod)
  }).mods.map(m => [m.ruleId, m.value]);

  it("без Таланта — только штраф за Размер", () => {
    expect(attack([], -1)).toEqual([["core.sizeToHit", -10]]);
  });
  it("Верный Удар: Размер −1 → штраф −10 и +10", () => {
    const m = attack([byName(SURE.name)], -1);
    expect(m).toContainEqual(["core.sizeToHit", -10]);
    expect(m).toContainEqual(["core.sureStrikeSize", 10]);
  });
  it("Размер 0 и больше — Талант ничего не добавляет", () => {
    expect(attack([byName(SURE.name)], 0).map(x => x[0])).not.toContain("core.sureStrikeSize");
  });
  it("Выверенный Удар: Размер −1 — второго шага нет; Размер −2 — есть", () => {
    expect(attack([byName(SURE.name), byName(PRECISE.name)], -1).map(x => x[0])).not.toContain("core.preciseBlowSize");
    const m = attack([byName(SURE.name), byName(PRECISE.name)], -2);
    expect(m).toContainEqual(["core.sureStrikeSize", 10]);
    expect(m).toContainEqual(["core.preciseBlowSize", 10]);
  });
  it("стрелковое оружие правилами не затронуто", () => {
    expect(attack([byName(SURE.name)], -1, "basic").map(x => x[0])).not.toContain("core.sureStrikeSize");
  });
});
