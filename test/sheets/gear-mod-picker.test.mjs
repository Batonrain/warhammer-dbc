// test/sheets/gear-mod-picker.test.mjs
//
// «Улучшить» (wdbc-7td8): пикер модификаций для оружия/брони прямо со
// строки Снаряжения. Проверяется отбор совместимых свободных модификаций
// (hostKindOf/modsAvailableFor — та же логика, что уже отбирает
// gearWeaponModsFree/gearArmorModsFree в sheet-helpers.mjs, только со
// стороны носителя) и построение содержимого диалога.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { hostKindOf, modsAvailableFor, openGearModPicker } from "../../module/sheets/gear-mod-picker.mjs";

function weapon({ id = "w1", name = "Лазган", weaponClass = "basic" } = {}) {
  return { id, name, type: "weapon", system: { weaponClass } };
}
function armor({ id = "a1", name = "Флак-броня", armorType = "flak" } = {}) {
  return { id, name, type: "armor", system: { armorType } };
}
function weaponMod({ id = "wm1", name = "Прицел", installedOn = "", modGroup = "sights", category = "ranged" } = {}) {
  return { id, name, type: "weaponMod", system: { installedOn, modGroup, category, weight: 0.5, description: "Прицел." } };
}
function armorMod({ id = "am1", name = "Керамитовое покрытие", installedOn = "", modGroup = "reinforcement", category = "armor" } = {}) {
  return { id, name, type: "armorMod", system: { installedOn, modGroup, category, weight: 1, description: "Керамит." } };
}
function powerSystemMod({ id = "ps1", name = "Сервомотор", installedOn = "" } = {}) {
  return { id, name, type: "armorMod", system: { installedOn, modGroup: "standard", category: "powerSystem", weight: 2 } };
}

function actorWith(items) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  return { id: "actor-1", items: list, createEmbeddedDocuments: async () => [] };
}

beforeEach(() => {
  resetCaptured();
  globalThis.window = { innerWidth: 1200, innerHeight: 900 };
});

describe("hostKindOf", () => {
  it("weapon/armor распознаются, остальное — нет", () => {
    expect(hostKindOf(weapon())).toBe("weapon");
    expect(hostKindOf(armor())).toBe("armor");
    expect(hostKindOf({ type: "gear" })).toBeNull();
    expect(hostKindOf(null)).toBeNull();
  });
});

describe("modsAvailableFor — отбор совместимых свободных модификаций", () => {
  it("оружие: любая свободная weaponMod подходит, установленная — нет", () => {
    const host = weapon();
    const free = weaponMod({ id: "free" });
    const installed = weaponMod({ id: "installed", installedOn: host.id });
    const actor = actorWith([host, free, installed]);

    const mods = modsAvailableFor(actor, host);

    expect(mods.map(m => m.id)).toEqual(["free"]);
  });

  it("armorMod свободна, её installedOn указывает на удалённый предмет — тоже подходит", () => {
    const host = armor();
    const orphan = armorMod({ id: "orphan", installedOn: "ghost-item-not-in-inventory" });
    const actor = actorWith([host, orphan]);

    const mods = modsAvailableFor(actor, host);

    expect(mods.map(m => m.id)).toEqual(["orphan"]);
  });

  it("система силовой брони (category powerSystem) предлагается только Силовой броне", () => {
    const power = armor({ id: "power-1", armorType: "power" });
    const flak  = armor({ id: "flak-1", armorType: "flak" });
    const sys   = powerSystemMod();

    const actorPower = actorWith([power, sys]);
    const actorFlak  = actorWith([flak, { ...sys }]);

    expect(modsAvailableFor(actorPower, power).map(m => m.id)).toEqual(["ps1"]);
    expect(modsAvailableFor(actorFlak, flak).map(m => m.id)).toEqual([]);
  });

  it("обычная armorMod (category armor) подходит любой броне, включая Силовую", () => {
    const power = armor({ id: "power-1", armorType: "power" });
    const mod = armorMod();
    const actor = actorWith([power, mod]);

    expect(modsAvailableFor(actor, power).map(m => m.id)).toEqual(["am1"]);
  });

  it("непригодный носитель (тип не weapon/armor) — пустой список без ошибок", () => {
    const actor = actorWith([weaponMod()]);
    expect(modsAvailableFor(actor, { type: "gear" })).toEqual([]);
  });

  it("не подмешивает моды другого рода носителя (armorMod не предлагается оружию)", () => {
    const host = weapon();
    const actor = actorWith([host, armorMod()]);
    expect(modsAvailableFor(actor, host)).toEqual([]);
  });
});

describe("openGearModPicker — содержимое диалога", () => {
  it("заголовок называет носителя, список содержит только совместимые свободные моды", async () => {
    const host = weapon({ name: "Болтер" });
    const free = weaponMod({ id: "free", name: "Расширенный магазин" });
    const installed = weaponMod({ id: "installed", name: "Уже установлен", installedOn: host.id });
    const actor = actorWith([host, free, installed]);

    await openGearModPicker(actor, host);

    expect(captured.dialog.title).toContain("Болтер");
    expect(captured.dialog.content).toContain("Расширенный магазин");
    expect(captured.dialog.content).not.toContain("Уже установлен");
    expect(captured.dialog.content).toContain("＋ Своя");
  });

  it("пустой список совместимых модов — заглушка вместо строк", async () => {
    const host = armor({ armorType: "power" });
    const actor = actorWith([host]);

    await openGearModPicker(actor, host);

    expect(captured.dialog.content).toContain("Нет подходящих модификаций");
  });

  it("непригодный носитель — ничего не открывает", async () => {
    const actor = actorWith([]);
    const result = await openGearModPicker(actor, { type: "gear" });
    expect(result).toBeNull();
    expect(captured.dialog).toBeNull();
  });
});
