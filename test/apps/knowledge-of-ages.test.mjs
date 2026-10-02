// test/apps/knowledge-of-ages.test.mjs
//
// Знания Веков (wdbc-1rno.23), Foundry-обвязка — module/apps/knowledge-of-ages.mjs:
//   • кнопка «бросить 1d10» в карточке траты Очка Бесчестия на «Усиление»/
//     «Успех»/«Переброс» — только у носителя мутации и только на тест того
//     Навыка, что добыт мутацией (если тест известен);
//   • обработчик: 9-10 — Очко вернулось (туда, откуда списано), 1 — Ступор на
//     1 Раунд, раз на карточку.
// Плюс сторож стыковки по исходникам: кнопка реально рисуется в меню Очков
// карточки (hooks.mjs) и на полосе Бесчестия (apps/infamy-points.mjs), а
// обработчик повешен на карточки чата.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs   from "node:fs";
import path from "node:path";
import { packDocById } from "../support/pack-doc.mjs";
import { knowledgeOfAgesButtonHtml, rollKnowledgeOfAges } from "../../module/apps/knowledge-of-ages.mjs";
import { CARD_ONCE_FLAGS } from "../../module/combat/card-once.mjs";

const NS = "warhammer-dbc";
const ROOT = path.resolve(import.meta.dirname, "../..");
const KOA = packDocById("packs-src/mutations/Общие_мутации", "0Mc6b4RhLPO4ruoU");

function fakeActor({ withMutation = true, masteryKey = "dodge", fate = 2, temp = 0 } = {}) {
  const items = [];
  if (withMutation) {
    items.push({ id: "mut1", name: KOA.name, type: "mutation", system: KOA.system, flags: KOA.flags });
    if (masteryKey) items.push({
      id: "t1", name: "Mastery / Мастерство", type: "talent",
      system: { specialization: "?", aptSource: masteryKey },
      flags: { [NS]: { grantedByItem: "mut1", abilityEntryId: "6WRTlSrWDkgM8iI5:mastery" } }
    });
  }
  const actor = {
    id: "a1", uuid: "Actor.a1", name: "Еретик", type: "character", isOwner: true,
    system: {
      alignment: "heretic", fate: { value: fate, max: 5 },
      characteristics: { inf: { bonus: 5 } }, conditions: {}
    },
    flags: { [NS]: temp ? { tempInfamy: { amount: temp, source: "Голос Бога", restriction: "" } } : {} },
    effects: [], created: [], updates: [],
    items: Object.assign([...items], { contents: items, get: id => items.find(i => i.id === id) }),
    getFlag(ns, k) { return this.flags[ns]?.[k]; },
    async setFlag(ns, k, v) { (this.flags[ns] ??= {})[k] = v; },
    async unsetFlag(ns, k) { delete this.flags[ns]?.[k]; },
    async update(u) {
      this.updates.push(u);
      for (const [k, v] of Object.entries(u)) {
        const parts = k.split(".");
        let cur = this;
        for (const p of parts.slice(0, -1)) cur = (cur[p] ??= {});
        cur[parts.at(-1)] = v;
      }
    },
    async createEmbeddedDocuments(type, docs) { this.created.push({ type, docs }); return docs; }
  };
  return actor;
}

let seq = 0;
function fakeMessage({ isOwner = true } = {}) {
  return {
    id: `koa${++seq}`, isOwner, flags: {},
    getFlag(ns, k) { return this.flags[ns]?.[k]; },
    async setFlag(ns, k, v) { (this.flags[ns] ??= {})[k] = v; }
  };
}

const realGetProperty = globalThis.foundry.utils.getProperty;
let prev;
beforeEach(() => {
  resetCaptured();
  globalThis.foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);
  prev = { socket: game.socket, users: game.users, user: game.user };
  game.socket = { emit: () => {} };
  game.users = Object.assign([], { activeGM: { id: "gm" } });
  game.user = { id: "u1" };
});
afterEach(() => {
  globalThis.foundry.utils.getProperty = realGetProperty;
  Object.assign(game, prev);
});

