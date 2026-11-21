// test/rules/resource-pools.test.mjs
//
// Пулы ресурсов элитных архетипов (rules/resource-pools.mjs): Жажда Вампира,
// Очки Вдохновения Когитора, Очки Мести Ревенанта. Пул задают записи
// Конструктора kind:"resourcePool" — Черта даёт базу, Стадии Пакта прибавки.
// Сверка с таблицами Стадий из книги — по самим паковым JSON.

import "../support/foundry-stub.mjs";
import { captured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  resourcePoolDefs, resourcePoolValue, resourceSpendGate, resourceSpendUpdates,
  resourceGainUpdates, resourceRefillUpdates, refillMatches, infamyResourceOptions,
  resourceBoostOptions, resourceFailSuccessOptions, resourceKeyOfCost, resourceAmountLabel,
  resourcePoolsView
} from "../../module/rules/resource-pools.mjs";
import { capabilityCostLabel, capabilityCostGate, spendCapabilityCost } from "../../module/combat/capability-cost.mjs";

const entry = over => ({ kind: "resourcePool", ...over });
const itemWith = (name, entries, operator = "AND") => ({
  name, type: "talent", flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator, entries }] } }
});

function actorWith(items, { pools = {}, flags = {} } = {}) {
  const doc = {
    id: "a1", uuid: "Actor.a1", name: "Подставной", type: "character", items,
    system: { resourcePools: { ...pools }, characteristics: { wp: { bonus: 4 } } },
    flags: { "warhammer-dbc": { ...flags } }
  };
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

const thirstTrait = itemWith("Жажда", [entry({
  resPoolKey: "thirst", resPoolLabel: "Жажда", resPoolMax: "6", resPoolRoundCap: "2",
  resPoolAsInfamy: true, resPoolAsInfamyCap: "2", resPoolAsInfamyCor: "19", resPoolGainAmount: "1"
})]);
const stage = (n, over) => itemWith(`Стадия ${n}`, [entry({ resPoolKey: "thirst", ...over })]);

beforeEach(() => { captured.chat = []; captured.warnings = []; });

describe("resourcePoolDefs — записи складываются по ключу", () => {
  it("Черта задаёт пул, Стадии прибавляют максимум и лимиты", () => {
    const a = actorWith([thirstTrait, stage(1, { resPoolMax: "3", resPoolRoundCap: "1", resPoolAsInfamyCap: "1", resPoolGainAmount: "1" })]);
    const d = resourcePoolDefs(a).get("thirst");
    expect(d.label).toBe("Жажда");
    expect(d.max).toBe(9);
    expect(d.roundCap).toBe(3);
    expect(d.asInfamyCap).toBe(3);
    expect(d.gainAmount).toBe(2);
    expect(d.asInfamy).toBe(true);
    expect(d.asInfamyCor).toBe(19);
  });

  it("формула Механики в максимуме: wp — Бонус Воли", () => {
    const a = actorWith([itemWith("X", [entry({ resPoolKey: "x", resPoolMax: "wp*2" })])]);
    expect(resourcePoolDefs(a).get("x").max).toBe(8);
  });

  it("пул без положительного максимума и запись без ключа не видны; ветка «ИЛИ» не читается", () => {
    const a = actorWith([
      itemWith("A", [entry({ resPoolKey: "thirst", resPoolMax: "0" })]),
      itemWith("B", [entry({ resPoolKey: "", resPoolMax: "5" })]),
      itemWith("C", [entry({ resPoolKey: "vengeance", resPoolMax: "3" })], "OR")
    ]);
    expect(resourcePoolDefs(a).size).toBe(0);
  });

  it("вложенная подгруппа читается", () => {
    const a = actorWith([itemWith("A", [{ kind: "group", group: { id: "n", operator: "AND", entries: [entry({ resPoolKey: "vengeance", resPoolMax: "3" })] } }])]);
    expect(resourcePoolDefs(a).get("vengeance").max).toBe(3);
  });
});

describe("значение, трата и лимит за Раунд", () => {
  it("значение прижато к максимуму", () => {
    const a = actorWith([thirstTrait], { pools: { thirst: 40 } });
    expect(resourcePoolValue(a, "thirst")).toBe(6);
  });

  it("не хватает — гейт закрыт с причиной", () => {
    const a = actorWith([thirstTrait], { pools: { thirst: 1 } });
    const g = resourceSpendGate(a, "thirst", 2);
    expect(g.ok).toBe(false);
    expect(g.reason).toMatch(/Не хватает/);
  });

  it("лимит 2 Жажды за Раунд — только в бою; вне боя лимита нет", () => {
    const a = actorWith([thirstTrait], { pools: { thirst: 6 } });
    expect(resourceSpendGate(a, "thirst", 3).ok).toBe(true);
    expect(resourceSpendGate(a, "thirst", 3, { roundKey: "c1:1" }).ok).toBe(false);
    const { update, after } = resourceSpendUpdates(a, "thirst", 2, { roundKey: "c1:1" });
    expect(after).toBe(4);
    expect(update["system.resourcePools.thirst"]).toBe(4);
    expect(update["flags.warhammer-dbc.resourcePoolRound.thirst"]).toEqual({ combat: "c1:1", spent: 2, asInfamy: 0 });
  });

  it("счётчик Раунда сбрасывается новым Раундом", async () => {
    const a = actorWith([thirstTrait], { pools: { thirst: 6 } });
    await a.update(resourceSpendUpdates(a, "thirst", 2, { roundKey: "c1:1" }).update);
    expect(resourceSpendGate(a, "thirst", 1, { roundKey: "c1:1" }).ok).toBe(false);
    expect(resourceSpendGate(a, "thirst", 1, { roundKey: "c1:2" }).ok).toBe(true);
  });

  it("«как Очки Бесчестия» — свой лимит за Раунд", async () => {
    const a = actorWith([itemWith("T", [entry({ resPoolKey: "thirst", resPoolMax: "10", resPoolRoundCap: "5", resPoolAsInfamy: true, resPoolAsInfamyCap: "1" })])], { pools: { thirst: 10 } });
    await a.update(resourceSpendUpdates(a, "thirst", 1, { roundKey: "c:1", asInfamy: true }).update);
    expect(resourceSpendGate(a, "thirst", 1, { roundKey: "c:1", asInfamy: true }).ok).toBe(false);
    expect(resourceSpendGate(a, "thirst", 1, { roundKey: "c:1" }).ok).toBe(true);
  });

  it("пополнение не выше максимума", () => {
    const a = actorWith([thirstTrait], { pools: { thirst: 5 } });
    expect(resourceGainUpdates(a, "thirst", 3).after).toBe(6);
  });
});

describe("восполнение по событию", () => {
  it("battleOrScene срабатывает на бой и сцену, scene — ещё и на конец сессии", () => {
    expect(refillMatches("battleOrScene", "battle")).toBe(true);
    expect(refillMatches("battleOrScene", "scene")).toBe(true);
    expect(refillMatches("scene", "session")).toBe(true);
    expect(refillMatches("battle", "scene")).toBe(false);
    expect(refillMatches("", "battle")).toBe(false);
  });

  it("Очки Мести до максимума в начале боя, Жажда не трогается", () => {
    const a = actorWith([
      thirstTrait,
      itemWith("Дух", [entry({ resPoolKey: "vengeance", resPoolLabel: "Очки Мести", resPoolMax: "3", resPoolRefill: "battleOrScene" })])
    ], { pools: { thirst: 1, vengeance: 0 } });
    const { update, filled } = resourceRefillUpdates(a, "battle");
    expect(update).toEqual({ "system.resourcePools.vengeance": 3 });
    expect(filled.map(f => f.key)).toEqual(["vengeance"]);
  });
});

describe("траты вместо Очка Бесчестия, +10, провал → Успех", () => {
  it("Жажда платит за способность с порогом Порчи до 19, но не выше", () => {
    const a = actorWith([thirstTrait], { pools: { thirst: 2 } });
    expect(infamyResourceOptions(a, { corThreshold: 0 }).map(d => d.key)).toEqual(["thirst"]);
    expect(infamyResourceOptions(a, { corThreshold: 40 })).toEqual([]);
  });

  it("пустой пул не предлагается", () => {
    const a = actorWith([thirstTrait], { pools: { thirst: 0 } });
    expect(infamyResourceOptions(a)).toEqual([]);
  });

  it("Вдохновение: +10 и провал → Успех только для I и W", () => {
    const a = actorWith([itemWith("ИВ", [entry({ resPoolKey: "inspiration", resPoolMax: "4", resPoolBoostChars: "int, wp", resPoolFailChars: "int,wp" })])]);
    expect(resourceBoostOptions(a, "wp").map(d => d.key)).toEqual(["inspiration"]);
    expect(resourceBoostOptions(a, "s")).toEqual([]);
    expect(resourceFailSuccessOptions(a, "INT").map(d => d.key)).toEqual(["inspiration"]);
  });
});

describe("подписи и лист", () => {
  it("ключ цены и количество", () => {
    expect(resourceKeyOfCost("res:thirst")).toBe("thirst");
    expect(resourceKeyOfCost("infamy")).toBe(null);
    expect(resourceAmountLabel("thirst", 3)).toBe("3 Жажды");
    expect(resourceAmountLabel("vengeance", 1)).toBe("1 Очко Мести");
    expect(resourceAmountLabel("inspiration", 2)).toBe("2 Очка Вдохновения");
  });

  it("строка листа: значение, максимум, пояснение", () => {
    const a = actorWith([thirstTrait], { pools: { thirst: 3 } });
    const [row] = resourcePoolsView(a);
    expect(row).toMatchObject({ key: "thirst", label: "Жажда", value: 3, max: 6 });
    expect(row.note).toMatch(/2 Жажды за Раунд/);
    expect(row.note).toMatch(/Очки Бесчестия/);
  });
});

describe("цена res:<ключ> у кнопки возможности (combat/capability-cost.mjs)", () => {
  it("подпись, гейт и списание с карточкой", async () => {
    const a = actorWith([thirstTrait], { pools: { thirst: 3 } });
    expect(capabilityCostLabel({ pool: "res:thirst", amount: 3 })).toBe("3 Жажды");
    expect(capabilityCostGate(a, { pool: "res:thirst", amount: 4 }).disabled).toBe(true);
    expect(capabilityCostGate(a, { pool: "res:thirst", amount: 3 }).disabled).toBe(false);
    expect(await spendCapabilityCost(a, { pool: "res:thirst", amount: 3 }, "Боевая форма")).toBe(true);
    expect(a.system.resourcePools.thirst).toBe(0);
    expect(await spendCapabilityCost(a, { pool: "res:thirst", amount: 1 }, "Боевая форма")).toBe(false);
  });
});

// ── Сверка паков с таблицами Стадий Пакта (корбук, Элитные архетипы) ───────
const ROOT = join(import.meta.dirname, "../../packs-src");
const readDir = rel => readdirSync(join(ROOT, rel)).filter(f => f.endsWith(".json") && !f.startsWith("_"))
  .map(f => JSON.parse(readFileSync(join(ROOT, rel, f), "utf8")));
const byName = (docs, re) => docs.filter(d => re.test(d.name));
const packActor = items => actorWith(items.map(d => ({ ...d, flags: d.flags })));

describe("паки: максимумы по Стадиям Пакта совпадают с книгой", () => {
  const cases = [
    { key: "thirst", trait: ["traits/Элитные_архетипы/Вампир", /^The Thirst/], stages: ["talents/Элитные_архетипы/Вампир", /^Pact Stage/],
      max: [6, 9, 12, 15, 18, 24], roundCap: [2, 3, 4, 5, 6, 7], asInfamyCap: [2, 3, 3, 4, 4, 5], gain: [1, 2, 2, 2, 2, 2] },
    { key: "inspiration", trait: ["traits/Элитные_архетипы/Когитор", /^Infernal Inspiration/], stages: ["talents/Элитные_архетипы/Когитор", /^Cogitor Pact Stage/],
      max: [4, 5, 6, 7, 8, 9], gain: [1, 1, 1, 2, 2, 3] },
    { key: "vengeance", trait: ["traits/Элитные_архетипы/Ревенант", /^Vengeful Spirit/], stages: ["talents/Элитные_архетипы/Ревенант", /^Revenant Pact Stage/],
      max: [3, 4, 5, 6, 7, 8] }
  ];
  for (const c of cases) {
    it(`${c.key}: Стадии 0–5`, () => {
      const [trait] = byName(readDir(c.trait[0]), c.trait[1]);
      const stages = byName(readDir(c.stages[0]), c.stages[1]).sort((x, y) => x.name.localeCompare(y.name));
      expect(trait).toBeTruthy();
      expect(stages).toHaveLength(5);
      for (let n = 0; n <= 5; n++) {
        const d = resourcePoolDefs(packActor([trait, ...stages.slice(0, n)])).get(c.key);
        expect(d.max, `максимум, Стадия ${n}`).toBe(c.max[n]);
        if (c.roundCap) expect(d.roundCap, `лимит за Раунд, Стадия ${n}`).toBe(c.roundCap[n]);
        if (c.asInfamyCap) expect(d.asInfamyCap, `как Бесчестие, Стадия ${n}`).toBe(c.asInfamyCap[n]);
        if (c.gain) expect(d.gainAmount, `пополнение, Стадия ${n}`).toBe(c.gain[n]);
      }
    });
  }
});

describe("spendFromInfamyPool: пул ресурса вместо Очка Бесчестия (apps/infamy-points.mjs)", () => {
  it("обычных Очков нет — платит Жажда без вопроса, Очко Бесчестия не трогается", async () => {
    const { spendFromInfamyPool } = await import("../../module/apps/infamy-points.mjs");
    const a = actorWith([thirstTrait], { pools: { thirst: 2 } });
    const r = await spendFromInfamyPool(a, 1, "system.fate.value", { corThreshold: 0 });
    expect(r.resourceSpent).toMatchObject({ key: "thirst", amount: 1, corCap: 19 });
    expect(r.poolSpent).toBe(0);
    expect(a.system.resourcePools.thirst).toBe(1);
  });

  it("способность с порогом Порчи выше 19 Жаждой не оплачивается", async () => {
    const { spendFromInfamyPool } = await import("../../module/apps/infamy-points.mjs");
    const a = actorWith([thirstTrait], { pools: { thirst: 2 } });
    const r = await spendFromInfamyPool(a, 1, "system.fate.value", { corThreshold: 40 });
    expect(r.resourceSpent).toBeUndefined();
    expect(a.system.resourcePools.thirst).toBe(2);
  });

  it("принудительная потеря (штраф) пул ресурса не трогает", async () => {
    const { spendFromInfamyPool } = await import("../../module/apps/infamy-points.mjs");
    const a = actorWith([thirstTrait], { pools: { thirst: 2 } });
    const r = await spendFromInfamyPool(a, 1, "system.fate.value", { forced: true });
    expect(r.resourceSpent).toBeUndefined();
    expect(a.system.resourcePools.thirst).toBe(2);
  });
});

describe("пул без потолка (resPoolMax «∞», Отец Крови)", () => {
  const father = () => actorWith([itemWith("Отец Крови", [entry({ resPoolKey: "bloodFather", resPoolLabel: "Отец Крови", resPoolMax: "∞", resPoolGainAmount: "1" })])], { pools: { bloodFather: 37 } });

  it("пул виден, значение не прижимается к числу", () => {
    const a = father();
    const d = resourcePoolDefs(a).get("bloodFather");
    expect(d.unbounded).toBe(true);
    expect(resourcePoolValue(a, "bloodFather")).toBe(37);
  });

  it("пополнение не упирается в потолок, восполнение «до максимума» не срабатывает", () => {
    const a = father();
    expect(resourceGainUpdates(a, "bloodFather", 5).after).toBe(42);
    expect(resourceRefillUpdates(a, "battle").filled).toEqual([]);
  });

  it("лист показывает ∞", () => {
    const row = resourcePoolsView(father()).find(r => r.key === "bloodFather");
    expect(row.maxLabel).toBe("∞");
    expect(row.max).toBe("");
  });

  it("паковая Черта Отец Крови — без потолка", () => {
    const dir = "packs-src/traits/Элитные_архетипы/Виткис";
    const file = readdirSync(dir).find(f => f.includes("Отец_Крови"));
    const doc = JSON.parse(readFileSync(join(dir, file), "utf8"));
    expect(resourcePoolDefs({ items: [doc], system: {} }).get("bloodFather")?.unbounded).toBe(true);
  });
});
