import { describe, it, expect } from "vitest";
import { collectRules } from "../../../module/rules/collect.mjs";
import { RACES } from "../../../module/constants/races.mjs";
import { ASTARTES_RULES } from "../../../module/rules/library/astartes.mjs";

/** Подставной актор: обычный литерал, без Foundry. */
const actor = (over = {}) => ({
  system: { race: "astartes", size: 1, characteristics: {}, ...over },
  items: []
});

const effectsOf = rules => rules.flatMap(r => r.effects ?? []);

describe("правила Астартес", () => {
  it("раса отдаёт правила в сборку", () => {
    expect(RACES.astartes.rules).toBe(ASTARTES_RULES);
  });

  it("у актора расы astartes собираются все правила расы", () => {
    // core.sizeStealth тоже подходит: у фикстуры Размер 1 (см. actor выше), а
    // это правило проверяет только собственный Размер, без цели/вида броска
    // (rules/library/core.mjs) — оно из источника «core», не «race», но
    // collectRules() собирает оба сразу.
    const ids = collectRules(actor()).map(r => r.id);
    expect(ids).toEqual(["core.sizeStealth", ...ASTARTES_RULES.map(r => r.id)]);
  });

  it("Сверхъестественная Сила и Стойкость дают +4 к бонусу", () => {
    const charBonus = effectsOf(collectRules(actor())).filter(e => e.kind === "charBonus");
    expect(charBonus).toEqual([
      { kind: "charBonus", target: "s", value: 4 },
      { kind: "charBonus", target: "t", value: 4 }
    ]);
  });

  it("Размер (1) даёт sizeMod 1", () => {
    const effects = effectsOf(collectRules(actor()));
    expect(effects).toContainEqual({ kind: "grantValue", target: "sizeMod", value: 1 });
  });

  it("Геносемя и физиология отдают флаги-возможности", () => {
    const flags = effectsOf(collectRules(actor()))
      .filter(e => e.kind === "grantFlag").map(e => e.target);
    expect(flags).toEqual(["talents.geneSeed", "healing.astartes", "unarmed.astartesProfile",
      "weapons.legion"]);
  });

  it("у человека правил Астартес нет", () => {
    expect(collectRules(actor({ race: "human", size: 0 }))).toEqual([]);
  });

  // Идентификатор — имя правила в базе: по нему одно правило вытесняет другое,
  // и менять его после релиза нельзя. Опечатка ловится здесь.
  it("идентификаторы уникальны и в нижнем регистре", () => {
    const ids = ASTARTES_RULES.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(id => id === id.toLowerCase())).toBe(true);
  });
});
