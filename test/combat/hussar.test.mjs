// test/combat/hussar.test.mjs
//
// Hussar / Гусар (Всадник, Sahara 3-cross-actor-5482; DoomBC — Основная книга):
// «Совершая Верховую Атаку, персонаж может потратить бонусное верховое
// полудействие, чтобы провести ещё одну верховую атаку по другой цели на пути.
// Верховые атаки против Орды можно делать обе против одной Орды, и обе получают
// Devastating (2).» Образец — вторая атака Сабли (combat/sabre-second-attack.mjs).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { hasHussar, sabreSecondAttackBlockReason, armHussarSecondAttack, NS, SABRE_PENDING_FLAG }
  from "../../module/combat/sabre-second-attack.mjs";

const hussar = () => ({ id: "h", type: "talent", name: "Hussar / Гусар", system: {} });
const card = () => captured.chat.at(-1)?.content ?? "";

describe("Гусар: правила второй атаки", () => {
  const base = { pending: { itemId: "", hussar: true, firstTargetUuid: "T1" }, itemId: "w2",
    targetUuid: "T2", mounted: true, outOfTurn: false };

  it("любым оружием (метка Гусара не привязана к предмету), по другой цели — можно", () => {
    expect(sabreSecondAttackBlockReason(base)).toBe("");
  });
  it("по той же цели нельзя, но по той же Орде — можно", () => {
    expect(sabreSecondAttackBlockReason({ ...base, targetUuid: "T1" })).toMatch(/другой цели/);
    expect(sabreSecondAttackBlockReason({ ...base, targetUuid: "T1", targetIsHorde: true })).toBe("");
  });
  it("Сабля (метка с предметом) по той же Орде по-прежнему нельзя — исключение только у Гусара", () => {
    const sabre = { ...base, pending: { itemId: "w1", firstTargetUuid: "T1" }, itemId: "w1", targetUuid: "T1", targetIsHorde: true };
    expect(sabreSecondAttackBlockReason(sabre)).toMatch(/другой цели/);
  });
  it("бонусное полудействие есть только у владельца скакуна", () => {
    expect(sabreSecondAttackBlockReason({ ...base, hussarBonusOk: false })).toMatch(/бонусное/);
    expect(sabreSecondAttackBlockReason({ ...base, hussarBonusOk: false, pending: { itemId: "w1" }, itemId: "w1" })).toBe("");
  });
  it("опознаётся по имени, взводится меткой на всаднике", async () => {
    const flags = {};
    const a = { items: [hussar()], getFlag: (s, k) => flags[`${s}.${k}`], setFlag: async (s, k, v) => { flags[`${s}.${k}`] = v; } };
    expect(hasHussar(a)).toBe(true);
    expect(hasHussar({ items: [] })).toBe(false);
    await armHussarSecondAttack(a);
    expect(a.getFlag(NS, SABRE_PENDING_FLAG)).toMatchObject({ hussar: true, itemId: "" });
  });
});

describe("Гусар: Devastating (2) на Верховой Атаке по Орде", () => {
  beforeEach(() => { resetCaptured(); });
  const sword = () => weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10" });
  const fighter = (items) => actorFor({ items, characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) } });
  const horde = () => ({ ...actorFor({}), type: "horde" });

  async function strike(items, target, baseKey = "mounted") {
    setTargets([target]);
    const weapon = sword();
    const actor = fighter([weapon, ...items]);
    captured.dice = [10, 5, 5, 5, 5, 5];
    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, { baseKey });
    return card();
  }

  it("Гусар, Верховая Атака по Орде — Devastating (2) в данных кнопки урона", async () => {
    expect(await strike([hussar()], horde())).toMatch(/data-devastating="2"/);
  });
  it("не Орда, не Верховая База или нет Таланта — Devastating нет", async () => {
    expect(await strike([hussar()], actorFor({}))).toMatch(/data-devastating="0"/);
    expect(await strike([hussar()], horde(), "standard")).toMatch(/data-devastating="0"/);
    expect(await strike([], horde())).toMatch(/data-devastating="0"/);
  });
});

describe("Гусар: кнопка второй атаки в карточке первой", () => {
  beforeEach(() => { resetCaptured(); setTargets([]); });
  it("первая Верховая Атака Гусара (opts.hussarSecondAttack) несёт кнопку второй; сама вторая — нет", async () => {
    const weapon = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "П", damage: "1d10" });
    const actor = actorFor({ items: [weapon, hussar()], characteristics: { ws: char(45), s: char(9), t: char(40), ag: char(35), bs: char(45) } });
    captured.dice = [10, 5, 5];
    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, { baseKey: "mounted", hussarSecondAttack: true });
    expect(card()).toContain("wh-sabre-second-attack-btn");
    captured.dice = [10, 5, 5];
    await _executeAttackRoll(actor, weapon, "ws", 45, "melee", null, { baseKey: "mounted", hussarSecondAttack: true, sabreSecondAttackIsSecond: true });
    expect(card()).not.toContain("wh-sabre-second-attack-btn");
  });
});
