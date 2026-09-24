// test/combat/unarmed-combat.test.mjs
//
// Безоружный Бой (core.json, «II. МЕХАНИКА → Безоружный Бой», стр. 40) —
// wdbc-x1nz.2.69 (+20 и ответный удар за 2 Успеха), .70 (Силовое поле в обе
// стороны, конечность по Хвату), .71 (стрелковое в рукопашной: вооружён при
// Парировании, Bl/штраф по таблице, Дл. винтовка, Закреплённое тяжёлое),
// .72 (шипы узнают Пинок/Удар головой).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, char } from "../support/combat-fixtures.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { _performParry } from "../../module/combat/defense.mjs";
import { strikeLocation, parryWeaponFor, gunAsParryWeapon, strikeDamageFormula, performUnarmedRiposte }
  from "../../module/combat/unarmed-combat.mjs";
import { improvisedMeleeProfile, canStrikeWithGun, registerBraceCheck, FIRED_BRACED_FLAG }
  from "../../module/combat/weapon-profiles.mjs";
import { counterAttackTriggers } from "../../module/combat/counter-attack.mjs";
import { TURN_SCOPED_FLAG_KEYS } from "../../module/rules/turn-flags.mjs";

const DEFAULT_SOURCES = getRuleSources();

/** Актор с рабочими флагами (applyDamageToActor и пул их трогают). */
function fighter(items = [], { uuid = "Actor.def", name = "Защитник", s = 40 } = {}) {
  const a = actorFor({ skills: { parry: { rank: "expert" } }, items });
  a.system.characteristics.s = char(s);
  a.uuid = uuid;
  a.name = name;
  const store = {};
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  a.update = async () => {};
  a.items.contents = a.items;
  for (const i of items) { i.actor = a; i.parent = a; }
  return a;
}

/** Интегральная (безоружная) атака с данным Хватом. */
function unarmed(grips = "Кист", { id = "fist", uuid = "Item.fist", damage = "1d5-3" } = {}) {
  const w = weaponFor({ weaponClass: "melee", balance: -1, equipped: true, damage, damageType: "impact", grips },
                      { id, name: grips === "Ног" ? "Пинок" : "Кулак" });
  w.uuid = uuid;
  w.getFlag = (scope, key) => (scope === "warhammer-dbc" && key === "integralAttack") ? true : undefined;
  return w;
}

function sword(props = []) {
  const w = weaponFor({ weaponClass: "melee", balance: 0, equipped: true, damage: "1d10", damageType: "rending",
                        penetration: 2, weaponProps: props }, { id: "sword", name: "Меч" });
  w.uuid = "Item.sword";
  return w;
}

function gun(weaponClass = "pistol", sys = {}) {
  const w = weaponFor({ weaponClass, equipped: true, balance: 0, ...sys }, { id: `gun-${weaponClass}`, name: "Ствол" });
  w.uuid = `Item.gun-${weaponClass}`;
  return w;
}

function resolver(...docs) {
  globalThis.fromUuid = async uuid => docs.find(d => d?.uuid === uuid) ?? null;
}

