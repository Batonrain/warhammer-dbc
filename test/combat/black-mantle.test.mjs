// test/combat/black-mantle.test.mjs
//
// Меланохром и Чёрная Мантия (корбук, «Радиация», стр. 484 + Геносемя, гл. 3; 3-b530).
//   • «Работающий Меланохром (геносемя) −1» — строка таблицы защиты: установленный
//     имплант вычитается из уровня фона (rules/radiation-scene.mjs::radProtectionOf).
//   • Талант Black Mantle: за полудействие усиленный режим — защита −2 ВМЕСТО −1
//     (итог −2, не −3) и «любой урон в T от радиации» −1 до минимума 1
//     (combat/radiation.mjs::radDamageToCreature). Тики фона дают ровно 1 — не меняются.
//   • Исключения книги (возраст 31–35 лет, Кархародоны) сознательно не моделируются.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MELANOCHROME_KEY, BLACK_MANTLE_KEY, BLACK_MANTLE_ON_FLAG,
  melanochromeMode, radProtectionOf, effectiveRadiation, radDamageAfterMelanochrome
} from "../../module/rules/radiation-scene.mjs";
import { applyRadHit } from "../../module/combat/radiation.mjs";
import { blackMantleHtml, setBlackMantleOn } from "../../module/apps/black-mantle.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";
import { RAD_PROTECTION } from "../../module/constants/environment.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const NS = "warhammer-dbc";
const saved = getRuleSources();

/** Имплант Меланохром / Талант Мантии как предметы актора (форма — как у настоящих документов). */
const capEntry = key => ({ operator: "AND", entries: [{ kind: "capability", capabilityKey: key }] });
const doc = (type, name, flagData) => {
  const flags = { [NS]: flagData };
  return { type, name, system: {}, flags, getFlag: (_s, k) => flags[NS][k] };
};
const melanochrome = () => doc("implant", "13. Меланохром / Melanochrome", { installed: true, mechanics: [capEntry(MELANOCHROME_KEY)] });
const mantle = ({ on = false } = {}) =>
  doc("talent", "Black Mantle / Чёрная Мантия", { mechanics: [capEntry(BLACK_MANTLE_KEY)], ...(on ? { [BLACK_MANTLE_ON_FLAG]: true } : {}) });

/** Источник правил, выдающий возможности «как будто предметы активны». */
function grant(...keys) {
  clearRuleSources();
  registerRuleSource("test", () => keys.map(k => ({ id: `t.${k}`, when: {}, effects: [{ kind: "grantFlag", target: k }] })));
}

beforeEach(() => { resetCaptured(); clearRuleSources(); globalThis.game.time = { worldTime: 1000 }; });
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of saved) registerRuleSource(key, fn);
  delete globalThis.game.combat; delete globalThis.game.combats;
});

describe("Меланохром: базовая защита −1", () => {
  it("работающий Меланохром даёт −1 строкой «Меланохром −1»; без него защиты нет", () => {
    grant(MELANOCHROME_KEY);
    const p = radProtectionOf({ items: [melanochrome()] }, "");
    expect(p).toMatchObject({ immune: false, total: 1 });
    expect(p.parts).toContain("Меланохром −1");
    clearRuleSources();
    expect(radProtectionOf({ items: [] }, "").total).toBe(0);
  });

  it("копия Меланохрома без записи (до «Обновить мир»): установленный работает по имени, снятый — нет", () => {
    const stale = installed => doc("implant", "13. Меланохром / Melanochrome", { installed, mechanics: [] });
    expect(melanochromeMode({ items: [stale(true)] })).toBe("base");
    expect(melanochromeMode({ items: [stale(false)] })).toBe(null);
  });

  it("складывается с бронёй и укрытием (строки таблицы книги — разные виды защиты)", () => {
    grant(MELANOCHROME_KEY);
    const armour = { type: "armor", name: "Power", system: { armorType: "power", equipped: true, properties: [] } };
    expect(radProtectionOf({ items: [armour, melanochrome()] }, "tin").total).toBe(3 + 1 + 1);
  });

  it("иммунитет сильнее: Терминаторская броня — иммунитет, Меланохром не вмешивается", () => {
    grant(MELANOCHROME_KEY);
    const term = { type: "armor", name: "Terminator Armour", system: { armorType: "power", equipped: true, properties: [] } };
    expect(radProtectionOf({ items: [term, melanochrome()] }, "").immune).toBe(true);
  });

  it("уровень фона 3 при Меланохроме → эффективный 2; фон 1 → радиации нет вовсе", () => {
    grant(MELANOCHROME_KEY);
    const a = { items: [melanochrome()] };
    expect(effectiveRadiation(3, radProtectionOf(a, ""))).toBe(2);
    expect(effectiveRadiation(1, radProtectionOf(a, ""))).toBe(0);
  });

  it("справочник окна «Окружение» держит ту же строку: Работающий Меланохром −1", () => {
    expect(RAD_PROTECTION).toContainEqual(expect.objectContaining({ label: "Работающий Меланохром (геносемя)", val: "−1" }));
  });
});

