// test/apps/item-script.test.mjs
//
// executeItemCode — общий исполнитель kind:"script"-записей (module/apps/
// mechanics.mjs::runMechScriptEntry). Проверяет, что все заявленные в шапке
// файла «стандартные помощники» реально долетают до кода записи — без
// импортов внутри самого script (executeItemCode их не умеет, см. шапку).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { executeItemCode } from "../../module/apps/item-script.mjs";

function mockItem() {
  return { name: "Тест", actor: { name: "Актор" } };
}

describe("executeItemCode — стандартные помощники в области видимости кода", () => {
  it("woundLossUpdates/isTokenInSight/tokensThatCanSee/факции/talentGroupOf/incrementThrottleCount/tokensWithinRadius — все переданы", async () => {
    const item = mockItem();
    // `seen` передан как extra-помощник (не глобальная переменная) — объект
    // общий по ссылке, поэтому мутации внутри кода видны и снаружи.
    const seen = {};
    await executeItemCode(item, `
      seen.woundLossUpdates = typeof woundLossUpdates;
      seen.isTokenInSight = typeof isTokenInSight;
      seen.tokensThatCanSee = typeof tokensThatCanSee;
      seen.actorFactionKeys = typeof actorFactionKeys;
      seen.anySameOrDescendant = typeof anySameOrDescendant;
      seen.getFactionIndex = typeof getFactionIndex;
      seen.talentGroupOf = typeof talentGroupOf;
      seen.incrementThrottleCount = typeof incrementThrottleCount;
      seen.tokensWithinRadius = typeof tokensWithinRadius;
    `, null, { seen });
    expect(seen).toEqual({
      woundLossUpdates: "function", isTokenInSight: "function",
      tokensThatCanSee: "function", actorFactionKeys: "function",
      anySameOrDescendant: "function", getFactionIndex: "function",
      talentGroupOf: "function", incrementThrottleCount: "function",
      tokensWithinRadius: "function"
    });
  });

  it("talentGroupOf внутри скрипта опознаёт группу Таланта по имени (Око Вызова: «владение Талантами группы Берсерк»)", async () => {
    const item = mockItem();
    globalThis.__testResult = null;
    await executeItemCode(item, `
      globalThis.__testResult = talentGroupOf("Frenzy / Ярость")?.folder;
    `, null);
    expect(globalThis.__testResult).toBe("Берсерк");
    delete globalThis.__testResult;
  });

  it("talentGroupOf возвращает null для незнакомого имени", async () => {
    const item = mockItem();
    globalThis.__testResult = "не тронуто";
    await executeItemCode(item, `
      globalThis.__testResult = talentGroupOf("Совершенно Незнакомый Талант XYZ");
    `, null);
    expect(globalThis.__testResult).toBe(null);
    delete globalThis.__testResult;
  });
});