beforeEach(() => {
  resetCaptured();
  captured.dice = [10];
  globalThis.game.combat = undefined;
});
afterEach(() => {
  registerBraceCheck(() => false);
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

describe("strikeLocation: «атакующая конечность» по Хвату", () => {
  it("Кулак — Рука, Пинок — Нога, Удар головой и Укус — Голова, Хвост — Торс", () => {
    expect(strikeLocation(unarmed("Кист"))).toBe("Рука");
    expect(strikeLocation(unarmed("1р"))).toBe("Рука");
    expect(strikeLocation(unarmed("Ног"))).toBe("Нога");
    expect(strikeLocation(unarmed("Нога"))).toBe("Нога");
    expect(strikeLocation(unarmed("Гол"))).toBe("Голова");
    expect(strikeLocation(unarmed("Зуб"))).toBe("Голова");
    expect(strikeLocation(unarmed("Хвост"))).toBe("Торс");
    expect(strikeLocation(null)).toBe("Рука");
  });
});

describe("Профиль «Ударить оружием»: Баланс, штраф и Дл. винтовка по таблице книги", () => {
  it("пистолет и винтовка — Bl −1, штраф −10; тяжёлое — Bl −2, штраф −20", () => {
    expect(improvisedMeleeProfile(gun("pistol"))).toMatchObject({ balance: -1, attackMod: -10 });
    expect(improvisedMeleeProfile(gun("basic"))).toMatchObject({ balance: -1, attackMod: -10, range: "2–3 м" });
    expect(improvisedMeleeProfile(gun("heavy"))).toMatchObject({ balance: -2, attackMod: -20, range: "3 м" });
  });

  it("Дл. винтовка (свойство longRifle) — Посох 2–4 м, остальное как у винтовки", () => {
    const p = improvisedMeleeProfile(gun("basic", { weaponProps: [{ key: "longRifle" }] }));
    expect(p).toMatchObject({ range: "2–4 м", damage: "1d10-2", balance: -1, attackMod: -10, meleeCategory: "Посох" });
  });

  it("Закреплённое тяжёлое рукопашной не бьёт; пистолет Закрепление не касается", () => {
    const heavy = gun("heavy");
    const pistol = gun("pistol");
    fighter([heavy, pistol]);
    registerBraceCheck((actor, item) => item.id === heavy.id);
    expect(canStrikeWithGun(heavy)).toBe(false);
    expect(canStrikeWithGun(pistol)).toBe(true);
  });

  it("стрелял из Закреплённого в этом Ходу — безоружен им, даже если Закрепление уже слетело", async () => {
    const heavy = gun("heavy");
    const a = fighter([heavy]);
    expect(canStrikeWithGun(heavy)).toBe(true);
    await a.setFlag("warhammer-dbc", FIRED_BRACED_FLAG, [heavy.id]);
    expect(canStrikeWithGun(heavy)).toBe(false);
  });

  it("метка «стрелял из Закреплённого» гаснет к началу своего Хода", () => {
    expect(TURN_SCOPED_FLAG_KEYS).toContain(FIRED_BRACED_FLAG);
  });
});

describe("parryWeaponFor: стрелок вооружён, кроме как против безоружной атаки", () => {
  it("без рукопашного против оружия — ствол по профилю книги", () => {
    const pistol = gun("pistol", { weaponProps: [{ key: "reliable" }] });
    const a = fighter([pistol]);
    const w = parryWeaponFor(a, { attackerUnarmed: false });
    expect(w.improvisedFrom).toBe(pistol);
    expect(w.id).toBe(pistol.id);
    expect(w.system.balance).toBe(-1);
    // Свойства ствола в Парирование прикладом не протекают.
    expect(w.system.weaponProps.map(p => p.key)).toEqual(["imprecise", "primitive"]);
  });

  it("против безоружной атаки стрелок безоружен — кулак, а не ствол", () => {
    const fist = unarmed();
    const a = fighter([gun("pistol"), fist]);
    expect(parryWeaponFor(a, { attackerUnarmed: true })).toBe(fist);
  });

  it("настоящее рукопашное всегда важнее ствола", () => {
    const blade = sword();
    const a = fighter([gun("basic"), blade]);
    expect(parryWeaponFor(a, { attackerUnarmed: false })).toBe(blade);
  });

  it("снятый ствол парировать не даёт", () => {
    const a = fighter([gun("pistol", { equipped: false })]);
    expect(parryWeaponFor(a, { attackerUnarmed: false })).toBeNull();
  });
});

describe("strikeDamageFormula: урон своего оружия с S.b атакующего", () => {
  it("S.b берётся у того, кого передали, а не у владельца оружия", () => {
    const heavyHitter = fighter([], { s: 60 });
    expect(strikeDamageFormula(sword(), heavyHitter)).toContain("6");
    expect(strikeDamageFormula(sword(), fighter([], { s: 20 }))).toContain("2");
  });

  it("у ствола-заменителя — урон профиля книги", () => {
    const p = gun("pistol");
    fighter([p]);
    expect(strikeDamageFormula(gunAsParryWeapon(p), fighter([], { s: 30 }))).toMatch(/^1d5-2/);
  });
});

describe("_performParry: +20 вооружённому против безоружной атаки (wdbc-x1nz.2.69)", () => {
  it("меч против кулака — +20 в разбивке порога", async () => {
    const fist = unarmed();
    const atk = fighter([fist], { uuid: "Actor.atk", name: "Драчун" });
    resolver(atk, fist);
    const def = fighter([sword()]);
    await _performParry(def, { attackerUuid: atk.uuid, attackerWeaponUuid: fist.uuid });
    expect(captured.chat.at(-1).content).toContain("вооружён против безоружной атаки +20");
  });

  it("меч против меча — бонуса нет", async () => {
    const other = sword();
    other.uuid = "Item.enemy-sword";
    const atk = fighter([other], { uuid: "Actor.atk" });
    resolver(atk, other);
    await _performParry(fighter([sword()]), { attackerUuid: atk.uuid, attackerWeaponUuid: other.uuid });
    expect(captured.chat.at(-1).content).not.toContain("вооружён против безоружной атаки");
  });

  it("стрелок против кулака — безоружен: ни +20, ни −20", async () => {
    const fist = unarmed();
    const atk = fighter([fist], { uuid: "Actor.atk" });
    resolver(atk, fist);
    await _performParry(fighter([gun("basic")]), { attackerUuid: atk.uuid, attackerWeaponUuid: fist.uuid });
    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("вооружён против безоружной атаки");
    expect(card).not.toContain("безоружное Парирование");
  });

  it("стрелок против меча — вооружён стволом: без −20, Баланс −1 из таблицы", async () => {
    const enemy = sword();
    enemy.uuid = "Item.enemy-sword";
    const atk = fighter([enemy], { uuid: "Actor.atk" });
    resolver(atk, enemy);
    await _performParry(fighter([gun("basic")]), { attackerUuid: atk.uuid, attackerWeaponUuid: enemy.uuid });
    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("безоружное Парирование");
    expect(card).toContain("Ударить оружием");
    expect(card).toContain("Баланс -1");
  });
});

describe("_performParry: ответный удар за 2 Успеха (wdbc-x1nz.2.69)", () => {
  it("меч против Пинка, Успехов с запасом — кнопка удара в Ногу", async () => {
    const kick = unarmed("Ног", { id: "kick", uuid: "Item.kick" });
    const atk = fighter([kick], { uuid: "Actor.atk" });
    resolver(atk, kick);
    await _performParry(fighter([sword()]), { attackerUuid: atk.uuid, attackerWeaponUuid: kick.uuid });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-unarmed-riposte-btn");
    expect(card).toContain("Ответный удар в Ногу");
  });

  it("атака оружием — кнопки нет", async () => {
    const enemy = sword();
    enemy.uuid = "Item.enemy-sword";
    const atk = fighter([enemy], { uuid: "Actor.atk" });
    resolver(atk, enemy);
    await _performParry(fighter([sword()]), { attackerUuid: atk.uuid, attackerWeaponUuid: enemy.uuid });
    expect(captured.chat.at(-1).content).not.toContain("wh-unarmed-riposte-btn");
  });

  it("Успехов не хватает (снятое попадание съело всё) — кнопки нет", async () => {
    const fist = unarmed();
    const atk = fighter([fist], { uuid: "Actor.atk" });
    resolver(atk, fist);
    // Порог так низко, что 1-й кубик даёт ровно 1–2 Успеха.
    captured.dice = [5];
    await _performParry(fighter([sword()]), { extraMod: -85, attackerUuid: atk.uuid, attackerWeaponUuid: fist.uuid });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Парирование успешно");
    expect(card).not.toContain("wh-unarmed-riposte-btn");
  });
});

describe("_performParry: Силовое поле и безоружная атака (wdbc-x1nz.2.70)", () => {
  it("силовой меч отбил Пинок (1-75) — попадание мечом в Ногу атакующего, не «оружие уничтожено»", async () => {
    const kick = unarmed("Ног", { id: "kick", uuid: "Item.kick" });
    const atk = fighter([kick], { uuid: "Actor.atk", name: "Драчун" });
    resolver(atk, kick);
    captured.dice = [10, 5, 4]; // Парирование, 1-75, кубик урона меча
    await _performParry(fighter([sword([{ key: "powerField" }])]),
      { attackerUuid: atk.uuid, attackerWeaponUuid: kick.uuid });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("разбита о поле");
    expect(card).toContain("в Ногу атакующего");
    expect(card).not.toContain("уничтожено");
  });

  it("силовой меч отбил меч — прежнее «оружие противника уничтожено»", async () => {
    const enemy = sword();
    enemy.uuid = "Item.enemy-sword";
    const atk = fighter([enemy], { uuid: "Actor.atk" });
    resolver(atk, enemy);
    captured.dice = [10, 5];
    await _performParry(fighter([sword([{ key: "powerField" }])]),
      { attackerUuid: atk.uuid, attackerWeaponUuid: enemy.uuid });
    expect(captured.chat.at(-1).content).toContain("уничтожено");
  });

  it("Пинком парировал силовой меч — попадание в Ногу, а не в Руку", async () => {
    const powerSword = sword([{ key: "powerField" }]);
    powerSword.uuid = "Item.power-sword";
    const atk = fighter([powerSword], { uuid: "Actor.atk" });
    resolver(atk, powerSword);
    captured.dice = [10, 5, 4];
    await _performParry(fighter([unarmed("Ног", { id: "kick" })]),
      { attackerUuid: atk.uuid, attackerWeaponUuid: powerSword.uuid });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("безоружная защита не выдержала");
    expect(card).toContain("в Ногу");
  });
});

describe("Контратака (шипы): Пинок и Удар головой — тоже безоружные атаки (wdbc-x1nz.2.72)", () => {
  it("интегральная атака без категории «Кулаки» срабатывает", () => {
    expect(counterAttackTriggers({ isMelee: true, hit: true, meleeCategory: "", unarmed: true }).onUnarmedOrGrapple).toBe(true);
  });
  it("обычное оружие без категории — нет", () => {
    expect(counterAttackTriggers({ isMelee: true, hit: true, meleeCategory: "" }).onUnarmedOrGrapple).toBe(false);
  });
});

// wdbc-t3c3t.8: кнопку жал любой клиент, а «использовано» жило только в
// локальном disabled — вне боя (пула нет) ГМ и игрок давали два удара.
describe("performUnarmedRiposte: только владелец, один удар на карточку (wdbc-t3c3t.8)", () => {
  function setup({ owner = true } = {}) {
    const fist = unarmed();
    const atk = fighter([fist], { uuid: "Actor.atk" });
    const def = fighter([sword()]);
    def.isOwner = owner;
    resolver(atk, fist);
    const flags = {};
    const message = {
      getFlag: (scope, key) => flags[`${scope}.${key}`],
      setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
      canUserModify: () => true
    };
    const opts = { weaponId: "sword", attackerUuid: atk.uuid, attackerWeaponUuid: fist.uuid, message };
    const strikes = () => captured.chat.filter(m => String(m.content).includes("Ответный удар —")).length;
    return { def, opts, strikes };
  }

  it("владелец, первый клик — удар проходит", async () => {
    const { def, opts, strikes } = setup();
    await performUnarmedRiposte(def, opts);
    expect(strikes()).toBe(1);
  });

  it("не владелец парировавшего — удара нет", async () => {
    const { def, opts, strikes } = setup({ owner: false });
    await performUnarmedRiposte(def, opts);
    expect(strikes()).toBe(0);
  });

  it("второй клик по той же карточке (другой клиент) — удара нет", async () => {
    const { def, opts, strikes } = setup();
    await performUnarmedRiposte(def, opts);
    await performUnarmedRiposte(def, opts);
    expect(strikes()).toBe(1);
  });

  it("карточку бросал ГМ, игрок не может её отметить — удара нет (иначе ГМ ударит второй раз)", async () => {
    const { def, opts, strikes } = setup();
    opts.message.canUserModify = () => false;
    await performUnarmedRiposte(def, opts);
    expect(strikes()).toBe(0);
  });
});
