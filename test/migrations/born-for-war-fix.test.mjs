// test/migrations/born-for-war-fix.test.mjs
//
// wdbc-7ba: dccb2a08 сняло альтернативу «Стойкость +3» из первой ИЛИ-группы
// Предсказания «Ты рождён для войны» и поменяло op у второй (Int/Fel)
// add→subtract. У акторов, кому Предсказание досталось ДО этой правки,
// ActiveEffect несёт старые числа — ни applyItemMechanics, ни
// syncMechanicsEffects, ни «Обновить мир» их не пересобирают (ИЛИ-выбор
// отыгрывается один раз, диалогом, при выдаче). Эта миграция чинит changes
// эффекта напрямую.

import { describe, it, expect, afterEach } from "vitest";
import {
  isBornForWarItem, bornForWarHasStaleEffects, fixBornForWarItem, migrateBornForWarDivination
} from "../../module/migrations/born-for-war-fix.mjs";

const T_KEY   = "system.characteristics.t.totalFx";
const INT_KEY = "system.characteristics.int.totalFx";
const FEL_KEY = "system.characteristics.fel.totalFx";
const WS_KEY  = "system.characteristics.ws.totalFx";

function effect({ id, changes }) {
  return {
    id, disabled: false,
    system: { changes },
    async update(data) { if (data["system.changes"]) this.system.changes = data["system.changes"]; }
  };
}

function divinationItem({ id = "i1", key = "bornwar", name = "Ты рождён для войны", effects = [] } = {}) {
  return {
    id, name, type: "divination",
    system: { key },
    effects,
    async deleteEmbeddedDocuments(type, ids) {
      for (const eid of ids) {
        const i = this.effects.findIndex(e => e.id === eid);
        if (i !== -1) this.effects.splice(i, 1);
      }
    }
  };
}

describe("isBornForWarItem", () => {
  it("тип divination + system.key bornwar — да", () => {
    expect(isBornForWarItem(divinationItem())).toBe(true);
  });

  it("тип divination без key, но с точным именем — фолбэк по имени, да", () => {
    expect(isBornForWarItem(divinationItem({ key: "" }))).toBe(true);
  });

  it("другое Предсказание — нет", () => {
    expect(isBornForWarItem(divinationItem({ key: "other", name: "Прочее" }))).toBe(false);
  });

  it("не Предсказание вовсе — нет", () => {
    expect(isBornForWarItem({ type: "talent", name: "Ты рождён для войны" })).toBe(false);
  });
});

