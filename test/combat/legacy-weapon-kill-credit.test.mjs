// test/combat/legacy-weapon-kill-credit.test.mjs
//
// Ужасающее/merciless 1-2 и Злорадство/merciless 3-4, Оружие Наследия
// (wdbc-1rno.35, стр. 428) — оба используют готовый хук
// LAST_DAMAGE_WEAPON_FLAG (module/combat/blood-flame.mjs), построенный
// раньше для Кровавого Пламени.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { registerLegacyDreadfulKill, triggerLegacyGleeOnFateSave } from "../../module/combat/legacy-weapon-kill-credit.mjs";

beforeEach(() => resetCaptured());

function ownerActor(fate = 2) {
  const updates = [];
  return {
    name: "Чемпион", system: { fate: { value: fate, max: 10 } },
    async update(data) { updates.push(data); if (data["system.fate.value"] !== undefined) this.system.fate.value = data["system.fate.value"]; },
    updates
  };
}

function weaponWith(mutationName, owner) {
  return { name: "Клинок Изгоя", system: { legacy: { mutations: [{ name: mutationName }] } }, actor: owner };
}

describe("registerLegacyDreadfulKill (Ужасающее)", () => {
  it("оружие с Мутацией, есть владелец — карточка с напоминанием о рейтинге Страха", async () => {
    const owner = ownerActor();
    const weapon = weaponWith("Ужасающее", owner);
    await registerLegacyDreadfulKill(weapon);
    const card = captured.chat.at(-1)?.content ?? "";
    expect(card).toContain("Ужасающее");
    expect(card).toContain("рейтинг Страха 1");
  });

  it("оружие без Мутации — ничего не постит", async () => {
    const owner = ownerActor();
    const weapon = weaponWith("Единство", owner);
    await registerLegacyDreadfulKill(weapon);
    expect(captured.chat.length).toBe(0);
  });

  it("нет оружия/владельца — не падает", async () => {
    await expect(registerLegacyDreadfulKill(null)).resolves.toBeUndefined();
    const weapon = weaponWith("Ужасающее", null);
    await expect(registerLegacyDreadfulKill(weapon)).resolves.toBeUndefined();
  });
});

describe("triggerLegacyGleeOnFateSave (Злорадство)", () => {
  it("жертва помечена оружием со Злорадством — владелец оружия получает +1 Очко Бесчестия", async () => {
    const owner = ownerActor(2);
    const weapon = weaponWith("Злорадство", owner);
    globalThis.fromUuid = async uuid => (uuid === "Item.weapon1" ? weapon : null);
    const victim = { getFlag: (scope, key) => (key === "lastDamageWeaponUuid" ? "Item.weapon1" : undefined) };
    await triggerLegacyGleeOnFateSave(victim);
    expect(owner.system.fate.value).toBe(3);
  });

  it("оружие без Мутации — ничего не восстанавливает", async () => {
    const owner = ownerActor(2);
    const weapon = weaponWith("Единство", owner);
    globalThis.fromUuid = async () => weapon;
    const victim = { getFlag: () => "Item.weapon1" };
    await triggerLegacyGleeOnFateSave(victim);
    expect(owner.system.fate.value).toBe(2);
  });

  it("нет флага у жертвы (не помнит, чем её ранили) — не падает", async () => {
    const victim = { getFlag: () => undefined };
    await expect(triggerLegacyGleeOnFateSave(victim)).resolves.toBeUndefined();
  });

  it("флаг есть, но не резолвится (оружие удалено) — не падает", async () => {
    globalThis.fromUuid = async () => null;
    const victim = { getFlag: () => "Item.gone" };
    await expect(triggerLegacyGleeOnFateSave(victim)).resolves.toBeUndefined();
  });
});
