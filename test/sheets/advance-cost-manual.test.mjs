// test/sheets/advance-cost-manual.test.mjs
//
// Поле «Цена» у Характеристик и Навыков на вкладке «Развитие» подписано
// «Авто-цена по склонностям (можно поправить)» — то есть ГМу прямо предлагают
// вписать своё число. Но recalcAllAdvanceCosts переписывал цену ВСЕХ купленных
// строк разом, и любая вписанная руками цена молча возвращалась к
// автоматической при следующем пересчёте (wdbc-rcr9). У Талантов защита была
// давно (system.costManual, wdbc-cct) — здесь тот же приём распространяется на
// Характеристики, Навыки и записи Групповых Навыков.
//
// Триггеров пересчёта три: смена Склонностей персонажа, смена Покровителя и —
// с появлением кнопки Д/Н/В — любая смена привязки Склонностей у одной строки.
// Последний и сделал старое поведение заметным: раньше терялось раз в кампанию,
// теперь — на каждый щелчок.
//
// Обратная сторона проверяется тут же: строка, которой цену НЕ правили руками,
// обязана пересчитываться как прежде, а «вернуть авто-цену» — быть достижимым
// действием, иначе ручная правка становится ловушкой без выхода.

import { describe, it, expect, beforeEach } from "vitest";
import { resetCaptured } from "../support/foundry-stub.mjs";
import {
  activateAdvanceListeners,
  recalcAllAdvanceCosts
} from "../../module/sheets/tabs/advance.mjs";

function applyPath(target, path, value) {
  const keys = path.split(".");
  let cur = target;
  for (const key of keys.slice(0, -1)) cur = (cur[key] ??= {});
  cur[keys.at(-1)] = value;
}

function actor({ aptitudes = [], characteristics = {}, skills = {}, groupSkills = {} } = {}) {
  const list = [];
  list.get = id => list.find(i => i.id === id) ?? null;
  const a = {
    system: { aptitudes, characteristics, skills, groupSkills, advanceTalents: [] },
    items: list,
    updates: [],
    update: async data => {
      a.updates.push(data);
      for (const [path, value] of Object.entries(data)) applyPath(a, path, value);
      return data;
    },
    updateEmbeddedDocuments: async (_type, docs) => docs
  };
  return a;
}

function wire(a) {
  const handlers = {};
  const html = {
    find: selector => ({
      click:  fn => { handlers[`${selector}:click`]  = fn; },
      change: fn => { handlers[`${selector}:change`] = fn; },
      on: (event, fn) => { handlers[`${selector}:${event}`] = fn; },
      each: () => {}
    })
  };
  activateAdvanceListeners(html, a, { addGroupSkill: () => {}, jq: undefined });
  return handlers;
}

const ev = (dataset = {}, value) => ({
  preventDefault: () => {},
  stopPropagation: () => {},
  currentTarget: { dataset, value }
});

beforeEach(resetCaptured);

