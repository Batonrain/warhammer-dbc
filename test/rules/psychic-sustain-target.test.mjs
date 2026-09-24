// test/rules/psychic-sustain-target.test.mjs
//
// module/rules/psychic-sustain-target.mjs — «я текущая цель чьей-то
// поддерживаемой психосилы с записью target:<флаг>». До wdbc-4a92 тестов у
// источника не было вовсе, а условие записи (entry.when) игнорировалось: в
// отличие от обычных записей Конструктора, условная target:-запись сработала
// бы безусловно. Условие проверяется по владельцу силы — тот же приём, что
// у любой записи предмета (rules/mech-when.mjs::entryWhenOk).

import { describe, it, expect, afterEach } from "vitest";
import { psychicSustainTargetRules } from "../../module/rules/psychic-sustain-target.mjs";

const power = ({ sustained = true, target = "Actor.target", when = {} } = {}) => ({
  uuid: "Actor.caster.Item.p1", name: "Покров", type: "psychicPower",
  system: { isSustained: sustained, sustainedTargetUuid: target },
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e1", kind: "capability", capabilityKey: "target:psyShield", when }
  ] }] } }
});

const caster = (items, system = {}) => ({ uuid: "Actor.caster", items, system });
const target = { uuid: "Actor.target" };

afterEach(() => { delete globalThis.game; });

describe("psychicSustainTargetRules", () => {
  it("цель поддерживаемой силы получает флаг записи target:", () => {
    globalThis.game = { actors: [caster([power()])] };
    const rules = psychicSustainTargetRules(target);
    expect(rules).toHaveLength(1);
    expect(rules[0].effects).toEqual([{ kind: "grantFlag", target: "psyShield" }]);
  });

  it("сила не поддерживается или нацелена на другого — ничего", () => {
    globalThis.game = { actors: [caster([power({ sustained: false }), power({ target: "Actor.other" })])] };
    expect(psychicSustainTargetRules(target)).toEqual([]);
  });

  it("условие записи не выполнено у владельца силы — флага нет (wdbc-4a92)", () => {
    globalThis.game = { actors: [caster([power({ when: { requireRage: true } })], { inRage: false })] };
    expect(psychicSustainTargetRules(target)).toEqual([]);
  });

  it("условие выполнено — флаг есть", () => {
    globalThis.game = { actors: [caster([power({ when: { requireRage: true } })], { inRage: true })] };
    expect(psychicSustainTargetRules(target)).toHaveLength(1);
  });

  it("вне игры (нет game) — молчит", () => {
    expect(psychicSustainTargetRules(target)).toEqual([]);
  });
});
