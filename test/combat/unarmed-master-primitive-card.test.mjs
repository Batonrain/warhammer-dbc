import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { resolveWeaponPropsList, visibleWeaponProps } from "../../module/combat/weapon-properties.mjs";

const MASTER = { id: "um", name: "Unarmed Master / Безоружный Мастер", type: "talent", system: {} };

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

function fist(integral) {
  const w = weaponFor({
    weaponClass: "melee", equipped: true, damage: "1d5-3", damageType: "impact",
    weaponProps: [{ key: "primitive" }]
  }, { id: "fist", name: "Кулак" });
  w.getFlag = (scope, key) => (integral && scope === "warhammer-dbc" && key === "integralAttack") ? true : undefined;
  return w;
}

async function strike(items, weapon) {
  const actor = actorFor({ items: [weapon, ...items] });
  actor.getFlag = () => undefined;
  captured.dice = [10, 3];
  await _executeAttackRoll(actor, weapon, "ws", 60, "single", null, {});
  return card();
}

describe("Безоружный Мастер: карточка не называет снятое Примитивное", () => {
  it("с Талантом на интегральном Кулаке строки Примитивное нет, расчёт data-primitive=0", async () => {
    const html = await strike([MASTER], fist(true));
    expect(html).not.toContain("Примитивное");
    expect(html).toContain('data-primitive="0"');
  });

  it("без Таланта Примитивное остаётся и в тексте, и в расчёте", async () => {
    const html = await strike([], fist(true));
    expect(html).toContain("Примитивное");
    expect(html).toContain('data-primitive="1"');
  });
});

describe("visibleWeaponProps", () => {
  const props = resolveWeaponPropsList([{ key: "primitive" }, { key: "reinforced" }]);

  it("wp.primitive истинно — список как есть", () => {
    expect(visibleWeaponProps(props, { primitive: true })).toHaveLength(2);
  });

  it("wp.primitive снято — Примитивное убрано, остальное на месте", () => {
    const out = visibleWeaponProps(props, { primitive: false });
    expect(out.map(p => p.def.key)).toEqual(["reinforced"]);
  });
});
