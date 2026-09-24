// test/combat/squeeze.test.mjs
//
// Стены и Двери (wdbc-x1nz.2, стр. 31): живой детект протискивания сквозь
// дверь уже половины Базы — карточка-напоминание в чат, без вымышленного
// числа (книга нарочно не даёт штраф формулой). Хуки Foundry (Hooks.on)
// заглушка не исполняет — тот же приём, что test/combat/free-attack.test.mjs:
// колбэки ловятся локальным перехватчиком.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkSqueeze, postSqueezeReminder, initSqueezeHooks, squeezeBaseSize } from "../../module/combat/squeeze.mjs";

function fakeActor({ type = "character", uuid = "Actor.stub", name = "Носильщик" } = {}) {
  return { type, uuid, name, items: [], system: {} };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.settings = { get: () => "roll" };
  globalThis.game.user = { id: "u1" };
});

describe("checkSqueeze: чистая проверка по готовым данным", () => {
  const cellPx = 100;
  const door = { c: [100, 0, 100, 100] }; // вертикальная дверь, 1 клетка

  it("Базы 2×2, дверь в 1 клетку (половина) — ещё не теснота", () => {
    const result = checkSqueeze({
      fromCenter: { x: 0, y: 50 }, toCenter: { x: 200, y: 50 },
      doorWalls: [door], cellPx, baseSize: 2
    });
    expect(result).toBeNull();
  });

  it("Базы 3×3, та же дверь в 1 клетку — уже теснота (1 < 1.5)", () => {
    const result = checkSqueeze({
      fromCenter: { x: 0, y: 50 }, toCenter: { x: 200, y: 50 },
      doorWalls: [door], cellPx, baseSize: 3
    });
    expect(result).toEqual({ doorWidthCells: 1 });
  });

  it("движение не пересекло дверь — null", () => {
    const result = checkSqueeze({
      fromCenter: { x: 0, y: 500 }, toCenter: { x: 200, y: 500 },
      doorWalls: [door], cellPx, baseSize: 3
    });
    expect(result).toBeNull();
  });

  it("baseSize отсутствует (нет ни правила, ни размера токена) — проверять не с чем, null", () => {
    const result = checkSqueeze({
      fromCenter: { x: 0, y: 50 }, toCenter: { x: 200, y: 50 },
      doorWalls: [door], cellPx, baseSize: null
    });
    expect(result).toBeNull();
  });
});

