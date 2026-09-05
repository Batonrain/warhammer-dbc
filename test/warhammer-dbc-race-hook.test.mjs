// test/warhammer-dbc-race-hook.test.mjs
//
// Страховка createItem в warhammer-dbc.mjs: раса/субраса, попавшая на актора
// мимо листа (макрос, скрипт, копирование), уводится в применение — но её
// ключ обязан читаться тем же правилом, что и кэш библиотеки (raceKeyOf), а
// не отдельным «system.key || ''» (Находка C1, wdbc-n1k): пустая строка на
// пути применения означает «снять расу», и раса без заполненного ключа
// стирала бы персонажа молча — тем же способом, каким это раньше делал дроп
// на лист.

import "./support/foundry-stub.mjs";

import { describe, it, expect, vi } from "vitest";
import { captured, resetCaptured } from "./support/foundry-stub.mjs";

// Наблюдаем applyItemMechanics/runAutoScripts, не полагаясь на реальные
// эффекты (Конструктор требует полноценного предмета с механикой) — контракт
// проверяется в том, ЗВАЛИ ли их, а не что именно они сделали.
const mechanicsCalls = [];
vi.mock("../module/apps/mechanics.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, applyItemMechanics: vi.fn(async item => { mechanicsCalls.push(item.id); }) };
});

const scriptCalls = [];
vi.mock("../module/apps/item-script.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, runAutoScripts: vi.fn(async item => { scriptCalls.push(item.id); }) };
});

const { handleStrayRaceItem, handleItemCreated } = await import("../warhammer-dbc.mjs");
const { SKIP_MECHANICS_HOOK } = await import("../module/apps/races.mjs");

function itemStub({ type, key, id = "doc-1", name = "Раса" }) {
  const deleted = { called: false };
  return {
    item: {
      type, id, name, system: { key },
      delete: async () => { deleted.called = true; }
    },
    deleted
  };
}

function actorStub() {
  const list = [];
  list.get = i => list.find(x => x.id === i) ?? null;
  const actor = {
    system: { characteristics: {}, skills: {}, groupSkills: {}, wounds: {} },
    items: list, updates: [],
    update: async data => { actor.updates.push(data); return data; },
    createEmbeddedDocuments: async () => [],
    deleteEmbeddedDocuments: async () => []
  };
  return actor;
}

describe("handleStrayRaceItem — страховка createItem race/subrace", () => {
  it("ключ по system.key применяется как раньше", async () => {
    resetCaptured();
    const { item, deleted } = itemStub({ type: "race", key: "astartes" });
    const actor = actorStub();

    await handleStrayRaceItem(item, actor);

    expect(deleted.called).toBe(true);
    expect(actor.updates.some(u => u["system.race"] === "astartes")).toBe(true);
    expect(captured.errors).toEqual([]);
  });

  // Тот самый сценарий Находки C1: system.key пуст, но у документа есть id —
  // раньше "" ушло бы в applyRace как команда «снять расу».
  it("пустой system.key берёт ключ по id документа, а не снимает расу", async () => {
    resetCaptured();
    const { item, deleted } = itemStub({ type: "race", key: "", id: "astartes" });
    const actor = actorStub();

    await handleStrayRaceItem(item, actor);

    // clearRace внутри applyRace пишет транзитное "" первым шагом (снимает
    // ПРЕЖНЮЮ расу) — это не баг, финальное значение перезаписывается следом
    // тем же update-вызовом, который несёт настоящий ключ.
    expect(deleted.called).toBe(true);
    const raceUpdates = actor.updates.filter(u => "system.race" in u);
    expect(raceUpdates.at(-1)["system.race"]).toBe("astartes");
  });

  it("ключ не определился вовсе — явный отказ, применение не зовётся", async () => {
    resetCaptured();
    const { item, deleted } = itemStub({ type: "race", key: "", id: "" });
    const actor = actorStub();

    await handleStrayRaceItem(item, actor);

    expect(deleted.called).toBe(true);
    expect(actor.updates).toEqual([]);
    expect(captured.errors.length).toBeGreaterThan(0);
  });
});

/**
 * Предмет-носитель расы: originGrant СТОИТ (его кладут applyRace/applySubrace
 * сами), значит страховочная ветка (handleStrayRaceItem) его не касается —
 * он доходит до общей ветки createItem-хука (runAutoScripts + applyItemMechanics).
 */
function carrierItem(actor, id) {
  return {
    id, type: "trait", name: "Носитель", parent: actor,
    getFlag: (_scope, key) => (key === "originGrant" ? "race" : undefined)
  };
}

describe("handleItemCreated — общая ветка createItem, SKIP_MECHANICS_HOOK", () => {
  it("без опции применяет и runAutoScripts, и applyItemMechanics — как раньше", async () => {
    mechanicsCalls.length = 0; scriptCalls.length = 0;
    globalThis.game.user = { id: "user-1" };
    const actor = new Actor();
    const item = carrierItem(actor, "carrier-1");

    await handleItemCreated(item, {}, "user-1");

    expect(scriptCalls).toContain("carrier-1");
    expect(mechanicsCalls).toContain("carrier-1");
  });

  // Блочная модель (mechBlocks) снята целиком — ею не был написан ни один
  // документ паков, а её редактора в Конструкторе не существовало (wdbc-20l5).
  // Проверки «хук зовёт applyMechBlocks с onGrant» и «SKIP_MECHANICS_HOOK его
  // гасит» убраны вместе с ней; тот же гейт по старой модели проверяется выше.

  // Находка второго раунда ревью (wdbc-n1k): applyRace/applySubrace уже
  // применили Механику носителя СИНХРОННО и напрямую — если этот хук
  // применит её ЕЩЁ раз, Астартес получит Черты дважды. Идемпотентность
  // applyItemMechanics тут не спасает (гонка по флагу mechanicsApplied),
  // поэтому единственный надёжный контракт — явная опция в контексте
  // создания, которую этот хук обязан уважать.
  it("с опцией SKIP_MECHANICS_HOOK применяет runAutoScripts, но НЕ applyItemMechanics", async () => {
    mechanicsCalls.length = 0; scriptCalls.length = 0;
    globalThis.game.user = { id: "user-1" };
    const actor = new Actor();
    const item = carrierItem(actor, "carrier-2");

    await handleItemCreated(item, { [SKIP_MECHANICS_HOOK]: true }, "user-1");

    expect(scriptCalls).toContain("carrier-2");
    expect(mechanicsCalls).not.toContain("carrier-2");
  });
});
