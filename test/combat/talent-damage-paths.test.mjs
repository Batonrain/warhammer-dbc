// test/combat/talent-damage-paths.test.mjs
//
// Крушащий Удар (+½WS.b «ко всему своему рукопашному урону») и Могучий Выстрел
// (+½BS.b стрелковому) до этой правки считались только в основной атаке
// (combat/attack.mjs). Пути со своей формулой урона — Захват (когти, укус),
// ответный удар по Парированию/Силовому полю и атаки Орд с листа — Талантов не
// видели (Sahara maximal-blast-10-rng, п.2). Теперь они берут бонус из одного
// места: rules/damage-talents.mjs::talentDamageBonus.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { talentDamageBonus, talentDamageNote } from "../../module/rules/damage-talents.mjs";

vi.mock("../../module/combat/damage.mjs", async importOriginal => ({
  ...(await importOriginal()),
  applyDamageToActor: vi.fn(async () => {})
}));
vi.mock("../../module/combat/gm-relay.mjs", async importOriginal => ({
  ...(await importOriginal()),
  dealDamageToTarget: async (target, damage) => { (await import("../../module/combat/damage.mjs")).applyDamageToActor(target, damage); return true; }
}));

const { applyDamageToActor } = await import("../../module/combat/damage.mjs");
const { _doBite, _resolveWrenchSuccess } = await import("../../module/combat/grapple.mjs");
const { WarhammerHordeSheet } = await import("../../module/sheets/horde-sheet.mjs");
const { strikeDamageFormula, rollStrikeOn } = await import("../../module/combat/unarmed-combat.mjs");

const talentByKey = key => ({
  id: "t-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }
  ] }] } }
});
const CRUSHING = "meleeCore.core.crushingBlow";
const MIGHTY = "rangedCore.core.mightyShot";

// WS.b 4, BS.b 4, S.b 0 — слагаемое Силы не мешает арифметике Таланта: +½·4 = +2.
const CHARS = { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) };
const lastDamage = () => applyDamageToActor.mock.calls.at(-1)?.[1] ?? {};

beforeEach(() => { resetCaptured(); setTargets([]); applyDamageToActor.mockClear(); });

describe("talentDamageBonus", () => {
  const who = key => actorFor({ items: key ? [talentByKey(key)] : [] });
  it("рукопашная: Крушащий Удар +½WS.b, Могучий Выстрел молчит", () => {
    const b = talentDamageBonus(who(CRUSHING), { isMelee: true, chars: CHARS, wp: {} });
    expect(b).toMatchObject({ flat: 2, crushing: 2, mighty: 0 });
    expect(talentDamageBonus(who(MIGHTY), { isMelee: true, chars: CHARS, wp: {} }).flat).toBe(0);
  });
  it("стрельба: Могучий Выстрел +½BS.b; у Взрывного — только напоминание цели в центре", () => {
    expect(talentDamageBonus(who(MIGHTY), { isMelee: false, chars: CHARS, wp: {} })).toMatchObject({ flat: 2, mighty: 2 });
    expect(talentDamageBonus(who(MIGHTY), { isMelee: false, chars: CHARS, wp: { blastRating: 3 } }))
      .toMatchObject({ flat: 0, centerBonus: 2 });
    expect(talentDamageBonus(who(MIGHTY), { isMelee: false, chars: CHARS, wp: { spray: true } }).flat).toBe(0);
  });
  it("без Таланта — ноль, подпись пустая", () => {
    const b = talentDamageBonus(who(null), { isMelee: true, chars: CHARS, wp: {} });
    expect(b.flat).toBe(0);
    expect(talentDamageNote(b)).toBe("");
    expect(talentDamageNote(talentDamageBonus(who(CRUSHING), { isMelee: true, chars: CHARS, wp: {} }))).toContain("Крушащий Удар +2");
  });
});

