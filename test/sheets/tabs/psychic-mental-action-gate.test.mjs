// test/sheets/tabs/psychic-mental-action-gate.test.mjs
//
// Стр. 12, wdbc-x1nz.2.32: «Ментальное действие... не может быть проведено,
// когда разум персонажа расфокусирован (например он пьян, галлюцинирует,
// или в Ярости)» — манифестация психосил проверяет это тем же приёмом, что
// Саркофаг Дредноута/мононить/Паразит рядом (showManifestDialog).

import "../../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../../support/foundry-stub.mjs";
import { showManifestDialog } from "../../../module/sheets/tabs/psychic.mjs";
import { isMentalActionBlocked } from "../../../module/rules/predicates.mjs";

function makeActor(conditions = {}, inRage = false) {
  const items = [];
  items.get = id => items.find(i => i.id === id) ?? null;
  return {
    uuid: "Actor.psyker1", id: "psyker1", name: "Псайкер", items,
    system: { psyker: { currentRating: 3 }, characteristics: {}, inRage, conditions }
  };
}

beforeEach(resetCaptured);

describe("isMentalActionBlocked", () => {
  it("ничего не активно — не блокирует", () => {
    expect(isMentalActionBlocked(makeActor())).toBe(false);
  });
  it("в Ярости — блокирует", () => {
    expect(isMentalActionBlocked(makeActor({}, true))).toBe(true);
  });
  it("Галлюцинации — блокирует", () => {
    expect(isMentalActionBlocked(makeActor({ hallucinogenic: true }))).toBe(true);
  });
  it("Опьянение — блокирует", () => {
    expect(isMentalActionBlocked(makeActor({ intoxicated: true }))).toBe(true);
  });
});

describe("showManifestDialog: разфокусированный разум", () => {
  it("в Ярости — окно не открывается, есть предупреждение", () => {
    showManifestDialog(makeActor({}, true), { name: "Пирокинез", system: {} });
    expect(captured.dialog).toBeNull();
    expect(captured.warnings.some(w => w.includes("расфокусирован"))).toBe(true);
  });

  it("Галлюцинации — окно не открывается", () => {
    showManifestDialog(makeActor({ hallucinogenic: true }), { name: "Пирокинез", system: {} });
    expect(captured.dialog).toBeNull();
  });

  it("Опьянение — окно не открывается", () => {
    showManifestDialog(makeActor({ intoxicated: true }), { name: "Пирокинез", system: {} });
    expect(captured.dialog).toBeNull();
  });

  it("ничего не активно — окно открывается как обычно", () => {
    showManifestDialog(makeActor(), { name: "Пирокинез", system: {} });
    expect(captured.dialog).not.toBeNull();
  });
});
