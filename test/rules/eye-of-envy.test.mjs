// test/rules/eye-of-envy.test.mjs
//
// Eye of Envy / Око Зависти (wdbc-1rno, 12.09.2026): первая находка,
// использующая temp-infamy.mjs с иным сроком жизни ("до конца ЭТОГО броска",
// не "до конца Хода/Команды") — и первый реальный хук «атака полностью
// отыграна» в конвейере атаки (module/sheets/attack/dialog.mjs оборачивает
// _executeAttackRoll, сама функция не тронута).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eyeOfEnvyTriggers, withEyeOfEnvy } from "../../module/rules/eye-of-envy.mjs";
import { tempInfamyAmount, grantTempInfamy, spendTempInfamy } from "../../module/rules/temp-infamy.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

function flagActor(over = {}) {
  const flags = {};
  return {
    system: { characteristics: {} },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { flags[`${scope}.${key}`] = value; },
    unsetFlag: async (scope, key) => { delete flags[`${scope}.${key}`]; },
    ...over
  };
}

const charOf = total => ({ total });

describe("eyeOfEnvyTriggers", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  function withGift(over = {}) {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "test.rule", when: {}, effects: [{ kind: "grantFlag", target: "gift.slaanesh.eyeOfEnvy" }] }
    ]);
    return flagActor(over);
  }

  it("цель сильнее по базовой Характеристике этого теста — срабатывает", () => {
    const a = withGift({ system: { characteristics: { ws: charOf(30) } } });
    const target = { system: { characteristics: { ws: charOf(50) } } };
    expect(eyeOfEnvyTriggers(a, target, "ws")).toBe(true);
  });

  it("цель не сильнее — не срабатывает", () => {
    const a = withGift({ system: { characteristics: { ws: charOf(50) } } });
    const target = { system: { characteristics: { ws: charOf(30) } } };
    expect(eyeOfEnvyTriggers(a, target, "ws")).toBe(false);
    // Равенство книга тоже не считает «выше».
    const target2 = { system: { characteristics: { ws: charOf(50) } } };
    expect(eyeOfEnvyTriggers(a, target2, "ws")).toBe(false);
  });

  it("без Дара — не срабатывает, даже если цель сильнее", () => {
    clearRuleSources();
    const a = flagActor({ system: { characteristics: { ws: charOf(30) } } });
    const target = { system: { characteristics: { ws: charOf(50) } } };
    expect(eyeOfEnvyTriggers(a, target, "ws")).toBe(false);
  });

  it("без цели/без ключа Характеристики — не срабатывает", () => {
    const a = withGift({ system: { characteristics: { ws: charOf(30) } } });
    expect(eyeOfEnvyTriggers(a, null, "ws")).toBe(false);
    expect(eyeOfEnvyTriggers(a, { system: { characteristics: { ws: charOf(50) } } }, "")).toBe(false);
  });

  // Сравнение по КЛЮЧУ ЭТОГО теста — рукопашная атака сравнивает WS, а не BS
  // цели, даже если у цели BS выше.
  it("сравнивает именно ту Характеристику, что передана — не любую бо́льшую", () => {
    const a = withGift({ system: { characteristics: { ws: charOf(40), bs: charOf(60) } } });
    const target = { system: { characteristics: { ws: charOf(30), bs: charOf(90) } } };
    expect(eyeOfEnvyTriggers(a, target, "ws")).toBe(false);
    expect(eyeOfEnvyTriggers(a, target, "bs")).toBe(true);
  });
});

describe("withEyeOfEnvy", () => {
  const saved = getRuleSources();
  beforeEach(() => {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "test.rule", when: {}, effects: [{ kind: "grantFlag", target: "gift.slaanesh.eyeOfEnvy" }] }
    ]);
  });
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  const strongerTarget = { system: { characteristics: { ws: charOf(50) } } };
  const weaker = () => flagActor({ system: { characteristics: { ws: charOf(30) } } });

  it("совпало — выдаёт временное Очко на время броска и снимает его после, если не потрачено", async () => {
    const a = weaker();
    let seenDuringRoll = -1;
    const result = await withEyeOfEnvy(a, strongerTarget, "ws", async () => {
      seenDuringRoll = tempInfamyAmount(a);
      return "rolled";
    });
    expect(result).toBe("rolled");
    expect(seenDuringRoll).toBe(1); // доступно ВО ВРЕМЯ броска
    expect(tempInfamyAmount(a)).toBe(0); // и пропало после
  });

  it("персонаж потратил Очко во время броска — после ничего лишнего не снимает", async () => {
    const a = weaker();
    await withEyeOfEnvy(a, strongerTarget, "ws", async () => {
      await spendTempInfamy(a, 1); // тот же путь, что и обычная трата Бесчестия
    });
    expect(tempInfamyAmount(a)).toBe(0);
  });

  it("не совпало — не выдаёт ничего и не трогает temp-запас", async () => {
    const a = weaker();
    await grantTempInfamy(a, 2, { source: "Другой источник" }); // чужой запас уже висит
    const notMatching = { system: { characteristics: { ws: charOf(10) } } }; // слабее меня
    await withEyeOfEnvy(a, notMatching, "ws", async () => "ok");
    expect(tempInfamyAmount(a)).toBe(2); // чужой запас цел
  });

  it("совпало, но у актора уже был ЧУЖОЙ temp-запас — снимает СВОЮ 1 единицу, не весь чужой", async () => {
    const a = weaker();
    await grantTempInfamy(a, 2, { source: "Voice of God" }); // чужой запас ДО броска Ока Зависти
    await withEyeOfEnvy(a, strongerTarget, "ws", async () => "ok");
    // 2 (чужих) + 1 (моё) − 1 (моё же снято после) = 2, чужие целы
    expect(tempInfamyAmount(a)).toBe(2);
  });

  it("бросок падает — временный запас всё равно снимается (finally)", async () => {
    const a = weaker();
    await expect(withEyeOfEnvy(a, strongerTarget, "ws", async () => { throw new Error("бросок сломался"); }))
      .rejects.toThrow("бросок сломался");
    expect(tempInfamyAmount(a)).toBe(0);
  });
});
