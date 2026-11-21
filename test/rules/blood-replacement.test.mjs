// Замена Крови (wdbc-1rno.15): субмутация, Ранение на непоглощённом I/R/X, кого задевает, Дым.
import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  bloodReplacementSub, bloodWoundFor, bloodWoundVictims, bloodSmokeSight, BLOOD_WOUNDS
} from "../../module/rules/blood-replacement.mjs";
import { smokePenaltyImmunityReason } from "../../module/rules/vision-penalty-immunity.mjs";
import { sensesOf } from "../../module/rules/perception.mjs";

const withSub = label => ({
  items: [{ type: "mutation", name: "Blood Replacement / Замена Крови", system: { submutation: { label } }, getFlag: () => undefined }],
  system: { conditions: {}, characteristics: { per: { bonus: 3 } } }
});

describe("Замена Крови", () => {
  it("номер субмутации; без мутации — null", () => {
    expect(bloodReplacementSub(withSub("4"))).toBe(4);
    expect(bloodReplacementSub({ items: [] })).toBeNull();
  });
  it("Ранение — только непоглощённый I/R/X", () => {
    const a = withSub("3");
    expect(bloodWoundFor(a, { netDamage: 2, damageType: "rending" })).toMatchObject({ sub: 3, label: "Свет" });
    expect(bloodWoundFor(a, { netDamage: 2, damageType: "energy" })).toBeNull();
    expect(bloodWoundFor(a, { netDamage: 0, damageType: "impact" })).toBeNull();
  });
  it("Ртуть отмечается своим модулем — карточки нет; Память — без задетых", () => {
    expect(bloodWoundFor(withSub("2"), { netDamage: 1, damageType: "impact" })).toBeNull();
    expect(bloodWoundVictims(BLOOD_WOUNDS[5], [{ id: "x" }])).toEqual([]);
  });
  it("Личинки и Варп — только враги, Свет — все соседи", () => {
    const near = [{ id: "f", disposition: -1 }, { id: "a", disposition: 1 }];
    const enemy = t => t.disposition === -1;
    expect(bloodWoundVictims(BLOOD_WOUNDS[7], near, enemy).map(t => t.id)).toEqual(["f"]);
    expect(bloodWoundVictims(BLOOD_WOUNDS[3], near, enemy).map(t => t.id)).toEqual(["f", "a"]);
  });
  it("Дым: свой дым не мешает зрению и атакам", () => {
    const a = withSub("4");
    expect(bloodSmokeSight(a)).toBe(true);
    expect(smokePenaltyImmunityReason(a, [])).toBe("Замена Крови (Дым)");
    expect(sensesOf(a).smokeSight).toBe(true);
    expect(smokePenaltyImmunityReason(withSub("5"), [])).toBeNull();
  });
});
