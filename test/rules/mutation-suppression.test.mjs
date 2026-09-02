// test/rules/mutation-suppression.test.mjs
//
// module/rules/mutation-suppression.mjs (wdbc-1rno, Pure Form/Чистая Форма) —
// ставит/снимает flags.warhammer-dbc.suppressed на КАЖДОЙ Мутации/Даре актора
// (кроме источника) и зовёт переданные функции пересинхронизации (dependency
// injection — сам модуль ничего не импортирует из apps/, см. его шапку).

import { describe, it, expect } from "vitest";
import { setMutationsSuppressed, anyMutationSuppressed } from "../../module/rules/mutation-suppression.mjs";

function mutationItem(id, { suppressed = false } = {}) {
  const flags = { suppressed };
  return {
    id, name: `Мутация-${id}`, type: "mutation",
    getFlag: (scope, key) => (scope === "warhammer-dbc" ? flags[key] : undefined),
    setFlag: async (scope, key, value) => { if (scope === "warhammer-dbc") flags[key] = value; }
  };
}

function actorWith(items) {
  const list = [...items];
  for (const item of list) item.parent = undefined; // sourceItem.parent проставляется в тесте отдельно
  return { items: list };
}

function spySyncFns() {
  const calls = { syncItemEffectsDisabled: [], syncWeaponPropItemEffects: [], syncGrantedAbilities: [], syncGrantedEquipment: [] };
  return {
    calls,
    syncItemEffectsDisabled: async item => calls.syncItemEffectsDisabled.push(item.id),
    syncWeaponPropItemEffects: async item => calls.syncWeaponPropItemEffects.push(item.id),
    syncGrantedAbilities: async item => calls.syncGrantedAbilities.push(item.id),
    syncGrantedEquipment: async item => calls.syncGrantedEquipment.push(item.id)
  };
}

describe("setMutationsSuppressed", () => {
  it("подавляет все Мутации/Дары актора, кроме источника", async () => {
    const source = mutationItem("pureForm");
    const other1 = mutationItem("m1");
    const other2 = mutationItem("m2");
    const actor = actorWith([source, other1, other2]);
    source.parent = actor;

    const fns = spySyncFns();
    const affected = await setMutationsSuppressed(source, true, fns);

    expect(affected.sort()).toEqual(["Мутация-m1", "Мутация-m2"].sort());
    expect(other1.getFlag("warhammer-dbc", "suppressed")).toBe(true);
    expect(other2.getFlag("warhammer-dbc", "suppressed")).toBe(true);
    expect(source.getFlag("warhammer-dbc", "suppressed")).toBe(false); // источник не трогается
    expect(fns.calls.syncGrantedAbilities.sort()).toEqual(["m1", "m2"].sort());
    expect(fns.calls.syncGrantedEquipment.sort()).toEqual(["m1", "m2"].sort());
  });

  it("вызывает синхронизацию в правильном порядке: эффекты/оружие → выданные Черты → выданные предметы", async () => {
    const source = mutationItem("pureForm");
    const other = mutationItem("m1");
    const actor = actorWith([source, other]);
    source.parent = actor;

    const order = [];
    const fns = {
      syncItemEffectsDisabled: async () => order.push("effects"),
      syncWeaponPropItemEffects: async () => order.push("weaponProp"),
      syncGrantedAbilities: async () => order.push("abilities"),
      syncGrantedEquipment: async () => order.push("equipment")
    };
    await setMutationsSuppressed(source, true, fns);
    expect(order).toEqual(["effects", "weaponProp", "abilities", "equipment"]);
  });

  it("уже в нужном состоянии — не трогает и не считает затронутым", async () => {
    const source = mutationItem("pureForm");
    const already = mutationItem("m1", { suppressed: true });
    const actor = actorWith([source, already]);
    source.parent = actor;

    const fns = spySyncFns();
    const affected = await setMutationsSuppressed(source, true, fns);

    expect(affected).toEqual([]);
    expect(fns.calls.syncGrantedAbilities).toEqual([]);
  });

  it("suppressed:false возвращает подавленные Мутации обратно", async () => {
    const source = mutationItem("pureForm");
    const other = mutationItem("m1", { suppressed: true });
    const actor = actorWith([source, other]);
    source.parent = actor;

    const fns = spySyncFns();
    const affected = await setMutationsSuppressed(source, false, fns);

    expect(affected).toEqual(["Мутация-m1"]);
    expect(other.getFlag("warhammer-dbc", "suppressed")).toBe(false);
  });

  it("не Мутации на акторе не трогает", async () => {
    const source = mutationItem("pureForm");
    const trait = { id: "t1", name: "Трейт", type: "trait", getFlag: () => undefined, setFlag: async () => {} };
    const actor = actorWith([source, trait]);
    source.parent = actor;

    const fns = spySyncFns();
    const affected = await setMutationsSuppressed(source, true, fns);
    expect(affected).toEqual([]);
  });

  it("нет актора (sourceItem.parent пуст) — пустой результат, не падает", async () => {
    const source = mutationItem("pureForm");
    const fns = spySyncFns();
    expect(await setMutationsSuppressed(source, true, fns)).toEqual([]);
  });
});

describe("anyMutationSuppressed", () => {
  it("true, если хоть одна Мутация подавлена", () => {
    const actor = actorWith([mutationItem("m1"), mutationItem("m2", { suppressed: true })]);
    expect(anyMutationSuppressed(actor)).toBe(true);
  });

  it("false, если ни одна не подавлена", () => {
    const actor = actorWith([mutationItem("m1"), mutationItem("m2")]);
    expect(anyMutationSuppressed(actor)).toBe(false);
  });

  it("нет актора — false, не падает", () => {
    expect(anyMutationSuppressed(null)).toBe(false);
  });
});
