// test/combat/takedown-standup.test.mjs
//
// That's Not All / Ещё Не Всё, читатель метки: помеченной цели Вскочить не
// помогает, и любое вставание стоит +1 ОД сверх обычного (решение владельца
// 23.10.2026). Метку ставит кнопка Вырубания (test/combat/takedown.test.mjs).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { _standUpPlain, _standUpJump, declareStandUp, movementMenuItems } from "../../module/combat/movement-actions.mjs";
import { LEAP_UP_DENIED_FLAG } from "../../module/rules/takedown.mjs";
import { rollFlip } from "../../module/combat/flip.mjs";

const talent = name => ({ id: `t-${name}`, type: "talent", name });
const LEAP_UP = "Leap Up / Вскочить";

function fighter({ items = [], ap = 3, prone = true, marked = false, acro = 40 } = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const flags = marked ? { [`warhammer-dbc.${LEAP_UP_DENIED_FLAG}`]: true } : {};
  const a = {
    id: "actor-1", name: "Лежачий", type: "character", uuid: "Actor.a1", items: list,
    system: {
      actionPoints: { value: ap, max: 3 },
      conditions: { prone },
      characteristics: { ag: { total: acro, bonus: 4 }, s: { total: 40, bonus: 4 }, int: { total: 40 } },
      skills: { acrobatics: { total: acro } },
      movement: { halfMove: 4, move: 8, charge: 12, run: 24, sprintRun: 48 },
      fatigue: { value: 0 }
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    getActiveTokens: () => [],
    update: async data => {
      for (const [path, value] of Object.entries(data)) {
        const m = path.match(/^flags\.([^.]+)\.-=(.+)$/);
        if (m) { delete flags[`${m[1]}.${m[2]}`]; continue; }
        const keys = path.split(".");
        let node = a;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    }
  };
  for (const item of list) item.parent = a;
  return a;
}

beforeEach(() => { resetCaptured(); globalThis.game.combat = { started: true, id: "c1", round: 1 }; });
afterEach(() => { resetCaptured(); globalThis.game.combat = undefined; });

describe("Встать обычным способом: цена помеченного", () => {
  it("без метки по-прежнему 1 ОД (регрессия)", async () => {
    const a = fighter();
    await _standUpPlain(a);
    expect(a.system.actionPoints.value).toBe(2);
    expect(a.system.conditions.prone).toBe(false);
  });

  it("помеченный без Вскочить: 2 ОД (1 обычный + 1), метка снята вместе с «Повален»", async () => {
    const a = fighter({ marked: true });
    await _standUpPlain(a);
    expect(a.system.actionPoints.value).toBe(1);
    expect(a.system.conditions.prone).toBe(false);
    expect(a.getFlag("warhammer-dbc", LEAP_UP_DENIED_FLAG)).toBeUndefined();
  });

  it("помеченный со Вскочить: Вскочить не работает — те же 2 ОД, а не 0", async () => {
    const a = fighter({ marked: true, items: [talent(LEAP_UP)] });
    await _standUpPlain(a);
    expect(a.system.actionPoints.value).toBe(1);
    expect(a.system.conditions.prone).toBe(false);
    expect(captured.chat.at(-1).content).not.toContain("Вскочить. Встал автоматически");
  });

  it("не помеченный со Вскочить — по-прежнему бесплатно (регрессия)", async () => {
    const a = fighter({ items: [talent(LEAP_UP)] });
    await _standUpPlain(a);
    expect(a.system.actionPoints.value).toBe(3);
  });

  it("помеченный, но ОД хватает только на 1 — не встаёт, предупреждение", async () => {
    const a = fighter({ marked: true, ap: 1 });
    await _standUpPlain(a);
    expect(a.system.conditions.prone).toBe(true);
    expect(a.system.actionPoints.value).toBe(1);
    expect(captured.warnings.length).toBeGreaterThan(0);
  });

  it("карточка называет причину надбавки", async () => {
    const a = fighter({ marked: true });
    await _standUpPlain(a);
    expect(captured.chat.at(-1).content).toContain("Ещё Не Всё");
  });
});

describe("declareStandUp: помеченному Вскочить не обходит диалог выбора способа", () => {
  it("со Вскочить, но помеченный — открывается диалог, а не автоматическое вставание", async () => {
    const a = fighter({ marked: true, items: [talent(LEAP_UP)] });
    declareStandUp(a);
    await Promise.resolve();
    expect(captured.dialog).not.toBeNull();
    expect(a.system.conditions.prone).toBe(true);
  });

  it("со Вскочить и без метки — диалога нет (регрессия)", async () => {
    const a = fighter({ items: [talent(LEAP_UP)] });
    await declareStandUp(a);
    expect(captured.dialog).toBeNull();
    expect(a.system.conditions.prone).toBe(false);
  });
});

describe("Встать прыжком: помеченный платит +1 ОД", () => {
  it("успех теста: не бесплатно, а за 1 ОД", async () => {
    captured.dice = [1];   // 1 из d100 — гарантированный успех
    const a = fighter({ marked: true });
    await _standUpJump(a);
    expect(a.system.conditions.prone).toBe(false);
    expect(a.system.actionPoints.value).toBe(2);
  });

  it("успех теста без метки — бесплатно (регрессия)", async () => {
    captured.dice = [1];
    const a = fighter();
    await _standUpJump(a);
    expect(a.system.conditions.prone).toBe(false);
    expect(a.system.actionPoints.value).toBe(3);
  });

  it("успех, но помеченному нечем платить (0 ОД) — остаётся лежать", async () => {
    captured.dice = [1];
    const a = fighter({ marked: true, ap: 0 });
    await _standUpJump(a);
    expect(a.system.conditions.prone).toBe(true);
  });

  it("провал теста: обычные 1 ОД + 1 = 2 ОД", async () => {
    captured.dice = [99];
    const a = fighter({ marked: true });
    await _standUpJump(a);
    expect(a.system.conditions.prone).toBe(false);
    expect(a.system.actionPoints.value).toBe(1);
  });
});

describe("Кувырок (Flip): помеченный платит +1 ОД и за него", () => {
  const FLIP = talent("Flip / Кувырок");

  it("успех без метки — бесплатно (регрессия)", async () => {
    captured.dice = [5];
    const a = fighter({ items: [FLIP] });
    const res = await rollFlip(a);
    expect(res.success).toBe(true);
    expect(a.system.actionPoints.value).toBe(3);
    expect(a.system.conditions.prone).toBe(false);
  });

  it("успех с меткой — встал, но заплатил 1 ОД, метка снята", async () => {
    captured.dice = [5];
    const a = fighter({ items: [FLIP], marked: true });
    const res = await rollFlip(a);
    expect(res.success).toBe(true);
    expect(a.system.actionPoints.value).toBe(2);
    expect(a.system.conditions.prone).toBe(false);
    expect(a.getFlag("warhammer-dbc", LEAP_UP_DENIED_FLAG)).toBeUndefined();
    expect(captured.chat.at(-1).content).toContain("Ещё Не Всё");
  });

  it("успех с меткой, но ОД нет — остаётся Повален", async () => {
    captured.dice = [5];
    const a = fighter({ items: [FLIP], marked: true, ap: 0 });
    const res = await rollFlip(a);
    expect(res.success).toBe(false);
    expect(a.system.conditions.prone).toBe(true);
  });

  it("провал с меткой — ОД не тратятся", async () => {
    captured.dice = [95];
    const a = fighter({ items: [FLIP], marked: true });
    await rollFlip(a);
    expect(a.system.actionPoints.value).toBe(3);
    expect(a.system.conditions.prone).toBe(true);
  });
});

describe("Меню движения: пункт «Встать» показывает надбавку", () => {
  it("помеченный — подпись цены +1 ОД", () => {
    const item = movementMenuItems(fighter({ marked: true })).find(i => i.key === "standup");
    expect(item?.cost).toContain("+1 ОД");
  });
  it("без метки — подписи нет", () => {
    const item = movementMenuItems(fighter()).find(i => i.key === "standup");
    expect(item?.cost).toBe("");
  });
});
