// test/combat/horde-tokens.test.mjs
//
// Что Орда читает прямо с карты: наложенные токены («Прячась в Орде») и
// соприкосновение строёв («Орда против Орды»). Счёт по клеткам живёт без
// Foundry (rules/horde-geometry.mjs) — здесь проверяется перевод токенов в
// клетки и решения, которые на нём строятся.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { tokenRect, hordeSheltering, hidingInHordeSplit,
         hordeContacts, hordeMeleeTargets } from "../../module/combat/horde-tokens.mjs";

const GRID = 100;

/** Токен: координаты в пикселях, ширина/высота — в клетках, как в Foundry. */
function token({ name = "Токен", type = "character", gx = 0, gy = 0, w = 1, h = 1,
                 disposition = 1 } = {}) {
  const actor = { type, name, uuid: `Actor.${name}` };
  return {
    name, actor,
    document: { x: gx * GRID, y: gy * GRID, width: w, height: h, disposition, actor }
  };
}

/** Ставит сцену: перечисленные токены становятся содержимым канвы. */
function scene(...tokens) {
  globalThis.canvas = { grid: { size: GRID }, tokens: { placeables: tokens } };
}

beforeEach(() => { globalThis.canvas = {}; });

describe("токен в клетках сетки", () => {
  it("пиксели переводятся в клетки по размеру сетки", () => {
    scene();
    expect(tokenRect(token({ gx: 3, gy: 4, w: 2, h: 2 })))
      .toEqual({ x: 3, y: 4, w: 2, h: 2 });
  });
});

describe("прячась в Орде", () => {
  it("персонаж внутри союзной Орды прикрыт ею", () => {
    const horde = token({ name: "Толпа", type: "horde", w: 4, h: 4 });
    const hero  = token({ name: "Герой", gx: 2, gy: 2 });
    scene(horde, hero);
    expect(hordeSheltering(hero)).toBe(horde);
  });

  it("вражеская Орда живым щитом не работает", () => {
    const horde = token({ name: "Толпа", type: "horde", w: 4, h: 4, disposition: -1 });
    const hero  = token({ name: "Герой", gx: 2, gy: 2, disposition: 1 });
    scene(horde, hero);
    expect(hordeSheltering(hero)).toBeNull();
  });

  it("Орда рядом, но не под персонажем, не прикрывает", () => {
    const horde = token({ name: "Толпа", type: "horde", w: 4, h: 4 });
    const hero  = token({ name: "Герой", gx: 4, gy: 0 });
    scene(horde, hero);
    expect(hordeSheltering(hero)).toBeNull();
  });

  it("прятаться могут персонаж, демон и демон-принц — но не техника", () => {
    const horde = token({ name: "Толпа", type: "horde", w: 4, h: 4 });
    for (const type of ["character", "daemon", "demonPrince"]) {
      const who = token({ name: type, type, gx: 1, gy: 1 });
      scene(horde, who);
      expect(hordeSheltering(who)).toBe(horde);
    }
    const tank = token({ name: "Химера", type: "vehicle", gx: 1, gy: 1 });
    scene(horde, tank);
    expect(hordeSheltering(tank)).toBeNull();
  });
});

describe("раскладка попаданий, уведённых в Орду", () => {
  function sheltered() {
    const horde = token({ name: "Толпа", type: "horde", w: 4, h: 4 });
    const hero  = token({ name: "Герой", gx: 1, gy: 1 });
    scene(horde, hero);
    return hero;
  }

  it("одиночный выстрел с нечётным броском уходит в толпу", () => {
    expect(hidingInHordeSplit(sheltered(), { hitsCount: 1, rv: 43 }))
      .toMatchObject({ count: 1, mask: [true] });
  });

  it("одиночный выстрел с чётным броском достаётся персонажу", () => {
    expect(hidingInHordeSplit(sheltered(), { hitsCount: 1, rv: 42 })).toBeNull();
  });

  it("очередь отдаёт толпе каждое нечётное попадание", () => {
    expect(hidingInHordeSplit(sheltered(), { hitsCount: 4, rv: 42, burst: true }))
      .toMatchObject({ count: 2, mask: [true, false, true, false] });
  });

  it("Избирательная атака бьёт именно в персонажа", () => {
    expect(hidingInHordeSplit(sheltered(), { hitsCount: 1, rv: 43, selective: true })).toBeNull();
  });

  it("в рукопашной правило не работает", () => {
    expect(hidingInHordeSplit(sheltered(), { hitsCount: 1, rv: 43, isMelee: true })).toBeNull();
  });

  it("правило возвращает саму Орду — попадание применится к ней", () => {
    const split = hidingInHordeSplit(sheltered(), { hitsCount: 1, rv: 43 });
    expect(split.horde.type).toBe("horde");
  });
});

describe("Орда против Орды", () => {
  it("соседняя Орда считается по клеткам своего контакта", () => {
    const ours  = token({ name: "Наши",  type: "horde", w: 3, h: 3 });
    const theirs = token({ name: "Чужие", type: "horde", gx: 3, w: 3, h: 3 });
    scene(ours, theirs);
    expect(hordeContacts(ours)).toMatchObject([{ name: "Чужие", targets: 3 }]);
  });

  it("разошедшиеся Орды в контакт не попадают", () => {
    const ours   = token({ name: "Наши",  type: "horde", w: 3, h: 3 });
    const theirs = token({ name: "Чужие", type: "horde", gx: 9, w: 3, h: 3 });
    scene(ours, theirs);
    expect(hordeContacts(ours)).toEqual([]);
  });

  it("своя Магнитуда остаётся потолком целей", () => {
    const ours   = token({ name: "Наши",  type: "horde", w: 6, h: 6 });
    const theirs = token({ name: "Чужие", type: "horde", gx: 6, w: 3, h: 6 });
    scene(ours, theirs);
    // Контакт даёт 6 целей, но Магнитуда позволяет только 2.
    expect(hordeMeleeTargets(ours, { magnitudeTargets: 2 }).targets).toBe(2);
    expect(hordeMeleeTargets(ours, { magnitudeTargets: 20 }).targets).toBe(6);
  });

  it("без соседних Орд целей столько, сколько даёт Магнитуда", () => {
    const ours = token({ name: "Наши", type: "horde", w: 3, h: 3 });
    scene(ours);
    expect(hordeMeleeTargets(ours, { magnitudeTargets: 8 }))
      .toEqual({ targets: 8, note: "" });
  });

  it("расклад по строям объясняется в примечании", () => {
    const ours   = token({ name: "Наши",  type: "horde", w: 3, h: 3 });
    const theirs = token({ name: "Чужие", type: "horde", gx: 3, w: 3, h: 3 });
    scene(ours, theirs);
    expect(hordeMeleeTargets(ours, { magnitudeTargets: 8 }).note).toContain("Чужие — 3");
  });
});
