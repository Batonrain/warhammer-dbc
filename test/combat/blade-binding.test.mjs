// test/combat/blade-binding.test.mjs
//
// Blade Binding / Сцепление Клинков (Рукопашные, Sahara 3-8dc5): после успешного Парирования
// (не щитом) — S+0 vs S+0; победа сцепляет оружия: ни цепляющий, ни противник не могут ими
// атаковать или парировать до начала следующего Хода цепляющего или пока не разойдутся.

import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { actorFor } from "../support/combat-fixtures.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import {
  bladeBindingOffered, boundWeaponIds, isWeaponBound, hasBinding,
  BLADE_OWNER_FLAG, BLADE_BY_FLAG, BLADE_WEAPON_FLAG
} from "../../module/rules/blade-binding.mjs";
import {
  resolveBladeBindingSuccess, releaseBinding, bladeBindingButtonHtml, BLADE_BINDING_CONTEST
} from "../../module/combat/blade-binding.mjs";
import { RELAY_TARGET_FLAGS } from "../../module/combat/gm-relay.mjs";

const KEY = "meleeCore.core.bladeBinding";
const talentByKey = key => ({
  id: "t-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }] }] } }
});

/** Актор с флагами и записью update по путям flags.* (как у Foundry). */
function fighter(uuid, { items = [], name = uuid } = {}) {
  const store = {};
  const a = actorFor({ items });
  Object.assign(a, { uuid, name, isOwner: true, flags: {} });
  a.getFlag = (s, k) => store[`${s}.${k}`];
  a.setFlag = async (s, k, v) => { store[`${s}.${k}`] = v; };
  a.unsetFlag = async (s, k) => { delete store[`${s}.${k}`]; };
  a.update = async data => {
    for (const [p, v] of Object.entries(data)) {
      const m = p.match(/^flags\.([^.]+)\.(-=)?(.+)$/);
      if (!m) continue;
      if (m[2]) delete store[`${m[1]}.${m[3]}`]; else store[`${m[1]}.${m[3]}`] = v;
    }
  };
  return a;
}

let registry; let prevSync; let prevUuid;
beforeEach(() => {
  resetCaptured();
  registry = {};
  prevSync = globalThis.fromUuidSync; prevUuid = globalThis.fromUuid;
  globalThis.fromUuidSync = uuid => registry[uuid] ?? null;
  globalThis.fromUuid = async uuid => registry[uuid] ?? null;
  globalThis.game.user = { isGM: true };
});
afterEach(() => { globalThis.fromUuidSync = prevSync; globalThis.fromUuid = prevUuid; });

describe("данные и реестры", () => {
  it("Талант несёт запись Конструктора с ключом возможности", () => {
    const doc = packDocById("packs-src/talents/Рукопашные", "LYLxB7IZwpBnwsjm");
    const keys = (doc.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries).map(e => e.capabilityKey);
    expect(keys).toContain(KEY);
  });
  it("указатели Сцепления разрешены релею", () => {
    expect(RELAY_TARGET_FLAGS).toEqual(expect.arrayContaining([BLADE_BY_FLAG, BLADE_WEAPON_FLAG]));
  });
  it("встречный тест — S vs S, одна характеристика", () => {
    expect(BLADE_BINDING_CONTEST.defaultChar).toBe("s");
    expect(BLADE_BINDING_CONTEST.allowedChars).toEqual(["s"]);
  });
});

describe("bladeBindingOffered: когда кнопка на карточке Парирования", () => {
  const talented = fighter("Actor.a", { items: [talentByKey(KEY)] });
  const ok = { parried: true, parryIsShield: false, hasParryWeapon: true, hasAttackWeapon: true };
  it("Парирование удалось, оружие не щит — да", () => { expect(bladeBindingOffered(talented, ok)).toBe(true); });
  it("против щита — нет (книга)", () => { expect(bladeBindingOffered(talented, { ...ok, parryIsShield: true })).toBe(false); });
  it("Парирование не удалось — нет", () => { expect(bladeBindingOffered(talented, { ...ok, parried: false })).toBe(false); });
  it("без Таланта / без оружия (кулаки) — нет", () => {
    expect(bladeBindingOffered(fighter("Actor.x"), ok)).toBe(false);
    expect(bladeBindingOffered(talented, { ...ok, hasParryWeapon: false })).toBe(false);
    expect(bladeBindingOffered(talented, { ...ok, hasAttackWeapon: false })).toBe(false);
  });
});

