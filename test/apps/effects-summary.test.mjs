// test/apps/effects-summary.test.mjs
// ════════════════════════════════════════════════════════════════════════
//  Вкладка «Эффекты» (wdbc-xrsh): чистые функции без Foundry-заглушки —
//  сбор применимых эффектов, знак баф/дебаф, категория цели, группировка.
// ════════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import {
  effectTargetCategory, effectChangeSign, formatChangeValue,
  applicableActorEffects, buildActiveEffectRows, groupActiveEffectRows,
  activeEffectsTabContext
} from "../../module/apps/effects-summary.mjs";

const change = (key, type, value) => ({ key, type, value, phase: "final", priority: 0 });

function fx({ id, name = "Эффект", changes = [], disabled = false, transfer, img } = {}) {
  const out = { id, name, disabled, system: { changes } };
  if (transfer !== undefined) out.transfer = transfer;
  if (img) out.img = img;
  return out;
}

function item({ id, name, effects = [], img } = {}) {
  return { id, name, uuid: `Item.${id}`, img: img || "icons/item.svg", effects };
}

function actor({ effects = [], items = [] } = {}) {
  return { id: "actor-1", name: "Персонаж", uuid: "Actor.actor-1", effects, items };
}

describe("effectTargetCategory", () => {
  it("характеристика — по префиксу system.characteristics.", () => {
    expect(effectTargetCategory("system.characteristics.ws.totalFx")).toBe("characteristic");
    expect(effectTargetCategory("system.characteristics.t.bonusFx")).toBe("characteristic");
  });
  it("всё остальное — «иной показатель»", () => {
    expect(effectTargetCategory("system.armorBonus.head")).toBe("other");
    expect(effectTargetCategory("system.fearRating")).toBe("other");
    expect(effectTargetCategory("system.initiative")).toBe("other");
  });
});

describe("effectChangeSign", () => {
  it("add: знак самого числа", () => {
    expect(effectChangeSign(change("k", "add", 2))).toBe(1);
    expect(effectChangeSign(change("k", "add", -2))).toBe(-1);
  });
  it("subtract: обратный знак числа (вычесть положительное — дебаф)", () => {
    expect(effectChangeSign(change("k", "subtract", 2))).toBe(-1);
    expect(effectChangeSign(change("k", "subtract", -2))).toBe(1);
  });
  it("multiply: ×1 и больше — баф, дробное — дебаф", () => {
    expect(effectChangeSign(change("k", "multiply", 2))).toBe(1);
    expect(effectChangeSign(change("k", "multiply", 0.5))).toBe(-1);
  });
  it("upgrade — знак значения, downgrade — всегда дебаф-ограничение", () => {
    expect(effectChangeSign(change("k", "upgrade", 3))).toBe(1);
    expect(effectChangeSign(change("k", "downgrade", 3))).toBe(-1);
  });
  it("divideUp/divideDown: делитель ≥1 — дебаф, дробный — баф", () => {
    expect(effectChangeSign(change("k", "divideUp", 2))).toBe(-1);
    expect(effectChangeSign(change("k", "divideDown", 0.5))).toBe(1);
  });
  it("override и нулевое значение — знак не определён", () => {
    expect(effectChangeSign(change("k", "override", 5))).toBe(0);
    expect(effectChangeSign(change("k", "add", 0))).toBe(0);
  });
});

describe("formatChangeValue", () => {
  it("склеивает подпись операции со значением", () => {
    expect(formatChangeValue(change("k", "add", 2))).toBe("+2");
    expect(formatChangeValue(change("k", "subtract", 3))).toBe("−3");
  });

  // wdbc-8cyu: Foundry хранит дебаф тем же режимом ADD с отрицательным
  // value (нет отдельного режима «вычесть») — фиксированный префикс "+"
  // из EFFECT_TYPE_LABELS.add давал «+-5» вместо «−5».
  it("ADD с отрицательным value — знак минус, не «+-N»", () => {
    expect(formatChangeValue(change("k", "add", -5))).toBe("−5");
  });

  it("ADD с положительным value — по-прежнему плюс", () => {
    expect(formatChangeValue(change("k", "add", 5))).toBe("+5");
  });
});

