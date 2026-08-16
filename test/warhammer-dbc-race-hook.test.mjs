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

import { describe, it, expect } from "vitest";
import { captured, resetCaptured } from "./support/foundry-stub.mjs";

const { handleStrayRaceItem } = await import("../warhammer-dbc.mjs");

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