describe("Знания Веков: кнопка в карточке траты", () => {
  it("тест добытого Навыка, «Переброс» — кнопка есть", () => {
    const html = knowledgeOfAgesButtonHtml(fakeActor(), { ability: "reroll", skillTest: { skill: "dodge" } });
    expect(html).toContain("wh-knowledge-of-ages-btn");
    expect(html).toContain('data-actor-uuid="Actor.a1"');
  });

  it("тест другого Навыка — кнопки нет", () => {
    expect(knowledgeOfAgesButtonHtml(fakeActor(), { ability: "reroll", skillTest: { skill: "awareness" } })).toBe("");
  });

  it("карточка не теста Навыка (Характеристика, без флага) — кнопки нет", () => {
    expect(knowledgeOfAgesButtonHtml(fakeActor(), { ability: "reroll", skillTest: null })).toBe("");
    expect(knowledgeOfAgesButtonHtml(fakeActor(), { ability: "reroll", skillTest: { skill: "", group: "" } })).toBe("");
  });

  it("без мутации — кнопки нет", () => {
    expect(knowledgeOfAgesButtonHtml(fakeActor({ withMutation: false }),
      { ability: "reroll", skillTest: { skill: "dodge" } })).toBe("");
  });

  it("другие способности Очков (Исцеление, Прилив Сил) — кнопки нет", () => {
    for (const ability of ["heal", "surge", "calmWarp", "recover"]) {
      expect(knowledgeOfAgesButtonHtml(fakeActor(), { ability })).toBe("");
    }
  });

  it("полоса Бесчестия (тест неизвестен) — кнопка с названием Навыка, решает игрок", () => {
    for (const ability of ["boost", "reroll", "success"]) {
      const html = knowledgeOfAgesButtonHtml(fakeActor(), { ability });
      expect(html).toContain("wh-knowledge-of-ages-btn");
      expect(html).toContain("Уклонение");
    }
  });

  it("Навык не восстановить (Mastery не от мутации) — на тест любого Навыка кнопка есть, на Характеристику нет", () => {
    const actor = fakeActor({ masteryKey: "" });
    expect(knowledgeOfAgesButtonHtml(actor, { ability: "reroll", skillTest: { skill: "awareness" } }))
      .toContain("wh-knowledge-of-ages-btn");
    expect(knowledgeOfAgesButtonHtml(actor, { ability: "reroll", skillTest: { skill: "" } })).toBe("");
  });

  it("Очко из временного запаса — кнопка помнит это и его источник", () => {
    const html = knowledgeOfAgesButtonHtml(fakeActor(), { ability: "boost",
      spend: { tempSpent: 1, poolSpent: 0, tempSource: "Глас Божий", tempRestriction: "только Команда" } });
    expect(html).toContain('data-temp="1"');
    expect(html).toContain('data-temp-source="Глас Божий"');
    expect(html).toContain('data-temp-restriction="только Команда"');
  });

  it("не Хаосит (Очко Судьбы) — кнопки нет: книга говорит о способностях Бесчестия", () => {
    const actor = fakeActor();
    actor.system.alignment = "renegade";
    expect(knowledgeOfAgesButtonHtml(actor, { ability: "reroll", skillTest: { skill: "dodge" } })).toBe("");
  });
});

describe("Знания Веков: временный запас и источник", () => {
  it("spendFromInfamyPool запоминает источник временного Очка ДО списания", async () => {
    const { spendFromInfamyPool } = await import("../../module/apps/infamy-points.mjs");
    const actor = fakeActor({ temp: 1 });
    const spend = await spendFromInfamyPool(actor, 1, "system.fate.value");
    expect(spend.tempSpent).toBe(1);
    expect(spend.tempSource).toBe("Голос Бога");
    expect(actor.flags[NS].tempInfamy).toBeUndefined(); // последнее — флаг снят
  });
});

