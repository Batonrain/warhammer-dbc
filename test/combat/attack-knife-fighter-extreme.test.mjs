// test/combat/attack-knife-fighter-extreme.test.mjs
//
// Knife Fighter / Боец на Ножах (rogue.core.knifeFighter): «ножи, наносящие
// d10 урона, в его руках получают свойство Extreme (9)». Переброс урона от
// ножей — отдельно не сделан (нет общего примитива «переброс урона», тот же
// разрыв у Poisoner/Медик — bd wdbc-obo8v).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

const knifeFighterItem = () => ({
  id: "kf", name: "Knife Fighter / Боец на Ножах", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: "rogue.core.knifeFighter", label: "" }
  ] }] } }
});

const knife = (damage = "1d10+2") =>
  weaponFor({ weaponClass: "melee", meleeCategory: "Нож", damage }, { id: "knife-1", name: "Нож" });

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Knife Fighter: Extreme(9) на ножах, наносящих d10", () => {
  it("с Талантом — кубик урона 9 уже даёт Экстремальный урон", async () => {
    const weapon = knife("1d10+2");
    const actor = actorFor({ items: [weapon, knifeFighterItem()] });
    captured.dice = [10, 9, 3]; // атака, куб урона (9 — порог снижен до 9), доп. бросок Экстремального
    await _executeAttackRoll(actor, weapon, "ws", 45, "single", null, {});
    expect(card()).toContain('data-has-extreme="1"');
  });

  it("без Таланта — тот же кубик 9 не даёт Экстремальный урон (порог обычный, 10)", async () => {
    const weapon = knife("1d10+2");
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 9];
    await _executeAttackRoll(actor, weapon, "ws", 45, "single", null, {});
    expect(card()).toContain('data-has-extreme="0"');
  });

  it("с Талантом, но оружие не рукопашное (BS, не WS) — не считается ножом в рукопашной", async () => {
    const weapon = weaponFor({ weaponClass: "basic", damage: "1d10+2" }, { id: "rifle-1", name: "Лазган" });
    const actor = actorFor({ items: [weapon, knifeFighterItem()] });
    captured.dice = [10, 9];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});
    expect(card()).toContain('data-has-extreme="0"');
  });
});
