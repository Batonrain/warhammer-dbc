// test/combat/attack-bolter-drill.test.mjs
//
// Bolter Drill / Болтерная Муштра (weaponsmith.core.bolterDrill): «Успешные
// тесты персонажа на стрельбу Болт оружием получают +1 Успех.» Прибавляется
// к СТЕПЕНИ (deg), тот же приём, что Наследие Излишеств/Savage — наблюдаем
// через число попаданий Длинной очереди (rofMode "full": count = min(deg, rof_full)).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const hitCount = () => [...card().matchAll(/roll-hit-idx/g)].length;

const bolterDrillItem = () => ({
  id: "bd", name: "Bolter Drill / Болтерная Муштра", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: "weaponsmith.core.bolterDrill", label: "" }
  ] }] } }
});

const boltWeapon = () => weaponFor({ weaponType: "bolt", rof_full: 4 });

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Bolter Drill: +1 Успех на стрельбу Болт оружием", () => {
  it("с Талантом — deg 2→3, третье попадание появляется (count = min(deg, rof_full))", async () => {
    const weapon = boltWeapon();
    const actor = actorFor({ items: [weapon, bolterDrillItem()] });
    captured.dice = [35, 3, 3, 3]; // атака (deg 2+1=3), 3× урон
    await _executeAttackRoll(actor, weapon, "bs", 50, "full", null, {});
    expect(hitCount()).toBe(3);
  });

  it("без Таланта — тот же бросок, deg 2, только два попадания", async () => {
    const weapon = boltWeapon();
    const actor = actorFor({ items: [weapon] });
    captured.dice = [35, 3, 3];
    await _executeAttackRoll(actor, weapon, "bs", 50, "full", null, {});
    expect(hitCount()).toBe(2);
  });

  it("с Талантом, но оружие не Болт — бонус не применяется", async () => {
    const weapon = weaponFor({ weaponType: "las", rof_full: 4 });
    const actor = actorFor({ items: [weapon, bolterDrillItem()] });
    captured.dice = [35, 3, 3];
    await _executeAttackRoll(actor, weapon, "bs", 50, "full", null, {});
    expect(hitCount()).toBe(2);
  });
});
