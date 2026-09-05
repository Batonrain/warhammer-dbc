// Невидимые метки актора как Состояния (wdbc-5uae) — чтение из чужого
// источника и гашение самого источника. Чистый модуль, заглушка Foundry не
// нужна и не должна понадобиться.

import { describe, it, expect } from "vitest";
import { CONDITION_MIRRORS, MIRROR_KEYS, isMirroredCondition, readMirror,
         readAllMirrors, mirrorClearPatch, mirrorItemSources, isMirrorClearable }
  from "../../module/rules/condition-mirrors.mjs";

const FLAG = "warhammer-dbc";

/** Актор с флагами — и через getFlag (документ), и голым объектом (данные). */
const actor = ({ system = {}, flags = {}, items = [] } = {}) => ({
  system, items,
  flags: { [FLAG]: flags },
  getFlag: (scope, key) => (scope === FLAG ? flags[key] : undefined)
});

const itemWithFlag = (key, value) => ({
  getFlag: (scope, k) => (scope === FLAG && k === key ? value : undefined)
});

describe("isMirroredCondition", () => {
  it("метки — зеркала, книжные Состояния — нет", () => {
    expect(isMirroredCondition("inRage")).toBe(true);
    expect(isMirroredCondition("running")).toBe(true);
    expect(isMirroredCondition("stunned")).toBe(false);
    expect(isMirroredCondition("")).toBe(false);
  });

  it("у каждого зеркала есть подпись и хотя бы один источник", () => {
    for (const key of MIRROR_KEYS) {
      expect(CONDITION_MIRRORS[key].label).toBeTruthy();
      expect(CONDITION_MIRRORS[key].sources.length).toBeGreaterThan(0);
    }
  });
});

describe("readMirror: поле схемы", () => {
  it("Ярость читается из system.inRage", () => {
    expect(readMirror(actor({ system: { inRage: true } }), "inRage")).toBe(true);
    expect(readMirror(actor({ system: { inRage: false } }), "inRage")).toBe(false);
    expect(readMirror(actor(), "inRage")).toBe(false);
  });
});

describe("readMirror: флаг актора", () => {
  it("Бег читается из флага", () => {
    expect(readMirror(actor({ flags: { running: true } }), "running")).toBe(true);
    expect(readMirror(actor(), "running")).toBe(false);
  });

  it("читается и без getFlag — по голым данным", () => {
    const raw = { system: {}, items: [], flags: { [FLAG]: { running: true } } };
    expect(readMirror(raw, "running")).toBe(true);
  });

  it("Марш: флаг несёт ВИД марша, а не «да/нет» — важен сам факт значения", () => {
    expect(readMirror(actor({ flags: { marchKind: "forced" } }), "marching")).toBe(true);
    expect(readMirror(actor({ flags: { marchKind: "" } }), "marching")).toBe(false);
  });
});

describe("readMirror: несколько источников — это ИЛИ", () => {
  it("«Отмечен» одинаково значит любую из трёх меток", () => {
    // Метка Аватара Резни — объект, а не булево: непустой объект считается
    // стоящей меткой.
    expect(readMirror(actor({ flags: { avatarOfSlaughterMark: { berserkerUuid: "a" } } }), "marked")).toBe(true);
    expect(readMirror(actor({ flags: { hexMarkedPrey: true } }), "marked")).toBe(true);
    expect(readMirror(actor({ flags: { bowToAudienceMark: { by: "x" } } }), "marked")).toBe(true);
    expect(readMirror(actor(), "marked")).toBe(false);
  });
});

describe("readMirror: флаг на предмете", () => {
  it("«Щит поднят» — про вещь в руках, но виден на акторе", () => {
    const withShield = actor({ items: [itemWithFlag("shieldRaised", true)] });
    expect(readMirror(withShield, "shieldUp")).toBe(true);
  });

  it("щит есть, но опущен — метки нет", () => {
    expect(readMirror(actor({ items: [itemWithFlag("shieldRaised", false)] }), "shieldUp")).toBe(false);
    expect(readMirror(actor({ items: [] }), "shieldUp")).toBe(false);
  });

  it("хотя бы один поднятый из нескольких щитов — считается", () => {
    const two = actor({ items: [itemWithFlag("shieldRaised", false), itemWithFlag("shieldRaised", true)] });
    expect(readMirror(two, "shieldUp")).toBe(true);
  });
});

describe("readAllMirrors", () => {
  it("отдаёт все ключи разом, каждый булевым", () => {
    const got = readAllMirrors(actor({ system: { inRage: true }, flags: { running: true } }));
    expect(got.inRage).toBe(true);
    expect(got.running).toBe(true);
    expect(got.marked).toBe(false);
    expect(Object.keys(got).sort()).toEqual([...MIRROR_KEYS].sort());
  });

  it("пустой актор — все ложны, ничего не падает", () => {
    expect(Object.values(readAllMirrors(actor()))).not.toContain(true);
    expect(Object.values(readAllMirrors(null))).not.toContain(true);
  });
});

describe("mirrorClearPatch: гасится ИСТОЧНИК, а не отражение", () => {
  it("поле схемы гасится записью false", () => {
    expect(mirrorClearPatch("inRage")).toEqual({ "system.inRage": false });
  });

  it("флаг гасится штатным «-=», как в экономике действий", () => {
    expect(mirrorClearPatch("running")).toEqual({ [`flags.${FLAG}.-=running`]: null });
  });

  it("несколько источников гасятся все разом — иначе метка «вернулась бы»", () => {
    expect(mirrorClearPatch("marked")).toEqual({
      [`flags.${FLAG}.-=avatarOfSlaughterMark`]: null,
      [`flags.${FLAG}.-=hexMarkedPrey`]: null,
      [`flags.${FLAG}.-=bowToAudienceMark`]: null
    });
  });

  it("источник на предмете патчем актора не достаётся — патч пуст", () => {
    expect(mirrorClearPatch("shieldUp")).toEqual({});
    expect(mirrorItemSources("shieldUp")).toEqual([{ kind: "itemFlag", path: "shieldRaised" }]);
  });

  it("незнакомый ключ — пустой патч, а не исключение", () => {
    expect(mirrorClearPatch("stunned")).toEqual({});
  });
});

describe("isMirrorClearable", () => {
  it("крестик показывается только там, где он реально что-то сделает", () => {
    // Врать крестиком, который ничего не делает, хуже, чем не рисовать его.
    expect(isMirrorClearable("inRage")).toBe(true);
    expect(isMirrorClearable("marked")).toBe(true);
    expect(isMirrorClearable("shieldUp")).toBe(false);
  });
});
