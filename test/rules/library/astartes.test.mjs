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

  it("у актора расы astartes собираются все безусловные правила расы", () => {
    // core.sizeStealth тоже подходит: у фикстуры Размер 1 (см. actor выше), а
    // это правило проверяет только собственный Размер, без цели/вида броска
    // (rules/library/core.mjs) — оно из источника «core», не «race», но
    // collectRules() собирает оба сразу. astartes.nightLords сюда не входит —
    // у него есть `when` (легион), и без geneSeed он не проходит отбор.
    const unconditional = ASTARTES_RULES.filter(r => !Object.keys(r.when ?? {}).length).map(r => r.id);
    const ids = collectRules(actor()).map(r => r.id);
    expect(ids).toEqual(["core.sizeStealth", ...unconditional]);
  });

  // Единственная легионная ветка гейта среди расовых (было хардкодом
  // `system.geneSeed?.legion === "VIII"` в item-picker.mjs, wdbc-sauo).
  describe("astartes.nightlords", () => {
    it("собирается у Астартес с Геносеменем легиона VIII", () => {
      const ids = collectRules(actor({ geneSeed: { legion: "VIII" } })).map(r => r.id);
      expect(ids).toContain("astartes.nightlords");
    });

    it("не собирается у другого легиона", () => {
      const ids = collectRules(actor({ geneSeed: { legion: "I" } })).map(r => r.id);
      expect(ids).not.toContain("astartes.nightlords");
    });

    it("не собирается без Геносемени вовсе", () => {
      expect(collectRules(actor()).map(r => r.id)).not.toContain("astartes.nightlords");
    });
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
    // Усиленный профиль безоружного удара сюда больше не зашит — теперь это
    // Талант Unarmed Warrior (kind:"capability" в его Mechanics), который
    // Астартес получают как один из стартовых, а не хардкод расы.
    const flags = effectsOf(collectRules(actor()))
      .filter(e => e.kind === "grantFlag").map(e => e.target);
    expect(flags).toEqual(["talents.geneSeed", "healing.astartes", "weapons.legion"]);
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
