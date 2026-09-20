// test/combat/attack-crit-evasion-penalty.test.mjs
//
// Стр. 34, wdbc-x1nz.2.47: «Критический Успех на попадание накладывает штраф
// –30 на Избегания от этого попадания.» Критический диапазон — натуральные
// 1–5 (module/rules/roll-outcome.mjs::criticalOutcome), независимо от Предела.
// Штраф прибавляется к dodgeMod/parryMod, которые уже читают Уклонение,
// Парирование, Вираж и Уклонение верхом (одна и та же карточка).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Критический Успех на попадание: -30 к Избеганию цели (wdbc-x1nz.2.47)", () => {
  it("натуральный бросок 1-5 (крит) — Уклонение и Парирование несут -30", async () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [3, 5]; // 3 — крит-диапазон (1-5), попадание при Пороге 45
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("Критический Успех");
    expect(card()).toMatch(/wh-dodge-btn"[^>]*data-extra-mod="-30"/);
    expect(card()).toMatch(/wh-parry-btn"[^>]*data-extra-mod="-30"/);
  });

  it("обычное попадание (не крит) — штрафа нет", async () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [20, 5]; // 20 — вне крит-диапазона, попадание при Пороге 45
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).not.toContain("Критический Успех");
    expect(card()).toMatch(/wh-dodge-btn"[^>]*data-extra-mod="0"/);
    expect(card()).toMatch(/wh-parry-btn"[^>]*data-extra-mod="0"/);
  });

  it("крит-провал (96-100) не даёт штрафа Избеганию — это не Критический Успех", async () => {
    // Reliable (стр. 41, wdbc-x1nz.2.61): без него обычное стрелковое клинит
    // уже на 96+, а тест здесь проверяет карточку обычного крит-провала.
    const weapon = weaponFor({ weaponProps: [{ key: "reliable" }] });
    const actor  = actorFor({ items: [weapon] });
    captured.dice = [99, 5]; // провал теста (Порог 45) и крит-провал разом
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("Критический Провал");
    // Промах — карточка Избегания вовсе не рендерится (нет попадания).
    expect(card()).not.toContain("wh-dodge-btn");
  });
});
