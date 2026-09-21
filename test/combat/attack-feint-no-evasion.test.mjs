// test/combat/attack-feint-no-evasion.test.mjs
//
// Стр. 31, wdbc-x1nz.2.65: успешный Финт снимает Уклонение/Парирование цели
// от атак ИМЕННО этого атакующего до конца его Хода — тот же порог −999,
// что «Скрытая атака» (attack-hidden-attack-no-evasion.test.mjs), но флаг
// персистентный (module/combat/feint-press.mjs), не разовая галочка окна.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";

function withFlags(actor, flags = {}) {
  const store = { ...flags };
  actor.getFlag = (scope, key) => store[`${scope}.${key}`];
  return actor;
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
});

describe("Финт: Уклонение/Парирование недоступны только атакующему, который выиграл Финт", () => {
  it("цель Финтована ЭТИМ атакующим — Уклонение/Парирование недоступны", async () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon] });
    actor.uuid = "Actor.attacker";
    const target = withFlags(actorFor({}), { "warhammer-dbc.feintNoEvade": { byUuid: "Actor.attacker", byName: "Атакующий" } });
    setTargets([target]);
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("Уклонение (невозможно)");
    expect(card()).toContain("Парирование (невозможно");
  });

  it("цель Финтована ДРУГИМ атакующим — Уклонение доступно как обычно", async () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon] });
    actor.uuid = "Actor.attacker";
    const target = withFlags(actorFor({}), { "warhammer-dbc.feintNoEvade": { byUuid: "Actor.someoneElse", byName: "Кто-то ещё" } });
    setTargets([target]);
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain("wh-dodge-btn\"");
    expect(card()).not.toContain("Уклонение (невозможно)");
  });

  it("без флага Финта вовсе — Уклонение доступно как обычно", async () => {
    const weapon = weaponFor();
    const actor  = actorFor({ items: [weapon] });
    actor.uuid = "Actor.attacker";
    const target = withFlags(actorFor({}), {});
    setTargets([target]);
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).not.toContain("Уклонение (невозможно)");
  });
});
