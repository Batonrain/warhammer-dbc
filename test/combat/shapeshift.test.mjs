// test/combat/shapeshift.test.mjs
//
// wdbc-tkeh1. Адаптация Сплайса «Перевертыш» (корбук, стр. 283, Полиморфин «для
// женщины»): «за полудействие тест A+20, и в зависимости от количества Успехов
// персонаж меняет внешность». Кнопка «Сменить облик» на Трейте.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { shapeshiftStep, SHAPESHIFT_STEPS } from "../../module/rules/shapeshifter.mjs";
import { useShapeshift } from "../../module/combat/shapeshift.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const TRAIT_DIR = "packs-src/traits/Трейты_рас/Адаптации_Сплайса";
const TRAIT_ID = "AHr13FOCZErE45gT";
const DRUG_DIR = "packs-src/chemistry/Наркотики";
const DRUG_ID = "yxRNulm12KO4wui9";

function splice({ ap = 2, ag = 40 } = {}) {
  return {
    id: "a1", uuid: "Actor.a1", name: "Сплайс", type: "character", items: [],
    system: { actionPoints: { value: ap, max: 2 }, fatigue: { value: 0 },
      characteristics: { ag: { total: ag, bonus: Math.floor(ag / 10) } }, conditions: {} },
    updates: [],
    getFlag: () => undefined,
    update: async function (d) { this.updates.push(d); }
  };
}

beforeEach(resetCaptured);
afterEach(() => { globalThis.game.combat = null; });

describe("таблица Полиморфина (rules/shapeshifter.mjs)", () => {
  it("строка таблицы — по наибольшему достигнутому порогу Успехов: 1, 2, 3, 4, 5, 7", () => {
    expect(SHAPESHIFT_STEPS.map(s => s.min)).toEqual([1, 2, 3, 4, 5, 7]);
    expect(shapeshiftStep(0)).toBeNull();
    expect(shapeshiftStep(1).min).toBe(1);
    expect(shapeshiftStep(2).min).toBe(2);
    expect(shapeshiftStep(3).min).toBe(3);
    expect(shapeshiftStep(4).min).toBe(4);
    expect(shapeshiftStep(5).min).toBe(5);
    expect(shapeshiftStep(6).min).toBe(5);   // 6 Успехов — всё ещё «5+», строки «6+» в книге нет
    expect(shapeshiftStep(7).min).toBe(7);
    expect(shapeshiftStep(12).min).toBe(7);
  });

  it("тексты таблицы дословно лежат в описании Трейта (пак и код не расходятся)", () => {
    const trait = packDocById(TRAIT_DIR, TRAIT_ID);
    for (const s of SHAPESHIFT_STEPS) {
      expect(trait.system.benefit).toContain(`${s.min}+ У: ${s.text}`);
    }
  });

  it("те же тексты — в записи препарата Полиморфин (таблица книги одна)", () => {
    const drug = packDocById(DRUG_DIR, DRUG_ID);
    for (const s of SHAPESHIFT_STEPS) {
      expect(drug.system.effect).toContain(`${s.min}+ У: ${s.text}`);
    }
  });
});

describe("данные пака", () => {
  it("Трейт несёт кнопку useShapeshift без лимита «раз в Раунд»", () => {
    const doc = packDocById(TRAIT_DIR, TRAIT_ID);
    const entries = doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).filter(e => e.kind === "script");
    expect(entries).toHaveLength(1);
    expect(entries[0].code).toContain("return await useShapeshift(actor)");
    expect(entries[0].scriptThrottleUnit || "").toBe("");
  });
});

describe("useShapeshift", () => {
  it("тест A+20: Порог 60, бросок 25 — 4 Успеха → строка «4+», не «5+»", async () => {
    const a = splice();
    captured.nextRoll = 25; // floor((60-25)/10)+1 = 4
    await useShapeshift(a);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("4+ У");
    expect(html).toContain("форму тела на человека того же пола");
    expect(html).not.toContain("5+ У");
    expect(html).toContain("60"); // Порог A+20
  });

  it("5 Успехов — другой пол и размер ±40%; 7 — гуманоидный ксенос", async () => {
    captured.nextRoll = 15; // floor(45/10)+1 = 5
    await useShapeshift(splice());
    expect(captured.chat.at(-1).content).toContain("другой пол");
    resetCaptured();
    captured.nextRoll = 1; // floor(59/10)+1 = 6 → строка 5+
    await useShapeshift(splice());
    expect(captured.chat.at(-1).content).toContain("5+ У");
    resetCaptured();
    captured.nextRoll = 1;
    await useShapeshift(splice({ ag: 80 })); // Порог 100, 1 → 10 Успехов
    expect(captured.chat.at(-1).content).toContain("гуманоидного ксеноса");
  });

  it("провал теста — облик не меняется, строки таблицы нет", async () => {
    captured.nextRoll = 90;
    await useShapeshift(splice());
    const html = captured.chat.at(-1).content;
    expect(html).not.toContain("1+ У");
    expect(html).toMatch(/не удалось|не изменился/i);
  });

  it("в бою тратит одно ОД (полудействие); без ОД — не бросает и не пишет в чат", async () => {
    const a = splice({ ap: 2 });
    globalThis.game.combat = { id: "c1", round: 1, started: true, combatant: { actor: a, actorId: a.id } };
    captured.nextRoll = 30;
    await useShapeshift(a);
    expect(a.updates.at(-1)).toEqual({ "system.actionPoints.value": 1 });
    expect(captured.chat).toHaveLength(1);

    const b = splice({ ap: 0 });
    globalThis.game.combat = { id: "c1", round: 1, started: true, combatant: { actor: b, actorId: b.id } };
    resetCaptured();
    const res = await useShapeshift(b);
    expect(captured.chat).toHaveLength(0);
    expect(res).toBeTruthy(); // truthy-результат = самоотказ, runMechScriptEntry не списывает цену
  });
});

describe("Полиморфин против книги (Химия, стр. 283)", () => {
  const book = fs.readFileSync(path.resolve(import.meta.dirname, "../../packs-src/books/core.json"), "utf8");
  it("в книге есть абзац Полиморфина с обоими вариантами (мужчина [женщина])", () => {
    expect(book).toContain("тест А–10 [A+20]");
    expect(book).toContain("2d10+5 [1d10]");
  });

  it("запись препарата называет оба варианта: A−10 / A+20, T.b / 2×T.b ч, 2d10+5 / 1d10, W−20 / W+0", () => {
    const s = packDocById(DRUG_DIR, DRUG_ID).system;
    expect(s.effect).toMatch(/T\.b \[2×T\.b\] час/);
    expect(s.effect).toContain("A−10 [A+20]");
    expect(s.effect).toContain("полное действие [полудействие]");
    expect(s.afterEffect).toContain("2d10+5 [1d10]");
    expect(s.addiction.testMod).toBe(-20);
    expect(s.addiction.penalty).toContain("W−20 [W+0]");
    expect(s.addiction.penalty).toContain("−30");
  });

  it("в записи нет выдуманной строки «пол ±20%» и порога «на другого гуманоида (5)»", () => {
    const s = packDocById(DRUG_DIR, DRUG_ID).system;
    expect(s.effect).not.toContain("пол ±20%");
    expect(s.effect).not.toContain("на другого гуманоида (5)");
  });
});
