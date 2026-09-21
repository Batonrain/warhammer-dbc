// test/combat/knockdown.test.mjs
//
// Стр. 14, wdbc-x1nz.2.66.5: «Повалить» — эффект победы (цель Ничком, 5+
// Успехов — доп. урон/Усталость на выбор) и запрет/штраф по Размеру.
// Штраф (в отличие от Напролома) несёт МЕНЬШАЯ сторона — здесь
// автоматизирован только случай «инициатор меньше цели» (см. заголовок
// module/combat/knockdown.mjs), симметричный случай «цель меньше» не
// покрыт (тот же честный предел, что у bulldozeSizePenalty).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor } from "../support/combat-fixtures.mjs";
import { resolveKnockdownSuccess, knockdownForbidden, knockdownSizePenalty, knockdownSizeDiff } from "../../module/combat/knockdown.mjs";

beforeEach(() => resetCaptured());

describe("knockdownSizeDiff / knockdownForbidden / knockdownSizePenalty", () => {
  it("цель того же Размера — diff 0, не запрещено, штрафа нет", () => {
    const actor = actorFor({ size: 4 });
    const target = actorFor({ size: 4 });
    expect(knockdownSizeDiff(actor, target)).toBe(0);
    expect(knockdownForbidden(actor, target)).toBe(false);
    expect(knockdownSizePenalty(actor, target)).toBe(0);
  });

  it("цель на 1 Размер крупнее — не запрещено (запрет только с 2+)", () => {
    const actor = actorFor({ size: 4 });
    const target = actorFor({ size: 5 });
    expect(knockdownForbidden(actor, target)).toBe(false);
  });

  it("цель на 2 Размера крупнее — запрещено", () => {
    const actor = actorFor({ size: 3 });
    const target = actorFor({ size: 5 });
    expect(knockdownForbidden(actor, target)).toBe(true);
  });

  it("инициатор МЕНЬШЕ цели на 2 — штраф −20 (не запрещено)", () => {
    const actor = actorFor({ size: 3 });
    const target = actorFor({ size: 5 });
    expect(knockdownSizePenalty(actor, target)).toBe(-20);
  });

  it("инициатор КРУПНЕЕ цели — подсказка штрафа не покрывает симметричный случай, 0", () => {
    const actor = actorFor({ size: 5 });
    const target = actorFor({ size: 3 });
    expect(knockdownSizePenalty(actor, target)).toBe(0);
  });
});

describe("resolveKnockdownSuccess", () => {
  it("успех <5 Успехов — цель Ничком, доп. эффекта нет", async () => {
    const actor = actorFor({});
    const target = actorFor({ conditions: {} });
    let updated = null;
    target.update = async fields => { updated = fields; };

    await resolveKnockdownSuccess(actor, { deg: 3, target });

    expect(updated).toMatchObject({ "system.conditions.prone": true });
    expect(captured.chat.at(-1).content).not.toContain("5+ Успехов");
  });

  it("5+ Успехов, игрок соглашается на доп. эффект — урон и Усталость применяются", async () => {
    const actor = actorFor({ characteristics: { s: { total: 40, bonus: 4 } } });
    const target = actorFor({ conditions: { fatigue: { value: 0 } } });
    target.items.contents = target.items; // applyDamageToActor читает actor.items.contents
    target.update = async () => {};
    captured.dice = [3]; // 1d5 → 3, + S.b 4 = 7
    globalThis.Dialog = { confirm: async () => true };

    await resolveKnockdownSuccess(actor, { deg: 5, target });

    expect(captured.chat.some(c => c.content.includes("7") && c.content.includes("Усталости"))).toBe(true);
  });

  it("5+ Успехов, игрок отказывается — только Ничком, без доп. урона", async () => {
    const actor = actorFor({});
    const target = actorFor({ conditions: {} });
    target.update = async () => {};
    globalThis.Dialog = { confirm: async () => false };

    await resolveKnockdownSuccess(actor, { deg: 6, target });

    expect(captured.chat.at(-1).content).not.toContain("Усталости");
  });

  it("без выцеленной цели — предупреждает, не падает", async () => {
    const actor = actorFor({});
    await resolveKnockdownSuccess(actor, { deg: 6, target: null });
    expect(captured.warnings.some(w => w.includes("не выцелена"))).toBe(true);
  });
});
