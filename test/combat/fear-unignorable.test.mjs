// test/combat/fear-unignorable.test.mjs
//
// Затронутый Варпом, субмутация 1 (wdbc-1rno.26): «считает всех врагов в
// Ярости имеющими рейтинг Страха 3 и не может игнорировать этот Страх».
// Решение владельца 02.10.2026: «не может игнорировать» снимает всё, что
// книга называет игнорированием Страха, — память сцены (стр. 53), автоуспех
// по Infamy или своему Страху, Стальное Сердце. Свойство теста
// properties.unignorable ставит диалог Страха (sheets/tabs/disorders.mjs).

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { _executeFearRoll } from "../../module/combat/fear.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

function makeActor({ wp = 40, fearRating = 0, faced = 0 } = {}) {
  const flags = faced ? { fearFacedRating: faced } : {};
  return {
    id: "a1", name: "Затронутый", items: [], effects: [],
    system: { characteristics: { wp: { total: wp } }, fatigue: { value: 0, max: 0 }, fate: { value: 0 }, fearRating },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    update: async () => {},
    createEmbeddedDocuments: async () => [],
    flags
  };
}

const UNIGNORABLE = { unignorable: true };
const saved = getRuleSources();
const grant = (...flags) => {
  clearRuleSources();
  registerRuleSource("test", () => [
    { id: "test.rule", when: {}, effects: flags.map(target => ({ kind: "grantFlag", target })) }
  ]);
};

beforeEach(() => { resetCaptured(); clearRuleSources(); });
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of saved) registerRuleSource(key, fn);
});

describe("_executeFearRoll: нельзя игнорировать — память сцены", () => {
  it("в сцене уже был тест против Страха 3 — Страх Ярости 3 всё равно тестируется", async () => {
    const actor = makeActor({ faced: 3 });
    captured.nextRoll = 99;
    await _executeFearRoll(actor, 3, "important", 0, 0, UNIGNORABLE);
    const msg = captured.chat.at(-1).content;
    expect(msg).not.toContain("Не требуется");
    expect(msg).toContain("Провал");
  });

  it("обычный Страх 3 в той же сцене по-прежнему не тестируется", async () => {
    const actor = makeActor({ faced: 3 });
    await _executeFearRoll(actor, 3, "important", 0, 0, {});
    expect(captured.chat.at(-1).content).toContain("Не требуется");
  });

  it("память сцены не понижается: после Страха 4 тест против неигнорируемого 3 оставляет 4", async () => {
    const actor = makeActor({ faced: 4 });
    captured.nextRoll = 99;
    await _executeFearRoll(actor, 3, "important", 0, 0, UNIGNORABLE);
    expect(actor.flags.fearFacedRating).toBe(4);
  });

  it("неигнорируемый тест сам запоминается: следующий обычный Страх 3 в сцене не тестируется", async () => {
    const actor = makeActor();
    captured.nextRoll = 99;
    await _executeFearRoll(actor, 3, "important", 0, 0, UNIGNORABLE);
    expect(actor.flags.fearFacedRating).toBe(3);
    await _executeFearRoll(actor, 3, "important", 0, 0, {});
    expect(captured.chat.at(-1).content).toContain("Не требуется");
  });
});

describe("_executeFearRoll: нельзя игнорировать — автоуспех по Infamy и своему Страху", () => {
  it("Важный с Infamy 60 против Страха 3 — тест, а не автоуспех", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor(), 3, "important", 60, 0, UNIGNORABLE);
    expect(captured.chat.at(-1).content).not.toContain("выстоял");
  });

  it("тот же Важный без свойства — автоуспех (контроль)", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor(), 3, "important", 60, 0, {});
    expect(captured.chat.at(-1).content).toContain("выстоял");
  });

  it("свой Страх 3 против Страха 3 — тест, а не автоуспех", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor({ fearRating: 3 }), 3, "important", 0, 0, UNIGNORABLE);
    expect(captured.chat.at(-1).content).not.toContain("выстоял");
  });

  it("Infamy по-прежнему вычитается из броска Шока — это не игнорирование", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor(), 3, "important", 60, 0, UNIGNORABLE);
    expect(captured.chat.at(-1).content).toContain("−60");
  });
});

describe("_executeFearRoll: нельзя игнорировать — Стальное Сердце", () => {
  it("Страх 3 не снижается до 2: порог по настоящему рейтингу (40 − 10)", async () => {
    grant("mutation.heartOfSteel");
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor(), 3, "important", 0, 0, UNIGNORABLE);
    expect(captured.chat.at(-1).content).toContain("<label>Порог</label><b>30</b>");
  });

  it("без свойства Стальное Сердце снижает Страх 3 до 2: порог 40 + 0 (контроль)", async () => {
    grant("mutation.heartOfSteel");
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor(), 3, "important", 0, 0, {});
    expect(captured.chat.at(-1).content).toContain("<label>Порог</label><b>40</b>");
  });

  it("в карточке видно, что отменено", async () => {
    grant("mutation.heartOfSteel");
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor({ faced: 3 }), 3, "important", 0, 0, UNIGNORABLE);
    const msg = captured.chat.at(-1).content;
    expect(msg).toContain("нельзя игнорировать");
    expect(msg).toContain("Стальное Сердце");
    expect(msg).toContain("память сцены");
  });
});

describe("_executeFearRoll: иммунитет к Страху — не игнорирование, остаётся", () => {
  it("fear.immune проходит и неигнорируемый Страх", async () => {
    grant("fear.immune");
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor(), 3, "important", 0, 0, UNIGNORABLE);
    expect(captured.chat.at(-1).content).toContain("выстоял");
  });
});

describe("_executeFearRoll: бесплатный переброс Демона наследует свойство", () => {
  it("переброс с unignorable в properties — снова без автоуспеха по Infamy", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor({ faced: 3 }), 3, "important", 60, 0,
      { demon: true, unignorable: true }, { free: true });
    expect(captured.chat.at(-1).content).not.toContain("выстоял");
  });
});