describe("Знания Веков: бросок 1d10", () => {
  it("10 — Очко вернулось в пул", async () => {
    captured.nextRoll = 10;
    const actor = fakeActor({ fate: 2 });
    expect(await rollKnowledgeOfAges(actor, { message: fakeMessage() })).toBe(true);
    expect(actor.system.fate.value).toBe(3);
    expect(actor.system.conditions.dazed).toBeFalsy();
    expect(captured.chat).toHaveLength(1);
  });

  it("9 из временного запаса — Очко вернулось во временный запас с прежним источником, не в пул", async () => {
    captured.nextRoll = 9;
    const actor = fakeActor({ fate: 5 });   // запас уже снят тратой последнего Очка
    await rollKnowledgeOfAges(actor, { message: fakeMessage(), temp: true,
      tempSource: "Глас Божий", tempRestriction: "только Команда" });
    expect(actor.flags[NS].tempInfamy).toEqual({ amount: 1, source: "Глас Божий", restriction: "только Команда" });
    expect(actor.system.fate.value).toBe(5);
  });

  it("1 — Ступор на 1 Раунд, Очко не вернулось", async () => {
    captured.nextRoll = 1;
    const actor = fakeActor({ fate: 2 });
    await rollKnowledgeOfAges(actor, { message: fakeMessage() });
    expect(actor.system.conditions.dazed).toBe(true);
    expect(actor.system.fate.value).toBe(2);
    const eff = actor.created.find(c => c.type === "ActiveEffect")?.docs?.[0];
    expect(eff?.statuses).toEqual(["dazed"]);
  });

  it("5 — ничего", async () => {
    captured.nextRoll = 5;
    const actor = fakeActor({ fate: 2 });
    await rollKnowledgeOfAges(actor, { message: fakeMessage() });
    expect(actor.system.fate.value).toBe(2);
    expect(actor.system.conditions.dazed).toBeFalsy();
  });

  it("раз на карточку: двойной клик — один бросок, одно Очко", async () => {
    captured.nextRoll = 10;
    const actor = fakeActor({ fate: 2 });
    const message = fakeMessage();
    const res = await Promise.all([
      rollKnowledgeOfAges(actor, { message }), rollKnowledgeOfAges(actor, { message })
    ]);
    expect(res.filter(Boolean)).toHaveLength(1);
    expect(actor.system.fate.value).toBe(3);
    expect(captured.chat).toHaveLength(1);
  });

  it("без мутации — не бросает", async () => {
    const actor = fakeActor({ withMutation: false });
    expect(await rollKnowledgeOfAges(actor, { message: fakeMessage() })).toBe(false);
    expect(captured.chat).toHaveLength(0);
  });

  it("ключ отметки карточки — в белом списке сокета", () => {
    expect(CARD_ONCE_FLAGS).toContain("knowledgeOfAgesRolled");
  });
});

describe("Знания Веков: стыковка", () => {
  const hooks = fs.readFileSync(path.join(ROOT, "module/hooks.mjs"), "utf8");
  const points = fs.readFileSync(path.join(ROOT, "module/apps/infamy-points.mjs"), "utf8");

  it("меню Очков карточки: переброс и +10 теста рисуют кнопку по флагу skillTest", () => {
    const calls = hooks.match(/knowledgeOfAgesButtonHtml\(actor, \{[^}]*ability: "(reroll|boost)"[^}]*skillTest[^}]*\}\)/g) ?? [];
    expect(calls.length).toBe(2);
  });

  it("Очко Чемпиона (Вдохновляющее Присутствие) — не своё, кнопки нет", () => {
    for (const m of hooks.matchAll(/(.{0,40})knowledgeOfAgesButtonHtml\(actor/g)) {
      expect(m[1]).toMatch(/champion/);
    }
  });

  it("карточка переброса несёт флаг skillTest исходной — «+10» на ней тоже узнаёт Навык", () => {
    const at = hooks.indexOf("title: `Переброс за ${ft.one}`");
    expect(at).toBeGreaterThan(0);
    expect(hooks.slice(at, at + 900)).toMatch(/flags:[^\n]*skillTest/);
  });

  it("обработчик кнопки повешен на карточки чата", () => {
    expect(hooks).toMatch(/\.wh-knowledge-of-ages-btn/);
    expect(hooks).toMatch(/rollKnowledgeOfAges\(/);
  });

  it("полоса Бесчестия: трата на способность рисует кнопку", () => {
    expect(points).toMatch(/knowledgeOfAgesButtonHtml\(actor, \{ ability: key/);
  });
});
