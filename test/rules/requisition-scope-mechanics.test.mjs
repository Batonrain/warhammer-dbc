// test/rules/requisition-scope-mechanics.test.mjs
//
// Область «requisition» («достать снаряжение», resolve-test.mjs: ctx.requisition)
// доступна в Конструкторе: запись kind:"testMod" с modScope "requisition" даёт
// правило с target "requisition" — «+N к Реквизиции» данными, без отдельного
// Таланта. Область перечислена в списке областей Конструктора
// (apps/mechanics.mjs → REROLL_SCOPES) и в docs/rules-format.md.

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { effectAppliesTo } from "../../module/rules/resolve-test.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

function trait(entries) {
  const flags = { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries }] } };
  return { id: "t", name: "Покровитель", type: "trait", system: {}, flags, getFlag: (s, k) => flags[s]?.[k] };
}

describe("область requisition в Конструкторе", () => {
  const entry = { id: "e1", kind: "testMod", modScope: "requisition", modValueMode: "flat", value: 10 };

  it("запись testMod превращается в правило с target «requisition»", () => {
    const rules = rulesFromItemMechanics([trait([entry])]);
    const effects = rules.flatMap(r => r.effects);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({ kind: "rollBonus", target: "requisition", value: 10 });
  });

  it("правило срабатывает на тесте реквизиции и не срабатывает на обычном тесте Влияния", () => {
    expect(effectAppliesTo("requisition", { kind: "skill", char: "inf", requisition: true })).toBe(true);
    expect(effectAppliesTo("requisition", { kind: "skill", char: "inf" })).toBe(false);
  });

  it("область есть в списке Конструктора и в справочнике формата правил", () => {
    const src = fs.readFileSync(path.join(ROOT, "module/apps/mechanics.mjs"), "utf8");
    expect(src).toMatch(/\["requisition",\s*"[^"]+"\]/);
    const docs = fs.readFileSync(path.join(ROOT, "docs/rules-format.md"), "utf8");
    expect(docs).toMatch(/\|\s*`requisition`\s*\|/);
  });
});