describe("applicableActorEffects", () => {
  it("берёт свои эффекты актора и transfer:true эффекты предметов", () => {
    const a = actor({
      effects: [fx({ id: "own-1" })],
      items: [
        item({ id: "it-1", effects: [fx({ id: "fx-transfer" })] }),               // transfer не задан → по умолчанию true
        item({ id: "it-2", effects: [fx({ id: "fx-no-transfer", transfer: false })] })
      ]
    });
    const found = applicableActorEffects(a);
    const ids = found.map(f => f.effect.id);
    expect(ids).toContain("own-1");
    expect(ids).toContain("fx-transfer");
    expect(ids).not.toContain("fx-no-transfer");
  });

  it("источник своего эффекта — сам актор, источник эффекта предмета — предмет", () => {
    const it1 = item({ id: "it-1", effects: [fx({ id: "fx-1" })] });
    const a = actor({ effects: [fx({ id: "own-1" })], items: [it1] });
    const found = applicableActorEffects(a);
    expect(found.find(f => f.effect.id === "own-1").source).toBe(a);
    expect(found.find(f => f.effect.id === "fx-1").source).toBe(it1);
  });
});

describe("buildActiveEffectRows", () => {
  it("одна строка на один change активного эффекта", () => {
    const it1 = item({ id: "it-1", name: "Броня предка", effects: [
      fx({ id: "fx-1", name: "Благословение", changes: [
        change("system.characteristics.t.totalFx", "add", 3),
        change("system.armorBonus.body", "add", 1)
      ] })
    ] });
    const a = actor({ items: [it1] });
    const rows = buildActiveEffectRows(a);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      sourceName: "Броня предка", targetLabel: expect.stringContaining("T"),
      value: 3, sign: 1, category: "characteristic"
    });
    expect(rows[1]).toMatchObject({ sign: 1, category: "other" });
  });

  it("отключённый эффект (disabled) в сводку не попадает", () => {
    const it1 = item({ id: "it-1", effects: [
      fx({ id: "fx-1", disabled: true, changes: [change("system.fearRating", "upgrade", 2)] })
    ] });
    expect(buildActiveEffectRows(actor({ items: [it1] }))).toHaveLength(0);
  });

  it("change без key пропускается", () => {
    const it1 = item({ id: "it-1", effects: [
      fx({ id: "fx-1", changes: [change("", "add", 2)] })
    ] });
    expect(buildActiveEffectRows(actor({ items: [it1] }))).toHaveLength(0);
  });

  // Мутация: если бы sign не читался из change.type/value, а был всегда +1,
  // этот тест поймал бы порчу/штраф, замаскированную под баф.
  it("отрицательный change (штраф характеристике) размечен дебафом", () => {
    const it1 = item({ id: "it-1", name: "Мутация: Хрупкость", effects: [
      fx({ id: "fx-1", changes: [change("system.characteristics.t.bonusFx", "add", -2)] })
    ] });
    const rows = buildActiveEffectRows(actor({ items: [it1] }));
    expect(rows[0].sign).toBe(-1);
    expect(rows[0].category).toBe("characteristic");
  });
});

describe("groupActiveEffectRows / activeEffectsTabContext", () => {
  it("раскладывает по знаку и категории цели", () => {
    const it1 = item({ id: "it-1", name: "Талант", effects: [
      fx({ id: "fx-buff-char", changes: [change("system.characteristics.ws.totalFx", "add", 5)] }),
      fx({ id: "fx-debuff-other", changes: [change("system.speed", "add", -1)] }),
      fx({ id: "fx-neutral", changes: [change("system.fearRating", "override", 3)] })
    ] });
    const ctx = activeEffectsTabContext(actor({ items: [it1] }));
    expect(ctx.activeEffectsGroups.buff.characteristic).toHaveLength(1);
    expect(ctx.activeEffectsGroups.debuff.other).toHaveLength(1);
    expect(ctx.activeEffectsGroups.neutral.other).toHaveLength(1);
    expect(ctx.activeEffectsCounts).toEqual({ buff: 1, debuff: 1, neutral: 1 });
    expect(ctx.activeEffectsEmpty).toBe(false);
  });

  it("нет активных эффектов — пустой контекст", () => {
    const ctx = activeEffectsTabContext(actor());
    expect(ctx.activeEffectsEmpty).toBe(true);
    expect(ctx.activeEffectsRows).toHaveLength(0);
  });

  // Мутация: если бы группировка молча складывала buff/debuff в одну корзину,
  // этот тест бы не различил счётчики.
  it("баф и дебаф на одной и той же характеристике не смешиваются", () => {
    const it1 = item({ id: "it-1", effects: [
      fx({ id: "fx-a", changes: [change("system.characteristics.s.totalFx", "add", 2)] }),
      fx({ id: "fx-b", changes: [change("system.characteristics.s.totalFx", "add", -1)] })
    ] });
    const groups = groupActiveEffectRows(buildActiveEffectRows(actor({ items: [it1] })));
    expect(groups.buff.characteristic).toHaveLength(1);
    expect(groups.debuff.characteristic).toHaveLength(1);
  });
});
