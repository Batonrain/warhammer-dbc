// test/sheets/psy-focus-quality.test.mjs
//
// Качество предмета-Психофокуса в психотесте (executePsychotest, Путь
// «Психофокус») и поля привязки на вкладке МИСТИКА. Чистые правила —
// test/rules/psy-focus-quality.test.mjs; здесь — что они дошли до карточки.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured, sheetOf } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { executePsychotest } from "../../module/sheets/tabs/psychic.mjs";
import { WarhammerCharacterSheet } from "../../module/sheets/actor-sheet.mjs";
import { buildGetData } from "../../module/sheets/sheet-helpers.mjs";

function power(discipline = "telepathy") {
  const it = {
    id: "power-1", name: "Взор Варпа", type: "psychicPower",
    system: { testChar: "wp", powerType: "utility", prRequired: 1, discipline },
    updates: [], update: async d => { it.updates.push(d); return d; }
  };
  return it;
}

function actor({ quality = null, psyker = {} } = {}) {
  const list = [];
  if (quality) list.push({
    id: "f1", name: "Psy Focus / Психофокус", type: "gear",
    system: { quality, description: "", effect: "" }
  });
  list.get = id => list.find(i => i.id === id) ?? null;
  list.contents = list;
  const a = {
    id: "actor-1", name: "Псайкер", items: list, updates: [],
    getFlag: () => undefined, setFlag: async () => {},
    system: {
      race: "human", fatigue: { value: 0 },
      psyker: { rating: 3, currentRating: 3, sustain: 0, class: "bound",
                ...(quality ? { focusItemId: "f1" } : {}), ...psyker },
      skills: { psyniscience: { total: 52 } }, groupSkills: { forbiddenLore: [] },
      corruption: { value: 12 }, corruptionBonus: 1,
      wounds: { value: 8, max: 10, critical: 0 },
      charDamage: { s: 0, ag: 0, wp: 0 }, charLoss: { s: 0, ag: 0, wp: 0 }, charLossAt: {},
      experience: { current: 0, log: [] },
      characteristics: {
        wp:  { total: 40, value: 40, bonus: 4 }, int: { total: 40, value: 40, bonus: 4 },
        per: { total: 35, value: 35, bonus: 3 }, t:   { total: 42, value: 42, bonus: 4 },
        s:   { total: 30, value: 30, bonus: 3 }, ag:  { total: 30, value: 30, bonus: 3 }
      }
    },
    update: async d => { a.updates.push(d); return d; },
    updateEmbeddedDocuments: async () => []
  };
  return a;
}

const base = { mPR: 2, prMod: 0, mode: "normal", modifier: 0, eldar: false,
               pushChoice: 1, damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1,
               path: "psychofocus" };

// Заглушка Roll отдаёт nextRoll и фокусу, и психотесту; порог W=40.
//   30 — успех, 22 — крит. успех (дубль), 50 — провал, 44 — крит. провал (дубль).
async function cast(a, roll, discipline) {
  captured.nextRoll = roll;
  await executePsychotest(a, power(discipline), { ...base });
  return captured.chat[0].content;
}

beforeEach(resetCaptured);

describe("Психофокус в психотесте — качество предмета", () => {
  it("без привязанного фокуса — как раньше: успех +10, крит. провал −10", async () => {
    expect(await cast(actor(), 30)).toContain("успех, +10");
    resetCaptured();
    expect(await cast(actor(), 44)).toContain("крит. провал, -10");
  });

  it("Good.Q резонирует с Дисциплиной силы — успех +15, крит. успех +20", async () => {
    const a = actor({ quality: "good", psyker: { focusResonance: "telepathy" } });
    expect(await cast(a, 30, "telepathy")).toContain("успех, +15");
    resetCaptured();
    expect(await cast(a, 22, "telepathy")).toContain("крит. успех, +20");
  });

  it("Good.Q на силе другой Дисциплины — обычные +10", async () => {
    const a = actor({ quality: "good", psyker: { focusResonance: "telepathy" } });
    expect(await cast(a, 30, "divination")).toContain("успех, +10");
  });

  it("Good.Q: крит. провал по-прежнему −10", async () => {
    const a = actor({ quality: "good", psyker: { focusResonance: "telepathy" } });
    expect(await cast(a, 44, "telepathy")).toContain("крит. провал, -10");
  });

  it("Best.Q: крит. провал не штрафует и в карточке сказано почему", async () => {
    const a = actor({ quality: "best", psyker: { focusResonance: "telepathy" } });
    const html = await cast(a, 44, "telepathy");
    expect(html).not.toContain("-10");
    expect(html).toContain("игнорируется");
  });

  it("Best.Q игнорирует крит. провал и на нерезонирующей Дисциплине", async () => {
    const a = actor({ quality: "best", psyker: { focusResonance: "telepathy" } });
    const html = await cast(a, 44, "divination");
    expect(html).not.toContain("-10");
    expect(html).toContain("игнорируется");
  });

  it("Best.Q: обычный провал — «без бонуса», про игнор не пишет", async () => {
    const a = actor({ quality: "best", psyker: { focusResonance: "telepathy" } });
    const html = await cast(a, 50, "telepathy");
    expect(html).toContain("без бонуса");
    expect(html).not.toContain("игнорируется");
  });

  it("предмет влияет только на Путь «Психофокус»: на другом Пути броска фокуса нет", async () => {
    const a = actor({ quality: "best", psyker: { focusResonance: "telepathy" } });
    captured.nextRoll = 30;
    await executePsychotest(a, power("telepathy"), { ...base, path: "" });
    expect(captured.chat[0].content).not.toContain("Психофокус");
  });
});

describe("Вкладка МИСТИКА — привязка Психофокуса (buildGetData → context.psyFocusItem)", () => {
  const ctxOf = (items, psyker = {}) => {
    const sheet = sheetOf(WarhammerCharacterSheet, {
      items, characteristics: {}, skills: {}, groupSkills: {},
      psyker: { rating: 3, currentRating: 3, ...psyker }
    });
    sheet.actor.items.contents = sheet.actor.items;
    return buildGetData(sheet.actor).psyFocusItem;
  };
  const gear = (id, name, quality) => ({
    id, name, type: "gear", system: { quality, description: "", effect: "", benefit: "" }, getFlag: () => undefined
  });

  it("список содержит кандидатов и ничего не выбрано по умолчанию", () => {
    const c = ctxOf([gear("f1", "Psy Focus / Психофокус", "best"), gear("r", "Rope", "common")]);
    expect(c.options.map(o => o.id)).toEqual(["f1"]);
    expect(c.selectedId).toBe("");
    expect(c.showResonance).toBe(false);
  });

  it("у выбранного Good.Q+ показывается выбор резонансной Дисциплины", () => {
    const c = ctxOf([gear("f1", "Psy Focus / Психофокус", "good")], { focusItemId: "f1" });
    expect(c.selectedId).toBe("f1");
    expect(c.showResonance).toBe(true);
    expect(c.disciplines.length).toBeGreaterThan(0);
  });

  it("у Comm.Q выбор Дисциплины скрыт — он ничего не даёт", () => {
    const c = ctxOf([gear("f1", "Psy Focus / Психофокус", "common")], { focusItemId: "f1" });
    expect(c.showResonance).toBe(false);
  });
});