describe("Захват: укус и когти", () => {
  const PARTNER_UUID = "Actor.partner";
  let saved;
  beforeEach(() => {
    saved = globalThis.fromUuidSync;
    globalThis.fromUuidSync = uuid => (uuid === PARTNER_UUID ? { uuid: PARTNER_UUID, name: "Партнёр" } : null);
  });
  afterEach(() => { globalThis.fromUuidSync = saved; });

  function grappler(items) {
    const actor = actorFor({ items, characteristics: CHARS });
    actor.uuid = "Actor.grappler";
    actor.getFlag = (_s, key) => (key === "grapplePartnerUuid" ? PARTNER_UUID : undefined);
    return actor;
  }
  const bite = () => weaponFor({ weaponClass: "melee", damage: "1d10", damageType: "rending" }, { name: "Bite / Укус" });

  it("Укус с Крушащим Ударом: +2 к броску (5 → 7)", async () => {
    captured.dice = [5];
    await _doBite(grappler([bite(), talentByKey(CRUSHING)]), { aim: "torso" });
    expect(lastDamage().rawDamage).toBe(7);
    expect(captured.chat.at(-1).content).toContain("Крушащий Удар +2");
  });

  it("Укус без Таланта — голый кубик", async () => {
    captured.dice = [5];
    await _doBite(grappler([bite()]), { aim: "torso" });
    expect(lastDamage().rawDamage).toBe(5);
  });

  it("Когти (Заломить): +2 с Крушащим Ударом", async () => {
    const claws = weaponFor({ weaponClass: "melee", damage: "1d10", damageType: "rending", equipped: true,
      meleeCategory: "Когти" }, { name: "Claws / Когти" });
    const pending = _resolveWrenchSuccess(grappler([claws, talentByKey(CRUSHING)]));
    await vi.waitFor(() => expect(captured.press).toBeTypeOf("function"));
    captured.dice = [5];
    await captured.press("apply", { querySelector: sel => ({ checked: sel.includes('"dmg"') }) });
    await pending;
    expect(lastDamage().rawDamage).toBe(7);
  });
});

describe("ответный удар: Талант бьющего оружием", () => {
  const sword = () => weaponFor({ weaponClass: "melee", damage: "1d10", meleeCategory: "Меч" }, { name: "Меч" });
  it("формула с wielder'ом, у которого Крушащий Удар, длиннее на +2 (S.b — от sbActor)", () => {
    const wielder = actorFor({ items: [talentByKey(CRUSHING)], characteristics: CHARS });
    const target = actorFor({ characteristics: { ...CHARS, s: char(50) } });
    const plain = strikeDamageFormula(sword(), target);
    const withTalent = strikeDamageFormula(sword(), target, 0, wielder);
    expect(plain).toContain("5");                  // S.b 5 атакующего
    expect(withTalent).toContain("7");             // 5 + 2
  });
  it("rollStrikeOn: Талант владельца оружия попадает в брошенный урон", async () => {
    const wielder = actorFor({ items: [talentByKey(CRUSHING)], characteristics: CHARS });
    const hitter = actorFor({ characteristics: { ...CHARS, s: char(50) } });
    captured.dice = [3];
    await rollStrikeOn({ uuid: "Actor.v", name: "Цель" }, { weapon: sword(), sbActor: hitter, wielder, location: "Рука", source: wielder });
    expect(lastDamage().rawDamage).toBe(3 + 5 + 2);        // кубик + S.b атакующего + ½WS.b владельца
  });
  it("без wielder — как раньше", () => {
    const target = actorFor({ characteristics: { ...CHARS, s: char(50) } });
    expect(strikeDamageFormula(sword(), target, 0, null)).toBe(strikeDamageFormula(sword(), target));
  });
});

describe("атака Орды с листа", () => {
  const hordeFor = items => actorFor({ items, derived: { magDamageDice: 0 }, characteristics: CHARS });
  const attack = (actor, weapon, key = "ws", isMelee = true) =>
    WarhammerHordeSheet.prototype._executeHordeAttack.call({ actor }, weapon, key, 50, isMelee, 3);
  const card = () => captured.chat.at(-1)?.content ?? "";
  const damageOf = () => Number(card().match(/data-damage="(\d+)"/)?.[1]);

  it("Крушащий Удар у Орды: рукопашный урон растёт на +2 (S.b 0)", async () => {
    const w = weaponFor({ weaponClass: "melee", damage: "1d10", penetration: 0 }, { name: "Цепной меч" });
    captured.dice = [30, 5];
    await attack(hordeFor([w, talentByKey(CRUSHING)]), w);
    expect(damageOf()).toBe(7);
    expect(card()).toContain("Крушащий Удар +2");
  });

  it("Могучий Выстрел у Орды: стрелковый урон +2", async () => {
    const w = weaponFor({ weaponClass: "basic", damage: "1d10", penetration: 0, weaponProps: [] }, { name: "Лазган" });
    captured.dice = [30, 5];
    await attack(hordeFor([w, talentByKey(MIGHTY)]), w, "bs", false);
    expect(damageOf()).toBe(7);
  });

  it("без Таланта — как раньше", async () => {
    const w = weaponFor({ weaponClass: "melee", damage: "1d10", penetration: 0 }, { name: "Цепной меч" });
    captured.dice = [30, 5];
    await attack(hordeFor([w]), w);
    expect(damageOf()).toBe(5);
  });
});
