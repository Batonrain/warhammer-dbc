// test/apps/mechanics-script-cost.test.mjs
//
// wdbc-suwp: запись Конструктора kind:"script" получает те же поля цены, что
// уже несёт kind:"capability" (wdbc-1dc8) — capabilityCostPool/Amount.
// Непусто — кнопка «▶ Запустить» (runMechScriptEntry, wdbc-f4jt) ДОПОЛНИТЕЛЬНО
// гейтится доступностью пула и списывает цену ПОСЛЕ успешного выполнения кода
// (провал, как и у троттлинга, ничего не списывает). scriptAbilityRow строит
// готовую строку для панели актора «ВОЗМОЖНОСТИ СЕЙЧАС».

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { blankMechEntry, describeMechEntry, runMechScriptEntry, scriptAbilityRow } from "../../module/apps/mechanics.mjs";

function actorFor(fate = { value: 2, max: 4 }) {
  const doc = { id: "actor-1", name: "Подставной", type: "character", system: { fate, characteristics: {} } };
  doc.update = async changes => {
    for (const [path, value] of Object.entries(changes)) {
      const keys = path.split(".");
      let node = doc;
      for (const key of keys.slice(0, -1)) node = (node[key] ??= {});
      node[keys.at(-1)] = value;
    }
    return doc;
  };
  return doc;
}

function itemWithScript(entry, actor = null) {
  const store = { "warhammer-dbc.mechanics": [{ id: "g1", operator: "AND", entries: [entry] }] };
  return {
    name: "Тестовый предмет", actor,
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; return value; }
  };
}

afterEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
  globalThis.game.time = undefined;
});

describe("blankMechEntry(\"script\") — те же поля цены, что у capability", () => {
  it("без цены по умолчанию", () => {
    const e = blankMechEntry("script");
    expect(e.capabilityCostPool).toBe("");
    expect(e.capabilityCostAmount).toBe(1);
  });
});

describe("describeMechEntry — script с ценой", () => {
  it("без цены — как раньше, без суффикса", () => {
    const e = { ...blankMechEntry("script"), label: "Клинок", code: "1;" };
    expect(describeMechEntry(e)).not.toContain("цена");
  });

  it("с ценой — суффикс «— цена: N Очко(-а/-ов) <Пула>»", () => {
    const e = { ...blankMechEntry("script"), label: "Клинок", code: "1;",
      capabilityCostPool: "infamy", capabilityCostAmount: 2 };
    expect(describeMechEntry(e)).toContain("— цена: 2 Очка Бесчестия");
  });
});

describe("runMechScriptEntry — цена в пуле", () => {
  it("хватает в пуле: код выполняется, цена списывается ПОСЛЕ успеха", async () => {
    const actor = actorFor({ value: 2, max: 4 });
    const item = itemWithScript({
      id: "e1", kind: "script", label: "Дар", code: 'await item.setFlag("test","ran",true);',
      capabilityCostPool: "infamy", capabilityCostAmount: 1
    }, actor);
    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "ran")).toBe(true);
    expect(actor.system.fate.value).toBe(1);
    expect(captured.chat).toHaveLength(1);
  });

  it("не хватает в пуле: код НЕ выполняется, предупреждение, ничего не списано", async () => {
    const actor = actorFor({ value: 0, max: 4 });
    const item = itemWithScript({
      id: "e1", kind: "script", label: "Дар", code: 'await item.setFlag("test","ran",true);',
      capabilityCostPool: "infamy", capabilityCostAmount: 1
    }, actor);
    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "ran")).toBeUndefined();
    expect(actor.system.fate.value).toBe(0);
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat).toHaveLength(0);
  });

  it("нет актора-владельца: код НЕ выполняется, предупреждение", async () => {
    const item = itemWithScript({
      id: "e1", kind: "script", label: "Дар", code: 'await item.setFlag("test","ran",true);',
      capabilityCostPool: "infamy", capabilityCostAmount: 1
    }, null);
    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "ran")).toBeUndefined();
    expect(captured.warnings.length).toBe(1);
  });

  it("код бросает исключение — цена НЕ списывается (провал не должен запирать пул)", async () => {
    const actor = actorFor({ value: 2, max: 4 });
    const item = itemWithScript({
      id: "e1", kind: "script", label: "Дар", code: 'throw new Error("бум");',
      capabilityCostPool: "infamy", capabilityCostAmount: 1
    }, actor);
    await runMechScriptEntry(item, "g1", "e1");
    expect(captured.errors.length).toBe(1);
    expect(actor.system.fate.value).toBe(2);
    expect(captured.chat).toHaveLength(0);
  });

  it("троттлинг блокирует раньше цены: занятая частота не даёт списать пул", async () => {
    globalThis.game.combat = { round: 1 };
    const actor = actorFor({ value: 2, max: 4 });
    const entry = {
      id: "e1", kind: "script", label: "Дар", code: 'await item.setFlag("test","count",(item.getFlag("test","count")||0)+1);',
      scriptThrottleUnit: "round", capabilityCostPool: "infamy", capabilityCostAmount: 1
    };
    const item = itemWithScript(entry, actor);
    await runMechScriptEntry(item, "g1", "e1");
    expect(item.getFlag("test", "count")).toBe(1);
    expect(actor.system.fate.value).toBe(1);

    await runMechScriptEntry(item, "g1", "e1"); // тот же Раунд — блокируется троттлингом
    expect(item.getFlag("test", "count")).toBe(1);
    expect(actor.system.fate.value).toBe(1); // цена НЕ списана второй раз
    expect(captured.warnings.length).toBe(1);
  });
});

describe("scriptAbilityRow — строка для панели актора «ВОЗМОЖНОСТИ СЕЙЧАС»", () => {
  it("не script / не найдена запись — null", () => {
    const item = itemWithScript({ id: "e1", kind: "characteristic" });
    expect(scriptAbilityRow(item, "g1", "e1")).toBeNull();
    expect(scriptAbilityRow(item, "g1", "нет-такой")).toBeNull();
    expect(scriptAbilityRow(null, "g1", "e1")).toBeNull();
  });

  it("готовая запись без цены — ready:true, costLabel пуст", () => {
    globalThis.game.combat = { round: 1 };
    const item = itemWithScript({
      id: "e1", kind: "script", label: "Кровавый Клинок", code: "1;", scriptThrottleUnit: "round"
    });
    const row = scriptAbilityRow(item, "g1", "e1");
    expect(row.label).toBe("Кровавый Клинок");
    expect(row.ready).toBe(true);
    expect(row.costLabel).toBe("");
  });

  it("запись с ценой — costLabel заполнен, ready учитывает пул актора", () => {
    const actor = actorFor({ value: 0, max: 4 });
    const item = itemWithScript({
      id: "e1", kind: "script", label: "Дар", code: "1;",
      capabilityCostPool: "infamy", capabilityCostAmount: 1
    }, actor);
    const row = scriptAbilityRow(item, "g1", "e1");
    expect(row.costLabel).toBe("1 Очко Бесчестия");
    expect(row.ready).toBe(false); // пул пуст
  });
});
