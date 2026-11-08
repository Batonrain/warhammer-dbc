// test/combat/no-magazine-weapons.test.mjs
//
// Sahara task-b237. Оружие с magazineMax 0 и без ∞ — интегральные атаки
// существ, метательное, ракеты — магазина не имеет вовсе: выстрел ничего не
// списывает, «Магазин пуст» не пишется, в карточке «Магазин: —». Расходуемые
// гранаты и ракеты (в паке у имперских 1/1, у аэльдарских 0/0) тратят не
// магазин, а Количество предмета: после броска «Израсходовано». Плазменный
// Бластер получил ∞ в особенностях (книга: Clip ∞, питание от реактора брони).
// Документы — настоящие JSON из packs-src.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { hasInfiniteMagazine, ammoIsFree } from "../../module/rules/ammo-free.mjs";
import { hasNoMagazine, isExpendableOrdnance, tracksMagazine } from "../../module/rules/no-magazine.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

const IMPERIAL = "packs-src/weapons/Имперское/Стрелковое";
const DOCS = {
  aeldariGrenade: packDocById("packs-src/weapons/Азуриане/Стрелковое/Гранаты_и_бомбы", "u0CX6mFuQ2XyJVz0"),
  aeldariRocket:  packDocById("packs-src/weapons/Азуриане/Стрелковое/Ракеты", "QZSEy2aJ8VvJ5dcW"),
  frag:           packDocById(`${IMPERIAL}/Гранаты`, "vmWiEiuIfIRfNkWW"),
  krakRocket:     packDocById(`${IMPERIAL}/Ракеты`, "fGe14AvArOK6gkRz"),
  disposable:     packDocById(`${IMPERIAL}/Ракетные_установки`, "Kg1I7qD7hci0tYL5"),
  blaster:        packDocById(`${IMPERIAL}/Плазменное`, "jVw3g35AkTtVKnsk"),
  doomfire:       packDocById("packs-src/weapons/Друкхари/Атаки_существ/Житель_Бездны", "t5qXh2CZoAr7rBER"),
  missileLauncher: packDocById(`${IMPERIAL}/Ракетные_установки`, "XvejIKa4CEmTgxqh")
};

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

/** Предмет-оружие по настоящему документу пака; умеет update и delete. */
function fromPack(doc, system = {}) {
  const weapon = weaponFor({ ...structuredClone(doc.system), ...system }, { id: doc._id, name: doc.name });
  weapon.deleted = false;
  weapon.delete = async () => { weapon.deleted = true; };
  return weapon;
}

const fire = (actor, weapon, opts = {}) => _executeAttackRoll(actor, weapon, "bs", 60, "single", null, opts);

describe("hasNoMagazine / isExpendableOrdnance", () => {
  it("magazineMax 0 — магазина нет, с любым special", () => {
    expect(hasNoMagazine(fromPack(DOCS.doomfire))).toBe(true);
    expect(hasNoMagazine(fromPack(DOCS.aeldariGrenade))).toBe(true);
    expect(hasNoMagazine({ system: { magazineMax: 0, special: "Боезапас: ∞" } })).toBe(true);
    expect(hasNoMagazine({ system: {} })).toBe(true);
  });

  it("magazineMax больше 0 — магазин есть", () => {
    expect(hasNoMagazine(fromPack(DOCS.missileLauncher))).toBe(false);
    expect(hasNoMagazine(weaponFor({ magazineMax: 24 }))).toBe(false);
  });

  it("расходуемое: гранаты, ракеты, Одноразовая Ракетница; болтер и пусковая установка — нет", () => {
    for (const key of ["aeldariGrenade", "aeldariRocket", "frag", "krakRocket", "disposable"]) {
      expect(isExpendableOrdnance(fromPack(DOCS[key])), key).toBe(true);
    }
    for (const key of ["missileLauncher", "blaster", "doomfire"]) {
      expect(isExpendableOrdnance(fromPack(DOCS[key])), key).toBe(false);
    }
    expect(isExpendableOrdnance(weaponFor({}))).toBe(false);
  });
});

describe("tracksMagazine: HUD и лист не считают расходуемое и безмагазинное пустым", () => {
  it("магазин ведут только оружие с max больше 0 и не расходуемое", () => {
    expect(tracksMagazine(fromPack(DOCS.missileLauncher))).toBe(true);
    expect(tracksMagazine(weaponFor({ magazineMax: 24 }))).toBe(true);
    expect(tracksMagazine(fromPack(DOCS.doomfire))).toBe(false);
    expect(tracksMagazine(fromPack(DOCS.frag))).toBe(false);
    expect(tracksMagazine(fromPack(DOCS.disposable))).toBe(false);
  });
});

describe("оружие без магазина: Doomfire (интегральная атака существа)", () => {
  it("не пишет «Магазин пуст», показывает «—», магазин не трогает", async () => {
    const weapon = fromPack(DOCS.doomfire);
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await fire(actor, weapon);
    expect(card()).not.toContain("Магазин пуст");
    expect(card()).not.toContain("0/0");
    expect(card()).toContain("Магазин: <b>—</b>");
    expect(weapon.system.magazineCur).toBe(0);
    expect(weapon.deleted).toBe(false);
  });

  it("окно атаки: «—» и без красной метки пустого", () => {
    const weapon = fromPack(DOCS.doomfire);
    const actor = actorFor({ items: [weapon] });
    actor.getFlag = () => undefined;
    showAttackDialog(actor, weapon);
    const html = captured.dialog.content;
    expect(html).toContain("Магазин: <b>—</b>");
    expect(html).not.toContain("ammo-empty");
  });
});

