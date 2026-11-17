// Sahara 5-5134: +5 к WS/BS Чемпиона-Терминатора (запись ИЛИ-выбора с
// when.predicates.wearsTerminatorArmour) не гасли при снятии брони: эффект
// создаёт диалог выдачи, пересборка Механики ИЛИ-ветки не трогает, а смена
// system.equipped у брони эффекты архетипа не пересверяла.
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { syncWhenGatedEffects, syncItemEffectsDisabled } from "../../module/apps/effects.mjs";

const armour = (equipped) => ({ type: "armor", name: "Terminator Aegis / Терминатор Эгида", system: { equipped }, effects: [] });

function archetype(actor) {
  const fx = { id: "fx1", disabled: false, getFlag: (_s, k) => (k === "mechEntry" ? "eaC10" : undefined) };
  const mechanics = [{ id: "g", operator: "OR", entries: [
    { id: "eaC10", kind: "characteristic", charKey: "ws", field: "value", op: "add", value: 5,
      when: { predicates: { wearsTerminatorArmour: true } } }
  ] }];
  const item = {
    id: "arch", type: "eliteArchetype", name: "Чемпион-Терминатор", system: {}, parent: actor,
    effects: [fx], getFlag: (_s, k) => (k === "mechanics" ? mechanics : undefined),
    async updateEmbeddedDocuments(_t, ups) { for (const u of ups) item.effects.find(e => e.id === u._id).disabled = u.disabled; }
  };
  return item;
}

describe("эффекты записей с «Когда» следуют за состоянием актора", () => {
  it("снял Терминаторскую броню — эффект выключается, надел — включается", async () => {
    const actor = new Actor();
    const arm = armour(true);
    actor.items = [arm];
    const arch = archetype(actor);
    actor.items.push(arch);

    await syncWhenGatedEffects(actor);
    expect(arch.effects[0].disabled).toBe(false);

    arm.system.equipped = false;
    await syncWhenGatedEffects(actor);
    expect(arch.effects[0].disabled).toBe(true);

    arm.system.equipped = true;
    await syncWhenGatedEffects(actor);
    expect(arch.effects[0].disabled).toBe(false);
  });

  it("общая сверка disabled тоже не включает эффект, чьё «Когда» не выполнено", async () => {
    const actor = new Actor();
    actor.items = [armour(false)];
    const arch = archetype(actor);
    await syncItemEffectsDisabled(arch);
    expect(arch.effects[0].disabled).toBe(true);
  });
});
