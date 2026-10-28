// test/rules/defiance-talents.test.mjs
//
// Таланты Пси-Стойкости главы 3 (Sahara 3-defiance), добавленные после
// Неповиновения: Бастион Железной Воли (+тPR×5 «против психосил»), Ортопрокси
// (+20 на сопротивление допросу), Взгляд в Бездну (−1 Порчи от Варп-Шока).
// Записи Бастиона и Ортопрокси берутся из настоящих файлов packs-src — форма
// записи Конструктора проверяется той же функцией, что читает её в игре.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { resolveTest } from "../../module/rules/resolve-test.mjs";
import { gazeIntoAbyssReduction } from "../../module/rules/defiance-talents.mjs";
import { psychicResistReroll } from "../../module/rules/psychic-resist-reroll.mjs";

const DIR = path.resolve(import.meta.dirname, "../../packs-src/talents/Пси_стойкость");
function packTalent(prefix) {
  const file = fs.readdirSync(DIR).find(f => f.startsWith(prefix));
  const doc = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
  return { ...doc, id: doc._id, getFlag: () => undefined };
}

const sumAuto = r => r.autoMods.reduce((s, m) => s + (Number(m.value) || 0), 0);
const actor = (items, { tpr = 6, wpb = 4 } = {}) => ({
  type: "character", system: { psyker: { rating: 9, currentRating: tpr }, characteristics: { wp: { bonus: wpb, total: 40 } } }, items
});
const resist = extra => ({ kind: "skill", char: "wp", psychicThreat: true, ...extra });

describe("Бастион Железной Воли: +тPR×5 против психосил", () => {
  const bastion = () => packTalent("Bastion");

  it("тест Сопротивления психосиле — +тPR×5 от ТЕКУЩЕГО Пси-Рейтинга (за вычетом поддержания)", () => {
    expect(sumAuto(resolveTest({ actor: actor([bastion()], { tpr: 6 }), ...resist() }))).toBe(30);
    expect(sumAuto(resolveTest({ actor: actor([bastion()], { tpr: 4 }), ...resist() }))).toBe(20);
  });

  it("Выжигание Души (тег soulBurn) бонуса не получает", () => {
    expect(sumAuto(resolveTest({ actor: actor([bastion()]), ...resist({ soulBurn: true }) }))).toBe(0);
  });

  it("обычный тест Воли и чужой тест — без бонуса", () => {
    expect(sumAuto(resolveTest({ actor: actor([bastion()]), kind: "skill", char: "wp" }))).toBe(0);
    expect(sumAuto(resolveTest({ actor: actor([]), ...resist() }))).toBe(0);
  });

  it("запись в паке — testMod на области psychicPower с множителем ×5 от pr", () => {
    const e = bastion().flags["warhammer-dbc"].mechanics.flatMap(g => g.entries)[0];
    expect(e).toMatchObject({ kind: "testMod", modScope: "psychicPower", modValueMode: "charBonus", modCharBonus: "pr", modCharBonusMultiplier: 5 });
  });
});

describe("Ортопрокси: +20 на сопротивление допросу", () => {
  const ortho = () => packTalent("Orthoproxy");

  it("встречный тест жертвы в диалоге допроса (ctx.interrogation) — +20", () => {
    expect(sumAuto(resolveTest({ actor: actor([ortho()]), kind: "skill", char: "wp", interrogation: true }))).toBe(20);
  });

  it("обычный тест Воли и сопротивление психосиле — без бонуса", () => {
    expect(sumAuto(resolveTest({ actor: actor([ortho()]), kind: "skill", char: "wp" }))).toBe(0);
    expect(sumAuto(resolveTest({ actor: actor([ortho()]), ...resist() }))).toBe(0);
  });
});