describe("Победа: сцепление записывается, запреты действуют", () => {
  async function bind() {
    const binder = fighter("Actor.binder", { items: [talentByKey(KEY)], name: "Цепляющий" });
    const foe = fighter("Actor.foe", { name: "Противник" });
    registry["Actor.binder"] = binder; registry["Actor.foe"] = foe;
    await resolveBladeBindingSuccess(binder, { deg: 2, target: foe, binding: {
      binderWeaponId: "wb", binderWeaponName: "Меч", foeWeaponId: "wf", foeWeaponName: "Сабля" } });
    return { binder, foe };
  }
  const resolve = u => registry[u] ?? null;

  it("оба оружия сцеплены, остальное оружие свободно", async () => {
    const { binder, foe } = await bind();
    expect(isWeaponBound(binder, "wb", resolve)).toBe(true);
    expect(isWeaponBound(foe, "wf", resolve)).toBe(true);
    expect(isWeaponBound(binder, "other", resolve)).toBe(false);
    expect(isWeaponBound(foe, "wb", resolve)).toBe(false);
    expect(hasBinding(binder, resolve)).toBe(true);
    expect(hasBinding(foe, resolve)).toBe(true);
  });

  it("с началом Хода цепляющего его флаг гаснет — и у противника сцепление больше ничего не держит", async () => {
    const { binder, foe } = await bind();
    await binder.unsetFlag("warhammer-dbc", BLADE_OWNER_FLAG);   // так гасит реестр turn-flags
    expect(isWeaponBound(binder, "wb", resolve)).toBe(false);
    expect(isWeaponBound(foe, "wf", resolve)).toBe(false);       // указатель остался, но недействителен
  });

  it("«Разойтись» от любой стороны снимает всё", async () => {
    const { binder, foe } = await bind();
    await releaseBinding(foe);
    expect(isWeaponBound(binder, "wb", resolve)).toBe(false);
    expect(isWeaponBound(foe, "wf", resolve)).toBe(false);
    expect(foe.getFlag("warhammer-dbc", BLADE_BY_FLAG)).toBeUndefined();
  });

  it("указатель на одно оружие противника не блокирует другое его оружие", async () => {
    const { foe, binder } = await bind();
    expect(isWeaponBound(foe, "wf2", resolve)).toBe(false);
    expect(boundWeaponIds(binder, resolve).size).toBe(1);
  });

  it("противник не ваш и ГМа нет — запись отказана, сцепления нет", async () => {
    const binder = fighter("Actor.binder", { items: [talentByKey(KEY)] });
    const foe = fighter("Actor.foe"); foe.isOwner = false;
    registry["Actor.binder"] = binder; registry["Actor.foe"] = foe;
    globalThis.game.user = { isGM: false };
    globalThis.game.users = { activeGM: null };
    await resolveBladeBindingSuccess(binder, { target: foe, binding: { binderWeaponId: "wb", binderWeaponName: "М", foeWeaponId: "wf", foeWeaponName: "С" } });
    expect(binder.getFlag("warhammer-dbc", BLADE_OWNER_FLAG)).toBeUndefined();
    delete globalThis.game.users;
  });
});

describe("кнопка", () => {
  it("несёт обе стороны, оружие атаковавшего и id парирующего оружия", () => {
    const html = bladeBindingButtonHtml({ attackerUuid: "A.1", defenderUuid: "A.2", attackerWeaponUuid: "I.1", parryWeaponId: "wf", attackerName: "X" });
    expect(html).toContain("wh-blade-binding-btn");
    for (const s of ['data-attacker-uuid="A.1"', 'data-defender-uuid="A.2"', 'data-attacker-weapon-uuid="I.1"', 'data-parry-weapon-id="wf"'])
      expect(html).toContain(s);
  });
});

// ── Интеграция с Парированием: запрет и кнопка на карточке ──────────────────
import { weaponFor } from "../support/combat-fixtures.mjs";
import { captured } from "../support/foundry-stub.mjs";
import { _performParry } from "../../module/combat/defense.mjs";

const meleeWeapon = (id, name, over = {}) => {
  const w = weaponFor({ weaponClass: "melee", balance: 0, equipped: true, meleeCategory: "Меч", ...over }, { id, name });
  w.type = "weapon"; w.uuid = `Item.${id}`;
  return w;
};

