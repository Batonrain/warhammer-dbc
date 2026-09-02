// test/rules/synesthesia-social-penalty.test.mjs
//
// Synesthesia / Синэстезия (wdbc-1rno): «...он получает штраф −20 на все
// социальные взаимодействия и Командование...» — Командование классифицирован
// apt2:"social" (module/constants/skills.mjs), поэтому одна запись
// kind:"testMod", modScope:"social" покрывает оба книжных пункта разом через
// уже существующую область effectAppliesTo (module/rules/resolve-test.mjs).
// Часть находки НЕ покрыта этой записью (см. capabilities.mjs): −20 на
// Scrutiny ПРОТИВ персонажа и −10 доп. на Избирательные атаки по нему —
// требуют cross-actor ctx.targetActor на плоском тесте Навыка, которого
// сейчас нет (только у атак, attack-dialog.mjs); Stealth штраф — на
// усмотрение ГМа, книга сама не даёт числа.

import { describe, it, expect } from "vitest";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";

const synesthesiaTestMod = {
  id: "synesthesia-social-mod", kind: "testMod", modScope: "social",
  modValueMode: "flat", value: -20, label: "Синэстезия: −20 соц. взаимодействия/Командование"
};

const item = entries => ({
  id: "mut1", name: "Synesthesia / Синэстезия",
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries }] } }
});

describe("Synesthesia: −20 на социальные тесты и Командование (wdbc-1rno)", () => {
  it("запись kind:testMod даёт rollBonus области «social»", () => {
    const rules = rulesFromItemMechanics([item([synesthesiaTestMod])]);
    expect(rules[0].effects).toEqual([{ kind: "rollBonus", target: "social", value: -20 }]);
  });
});
