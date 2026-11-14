// test/combat/power-field-both-ways.test.mjs
// Силовое Поле (книга): «когда им успешно парируют оружие без этого свойства,
// ИЛИ его парируют оружием без этого свойства — 1d100, на 1–75 второе оружие
// уничтожается». Независимое оружие: парирование силовым полем на разрушение
// не бросается (удары в торс и плечи сбивают прицел).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, char } from "../support/combat-fixtures.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { _performParry } from "../../module/combat/defense.mjs";

const DEFAULT_SOURCES = getRuleSources();

function defender(weaponProps = []) {
  const w = weaponFor({ weaponClass: "melee", balance: 0, equipped: true, damage: "1d10", weaponProps }, { id: "sword", name: "Меч" });
  w.type = "weapon";
  const a = actorFor({ skills: { parry: { rank: "expert" } }, items: [w] });
  const store = {};
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  a.update = async () => {};
  a.items.contents = a.items;
  return a;
}
const atkActor = () => ({ uuid: "Actor.attacker-1", name: "Атакующий", system: { characteristics: { s: char(40) } } });
const atkWeapon = (weaponProps) =>
  ({ type: "weapon", uuid: "Item.attacker-weapon", system: { damage: "1d10+3", damageType: "energy", weaponProps } });

function wire(a, w) {
  globalThis.fromUuid = async uuid => (uuid === a.uuid ? a : uuid === w.uuid ? w : null);
}

beforeEach(() => { resetCaptured(); globalThis.game.combat = undefined; });
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
});

describe("Силовое Поле у АТАКУЮЩЕГО, парирует обычное оружие", () => {
  it("1–75 — парирующее оружие уничтожено", async () => {
    const a = atkActor(), w = atkWeapon([{ key: "powerField" }]); wire(a, w);
    captured.dice = [10, 5]; // успех Парирования; 5 — уничтожено
    await _performParry(defender(), { attackerUuid: a.uuid, attackerWeaponUuid: w.uuid });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("парирующее оружие «Меч»");
    expect(card).toContain("уничтожено");
  });

  it("76+ — оружие уцелело", async () => {
    const a = atkActor(), w = atkWeapon([{ key: "powerField" }]); wire(a, w);
    captured.dice = [10, 90];
    await _performParry(defender(), { attackerUuid: a.uuid, attackerWeaponUuid: w.uuid });
    expect(captured.chat.at(-1).content).toContain("парирующее оружие уцелело");
  });

  it("Укреплённое парирующее оружие не страдает — броска нет", async () => {
    const a = atkActor(), w = atkWeapon([{ key: "powerField" }]); wire(a, w);
    captured.dice = [10];
    await _performParry(defender([{ key: "reinforced" }]), { attackerUuid: a.uuid, attackerWeaponUuid: w.uuid });
    expect(captured.chat.at(-1).content).not.toContain("парирующее оружие");
  });

  it("у атакующего нет Силового Поля — блока нет", async () => {
    const a = atkActor(), w = atkWeapon([]); wire(a, w);
    captured.dice = [10];
    await _performParry(defender(), { attackerUuid: a.uuid, attackerWeaponUuid: w.uuid });
    expect(captured.chat.at(-1).content).not.toContain("парирующее оружие");
  });
});

describe("Независимое оружие против Силового Поля парирующего", () => {
  it("бросок на уничтожение не делается", async () => {
    const a = atkActor(), w = atkWeapon([{ key: "independent" }]); wire(a, w);
    captured.dice = [10];
    await _performParry(defender([{ key: "powerField" }]), { attackerUuid: a.uuid, attackerWeaponUuid: w.uuid });
    expect(captured.chat.at(-1).content).not.toContain("Силовое поле — бросок");
  });

  it("обычное оружие против Силового Поля — бросок есть", async () => {
    const a = atkActor(), w = atkWeapon([]); wire(a, w);
    captured.dice = [10, 5];
    await _performParry(defender([{ key: "powerField" }]), { attackerUuid: a.uuid, attackerWeaponUuid: w.uuid });
    expect(captured.chat.at(-1).content).toContain("Силовое поле — бросок");
  });
});