describe("расходуемая граната и ракета: Количество −1, «Израсходовано»", () => {
  const cases = [
    ["аэльдарская граната (0/0)", "aeldariGrenade"],
    ["имперская Фраг-граната (1/1)", "frag"],
    ["аэльдарская ракета (0/0)", "aeldariRocket"],
    ["имперская Крак-ракета (1/1)", "krakRocket"],
    ["Одноразовая Ракетница (1/1)", "disposable"]
  ];

  for (const [label, key] of cases) {
    it(`${label}: из трёх остаётся две, магазин цел, «Магазин пуст» нет`, async () => {
      const weapon = fromPack(DOCS[key], { quantity: 3 });
      const magBefore = weapon.system.magazineCur;
      const actor = actorFor({ items: [weapon] });
      captured.dice = [10, 5, 5, 5, 5, 5, 5];
      await fire(actor, weapon);
      expect(weapon.system.quantity).toBe(2);
      expect(weapon.system.magazineCur).toBe(magBefore);
      expect(weapon.deleted).toBe(false);
      expect(card()).toContain("Израсходовано");
      expect(card()).not.toContain("Магазин пуст");
      expect(card()).not.toContain("0/0");
      expect(card()).toContain("Магазин: <b>—</b>");
    });
  }

  it("промах тоже тратит: граната брошена в любом случае", async () => {
    const weapon = fromPack(DOCS.frag, { quantity: 2 });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [95];
    await fire(actor, weapon);
    expect(weapon.system.quantity).toBe(1);
    expect(card()).toContain("Израсходовано");
  });

  it("последняя (Количество 1) — предмет удаляется, как у гранаты в рукопашной", async () => {
    const weapon = fromPack(DOCS.aeldariGrenade, { quantity: 1 });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await fire(actor, weapon);
    expect(weapon.deleted).toBe(true);
    expect(card()).toContain("Израсходовано");
    expect(card()).not.toContain("Магазин пуст");
  });

  it("переброс того же броска (skipAmmo) — повторно не тратится", async () => {
    const weapon = fromPack(DOCS.frag, { quantity: 3 });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await fire(actor, weapon, { skipAmmo: true });
    expect(weapon.system.quantity).toBe(3);
    expect(card()).not.toContain("Израсходовано");
  });

  it("пусковая установка с магазином по-прежнему тратит магазин, а не Количество", async () => {
    const weapon = fromPack(DOCS.missileLauncher, { quantity: 1 });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await fire(actor, weapon);
    expect(weapon.system.magazineCur).toBe(0);
    expect(weapon.system.quantity).toBe(1);
    expect(weapon.deleted).toBe(false);
    expect(card()).toContain("Магазин пуст");
    expect(card()).not.toContain("Израсходовано");
  });
});

describe("Плазменный Бластер: Clip ∞ по книге", () => {
  it("в паке ∞ записан в особенностях, магазин 0", () => {
    const blaster = fromPack(DOCS.blaster);
    expect(blaster.system.magazineMax).toBe(0);
    expect(hasInfiniteMagazine(blaster)).toBe(true);
    expect(ammoIsFree(blaster, actorFor({}))).toBe(true);
  });

  it("выстрел: «∞», без «Магазин пуст»", async () => {
    const weapon = fromPack(DOCS.blaster);
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await fire(actor, weapon);
    expect(card()).toContain("Магазин: <b>∞</b>");
    expect(card()).not.toContain("Магазин пуст");
    expect(weapon.system.magazineCur).toBe(0);
  });

  it("Maximal: двойной расход к нулю не сводится, подзарядка по Maximal/Overheats остаётся", async () => {
    const weapon = fromPack(DOCS.blaster);
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5, 4, 5, 5, 5, 5];
    await fire(actor, weapon, { maximal: true });
    expect(card()).toContain("Магазин: <b>∞</b>");
    expect(card()).not.toContain("Магазин пуст");
    expect(card()).not.toContain("израсходовано:");
    expect(weapon.system.needsRecharge).toBe(true);
  });
});

describe("не сломано: обычное оружие и оружие с ∞", () => {
  it("болтер 10/10 тратит патрон и пишет остаток", async () => {
    const weapon = weaponFor({ magazineCur: 10, magazineMax: 10, rof_single: 1 }, { id: "bolter" });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await fire(actor, weapon);
    expect(weapon.system.magazineCur).toBe(9);
    expect(card()).toContain("Магазин: <b>9/10</b>");
    expect(card()).not.toContain("Израсходовано");
  });

  it("болтер с последним патроном — «Магазин пуст»", async () => {
    const weapon = weaponFor({ magazineCur: 1, magazineMax: 10, rof_single: 1 }, { id: "bolter" });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await fire(actor, weapon);
    expect(card()).toContain("Магазин пуст");
  });

  it("оружие с ∞ в особенностях по-прежнему показывает ∞", async () => {
    const weapon = weaponFor({
      weaponClass: "heavy", weaponType: "exotic", magazineCur: 0, magazineMax: 0,
      rof_single: 1, rof_semi: 0, rof_full: 0, special: "Боезапас: ∞"
    }, { id: "eng" });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5, 5, 5, 5, 5, 5];
    await fire(actor, weapon);
    expect(card()).toContain("Магазин: <b>∞</b>");
  });
});
