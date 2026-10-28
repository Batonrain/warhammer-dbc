// test/rules/command-substitution.test.mjs
//
// Living Legend (Inf вместо F) и Infernal Master (Forbidden Lore(Daemons)(W)
// вместо Command против демона) конкурируют за один навык — фикс 19.10.2026
// (независимое ревью диапазона «Таланты Оккультиста гл.3», Sahara 3-2a39):
// у персонажа с обоими Талантами разом раньше складывались ОБА rollBonus на
// skill:command. Здесь — что действует только бо́льшая подмена, а соло-case
// каждого Таланта не меняется этим фиксом.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { commandSubstitutionRules } from "../../module/rules/command-substitution.mjs";

const talentOf = (name) => ({ type: "talent", name, system: {} });
const daemonTarget = { type: "daemon", system: {} };
const humanTarget = { type: "character", system: {} };

/** inf/fel — для Living Legend; wp/int/commandTotal/flTotal — для Infernal Master. */
function actor(items, { inf = 0, fel = 0, wp = 0, int = 0, commandTotal = 0, flTotal = null } = {}) {
  return {
    items,
    system: {
      characteristics: { inf: { total: inf }, fel: { total: fel }, wp: { total: wp }, int: { total: int } },
      skills: { command: { total: commandTotal } },
      groupSkills: { forbiddenLore: flTotal == null ? [] : [{ specialty: "Daemons", char: "int", total: flTotal }] }
    }
  };
}

describe("commandSubstitutionRules: выбор бо́льшей подмены, не сумма", () => {
  it("ни одного Таланта — пустой список", () => {
    const a = actor([], { inf: 60, fel: 20 });
    expect(commandSubstitutionRules(a, { targetActor: daemonTarget })).toEqual([]);
  });

  it("соло Living Legend — применяется как раньше (без Infernal Master сравнивать не с чем)", () => {
    const a = actor([talentOf("Living Legend")], { inf: 60, fel: 20 });
    const rules = commandSubstitutionRules(a, { targetActor: humanTarget });
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("livingLegend.command");
    expect(rules[0].effects[0].value).toBe(40);
  });

  it("соло Living Legend, редкий отрицательный итог — применяется как раньше (принятый отдельно риск)", () => {
    const a = actor([talentOf("Living Legend")], { inf: 20, fel: 60 });
    const rules = commandSubstitutionRules(a, { targetActor: humanTarget });
    expect(rules).toHaveLength(1);
    expect(rules[0].effects[0].value).toBe(-40);
  });

  it("соло Infernal Master против демона — применяется", () => {
    const a = actor([talentOf("Infernal Master")], { wp: 50, int: 20, commandTotal: 30, flTotal: 40 });
    const rules = commandSubstitutionRules(a, { targetActor: daemonTarget });
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("infernalMaster.command");
    expect(rules[0].effects[0].value).toBe(40); // flTotal пересчитан от W: 50+(40-20)=70; 70-30=40
  });

  it("соло Infernal Master, цель не демон — не применяется", () => {
    const a = actor([talentOf("Infernal Master")], { wp: 50, int: 20, commandTotal: 30, flTotal: 40 });
    expect(commandSubstitutionRules(a, { targetActor: humanTarget })).toEqual([]);
  });

  it("оба Таланта разом, против демона — действует Infernal Master, когда его подмена больше", () => {
    // Living Legend: Inf 60 − Fel 40 = 20.
    // Infernal Master: FL(Daemons) от W = 50+(40-20) = 70; 70 − Command 30 = 40.
    const a = actor([talentOf("Living Legend"), talentOf("Infernal Master")],
      { inf: 60, fel: 40, wp: 50, int: 20, commandTotal: 30, flTotal: 40 });
    const rules = commandSubstitutionRules(a, { targetActor: daemonTarget });
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("infernalMaster.command");
    expect(rules[0].effects[0].value).toBe(40);
  });

  it("оба Таланта разом, против демона — действует Living Legend, когда его подмена больше", () => {
    // Living Legend: Inf 80 − Fel 20 = 60.
    // Infernal Master: FL(Daemons) от W = 20+(30-20) = 30; 30 − Command 15 = 15.
    const a = actor([talentOf("Living Legend"), talentOf("Infernal Master")],
      { inf: 80, fel: 20, wp: 20, int: 20, commandTotal: 15, flTotal: 30 });
    const rules = commandSubstitutionRules(a, { targetActor: daemonTarget });
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("livingLegend.command");
    expect(rules[0].effects[0].value).toBe(60);
  });

  it("оба Таланта разом, цель НЕ демон — Infernal Master не в игре, Living Legend действует сам по себе", () => {
    const a = actor([talentOf("Living Legend"), talentOf("Infernal Master")],
      { inf: 60, fel: 20, wp: 50, int: 20, commandTotal: 30, flTotal: 40 });
    const rules = commandSubstitutionRules(a, { targetActor: humanTarget });
    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("livingLegend.command");
    expect(rules[0].effects[0].value).toBe(40);
  });
});
