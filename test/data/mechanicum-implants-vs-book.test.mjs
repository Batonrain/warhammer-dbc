// test/data/mechanicum-implants-vs-book.test.mjs
//
// «Импланты Механикум» (Стартовый Трейт Еретеха; их же получает
// Технодесантник) против присланного текста книги, сверка 28.09.2026.
//
// Что уже было не так и что здесь сторожится:
//  • у Черепных Цепей стояли чужие модификаторы по Качеству (−10/+5/+10 —
//    это Ноосферное Подключение), у Электро-Графтов Poor.Q давал «+5» вместо
//    «заменяет только 1 члена экипажа»;
//  • модификаторы по Качеству были только текстом — теперь это записи
//    Конструктора «Модификатор теста» с условием по Качеству импланта;
//  • выдача Архетипом шла из констант (module/constants/implants.mjs) мимо
//    пака: без Механики, без energyMax и НЕ установленными — Катушка
//    Потенции не давала зарядов, пока игрок сам не «вживлял» её Хирургеоном.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { isItemActive } from "../../module/apps/effects.mjs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { rollModsFromRules } from "../../module/rules/resolve-test.mjs";
import { ruleAutoModsHtml, ruleRollModsHtml } from "../../module/rules/roll-mods.mjs";
import { MECHANICUS_IMPLANTS } from "../../module/constants/implants.mjs";

const DIR = "packs-src/implants/Адептус_Механикус/Импланты_Механикус";
const ID = {
  graft: "cbWIdvnkIdwxSiYL", electoo: "LF7oAhYFVGTPOcox", respirator: "UgTVCuCpK1lbSril",
  mantle: "tPCQ3IEWQ3xFLoKS", coil: "EijXeVNbA61hj3wa", cranial: "gGKQAPQuWI3KmNJq",
  uplink: "AmZ8pwOAozlZAm0D"
};
const doc = k => packDocById(DIR, ID[k]);

/** Имплант на акторе: установлен, нужного Качества. */
const onActor = (k, quality, installed = true) => {
  const d = doc(k);
  const flags = { ...d.flags, "warhammer-dbc": { ...(d.flags?.["warhammer-dbc"] ?? {}), installed } };
  return {
    id: k, name: d.name, type: d.type, system: { ...d.system, quality }, flags,
    getFlag: (scope, key) => flags?.[scope]?.[key]
  };
};
const actor = { system: { geneSeed: {}, bio: { age: 0 } }, items: [] };
// Обе половины — галочки и то, что считается само (auto): число сверяется с
// книгой независимо от того, как оно подаётся игроку.
const mods = (k, quality, ctx, installed = true) => {
  const rules = rulesFromItemMechanics([onActor(k, quality, installed)], isItemActive, actor);
  return [...rollModsFromRules(rules, ctx), ...rollModsFromRules(rules, ctx, { auto: true })].map(m => m.value);
};
/** Актор с одним установленным имплантом — для окна броска листа. */
const actorWith = (k, quality) => {
  const item = onActor(k, quality);
  return { ...actor, system: { ...actor.system, characteristics: {}, skills: {} },
           items: Object.assign([item], { contents: [item] }) };
};
const charge = { kind: "skill", skill: "techUse", char: "int", coilCharge: true };
const noo = { kind: "skill", skill: "techUse", char: "int", noosphere: true };

describe("Импланты Механикум: тексты книги", () => {
  it("Электро-Графты — книжное имя и уровни Качества", () => {
    const d = doc("graft");
    expect(d.name).toBe("Electro-Grafts / Электро-Графты");
    expect(d.system.effect).toContain("Позволяют выполнять роль до 2-х членов экипажа машины");
    expect(d.system.effect).toContain("Poor.Q – заменяет только 1 члена экипажа.");
  });
  it("Черепные Цепи — без чужих модификаторов по Качеству", () => {
    const e = doc("cranial").system.effect;
    expect(e).toContain("в 50 раз быстрее");
    expect(e).not.toMatch(/Poor\.Q|Good\.Q|Best\.Q/);
  });
  it("Катушка Потенции — 3 заряда, Усталость 2 к 1, заряды по Качеству 1/3/5/7", () => {
    const d = doc("coil");
    expect(d.system.effect).toContain("Имеет 3 заряда");
    expect(d.system.effect).toContain("по цене 2к1");
    expect(d.system.energyMax).toEqual({ poor: 1, common: 3, good: 5, best: 7 });
  });
  it("Кибер-Мантия — «в 10 раз»", () => {
    expect(doc("mantle").system.effect).toContain("в 10 раз");
  });
});

