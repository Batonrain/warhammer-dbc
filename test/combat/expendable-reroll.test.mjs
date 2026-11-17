// test/combat/expendable-reroll.test.mjs
//
// Решение владельца: последняя граната после броска по-прежнему удаляется из
// снаряжения, но переброс (Очко Судьбы/Бесчестия, Огневая Точка, сдвиг места)
// обязан работать — оружие берётся из снимка, который лёг в карточку атаки.
// Переброс не тратит ещё одну штуку. Документы — настоящие JSON из packs-src.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { attackWeapon } from "../../module/combat/attack-snapshot.mjs";

const IMPERIAL = "packs-src/weapons/Имперское/Стрелковое";
const DOCS = {
  frag: packDocById(`${IMPERIAL}/Гранаты`, "vmWiEiuIfIRfNkWW"),
  disposable: packDocById(`${IMPERIAL}/Ракетные_установки`, "Kg1I7qD7hci0tYL5")
};

const lastMessage = () => captured.chat.at(-1);
const attackFlag = () => lastMessage().flags["warhammer-dbc"].attack;
const card = () => lastMessage().content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

function setup(doc, quantity) {
  const weapon = weaponFor({ ...structuredClone(doc.system), quantity }, { id: doc._id, name: doc.name });
  weapon.deleted = false;
  const actor = actorFor({ items: [weapon] });
  weapon.delete = async () => {
    weapon.deleted = true;
    actor.items.splice(actor.items.indexOf(weapon), 1);
  };
  return { weapon, actor };
}

const fire = (actor, weapon, opts = {}) => _executeAttackRoll(actor, weapon, "bs", 60, "single", null, opts);

async function reroll(actor, atk, extra = {}) {
  const weapon = attackWeapon(actor, atk);
  return _executeAttackRoll(actor, weapon, atk.charKey, atk.threshold, atk.rofMode, atk.aimTarget,
    { ...(atk.opts || {}), forcedRoll: atk.rv, skipAmmo: true, ...extra });
}

describe("переброс по последней гранате", () => {
  it("предмет удалён, но карточка хранит снимок и переброс проходит", async () => {
    const { weapon, actor } = setup(DOCS.frag, 1);
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await fire(actor, weapon);
    expect(weapon.deleted).toBe(true);
    expect(actor.items.get(weapon.id)).toBeNull();
    const atk = attackFlag();
    expect(atk.itemSnapshot.name).toBe(DOCS.frag.name);
    expect(atk.itemSnapshot.system.weaponType).toBe("grenade");

    const found = attackWeapon(actor, atk);
    expect(found).not.toBeNull();
    expect(found.id).toBe(weapon.id);
    expect(found.name).toBe(DOCS.frag.name);

    resetCaptured();
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await reroll(actor, atk);
    expect(captured.chat.length).toBeGreaterThan(0);
    expect(card()).not.toContain("Израсходовано");
    expect(card()).not.toContain("Магазин пуст");
    expect(attackFlag().itemId).toBe(weapon.id);
    expect(attackFlag().rv).toBe(atk.rv);
  });

  it("переброс не списывает вторую штуку и не воссоздаёт предмет", async () => {
    const { weapon, actor } = setup(DOCS.frag, 1);
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await fire(actor, weapon);
    const atk = attackFlag();
    let deletes = 0;
    const found = attackWeapon(actor, atk);
    found.delete = async () => { deletes += 1; };
    resetCaptured();
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await _executeAttackRoll(actor, found, atk.charKey, atk.threshold, atk.rofMode, atk.aimTarget,
      { ...atk.opts, forcedRoll: atk.rv, skipAmmo: true });
    expect(deletes).toBe(0);
    expect(actor.items.length).toBe(0);
    expect(captured.created.length).toBe(0);
  });

  it("мутации виртуального оружия никуда не пишутся", async () => {
    const { weapon, actor } = setup(DOCS.frag, 1);
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await fire(actor, weapon);
    const found = attackWeapon(actor, attackFlag());
    await expect(found.update({ "system.quantity": 5 })).resolves.toBeDefined();
    await expect(found.delete()).resolves.toBeDefined();
    expect(actor.items.length).toBe(0);
  });

  it("переброс переброса тоже находит оружие: снимок едет в новую карточку", async () => {
    const { weapon, actor } = setup(DOCS.disposable, 1);
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await fire(actor, weapon);
    const first = attackFlag();
    resetCaptured();
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await reroll(actor, first);
    const second = attackFlag();
    expect(second.itemSnapshot.name).toBe(DOCS.disposable.name);
    resetCaptured();
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await reroll(actor, second);
    expect(captured.chat.length).toBeGreaterThan(0);
    expect(card()).not.toContain("Израсходовано");
  });

  it("сдвиг места попадания той же карточки (updateMessageId) тоже идёт по снимку", async () => {
    const { weapon, actor } = setup(DOCS.frag, 1);
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await fire(actor, weapon);
    const atk = attackFlag();
    const updates = [];
    globalThis.game.messages = { get: () => ({ update: async data => { updates.push(data); } }) };
    resetCaptured();
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await reroll(actor, atk, { locationShift: 1, updateMessageId: "m1" });
    expect(updates.length).toBe(1);
    expect(updates[0].flags["warhammer-dbc"].attack.itemSnapshot.name).toBe(DOCS.frag.name);
  });
});

describe("не сломано", () => {
  it("не-последняя граната: предмет жив, берётся живой, переброс не тратит", async () => {
    const { weapon, actor } = setup(DOCS.frag, 3);
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await fire(actor, weapon);
    expect(weapon.system.quantity).toBe(2);
    const atk = attackFlag();
    expect(attackWeapon(actor, atk)).toBe(weapon);
    resetCaptured();
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await reroll(actor, atk);
    expect(weapon.system.quantity).toBe(2);
    expect(card()).not.toContain("Израсходовано");
  });

  it("обычное оружие: снимка в карточке нет, пропавший предмет не подменяется", async () => {
    const weapon = weaponFor({ magazineCur: 10, magazineMax: 10, rof_single: 1 }, { id: "bolter" });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await fire(actor, weapon);
    const atk = attackFlag();
    expect(atk.itemSnapshot).toBeUndefined();
    expect(attackWeapon(actor, atk)).toBe(weapon);
    actor.items.splice(0, 1);
    expect(attackWeapon(actor, atk)).toBeNull();
  });

  it("карточка без itemId и актор без предметов не падают", () => {
    expect(attackWeapon(actorFor({}), { itemId: "x" })).toBeNull();
    expect(attackWeapon(null, { itemId: "x" })).toBeNull();
    expect(attackWeapon(actorFor({}), null)).toBeNull();
  });
});