describe("bornForWarHasStaleEffects / fixBornForWarItem", () => {
  it("выбрана снятая «Т» (add) — расхождение найдено, эффект снимается целиком", async () => {
    const item = divinationItem({
      effects: [effect({ id: "e1", changes: [{ key: T_KEY, type: "add", value: 3, phase: "initial", priority: 0 }] })]
    });
    expect(bornForWarHasStaleEffects(item)).toBe(true);

    const fixed = await fixBornForWarItem(item);
    expect(fixed).toBe(true);
    expect(item.effects).toHaveLength(0);
    expect(bornForWarHasStaleEffects(item)).toBe(false);
  });

  it("выбран Int с op add (старый бонус вместо штрафа) — знак меняется на subtract, эффект остаётся", async () => {
    const item = divinationItem({
      effects: [effect({ id: "e2", changes: [{ key: INT_KEY, type: "add", value: 3, phase: "initial", priority: 0 }] })]
    });

    const fixed = await fixBornForWarItem(item);
    expect(fixed).toBe(true);
    expect(item.effects).toHaveLength(1);
    expect(item.effects[0].system.changes).toEqual([{ key: INT_KEY, type: "subtract", value: 3, phase: "initial", priority: 0 }]);
  });

  it("выбран Fel с op add — тот же знак меняется на subtract", async () => {
    const item = divinationItem({
      effects: [effect({ id: "e3", changes: [{ key: FEL_KEY, type: "add", value: 3, phase: "initial", priority: 0 }] })]
    });

    await fixBornForWarItem(item);
    expect(item.effects[0].system.changes).toEqual([{ key: FEL_KEY, type: "subtract", value: 3, phase: "initial", priority: 0 }]);
  });

  it("выбран WS (не Т, не Int/Fel) — расхождения нет, эффект не тронут", async () => {
    const item = divinationItem({
      effects: [effect({ id: "e4", changes: [{ key: WS_KEY, type: "add", value: 3, phase: "initial", priority: 0 }] })]
    });
    expect(bornForWarHasStaleEffects(item)).toBe(false);

    const fixed = await fixBornForWarItem(item);
    expect(fixed).toBe(false);
    expect(item.effects[0].system.changes).toEqual([{ key: WS_KEY, type: "add", value: 3, phase: "initial", priority: 0 }]);
  });

  it("уже верный вид (Int subtract) — расхождения нет, второй прогон ничего не меняет (идемпотентность)", async () => {
    const item = divinationItem({
      effects: [effect({ id: "e5", changes: [{ key: INT_KEY, type: "subtract", value: 3, phase: "initial", priority: 0 }] })]
    });
    expect(bornForWarHasStaleEffects(item)).toBe(false);
    expect(await fixBornForWarItem(item)).toBe(false);
  });

  it("оба эффекта разом (Т снятая + Int неверный знак) — оба правятся одним проходом", async () => {
    const item = divinationItem({
      effects: [
        effect({ id: "eT", changes: [{ key: T_KEY, type: "add", value: 3, phase: "initial", priority: 0 }] }),
        effect({ id: "eInt", changes: [{ key: INT_KEY, type: "add", value: 3, phase: "initial", priority: 0 }] })
      ]
    });

    const fixed = await fixBornForWarItem(item);
    expect(fixed).toBe(true);
    expect(item.effects).toHaveLength(1);
    expect(item.effects[0].id).toBe("eInt");
    expect(item.effects[0].system.changes[0].type).toBe("subtract");
  });

  it("не Предсказание «Ты рождён для войны» — не трогается, даже с теми же ключами", async () => {
    const item = divinationItem({
      key: "other", name: "Прочее",
      effects: [effect({ id: "e6", changes: [{ key: T_KEY, type: "add", value: 3, phase: "initial", priority: 0 }] })]
    });
    expect(bornForWarHasStaleEffects(item)).toBe(false);
    expect(await fixBornForWarItem(item)).toBe(false);
  });

  it("в эффекте есть и другая правка рядом — сносится только строка снятой Т, эффект живёт", async () => {
    const other = { key: "system.armorBonus.body", type: "add", value: 2, phase: "initial", priority: 0 };
    const item = divinationItem({
      effects: [effect({ id: "e7", changes: [
        { key: T_KEY, type: "add", value: 3, phase: "initial", priority: 0 }, other
      ] })]
    });

    await fixBornForWarItem(item);
    expect(item.effects).toHaveLength(1);
    expect(item.effects[0].system.changes).toEqual([other]);
  });
});

