import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { hasInfiniteMagazine, ammoIsFree } from "../../module/rules/ammo-free.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

const INF_SPECIAL = "Боезапас: ∞ (энергия/подача)";

function engine(system = {}) {
  return weaponFor({
    weaponClass: "heavy", weaponType: "exotic", magazineCur: 0, magazineMax: 0,
    rof_single: 1, rof_semi: 0, rof_full: 0, special: INF_SPECIAL, ...system
  }, { id: "eng", name: "Twin Irradiation Engine" });
}

describe("hasInfiniteMagazine: ∞ отличается от «0 патронов»", () => {
  it("magazineMax 0 и ∞ в особенностях — бесконечный", () => {
    expect(hasInfiniteMagazine(engine())).toBe(true);
    expect(hasInfiniteMagazine(engine({ special: "Обойма ∞." }))).toBe(true);
    expect(hasInfiniteMagazine(engine({ special: "E(Fl); ∞." }))).toBe(true);
  });

  it("без ∞ в особенностях, или с магазином, или Pen∞ — нет", () => {
    expect(hasInfiniteMagazine(engine({ special: "" }))).toBe(false);
    expect(hasInfiniteMagazine(engine({ magazineMax: 10, magazineCur: 0 }))).toBe(false);
    expect(hasInfiniteMagazine(engine({ special: "Pen∞" }))).toBe(false);
  });

  it("ammoIsFree опознаёт бесконечный магазин", () => {
    expect(ammoIsFree(engine(), actorFor({}))).toBe(true);
    expect(ammoIsFree(engine({ special: "" }), actorFor({}))).toBe(false);
  });
});

describe("карточка атаки: Боезапас ∞", () => {
  it("не пишет «Магазин пуст» и показывает ∞ вместо 0/0", async () => {
    const weapon = engine();
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 60, "single", null, {});
    expect(card()).not.toContain("Магазин пуст");
    expect(card()).not.toContain("0/0");
    expect(card()).toContain("Магазин: <b>∞</b>");
  });

  it("обычное оружие с опустевшим магазином по-прежнему предупреждает", async () => {
    const weapon = weaponFor({ magazineCur: 1, magazineMax: 10, rof_single: 1 }, { id: "bolter" });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5];
    await _executeAttackRoll(actor, weapon, "bs", 60, "single", null, {});
    expect(card()).toContain("Магазин пуст");
  });
});

describe("окно атаки: Боезапас ∞", () => {
  it("показывает ∞ и не красит как пустой", () => {
    const weapon = engine();
    const actor = actorFor({ items: [weapon] });
    actor.getFlag = () => undefined;
    showAttackDialog(actor, weapon);
    const html = captured.dialog.content;
    expect(html).toContain("Магазин: <b>∞</b>");
    expect(html).not.toContain("ammo-empty");
  });
});