describe("Импланты Механикум: модификаторы по Качеству считаются сами", () => {
  const operate = { kind: "skill", skill: "operate", char: "ag" };
  it("Электро-Графты: Good.Q +5, Best.Q +10 к тестам управления, Poor/Comm — ничего", () => {
    expect(mods("graft", "poor", operate)).toEqual([]);
    expect(mods("graft", "common", operate)).toEqual([]);
    expect(mods("graft", "good", operate)).toEqual([5]);
    expect(mods("graft", "best", operate)).toEqual([10]);
    expect(mods("graft", "best", { kind: "skill", skill: "dodge", char: "ag" })).toEqual([]);
  });

  it("Электу-Индукторы: зарядка Катушки −10/0/+10/+20, на прочий Tech-Use — ничего", () => {
    expect(mods("electoo", "poor", charge)).toEqual([-10]);
    expect(mods("electoo", "common", charge)).toEqual([]);
    expect(mods("electoo", "good", charge)).toEqual([10]);
    expect(mods("electoo", "best", charge)).toEqual([20]);
    expect(mods("electoo", "best", { kind: "skill", skill: "techUse", char: "int" })).toEqual([]);
  });

  const gas = { kind: "skill", char: "t" };
  it("Респираторный Блок: против газов как респиратор своего Качества +20/+30/+40/+40", () => {
    expect(mods("respirator", "poor", gas)).toEqual([20]);
    expect(mods("respirator", "common", gas)).toEqual([30]);
    expect(mods("respirator", "good", gas)).toEqual([40]);
    expect(mods("respirator", "best", gas)).toEqual([40]);
  });

  it("Ноосферное Подключение: тесты Ноосферы −10/0/+5/+10, прочий Tech-Use — ничего", () => {
    expect(mods("uplink", "poor", noo)).toEqual([-10]);
    expect(mods("uplink", "common", noo)).toEqual([]);
    expect(mods("uplink", "good", noo)).toEqual([5]);
    expect(mods("uplink", "best", noo)).toEqual([10]);
    expect(mods("uplink", "best", { kind: "skill", skill: "techUse", char: "int" })).toEqual([]);
  });

  it("не установлен (лежит в сумке) — не даёт ничего", () => {
    expect(mods("graft", "best", operate, false)).toEqual([]);
  });
});

// wdbc-6rjtc.8: штраф Poor.Q приезжал в окно «⚡ Зарядки» и Ноосферного
// Сканирования галочкой, снятой по умолчанию, — навязанный штраф игрок мог
// просто не отметить. Теперь он в блоке «Состояние (учтено в Пороге)»;
// бонусы Good/Best остаются галочками.
describe("Poor.Q — штраф считается сам, Good/Best — галочкой", () => {
  for (const [k, ctx, good] of [["electoo", charge, 10], ["uplink", noo, 5]]) {
    it(k, () => {
      const poor = actorWith(k, "poor");
      expect(ruleAutoModsHtml(poor, ctx).total).toBe(-10);
      expect(ruleRollModsHtml(poor, ctx).mods.map(m => m.value)).toEqual([]);
      const g = actorWith(k, "good");
      expect(ruleAutoModsHtml(g, ctx).total).toBe(0);
      expect(ruleRollModsHtml(g, ctx).mods.map(m => m.value)).toEqual([good]);
    });
  }
});

describe("Импланты Механикум: резерв-константы в согласии с паком", () => {
  it("тот же набор имён и тексты эффекта", () => {
    const pack = Object.keys(ID).map(k => doc(k));
    expect(MECHANICUS_IMPLANTS.map(i => i.name).sort()).toEqual(pack.map(d => d.name).sort());
    for (const c of MECHANICUS_IMPLANTS) {
      const d = pack.find(p => p.name === c.name);
      expect(c.system.effect, c.name).toBe(d.system.effect);
    }
  });
  it("Катушка Потенции из констант тоже несёт заряды по Качеству", () => {
    const c = MECHANICUS_IMPLANTS.find(i => /Potentia Coil/.test(i.name));
    expect(c.system.energyMax).toEqual({ poor: 1, common: 3, good: 5, best: 7 });
  });
});