describe("postSqueezeReminder", () => {
  it("постит карточку с книжной цитатой, без вымышленного числа штрафа", async () => {
    await postSqueezeReminder(fakeActor(), "Герой");
    expect(captured.chat.length).toBe(1);
    const content = captured.chat[0].content;
    expect(content).toContain("протискивается");
    expect(content).toContain("может");
    // Никакого готового числа модификатора в самом тексте подсказки (SVG-иконка
    // выше по разметке своей path-геометрией даёт ложные "-1.4" и т.п. — не в счёт).
    const threshold = content.match(/roll-threshold">(.*?)<\/div>/s)[1];
    expect(threshold).not.toMatch(/[-+]\d+/);
  });
});

describe("initSqueezeHooks: подписка на Foundry-хуки", () => {
  let handlers;
  beforeEach(() => {
    handlers = {};
    globalThis.Hooks.on = (name, fn) => { (handlers[name] ??= []).push(fn); };
    initSqueezeHooks();
  });

  function fire(name, ...args) {
    return Promise.all((handlers[name] || []).map(fn => fn(...args)));
  }

  /** Токен-документ-заглушка: x/y/width/height как у настоящего TokenDocument. */
  function tokenDoc({ id, x = 0, y = 50, width = 1, height = 1, actor, name = "Токен" } = {}) {
    const scene = {
      grid: { size: 100 },
      walls: { contents: [{ door: 1, c: [100, 0, 100, 100] }] } // дверь в 1 клетку
    };
    return { id, x, y, width, height, actor, name, parent: scene };
  }

  it("регистрирует preUpdateToken/updateToken/deleteToken", () => {
    expect(handlers.preUpdateToken?.length).toBe(1);
    expect(handlers.updateToken?.length).toBe(1);
    expect(handlers.deleteToken?.length).toBe(1);
  });

  it("протискивание через узкую дверь (Базы 3×3 — крупная раса) — постит напоминание", async () => {
    const actor = fakeActor({ uuid: "Actor.big" });
    actor.items = [];
    // largeBase через раcу нельзя (raceDef недоступен без constants), поэтому
    // подставим напрямую через armor largeBase — то же поле, что читает
    // actorBaseSizeCells (module/combat/tactical-map.mjs::armorLargeBase).
    actor.items = [{ type: "armor", system: { equipped: true, largeBase: true } }];
    const doc = tokenDoc({ id: "t1", actor });

    fire("preUpdateToken", doc, { x: 0, y: 50 });
    doc.x = 200; // токен физически передвинут за тот же вызов, тем же приёмом, что free-attack.test.mjs
    await fire("updateToken", doc, { x: 200 }, {}, "u1");

    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("протискивается");
  });

  it("обычная База 2×2, та же дверь в 1 клетку — не теснота, ничего не постит", async () => {
    const actor = fakeActor();
    const doc = tokenDoc({ id: "t2", actor });

    fire("preUpdateToken", doc, { x: 0, y: 50 });
    doc.x = 200;
    await fire("updateToken", doc, { x: 200 }, {}, "u1");

    expect(captured.chat.length).toBe(0);
  });

  it("чужой апдейт (другой userId) — не постит", async () => {
    const actor = fakeActor();
    actor.items = [{ type: "armor", system: { equipped: true, largeBase: true } }];
    const doc = tokenDoc({ id: "t3", actor });

    fire("preUpdateToken", doc, { x: 0, y: 50 });
    doc.x = 200;
    await fire("updateToken", doc, { x: 200 }, {}, "someoneElse");

    expect(captured.chat.length).toBe(0);
  });

  it("deleteToken чистит запись ДО апдейта — отменённый драг не всплывает", async () => {
    const actor = fakeActor();
    actor.items = [{ type: "armor", system: { equipped: true, largeBase: true } }];
    const doc = tokenDoc({ id: "t4", actor });

    fire("preUpdateToken", doc, { x: 0, y: 50 });
    fire("deleteToken", doc);
    doc.x = 200;
    await fire("updateToken", doc, { x: 200 }, {}, "u1");

    expect(captured.chat.length).toBe(0);
  });

  it("протухшая по TTL запись не всплывает", async () => {
    vi.useFakeTimers();
    try {
      const actor = fakeActor();
      actor.items = [{ type: "armor", system: { equipped: true, largeBase: true } }];
      const doc = tokenDoc({ id: "t5", actor });
      const other = tokenDoc({ id: "o5", actor: fakeActor() });

      fire("preUpdateToken", doc, { x: 0, y: 50 });
      vi.advanceTimersByTime(6000); // > PRE_MOVE_TTL_MS (5с)
      fire("preUpdateToken", other, { x: 300, y: 50 });

      doc.x = 200;
      await fire("updateToken", doc, { x: 200 }, {}, "u1");

      expect(captured.chat.length).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

// wdbc-bjy1.9 (решение владельца, 23.09.2026): у Размера 2+ Базу по книге
// решает ГМ — и выражает это размером токена. Он и становится Базой.
describe("squeezeBaseSize — База для проверки тесноты", () => {
  it("обычный/крупный персонаж — База по правилу (2/3), токен не важен", () => {
    expect(squeezeBaseSize(2, 1, 1)).toBe(2);
    expect(squeezeBaseSize(3, 1, 1)).toBe(3);
  });

  it("Размер 2+ (правило вернуло null) — База = больший размер токена в клетках", () => {
    expect(squeezeBaseSize(null, 3, 3)).toBe(3);
    expect(squeezeBaseSize(null, 2, 4)).toBe(4);
  });

  it("Размер 2+, токен 3×3 в двери шириной 1 клетка — теснота", () => {
    const door = { c: [0, 0, 100, 0] };
    const res = checkSqueeze({
      fromCenter: { x: 50, y: -100 }, toCenter: { x: 50, y: 100 },
      doorWalls: [door], cellPx: 100, baseSize: squeezeBaseSize(null, 3, 3)
    });
    expect(res).toEqual({ doorWidthCells: 1 });
  });
});
