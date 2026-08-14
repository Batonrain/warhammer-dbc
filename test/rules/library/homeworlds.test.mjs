import { describe, it, expect } from "vitest";
import { hasRuleFlag, ruleFlagLabels } from "../../../module/rules/flags.mjs";
import { HOMEWORLD_BY_KEY } from "../../../module/constants/homeworlds.mjs";
import { TEMPLE_RULES, DEATH_RULES, INDUSTRIAL_RULES, CEMETERY_RULES }
  from "../../../module/rules/library/homeworlds.mjs";

/**
 * Подставной актор: ключ Происхождения лежит на предмете-носителе, как в игре
 * (rules/sources.mjs, hwKey). Никакого Foundry.
 */
const actor = (hwKey) => ({
  name: "Подопытный",
  system: { race: "human", characteristics: {} },
  items: hwKey ? [{ type: "homeworld", system: { key: hwKey } }] : []
});

describe("Особенности Происхождений в реестре правил", () => {
  it("данные мира отдают свои правила источнику", () => {
    expect(HOMEWORLD_BY_KEY.temple.rules).toBe(TEMPLE_RULES);
    expect(HOMEWORLD_BY_KEY.death.rules).toBe(DEATH_RULES);
    expect(HOMEWORLD_BY_KEY.industrial.rules).toBe(INDUSTRIAL_RULES);
    expect(HOMEWORLD_BY_KEY.cemetery.rules).toBe(CEMETERY_RULES);
  });

  it("Мир-храм даёт возможность не потратить Очко", () => {
    expect(hasRuleFlag(actor("temple"), "fate.save")).toBe(true);
  });

  it("Мир смерти гасит «Цель Врасплох» по себе", () => {
    expect(hasRuleFlag(actor("death"), "attack.surpriseImmune")).toBe(true);
  });

  it("Промышленный мир помогает сверх лимита", () => {
    expect(hasRuleFlag(actor("industrial"), "assist.beyondCap")).toBe(true);
  });

  it("Мир-кладбище открывает «Веру в прошлое»", () => {
    expect(hasRuleFlag(actor("cemetery"), "fear.faithInThePast")).toBe(true);
  });

  it("чужое Происхождение возможности не даёт", () => {
    expect(hasRuleFlag(actor("hive"), "fate.save")).toBe(false);
    expect(hasRuleFlag(actor("temple"), "assist.beyondCap")).toBe(false);
  });

  it("без Происхождения возможностей нет вовсе", () => {
    expect(hasRuleFlag(actor(null), "fate.save")).toBe(false);
  });

  // Подпись нужна интерфейсу: диалог атаки пишет, ЧТО погасило модификатор,
  // а карточка Страха называет ею кнопку.
  it("возможность называет своё правило", () => {
    expect(ruleFlagLabels(actor("death"), "attack.surpriseImmune")).toEqual(["Паранойя Выжившего"]);
    expect(ruleFlagLabels(actor("cemetery"), "fear.faithInThePast")).toEqual(["Абсолютная вера в прошлое"]);
    expect(ruleFlagLabels(actor("hive"), "fate.save")).toEqual([]);
  });
});