describe("Взгляд в Бездну: сколько Порчи снять", () => {
  const gaze = () => ({ type: "talent", name: "Gaze Into Abyss / Взгляд в Бездну", system: {} });
  it("−1 за каждое взятие", () => {
    expect(gazeIntoAbyssReduction(actor([gaze()], { wpb: 4 }))).toBe(1);
    expect(gazeIntoAbyssReduction(actor([gaze(), gaze()], { wpb: 4 }))).toBe(2);
  });
  it("предел ½W.b — ограничение покупки: упавший W.b уже взятые копии не отключает", () => {
    expect(gazeIntoAbyssReduction(actor([gaze(), gaze()], { wpb: 3 }))).toBe(2);
    expect(gazeIntoAbyssReduction(actor([gaze()], { wpb: 1 }))).toBe(1);
  });
  it("без Таланта и без актора — 0", () => {
    expect(gazeIntoAbyssReduction(actor([]))).toBe(0);
    expect(gazeIntoAbyssReduction(null)).toBe(0);
  });
});

// ── Непреклонный и Солипсизм (решения владельца 25.10.2026) ─────────────────
const rerollLabels = (items, ctx) => resolveTest({ actor: actor(items), ...ctx }).rerolls.map(r => r.target);

describe("Непреклонный: переброс сопротивления «влияющим на разум» (вариант Б — resistChar = W)", () => {
  const strong = () => packTalent("Strong_Minded");

  it("запись в паке — kind:reroll на области psychicMind", () => {
    const e = strong().flags["warhammer-dbc"].mechanics.flatMap(g => g.entries)[0];
    expect(e).toMatchObject({ kind: "reroll", rerollScope: "psychicMind" });
  });

  it("сопротивление психосиле по Воле — предлагает переброс", () => {
    expect(rerollLabels([strong()], resist())).toEqual(["psychicMind"]);
  });

  it("сопротивление психосиле по другой характеристике (Т, I) — переброса нет", () => {
    expect(rerollLabels([strong()], resist({ char: "t" }))).toEqual([]);
    expect(rerollLabels([strong()], resist({ char: "int" }))).toEqual([]);
  });

  it("обычный тест Воли без тега psychicThreat — переброса нет", () => {
    expect(rerollLabels([strong()], { kind: "skill", char: "wp" })).toEqual([]);
  });

  it("без Таланта переброса нет", () => {
    expect(rerollLabels([], resist())).toEqual([]);
  });
});

describe("Солипсизм: переброс сопротивления (кроме непрямых) и ручной тумблер", () => {
  const solip = (off = false) => {
    const t = packTalent("Solipsism");
    if (off) t.flags["warhammer-dbc"].manualOff = true;
    return t;
  };

  it("запись в паке — kind:reroll на области psychicDirect, Талант помечен ручным тумблером", () => {
    const t = solip();
    const e = t.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries)[0];
    expect(e).toMatchObject({ kind: "reroll", rerollScope: "psychicDirect" });
    expect(t.flags["warhammer-dbc"].manualToggle).toBe(true);
  });

  it("сопротивление психосиле — переброс; Выжигание Души тоже (книга перечисляет)", () => {
    expect(rerollLabels([solip()], resist())).toEqual(["psychicDirect"]);
    expect(rerollLabels([solip()], resist({ soulBurn: true }))).toEqual(["psychicDirect"]);
  });

  it("непрямая сила исключена («кроме непрямых»)", () => {
    expect(rerollLabels([solip()], resist({ psychicIndirect: true }))).toEqual([]);
  });

  it("тумблер выключен (проиграл социальное состязание) — переброса нет", () => {
    expect(rerollLabels([solip(true)], resist())).toEqual([]);
  });

  it("обычный тест Воли — переброса нет", () => {
    expect(rerollLabels([solip()], { kind: "skill", char: "wp" })).toEqual([]);
  });
});

describe("psychicResistReroll: автоматический переброс Выжигания Души берёт и новые области", () => {
  it("Солипсизм → «лучший из двух»; выключенный — нет", () => {
    const solip = off => {
      const t = packTalent("Solipsism");
      if (off) t.flags["warhammer-dbc"].manualOff = true;
      return t;
    };
    expect(psychicResistReroll(actor([solip(false)]), null)).toMatchObject({ mode: "keepBest", rolls: 2 });
    expect(psychicResistReroll(actor([solip(true)]), null)).toBeNull();
  });
  it("Непреклонный → «лучший из двух»", () => {
    expect(psychicResistReroll(actor([packTalent("Strong_Minded")]), null)).toMatchObject({ mode: "keepBest", rolls: 2 });
  });
});