describe("ручная цена продвижения переживает пересчёт (wdbc-rcr9)", () => {
  it("recalcAllAdvanceCosts обходит Характеристику и Навык с costManual", async () => {
    const a = actor({
      aptitudes: ["ws", "offence"],
      characteristics: {
        ws: { improvement: "simple", cost: 42, costManual: true },
        t:  { improvement: "simple", cost: 999 }
      },
      skills: {
        awareness: { rank: "knows", cost: 7, costManual: true },
        dodge:     { rank: "knows", cost: 999 }
      }
    });

    await recalcAllAdvanceCosts(a);

    expect(a.system.characteristics.ws.cost).toBe(42);   // вписано руками — не тронуто
    expect(a.system.skills.awareness.cost).toBe(7);      // вписано руками — не тронуто
    expect(a.system.characteristics.t.cost).not.toBe(999); // обычная строка пересчитана
    expect(a.system.skills.dodge.cost).not.toBe(999);
  });

  it("recalcAllAdvanceCosts обходит запись Группового Навыка с costManual", async () => {
    const a = actor({
      aptitudes: ["int", "knowledge"],
      groupSkills: {
        scholasticLore: [
          { specialty: "Тактика",   rank: "trained", char: "int", cost: 13, costManual: true },
          { specialty: "Геральдика", rank: "trained", char: "int", cost: 999 }
        ]
      }
    });

    await recalcAllAdvanceCosts(a);

    const entries = a.system.groupSkills.scholasticLore;
    expect(entries[0].cost).toBe(13);
    expect(entries[0].costManual).toBe(true);
    expect(entries[1].cost).not.toBe(999);
  });

  it("ручной ввод в поле «Цена» взводит costManual у Характеристики, Навыка и записи Группы", async () => {
    const a = actor({
      characteristics: { ws: { improvement: "simple", cost: 0 } },
      skills: { awareness: { rank: "knows", cost: 0 } },
      groupSkills: { scholasticLore: [{ specialty: "Тактика", rank: "trained", char: "int", cost: 0 }] }
    });
    const h = wire(a);

    await h[".char-cost-input:change"](ev({ char: "ws" }, "55"));
    await h[".skill-cost-input:change"](ev({ skill: "awareness" }, "66"));
    await h[".group-skill-cost-input:change"](ev({ group: "scholasticLore", index: "0" }, "77"));

    expect(a.system.characteristics.ws.cost).toBe(55);
    expect(a.system.characteristics.ws.costManual).toBe(true);
    expect(a.system.skills.awareness.cost).toBe(66);
    expect(a.system.skills.awareness.costManual).toBe(true);
    expect(a.system.groupSkills.scholasticLore[0].cost).toBe(77);
    expect(a.system.groupSkills.scholasticLore[0].costManual).toBe(true);
  });

  it("смена уровня/ранга сама ставит цену и потому снимает costManual", async () => {
    // Иначе строка навсегда выпала бы из пересчёта — с числом, которое ГМ
    // руками не вписывал (та же логика, что у ★ и грант-переключателя Талантов).
    const a = actor({
      aptitudes: ["ws", "offence"],
      characteristics: { ws: { improvement: "simple", cost: 55, costManual: true } },
      skills: { awareness: { rank: "known", cost: 66, costManual: true } }
    });
    const h = wire(a);

    await h[".char-improvement-select:change"](ev({ char: "ws" }, "average"));
    await h[".skill-rank-select:change"](ev({ skill: "awareness" }, "knows"));

    expect(a.system.characteristics.ws.costManual).toBe(false);
    expect(a.system.skills.awareness.costManual).toBe(false);
  });

  it("кнопка ↺ возвращает авто-цену и снимает пометку", async () => {
    const a = actor({
      aptitudes: ["ws", "offence"],
      characteristics: { ws: { improvement: "simple", cost: 55, costManual: true } },
      skills: { awareness: { rank: "knows", cost: 66, costManual: true } },
      groupSkills: { scholasticLore: [{ specialty: "Тактика", rank: "trained", char: "int", cost: 77, costManual: true }] }
    });
    const h = wire(a);

    await h[".adv-cost-reset:click"](ev({ scope: "char", key: "ws" }));
    await h[".adv-cost-reset:click"](ev({ scope: "skill", key: "awareness" }));
    await h[".adv-cost-reset:click"](ev({ scope: "group", key: "scholasticLore", index: "0" }));

    expect(a.system.characteristics.ws.costManual).toBe(false);
    expect(a.system.characteristics.ws.cost).toBe(100);   // Дружественная, первая ступень
    expect(a.system.skills.awareness.costManual).toBe(false);
    expect(a.system.skills.awareness.cost).not.toBe(66);
    const entry = a.system.groupSkills.scholasticLore[0];
    expect(entry.costManual).toBe(false);
    expect(entry.cost).not.toBe(77);
  });
});
