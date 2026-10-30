// test/combat/clobber.test.mjs
//
// Clobber / Поколотить (Талант Метания, Sahara 3-8318): попадание метательным оружием, весящим не меньше ¼ цели →
// S+0 цели (−10 при ≥½, −20 при тяжелее цели), Провал — Ничком. Правило — rules/throwing-talents.mjs::clobberPlan,
// обвязка — combat/clobber.mjs.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { clobberOfferFor, clobberOfferHtml, resolveClobberClick } from "../../module/combat/clobber.mjs";

const CLOBBER = { id: "n", name: "Clobber / Поколотить", type: "talent", system: {} };
const byKey = {
  id: "k", name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [{ id: "e", kind: "capability", capabilityKey: "throwing.core.clobber", label: "" }] }] } }
};
const card = () => captured.chat.map(m => m.content ?? "").join("\n");

/** Цель: вес тела и носимое снаряжение — как в Записях и на вкладке Ношения. */
function victim({ kg = 80, carried = 0, type = "character", name = "Жертва", uuid = "Actor.vic" } = {}) {
  const t = {
    id: uuid.replace("Actor.", ""), name, type, uuid, isOwner: true, updates: [],
    system: {
      bio: { weight: kg }, encumbrance: { current: carried },
      characteristics: { s: char(40), t: char(40), wp: char(40), ag: char(40), int: char(40) },
      conditions: {}, size: 4
    },
    items: Object.assign([], { contents: [], get: () => null }), effects: Object.assign([], { contents: [] }),
    getFlag: () => undefined,
    async update(data) {
      this.updates.push(data);
      for (const [p, v] of Object.entries(data)) this.system.conditions[p.split(".").at(-1)] = v;
    }
  };
  return t;
}
const thrower = (items = []) => {
  const a = actorFor({ items, characteristics: { ws: char(45), bs: char(45), s: char(40), t: char(40), ag: char(35) } });
  a.uuid = "Actor.thrower"; a.isOwner = true;
  return a;
};
const target = actor => ({ actor, document: { uuid: "Scene.s.Token.t" } });

describe("clobberOfferFor", () => {
  it("без Таланта предложения нет", () => {
    expect(clobberOfferFor(thrower([]), { projectileKg: 30, target: victim() })).toBeNull();
  });
  it("Талант опознаётся по имени и по ключу Возможности", () => {
    expect(clobberOfferFor(thrower([CLOBBER]), { projectileKg: 30, target: victim() })).toMatchObject({ status: "ok", mod: 0 });
    expect(clobberOfferFor(thrower([byKey]), { projectileKg: 30, target: victim() })).toMatchObject({ status: "ok" });
  });
  it("вес цели — тело плюс носимое: 80 + 40 = 120 кг, снаряд 60 кг ровно ½ → −10", () => {
    expect(clobberOfferFor(thrower([CLOBBER]), { projectileKg: 60, target: victim({ kg: 80, carried: 40 }) }))
      .toMatchObject({ status: "ok", mod: -10, targetKg: 120 });
  });
  it("вес тела не заполнен (NPC бестиария), а снаряжение есть — сравнивать нечего, а не «снаряд против рюкзака»", () => {
    const o = clobberOfferFor(thrower([CLOBBER]), { projectileKg: 2, target: victim({ kg: 0, carried: 4 }) });
    expect(o).toMatchObject({ status: "noTargetWeight", targetKg: 0 });
    expect(clobberOfferHtml(o, "Actor.thrower")).not.toContain("wh-clobber-btn");
  });
  it("технику, Орду и т.п. не сбивают — предложения нет", () => {
    for (const type of ["vehicle", "horde", "squad"])
      expect(clobberOfferFor(thrower([CLOBBER]), { projectileKg: 30, target: victim({ type }) })).toBeNull();
  });
});