describe("Парирование и Сцепление", () => {
  const lastCard = () => captured.chat.at(-1)?.content ?? "";

  it("сцепленным оружием парировать нельзя: бросок не делается, названа причина", async () => {
    const sword = meleeWeapon("wf", "Сабля");
    const defender = fighter("Actor.foe", { items: [sword], name: "Парирующий" });
    defender.system.characteristics.ws = { total: 45, bonus: 4 };
    registry["Actor.foe"] = defender;
    const binder = fighter("Actor.binder", { items: [talentByKey(KEY)] });
    registry["Actor.binder"] = binder;
    await resolveBladeBindingSuccess(binder, { target: defender, binding: {
      binderWeaponId: "wb", binderWeaponName: "Меч", foeWeaponId: "wf", foeWeaponName: "Сабля" } });
    captured.dice = [10];
    await _performParry(defender, { extraMod: 0, attackerUuid: "Actor.binder" });
    expect(lastCard()).toContain("сцеплено");
    expect(lastCard()).not.toContain("Парирование успешно");
  });

  it("без сцепления то же Парирование проходит (регрессия)", async () => {
    const defender = fighter("Actor.foe", { items: [meleeWeapon("wf", "Сабля")] });
    registry["Actor.foe"] = defender;
    captured.dice = [10];
    await _performParry(defender, { extraMod: 0, attackerUuid: "Actor.binder" });
    expect(lastCard()).toContain("Парирование успешно");
  });

  it("успешное Парирование: у атаковавшего с Талантом на карточке кнопка Сцепления; без Таланта и против щита — нет", async () => {
    const run = async ({ withTalent = true, parryWeapon }) => {
      const defender = fighter("Actor.foe", { items: [parryWeapon] });
      const atkWeapon = meleeWeapon("wb", "Меч"); atkWeapon.uuid = "Item.wb";
      const binder = fighter("Actor.binder", { items: withTalent ? [talentByKey(KEY)] : [] });
      registry["Actor.binder"] = binder; registry["Actor.foe"] = defender; registry["Item.wb"] = atkWeapon;
      captured.dice = [10];
      await _performParry(defender, { extraMod: 0, attackerUuid: "Actor.binder", attackerWeaponUuid: "Item.wb" });
      return lastCard();
    };
    expect(await run({ parryWeapon: meleeWeapon("wf", "Сабля") })).toContain("wh-blade-binding-btn");
    expect(await run({ withTalent: false, parryWeapon: meleeWeapon("wf", "Сабля") })).not.toContain("wh-blade-binding-btn");
    // щит (shieldAP задан) — книга: «Этот Талант не работает против парирования щитом»
    expect(await run({ parryWeapon: meleeWeapon("wf", "Щит", { shieldAP: 3 }) })).not.toContain("wh-blade-binding-btn");
  });
});

describe("ревью: устаревший указатель и «Разойтись» без прав", () => {
  const resolve = u => registry[u] ?? null;

  it("указатель на токене A не оживает, когда цепляющий сцепил ДРУГОЙ токен с тем же id оружия", async () => {
    const binder = fighter("Actor.binder", { items: [talentByKey(KEY)] });
    const foeA = fighter("Actor.A"); const foeB = fighter("Actor.B");
    registry["Actor.binder"] = binder; registry["Actor.A"] = foeA; registry["Actor.B"] = foeB;
    const binding = { binderWeaponId: "wb", binderWeaponName: "Меч", foeWeaponId: "wf", foeWeaponName: "Сабля" };
    await resolveBladeBindingSuccess(binder, { target: foeA, binding });
    await binder.unsetFlag("warhammer-dbc", BLADE_OWNER_FLAG);                    // срок вышел, указатель на A остался
    await resolveBladeBindingSuccess(binder, { target: foeB, binding });          // новое сцепление с B (то же id оружия)
    expect(isWeaponBound(foeB, "wf", resolve)).toBe(true);
    expect(isWeaponBound(foeA, "wf", resolve)).toBe(false);
  });

  it("сцепленная сторона жмёт «Разойтись», цепляющий не её: чужой флаг снимает ГМ по сокету, а не прямой записью", async () => {
    const binder = fighter("Actor.binder", { items: [talentByKey(KEY)] }); binder.isOwner = false;
    const foe = fighter("Actor.foe");
    registry["Actor.binder"] = binder; registry["Actor.foe"] = foe;
    await foe.setFlag("warhammer-dbc", BLADE_BY_FLAG, "Actor.binder");
    await foe.setFlag("warhammer-dbc", BLADE_WEAPON_FLAG, "wf");
    await binder.setFlag("warhammer-dbc", BLADE_OWNER_FLAG, { foeUuid: "Actor.foe", binderWeaponId: "wb", foeWeaponId: "wf" });
    const emitted = [];
    const prev = { socket: globalThis.game.socket, users: globalThis.game.users };
    globalThis.game.socket = { emit: (_c, p) => emitted.push(p) };
    globalThis.game.users = { activeGM: { id: "gm" } };
    globalThis.game.user = { isGM: false, id: "u1" };
    let direct = 0; const origUnset = binder.unsetFlag; binder.unsetFlag = async (...a) => { direct++; return origUnset(...a); };
    await releaseBinding(foe);
    globalThis.game.socket = prev.socket; globalThis.game.users = prev.users;
    expect(direct).toBe(0);
    expect(emitted).toHaveLength(1);
    expect(emitted[0].op.data).toEqual({ [`flags.warhammer-dbc.-=${BLADE_OWNER_FLAG}`]: null });
    expect(foe.getFlag("warhammer-dbc", BLADE_BY_FLAG)).toBeUndefined();
  });
});
