// test/apps/burned-senses.test.mjs
//
// Burned Senses / Выжженные Чувства (wdbc-1rno) — resolveBurnedSenses:
// второй бросок, перманентная потеря Зрения/Слуха (реальное условие),
// честный нарратив для остального, случай «одинаковые чувства», защита от
// повторного применения.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { resolveBurnedSenses } from "../../module/apps/burned-senses.mjs";

function makeActor() {
  const actor = {
    name: "Подставной",
    system: { conditions: {} },
    update: async data => {
      for (const [path, v] of Object.entries(data)) {
        const parts = path.split(".");
        let node = actor;
        for (const p of parts.slice(0, -1)) node = (node[p] ??= {});
        node[parts.at(-1)] = v;
      }
    }
  };
  return actor;
}

function makeItem(submutationName = "") {
  const flags = {};
  return {
    system: { submutation: { name: submutationName } },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; }
  };
}

beforeEach(resetCaptured);

describe("resolveBurnedSenses", () => {
  it("первая субмутация ещё не брошена — ok:false, честная причина", async () => {
    const res = await resolveBurnedSenses(makeActor(), makeItem(""));
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("не брошена");
  });

  it("уже применено — второй раз ok:false", async () => {
    const item = makeItem("Зрение");
    await item.setFlag("warhammer-dbc", "burnedSensesResolved", true);
    const res = await resolveBurnedSenses(makeActor(), item);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("Уже применено");
  });

  it("теряет Зрение (первый бросок), второй бросок — Слух: применяет blinded, честный нарратив про усиление", async () => {
    const actor = makeActor();
    const item = makeItem("Зрение");
    captured.dice = [4]; // 1d10 → 4 → Слух
    const res = await resolveBurnedSenses(actor, item);

    expect(res.ok).toBe(true);
    expect(actor.system.conditions.blinded).toBe(true);
    expect(item.getFlag("warhammer-dbc", "burnedSensesResolved")).toBe(true);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Теряет: <b>Зрение</b>");
    expect(card).toContain("Усиливает: <b>Слух</b>");
    expect(card).toContain("перманентно наложено");
    expect(card).toContain("не подключить ни к одному чувству");
  });

  it("теряет Слух — применяет deafened", async () => {
    const actor = makeActor();
    const item = makeItem("Слух");
    captured.dice = [1]; // → Зрение
    await resolveBurnedSenses(actor, item);

    expect(actor.system.conditions.deafened).toBe(true);
    expect(actor.system.conditions.blinded).toBeUndefined();
  });

  it("теряет Нюх — нет условия в системе, чат честно называет это отыгрышем", async () => {
    const actor = makeActor();
    const item = makeItem("Нюх");
    captured.dice = [9]; // → Вкус
    const res = await resolveBurnedSenses(actor, item);

    expect(res.ok).toBe(true);
    expect(actor.system.conditions.blinded).toBeUndefined();
    expect(actor.system.conditions.deafened).toBeUndefined();
    expect(captured.chat.at(-1).content).toContain("механики этой потери в системе нет");
  });

  it("одинаковые чувства (оба Зрение) — условие НЕ применяется, чат объясняет решение ГМа", async () => {
    const actor = makeActor();
    const item = makeItem("Зрение");
    captured.dice = [1]; // тоже Зрение
    const res = await resolveBurnedSenses(actor, item);

    expect(res.ok).toBe(true);
    expect(actor.system.conditions.blinded).toBeUndefined();
    const card = captured.chat.at(-1).content;
    expect(card).toContain("возвращается слегка");
    expect(card).toContain("решение ГМа");
  });
});