describe("migrateBornForWarDivination", () => {
  function actorWith(items) { return { items }; }

  it("правит только затронутые предметы у всех акторов мира, остальных не трогает", async () => {
    const badT = divinationItem({
      id: "badT",
      effects: [effect({ id: "e1", changes: [{ key: T_KEY, type: "add", value: 3, phase: "initial", priority: 0 }] })]
    });
    const badInt = divinationItem({
      id: "badInt",
      effects: [effect({ id: "e2", changes: [{ key: INT_KEY, type: "add", value: 3, phase: "initial", priority: 0 }] })]
    });
    const ok = divinationItem({
      id: "ok",
      effects: [effect({ id: "e3", changes: [{ key: FEL_KEY, type: "subtract", value: 3, phase: "initial", priority: 0 }] })]
    });
    const other = divinationItem({ id: "other", key: "other", name: "Прочее",
      effects: [effect({ id: "e4", changes: [{ key: T_KEY, type: "add", value: 3, phase: "initial", priority: 0 }] })] });

    globalThis.game = { user: { isGM: true }, actors: [actorWith([badT, ok, other]), actorWith([badInt])], scenes: [] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateBornForWarDivination();

    expect(res.fixed).toBe(2);
    expect(badT.effects).toHaveLength(0);
    expect(badInt.effects[0].system.changes[0].type).toBe("subtract");
    expect(other.effects[0].system.changes[0].type).toBe("add"); // не Предсказание — не тронут
  });

  it("не ГМ — предупреждает, ничего не трогает", async () => {
    const bad = divinationItem({
      effects: [effect({ id: "e1", changes: [{ key: T_KEY, type: "add", value: 3, phase: "initial", priority: 0 }] })]
    });
    globalThis.game = { user: { isGM: false }, actors: [actorWith([bad])] };
    let warned = false;
    globalThis.ui = { notifications: { info: () => {}, warn: () => { warned = true; } } };

    const res = await migrateBornForWarDivination();

    expect(warned).toBe(true);
    expect(res).toBeUndefined();
    expect(bad.effects).toHaveLength(1);
  });

  it("повторный прогон ничего не меняет (идемпотентность)", async () => {
    const bad = divinationItem({
      effects: [effect({ id: "e1", changes: [{ key: INT_KEY, type: "add", value: 3, phase: "initial", priority: 0 }] })]
    });
    globalThis.game = { user: { isGM: true }, actors: [actorWith([bad])], scenes: [] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    expect((await migrateBornForWarDivination()).fixed).toBe(1);
    expect((await migrateBornForWarDivination()).fixed).toBe(0);
  });

  it("ничего расходящегося — fixed:0, без ошибок", async () => {
    const ok = divinationItem({
      effects: [effect({ id: "e1", changes: [{ key: INT_KEY, type: "subtract", value: 3, phase: "initial", priority: 0 }] })]
    });
    globalThis.game = { user: { isGM: true }, actors: [actorWith([ok])], scenes: [] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateBornForWarDivination();
    expect(res.fixed).toBe(0);
  });

  it("несвязанный токен сцены (actorLink:false) — тоже правится", async () => {
    const bad = divinationItem({
      effects: [effect({ id: "e1", changes: [{ key: T_KEY, type: "add", value: 3, phase: "initial", priority: 0 }] })]
    });
    globalThis.game = {
      user: { isGM: true }, actors: [],
      scenes: [{ name: "Сцена", tokens: { contents: [
        { name: "Токен", actorLink: false, actor: actorWith([bad]) }
      ] } }]
    };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateBornForWarDivination();
    expect(res.fixed).toBe(1);
    expect(bad.effects).toHaveLength(0);
  });
});

// wdbc-059h: сбой на одном акторе не должен топить правку остальным.
describe("migrateBornForWarDivination: изоляция сбоя одного актора", () => {
  afterEach(() => { delete globalThis.game; delete globalThis.ui; });

  it("сбой на одном акторе не прерывает правку остальным и не топит их результат", async () => {
    const bad = divinationItem({
      id: "bad",
      effects: [effect({ id: "e1", changes: [{ key: T_KEY, type: "add", value: 3, phase: "initial", priority: 0 }] })]
    });
    bad.deleteEmbeddedDocuments = async () => { throw new Error("boom on bad"); };
    const good = divinationItem({
      id: "good",
      effects: [effect({ id: "e2", changes: [{ key: INT_KEY, type: "add", value: 3, phase: "initial", priority: 0 }] })]
    });

    globalThis.game = {
      user: { isGM: true },
      actors: [{ id: "a1", name: "Actor bad", items: [bad] }, { id: "a2", name: "Actor good", items: [good] }],
      scenes: []
    };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateBornForWarDivination();

    expect(res.fixed).toBe(1);
    expect(res.failed).toBe(1);
    expect(good.effects[0].system.changes[0].type).toBe("subtract");
    expect(bad.effects).toHaveLength(1); // не тронут, попробуется заново
  });
});
