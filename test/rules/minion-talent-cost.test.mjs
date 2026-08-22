// test/rules/minion-talent-cost.test.mjs
//
// «Миньон Хаоса» (стр. 111): вторая склонность цены (стр. 23) — от
// Характеристики выбранной группы Хозяина (masterChar), не статичная запись
// пака (там лежит только "social" — верно только для группы «Человек»).
// Без этого цена никогда не доходила до Дружественной категории, даже если
// у персонажа есть обе нужные склонности (wdbc-ije).

import { describe, it, expect } from "vitest";
import { dynamicAptKind, resolveTalentAptitudes, aptitudeCat, talentCostXP, charAptitudeSet }
  from "../../module/constants/advancement.mjs";
import { applyMinionSlot } from "../../module/apps/minion-talent.mjs";
import { MINION_GROUPS } from "../../module/constants/minions.mjs";

const NAME = "Minion of Chaos / Миньон Хаоса";

describe("«Миньон Хаоса» — динамическая склонность по группе", () => {
  it("распознан как динамический Талант (kind: char)", () => {
    expect(dynamicAptKind(NAME)).toBe("char");
    expect(dynamicAptKind("Минь Хаоса")).toBe(null); // соседнее имя не подхватывается зря
  });

  it("группа «Человек» (masterChar fel) даёт [fel, social] — те самые «Soc, F»", () => {
    const apts = resolveTalentAptitudes(NAME, ["social"], MINION_GROUPS.human.masterChar);
    expect(apts).toEqual(["fel", "social"]);
  });

  it("группа «Зверь» (masterChar per) даёт свою пару, не «social» из пака", () => {
    const apts = resolveTalentAptitudes(NAME, ["social"], MINION_GROUPS.beast.masterChar);
    expect(apts).toEqual(["per", "fieldcraft"]);
  });

  it("обе нужные склонности персонажа поднимают категорию до Дружественной", () => {
    const charApts = charAptitudeSet(["fel", "social"]);
    const apts = resolveTalentAptitudes(NAME, ["social"], "fel");
    expect(aptitudeCat(charApts, apts)).toBe("ally");
    expect(talentCostXP(3, apts, charApts)).toBe(400); // TALENT_COST.ally[2] — уровень 3
  });

  it("только одна из двух (как раньше, статично) — категория не выше Нейтральной", () => {
    const charApts = charAptitudeSet(["fel"]); // без "social"
    const staticApts = ["social"]; // старое поведение: без aptSource
    expect(aptitudeCat(charApts, staticApts)).toBe("enemy"); // fel не входит в старый список вовсе
  });
});

describe("applyMinionSlot проставляет aptSource — покупка сразу считается верно", () => {
  it("группа «Человек» → aptSource = fel", () => {
    const obj = applyMinionSlot({}, { group: "human", tier: "lesser", talentTier: 1, label: "Человек, Низший" });
    expect(obj.system.aptSource).toBe("fel");
  });

  it("группа «Демон» → aptSource = wp", () => {
    const obj = applyMinionSlot({}, { group: "daemon", tier: "greater", talentTier: 3, label: "Демон, Высший" });
    expect(obj.system.aptSource).toBe(MINION_GROUPS.daemon.masterChar);
  });
});
