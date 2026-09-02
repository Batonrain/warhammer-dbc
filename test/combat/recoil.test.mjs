// test/combat/recoil.test.mjs
//
// «Отскок» (стр. 12, wdbc-9wvm) — UI-половина (module/combat/recoil.mjs):
// кнопка на карточке успешного Уклонения от стрелковой атаки, и исход
// performRecoil (списание пула + разовый флаг AP Укрытия + чат-карточка).
// Данные пула — test/combat/recoil-pool.test.mjs, интеграция с _performDodge
// (isMelee-гейт) — ниже в этом файле.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { _performDodge } from "../../module/combat/defense.mjs";
import { recoilButtonHtml, performRecoil } from "../../module/combat/recoil.mjs";
import { recoilRemaining } from "../../module/combat/recoil-pool.mjs";

function defender(overrides = {}) {
  const a = actorFor(overrides);
  const store = {};
  a.uuid = "Actor.defender-1";
  a.type = "character";
  a.getFlag = (scope, key) => store[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
  a.unsetFlag = async (scope, key) => { delete store[`${scope}.${key}`]; };
  a.update = async data => {
    for (const [path, value] of Object.entries(data)) {
      if (path === "flags.warhammer-dbc.-=recoilPool") delete store["warhammer-dbc.recoilPool"];
    }
  };
  a.system.movement = { halfMove: 4 };
  return a;
}

const card = () => captured.chat.at(-1)?.content ?? "";

beforeEach(() => {
  resetCaptured();
  captured.dice = [10]; // Ag 35 по умолчанию у actorFor() — гарантированный успех
  globalThis.game.combat = undefined;
});

describe("_performDodge: кнопка Отскока только у успешной СТРЕЛКОВОЙ защиты", () => {
  it("успех, isMelee=false (по умолчанию) — кнопка есть", async () => {
    const d = defender();
    await _performDodge(d, 0, "", 1, "Actor.attacker-1", false);
    expect(card()).toContain("wh-recoil-btn");
    expect(card()).toContain(`data-actor-uuid="${d.uuid}"`);
  });

  it("успех, isMelee=true — кнопки нет (Отскок только от стрелковой)", async () => {
    const d = defender();
    await _performDodge(d, 0, "", 1, "Actor.attacker-1", true);
    expect(card()).toContain("Уклонение успешно");
    expect(card()).not.toContain("wh-recoil-btn");
  });

  it("провал — кнопки нет независимо от isMelee", async () => {
    captured.dice = [96];
    const d = defender();
    await _performDodge(d, 0, "", 1, "Actor.attacker-1", false);
    expect(card()).toContain("Уклонение провалено");
    expect(card()).not.toContain("wh-recoil-btn");
  });

  it("data-actor-uuid на обёртке карточки — контратака-подобный приём для клика", async () => {
    const d = defender();
    await _performDodge(d, 0, "", 1, "Actor.attacker-1", false);
    expect(card()).toContain(`data-actor-uuid="${d.uuid}"`);
  });
});

describe("recoilButtonHtml: остаток пула в подписи", () => {
  it("вне боя — «∞ (вне боя)»", () => {
    const d = defender();
    expect(recoilButtonHtml(d)).toContain("∞ (вне боя)");
  });

  it("в бою — конкретное число метров", () => {
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
    const d = defender();
    expect(recoilButtonHtml(d)).toContain("остаток 4м");
  });
});

describe("performRecoil: списание пула, разовый флаг Укрытия, чат-карточка", () => {
  beforeEach(() => {
    globalThis.game.combat = { started: true, id: "c1", combatant: { id: "cbt-1" } };
  });

  it("вне Укрытия — полная нивеляция текстом, флаг Укрытия не ставится", async () => {
    const d = defender();
    await performRecoil(d, { meters: 3, intoCover: false, coverAp: 0 });

    expect(card()).toContain("Отскочил на 3м вне предела атаки");
    expect(card()).toContain("все попадания промахиваются");
    expect(d.getFlag("warhammer-dbc", "recoilCoverBonus")).toBeUndefined();
    expect(recoilRemaining(d)).toBe(1);
  });

  it("в Укрытие — ставит разовый флаг AP, карточка называет прибавку", async () => {
    const d = defender();
    await performRecoil(d, { meters: 2, intoCover: true, coverAp: 6 });

    expect(d.getFlag("warhammer-dbc", "recoilCoverBonus")).toBe(6);
    expect(card()).toContain("Отскочил на 2м в Укрытие");
    expect(card()).toContain("+6 AP");
  });

  it("запрошено больше остатка — зажимается, в карточке реально потраченное", async () => {
    const d = defender();
    await performRecoil(d, { meters: 99, intoCover: false, coverAp: 0 });
    expect(card()).toContain("Отскочил на 4м");
    expect(recoilRemaining(d)).toBe(0);
  });
});
