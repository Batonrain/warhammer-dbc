// test/combat/weapon-repair.test.mjs
//
// «Починить» оружие, помеченное system.destroyed (Sahara system-destroyed п.1): после Выпуска Батареи (Batpack Dump)
// и Расплавления (Meltdown) оружие ломается, а снять метку умели только Экстренное Обслуживание и Песнь Перерождения —
// стол чинил правкой данных. Теперь — кнопка на листе (рядом со значком «Уничтожено») и флажок в листе предмета.

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { repairDestroyedWeapon } from "../../module/combat/weapon-repair.mjs";

const read = rel => fs.readFileSync(path.join(path.resolve(import.meta.dirname, "../.."), rel), "utf8");

function gun(destroyed = true) {
  const item = { id: "w1", name: "Лазган", type: "weapon", system: { destroyed }, isOwner: true };
  item.update = async patch => { for (const [k, v] of Object.entries(patch)) if (k === "system.destroyed") item.system.destroyed = v; };
  return item;
}
const owner = (isOwner = true) => ({ name: "Стрелок", isOwner, uuid: "Actor.s" });

beforeEach(() => { resetCaptured(); globalThis.game.user = { ...globalThis.game.user, isGM: false }; });

describe("repairDestroyedWeapon", () => {
  it("владелец: метка снимается, в чат уходит строка о починке", async () => {
    const w = gun();
    expect(await repairDestroyedWeapon(owner(), w)).toBe(true);
    expect(w.system.destroyed).toBe(false);
    expect(captured.chat.at(-1).content).toContain("Лазган");
    expect(captured.chat.at(-1).content).toContain("починено");
  });

  it("ГМ может чинить чужое оружие", async () => {
    globalThis.game.user.isGM = true;
    const w = gun();
    expect(await repairDestroyedWeapon(owner(false), w)).toBe(true);
    expect(w.system.destroyed).toBe(false);
  });

  it("не владелец и не ГМ — отказ, метка остаётся", async () => {
    const w = gun();
    expect(await repairDestroyedWeapon(owner(false), w)).toBe(false);
    expect(w.system.destroyed).toBe(true);
    expect(captured.warnings.length).toBeGreaterThan(0);
  });

  it("исправное оружие чинить нечего — ничего не пишется", async () => {
    const w = gun(false);
    expect(await repairDestroyedWeapon(owner(), w)).toBe(false);
    expect(captured.chat.length).toBe(0);
  });
});

describe("стыковка", () => {
  it("на листе рядом со значком «Уничтожено» есть кнопка «Починить», обработчик зовёт repairDestroyedWeapon", () => {
    const hbs = read("templates/actor/parts/tab-combat.hbs");
    expect((hbs.match(/wh-sheet-repair-destroyed-btn/g) ?? []).length).toBeGreaterThanOrEqual(2);   // обе раскладки строки оружия
    expect(read("module/sheets/tabs/combat.mjs")).toMatch(/wh-sheet-repair-destroyed-btn[\s\S]{0,200}repairDestroyedWeapon\(actor, item\)/);
  });
  it("в листе предмета есть поле «Уничтожено»", () => {
    expect(read("templates/item/parts/weapon.hbs")).toMatch(/name="system\.destroyed"/);
  });
});
