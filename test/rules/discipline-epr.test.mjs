// test/rules/discipline-epr.test.mjs
//
// Прибавка к эPR по дисциплине психосилы (rules/psyker.mjs::disciplineEprBonus):
// Паразитический Проводник (Король Червей) — «+1 к эPR психосил Нургла и Биомантии».

import { describe, it, expect } from "vitest";
import { disciplineEprBonus } from "../../module/rules/psyker.mjs";
import { allPackDocuments } from "../support/pack-docs.mjs";

const conduit = { type: "trait", name: "Verminous Conduit / Паразитический Проводник", system: {} };
const power = discipline => ({ type: "psychicPower", system: { discipline } });

describe("эPR по дисциплине", () => {
  it("Нургл и Биомантия — +1", () => {
    expect(disciplineEprBonus({ items: [conduit] }, power("nurgle")).bonus).toBe(1);
    expect(disciplineEprBonus({ items: [conduit] }, power("biomancy")).bonus).toBe(1);
  });
  it("прочие дисциплины и сила без дисциплины — 0", () => {
    expect(disciplineEprBonus({ items: [conduit] }, power("pyromancy")).bonus).toBe(0);
    expect(disciplineEprBonus({ items: [conduit] }, power("")).bonus).toBe(0);
  });
  it("без Черты — 0; Талант с тем же именем не считается", () => {
    expect(disciplineEprBonus({ items: [] }, power("nurgle")).bonus).toBe(0);
    expect(disciplineEprBonus({ items: [{ ...conduit, type: "talent" }] }, power("nurgle")).bonus).toBe(0);
  });
  it("подпись для карточки", () => {
    expect(disciplineEprBonus({ items: [conduit] }, power("nurgle")).labels).toEqual(["Паразитический Проводник +1"]);
  });
  it("Черта в паке опознаётся", () => {
    const docs = allPackDocuments("traits").map(x => x.doc);
    const trait = docs.find(d => String(d.name).startsWith("Verminous Conduit"));
    expect(trait).toBeTruthy();
    expect(disciplineEprBonus({ items: [trait] }, power("biomancy")).bonus).toBe(1);
  });
});
