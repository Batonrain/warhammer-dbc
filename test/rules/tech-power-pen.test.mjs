// Пробитие Техночуда формулой («Pen ½I.b» Люминен Сокрушения и др.), живая проверка #586.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { techPenFormulaValue, techPowerPenetration } from "../../module/rules/tech-power-pen.mjs";

const chars = { int: { bonus: 7 }, wp: { bonus: 4 } };

describe("техночудо: Пробитие формулой", () => {
  it("½I.b — половина вниз", () => {
    expect(techPenFormulaValue("½I.b", chars)).toBe(3);
    expect(techPenFormulaValue("I.b/2", chars)).toBe(3);
  });
  it("пусто и мусор — 0", () => {
    expect(techPenFormulaValue("", chars)).toBe(0);
    expect(techPenFormulaValue("alert(1)", chars)).toBe(0);
  });
  it("число и формула складываются", () => {
    expect(techPowerPenetration({ penetration: 2, penetrationFormula: "W.b" }, chars)).toBe(6);
  });
  it("в паке у Люминен Сокрушения Pen ½I.b", () => {
    const dir = path.resolve(import.meta.dirname, "../../packs-src/tech-powers/ТЕХНОЧУДЕСА/МОТИВОТЕУРГИЯ/Люминен");
    const f = fs.readdirSync(dir).find(n => n.startsWith("Luminen_Smite"));
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    expect(techPowerPenetration(d.system, chars)).toBe(3);
  });
});