describe("clobberOfferHtml", () => {
  const offer = o => clobberOfferFor(thrower([CLOBBER]), o);
  it("кнопка несёт штраф и uuid цели", () => {
    const html = clobberOfferHtml(offer({ projectileKg: 100, target: victim({ kg: 80 }) }), "Actor.thrower");
    expect(html).toContain("wh-clobber-btn");
    expect(html).toContain('data-mod="-20"');
    expect(html).toContain('data-target-uuid="Actor.vic"');
  });
  it("лёгкий снаряд — только пояснение, кнопки нет", () => {
    const html = clobberOfferHtml(offer({ projectileKg: 1, target: victim() }), "Actor.thrower");
    expect(html).not.toContain("wh-clobber-btn");
    expect(html).toContain("легче ¼");
  });
  it("вес цели не заполнен — пояснение про Записи → Вес", () => {
    const html = clobberOfferHtml(offer({ projectileKg: 20, target: victim({ kg: 0 }) }), "Actor.thrower");
    expect(html).not.toContain("wh-clobber-btn");
    expect(html).toContain("Вес");
  });
  it("null — пустая строка", () => expect(clobberOfferHtml(null, "x")).toBe(""));
});

describe("карточка попадания метательным оружием", () => {
  const rock = (weight, extra = {}) => weaponFor({ weaponClass: "thrown", damage: "1d10", rof_single: 1, rof_semi: 0, weight, ...extra }, { name: "Валун" });
  beforeEach(() => { resetCaptured(); });
  const throwAt = async (items, weapon, vic, dice = [10, 5, 5, 5]) => {
    const a = thrower([...items, weapon]);
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([target(vic)]) };
    captured.dice = dice;
    await _executeAttackRoll(a, weapon, "bs", 60, "single", null, {});
  };

  it("Поколотить: попадание тяжёлым снарядом — кнопка с S−10", async () => {
    await throwAt([CLOBBER], rock(50), victim({ kg: 80 }));
    expect(card()).toContain("wh-clobber-btn");
    expect(card()).toContain('data-mod="-10"');
  });
  it("без Таланта кнопки и пояснения нет", async () => {
    await throwAt([], rock(50), victim({ kg: 80 }));
    expect(card()).not.toContain("clobber");
    expect(card()).not.toContain("Поколотить");
  });
  it("промах — ничего не предлагается", async () => {
    await throwAt([CLOBBER], rock(50), victim({ kg: 80 }), [99]);
    expect(card()).not.toContain("wh-clobber-btn");
  });
  it("не метательное оружие (стрелковое) — ничего не предлагается", async () => {
    await throwAt([CLOBBER], weaponFor({ weaponClass: "basic", damage: "1d10", weight: 50 }), victim({ kg: 80 }));
    expect(card()).not.toContain("wh-clobber-btn");
  });
});

