// test/combat/fall-damage-perfect-landing.test.mjs
//
// Падение — Группирование (стр. 30): «Если на Группировании набрано больше
// Успехов, чем высота падения, персонаж приземляется на ноги и не получает
// никакого урона» — отдельная гарантия СВЕРХ обычного «−1 урона за успех»,
// раньше не реализованная (штраф просто вычитался из 1d10+высоты, бросок
// мог всё равно дать урон). wdbc-x1nz.2.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { _resolveFallDamage } from "../../module/combat/movement-actions.mjs";

function actor() {
  return { name: "Подставной", items: [], system: { characteristics: { ag: { total: 40 } } } };
}

beforeEach(resetCaptured);

describe("_resolveFallDamage: Группирование — успехов больше высоты ⇒ 0 урона (стр. 30)", () => {
  // Порядок бросков внутри _resolveFallDamage: сперва 1d10+высота (урон),
  // ПОТОМ (если tuck) Acrobatics 1d100 — dice[0] всегда урон, dice[1] тест.
  it("высота 0, 1 успех (Acrobatics) — гарантированный 0, даже при высоком d10", async () => {
    captured.dice = [10, 35]; // 1d10 роняет 10; Acrobatics 35≤40 → 1 ст. успеха
    await _resolveFallDamage(actor(), 0, { tuck: true });
    const html = captured.chat.at(-1).content;
    expect(html).toContain("приземлился на ноги без урона");
    expect(html).toContain("<b>0</b> I");
  });

  it("успехов РОВНО столько же, сколько высота — не считается «больше», обычная вычитающая формула", async () => {
    captured.dice = [5, 35]; // 1d10=5; Acrobatics 35≤40 → 1 ст. успеха; высота тоже 1
    await _resolveFallDamage(actor(), 1, { tuck: true });
    const html = captured.chat.at(-1).content;
    expect(html).not.toContain("приземлился на ноги без урона");
  });

  it("провал Группирования — обычная формула, без спецправила", async () => {
    captured.dice = [5, 99]; // 1d10=5; Acrobatics 99>40 — провал
    await _resolveFallDamage(actor(), 0, { tuck: true });
    const html = captured.chat.at(-1).content;
    expect(html).not.toContain("приземлился на ноги без урона");
    expect(html).toContain("<b>5</b> I");
  });

  it("без Группирования (tuck:false) — спецправило не участвует", async () => {
    captured.dice = [7];
    await _resolveFallDamage(actor(), 0, { tuck: false });
    const html = captured.chat.at(-1).content;
    expect(html).toContain("<b>7</b> I");
  });
});
