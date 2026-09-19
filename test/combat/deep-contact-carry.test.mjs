// test/combat/deep-contact-carry.test.mjs
//
// Глубокий Контакт: переноска раненого/пленного (wdbc-x1nz.2.19, стр. 31) —
// тумблер toggleDeepContactCarry ставит/снимает flags.warhammer-dbc.
// deepContactCarry, который free-attack.mjs::processTokenMove читает, чтобы
// НЕ провоцировать Свободную Атаку движением несомого/несущего (см.
// test/combat/free-attack.test.mjs). Здесь — только сам тумблер и его
// пункт меню (movement-menu-items.test.mjs проверяет метку пункта).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { toggleDeepContactCarry } from "../../module/combat/movement-actions.mjs";

/** Тот же приём фикстуры, что у free-attack.test.mjs/movement-moved-flag.test.mjs. */
function fakeActor(overrides = {}) {
  const flagStore = {};
  return {
    name: "Носильщик",
    system: {},
    ...overrides,
    getFlag: (scope, key) => flagStore[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flagStore[`${scope}.${key}`] = value; }
  };
}

beforeEach(resetCaptured);

describe("toggleDeepContactCarry", () => {
  it("выключен → включает флаг, сообщает о начале переноски", async () => {
    const actor = fakeActor();
    await toggleDeepContactCarry(actor);
    expect(actor.getFlag("warhammer-dbc", "deepContactCarry")).toBe(true);
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Несёт/держит в Глубоком Контакте");
  });

  it("включён → выключает флаг, сообщает об окончании переноски", async () => {
    const actor = fakeActor();
    await toggleDeepContactCarry(actor); // включить
    resetCaptured();
    await toggleDeepContactCarry(actor); // выключить
    expect(actor.getFlag("warhammer-dbc", "deepContactCarry")).toBe(false);
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Переноска закончена");
  });

  it("без актора — ничего не делает, не падает", async () => {
    await expect(toggleDeepContactCarry(null)).resolves.toBeUndefined();
    expect(captured.chat.length).toBe(0);
  });
});