describe("Чёрная Мантия: усиленный режим", () => {
  it("режим: нет импланта → null; имплант → base; имплант + Талант включён → enhanced", () => {
    expect(melanochromeMode({ items: [] })).toBeNull();
    grant(MELANOCHROME_KEY);
    expect(melanochromeMode({ items: [melanochrome()] })).toBe("base");
    grant(MELANOCHROME_KEY, BLACK_MANTLE_KEY);
    expect(melanochromeMode({ items: [melanochrome(), mantle({ on: false })] })).toBe("base");
    expect(melanochromeMode({ items: [melanochrome(), mantle({ on: true })] })).toBe("enhanced");
  });

  it("защита −2 ВМЕСТО −1: итог −2, не −3", () => {
    grant(MELANOCHROME_KEY, BLACK_MANTLE_KEY);
    const p = radProtectionOf({ items: [melanochrome(), mantle({ on: true })] }, "");
    expect(p.total).toBe(2);
    expect(p.parts).toEqual(["Меланохром, усиленный режим −2"]);
  });

  it("включённый режим без самого импланта ничего не даёт (усиливать нечего)", () => {
    grant(BLACK_MANTLE_KEY);
    const a = { items: [mantle({ on: true })] };
    expect(melanochromeMode(a)).toBeNull();
    expect(radProtectionOf(a, "").total).toBe(0);
  });

  // Талант с этим именем опознаётся и без возможности (копия до «Обновить мир»,
  // приёмка #554), поэтому «нет Таланта» — это флаг режима на чужом Таланте.
  it("флаг режима на чужом Таланте, Мантии нет — только базовый −1", () => {
    grant(MELANOCHROME_KEY);
    const other = doc("talent", "Other / Другой", { mechanics: [], [BLACK_MANTLE_ON_FLAG]: true });
    expect(melanochromeMode({ items: [melanochrome(), other] })).toBe("base");
  });

  it("копия Мантии без записи (до «Обновить мир») — режим по имени работает", () => {
    grant(MELANOCHROME_KEY);
    const stale = doc("talent", "Black Mantle / Чёрная Мантия", { mechanics: [], [BLACK_MANTLE_ON_FLAG]: true });
    expect(melanochromeMode({ items: [melanochrome(), stale] })).toBe("enhanced");
  });
});