describe("клик «Поколотить»", () => {
  let registry, prev;
  let seq = 0;
  const msg = () => {
    const flags = {};
    return { id: `m${++seq}`, isOwner: true, getFlag: (s, k) => flags[`${s}.${k}`], setFlag: async (s, k, v) => { flags[`${s}.${k}`] = v; } };
  };
  beforeEach(() => {
    resetCaptured();
    registry = {};
    prev = globalThis.fromUuid;
    globalThis.fromUuid = async uuid => registry[uuid] ?? null;
    globalThis.game.user = { isGM: true };
  });
  afterEach(() => { globalThis.fromUuid = prev; });

  it("Провал S-теста — цель Ничком; бросок идёт с переданным штрафом", async () => {
    const a = thrower([CLOBBER]); const v = victim();
    registry[a.uuid] = a; registry[v.uuid] = v;
    captured.dice = [50];                              // S 40 − 10 = 30, 50 > 30 — провал
    expect(await resolveClobberClick(a.uuid, v.uuid, "-10", msg())).toBe(true);
    expect(v.system.conditions.prone).toBe(true);
    expect(card()).toContain("30");                    // порог 40−10 виден в карточке
  });
  it("Успех S-теста — цель остаётся на ногах", async () => {
    const a = thrower([CLOBBER]); const v = victim();
    registry[a.uuid] = a; registry[v.uuid] = v;
    captured.dice = [20];
    expect(await resolveClobberClick(a.uuid, v.uuid, "-10", msg())).toBe(true);
    expect(v.system.conditions.prone).toBeUndefined();
  });
  it("положительное значение штрафа с кнопки читается как 0 (бонус подделать нельзя)", async () => {
    const a = thrower([CLOBBER]); const v = victim();
    registry[a.uuid] = a; registry[v.uuid] = v;
    captured.dice = [45];                              // порог 40: 45 > 40 — провал даже при подделке +20
    await resolveClobberClick(a.uuid, v.uuid, "20", msg());
    expect(v.system.conditions.prone).toBe(true);
  });
  it("слишком большой штраф с кнопки зажимается до −20", async () => {
    const a = thrower([CLOBBER]); const v = victim();
    registry[a.uuid] = a; registry[v.uuid] = v;
    captured.dice = [25];                              // S 40: при −20 порог 20 → провал; при подделке −100 — тоже провал, а при честных −10 порог 30 — успех
    await resolveClobberClick(a.uuid, v.uuid, "-100", msg());
    expect(card()).toContain("20");
    expect(card()).not.toMatch(/[−-]60/);
  });
  it("второй клик с той же карточки не бросает снова", async () => {
    const a = thrower([CLOBBER]); const v = victim();
    registry[a.uuid] = a; registry[v.uuid] = v;
    const m = msg();
    captured.dice = [50, 50];
    await resolveClobberClick(a.uuid, v.uuid, "0", m);
    const before = captured.chat.length;
    expect(await resolveClobberClick(a.uuid, v.uuid, "0", m)).toBe(false);
    expect(captured.chat.length).toBe(before);
  });
  it("у метателя нет Таланта — тест не бросается", async () => {
    const a = thrower([]); const v = victim();
    registry[a.uuid] = a; registry[v.uuid] = v;
    captured.dice = [50];
    expect(await resolveClobberClick(a.uuid, v.uuid, "0", msg())).toBe(false);
    expect(captured.chat).toHaveLength(0);
  });
});

describe("«Метнуть» обычным предметом (improvised-item.mjs)", () => {
  const thrown = (talents, itemKg, victimKg) => {
    const a = {
      id: "a1", name: "Метатель", uuid: "Actor.a1", items: talents,
      system: {
        characteristics: { ws: { total: 40 }, s: { total: 90, bonus: 9 }, bs: { total: 40 }, a: { total: 40 } },
        encumbrance: { carry: 200 }, bio: { weight: 100 }
      },
      update: async () => {}
    };
    globalThis.game.user.targets = [{ actor: victim({ kg: victimKg }) }];
    return { a, item: { id: "i1", name: "Бочка", system: { weight: itemKg } } };
  };
  beforeEach(async () => { resetCaptured(); globalThis.game.time = { worldTime: 0 }; });

  it("с Талантом: попадание тяжёлым предметом — кнопка Поколотить", async () => {
    const { useThrowItem } = await import("../../module/combat/improvised-item.mjs");
    captured.nextRoll = 5;
    const { a, item } = thrown([CLOBBER], 60, 80);       // 60/80 = 75% → −10; тир heavy (≤200, >100)
    await useThrowItem(a, item);
    expect(card()).toContain("wh-clobber-btn");
    expect(card()).toContain('data-mod="-10"');
  });
  it("без Таланта кнопки нет", async () => {
    const { useThrowItem } = await import("../../module/combat/improvised-item.mjs");
    captured.nextRoll = 5;
    const { a, item } = thrown([], 60, 80);
    await useThrowItem(a, item);
    expect(card()).not.toContain("wh-clobber-btn");
  });
  it("промах — кнопки нет", async () => {
    const { useThrowItem } = await import("../../module/combat/improvised-item.mjs");
    captured.nextRoll = 99;
    const { a, item } = thrown([CLOBBER], 60, 80);
    await useThrowItem(a, item);
    expect(card()).not.toContain("wh-clobber-btn");
  });
});