describe("урон Rad(X) в T: Чёрная Мантия −1 до минимума 1", () => {
  it("чистая функция: X−1, но не ниже 1; ноль остаётся нолём; без режима — без изменений", () => {
    grant(MELANOCHROME_KEY, BLACK_MANTLE_KEY);
    const on = { items: [melanochrome(), mantle({ on: true })] };
    expect(radDamageAfterMelanochrome(on, 5)).toBe(4);
    expect(radDamageAfterMelanochrome(on, 2)).toBe(1);
    expect(radDamageAfterMelanochrome(on, 1)).toBe(1);
    expect(radDamageAfterMelanochrome(on, 0)).toBe(0);
    const base = { items: [melanochrome(), mantle({ on: false })] };
    expect(radDamageAfterMelanochrome(base, 5)).toBe(5);
    expect(radDamageAfterMelanochrome({ items: [] }, 5)).toBe(5);
  });

  function creature(items) {
    const flags = {};
    const actor = {
      uuid: "Actor.m1", name: "Десантник", type: "character", isOwner: true, items,
      system: { characteristics: { t: { total: 60 } }, charLoss: { t: 0 }, charLossAt: {}, conditions: {} },
      getFlag: (_s, k) => flags[k],
      setFlag: async (_s, k, v) => { flags[k] = v; },
      update: async data => {
        for (const [path, value] of Object.entries(data)) {
          if (path === "system.charLoss.t") actor.system.charLoss.t = value;
        }
      }
    };
    return actor;
  }

  it("оружие Rad(1d5), выпало 4: с включённой Мантией в T ложится 3, без неё — 4", async () => {
    grant(MELANOCHROME_KEY, BLACK_MANTLE_KEY);
    const on = creature([melanochrome(), mantle({ on: true })]);
    captured.dice = [4];
    await applyRadHit(on, { formula: "1d5", label: "Рад" });
    expect(on.system.charLoss.t).toBe(3);
    expect(captured.chat.map(c => c.content).join("\n")).toContain("Чёрная Мантия");

    resetCaptured();
    const off = creature([melanochrome(), mantle({ on: false })]);
    captured.dice = [4];
    await applyRadHit(off, { formula: "1d5", label: "Рад" });
    expect(off.system.charLoss.t).toBe(4);
  });

  it("выпало 1: минимум 1 — усиленный Меланохром урон не гасит целиком", async () => {
    grant(MELANOCHROME_KEY, BLACK_MANTLE_KEY);
    const a = creature([melanochrome(), mantle({ on: true })]);
    captured.dice = [1];
    await applyRadHit(a, { formula: "1d5", label: "Рад" });
    expect(a.system.charLoss.t).toBe(1);
  });

  it("базовый Меланохром (без Таланта) оружие Rad не смягчает — книга: «но не оружию со свойством Rad»", async () => {
    grant(MELANOCHROME_KEY);
    const a = creature([melanochrome()]);
    captured.dice = [4];
    await applyRadHit(a, { formula: "1d5", label: "Рад" });
    expect(a.system.charLoss.t).toBe(4);
  });
});

describe("тумблер на листе Таланта", () => {
  it("панель есть у Чёрной Мантии на акторе и несёт флажок; у чужого Таланта и вне актора пусто", () => {
    const m = mantle({ on: true });
    m.id = "T1";
    const html = blackMantleHtml(m, { id: "a" });
    expect(html).toContain("black-mantle-cb");
    expect(html).toContain("checked");
    expect(blackMantleHtml(mantle(), { id: "a" })).not.toContain("checked");
    expect(blackMantleHtml(mantle(), null)).toBe("");
    expect(blackMantleHtml(doc("talent", "Другой", { mechanics: [] }), { id: "a" })).toBe("");
  });

  it("setBlackMantleOn пишет флаг только на Мантии", async () => {
    const calls = [];
    const m = mantle(); m.setFlag = async (...a) => calls.push(a);
    await setBlackMantleOn(m, true);
    expect(calls).toEqual([[NS, BLACK_MANTLE_ON_FLAG, true]]);
    const other = doc("talent", "Другой", {}); other.setFlag = async (...a) => calls.push(a);
    await setBlackMantleOn(other, true);
    expect(calls).toHaveLength(1);
  });
});

describe("данные пака и реестр возможностей", () => {
  it("Меланохром несёт запись capability implant.melanochrome", () => {
    const doc = packDocById("packs-src/implants/Импланты_Астартес", "N2PwMFQAf5qaDLK6");
    const entries = doc.flags[NS].mechanics.flatMap(g => g.entries);
    expect(entries.some(e => e.kind === "capability" && e.capabilityKey === MELANOCHROME_KEY)).toBe(true);
    expect(doc.flags[NS].installed).toBe(true);
    expect(doc.system.notes).toMatch(/31–35|31-35/);
    expect(doc.system.notes).toMatch(/Кархародон/);
  });

  it("реестр: у обеих возможностей есть читатель; устаревшее «не применяется» у Крепкого как Камень снято", () => {
    expect(CAPABILITIES[MELANOCHROME_KEY].reader).toContain("radiation-scene.mjs");
    expect(CAPABILITIES[BLACK_MANTLE_KEY].reader).toContain("radiation");
    expect(CAPABILITIES["trait.hardAsStone"].label).not.toContain("фон радиации к акторам не применяется");
  });
});
