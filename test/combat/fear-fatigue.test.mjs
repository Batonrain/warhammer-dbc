// test/combat/fear-fatigue.test.mjs
//
// Тест Страха (wdbc-lfho): порог wp+ratingMod+mod+difficulty раньше не знал
// про Усталость — уставший персонаж должен был вспомнить про свой −10 и
// вписать его в «Доп. мод.» руками. Тест дороги, которой этот штраф теперь
// доезжает до порога и виден в карточке результата.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { _executeFearRoll } from "../../module/combat/fear.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";

function makeActor({ fatigue = 0, wp = 40 } = {}) {
  return {
    id: "a1", name: "Подставной",
    items: [],
    system: {
      characteristics: { wp: { total: wp } },
      fatigue: { value: fatigue, max: 0 },
      fate: { value: 0 }
    },
    getFlag: () => undefined,
    update: async () => {},
    // Шок со сроком (Без сознания/Беспомощен) заводит ActiveEffect.
    effects: [],
    createEmbeddedDocuments: async () => []
  };
}

beforeEach(resetCaptured);

describe("_executeFearRoll: Усталость в пороге теста Страха", () => {
  it("не уставший — порог без штрафа", async () => {
    captured.nextRoll = 99; // гарантированный провал, чтобы дойти до конца без лишних веток
    await _executeFearRoll(makeActor({ fatigue: 0, wp: 40 }), 1, "important", 0, 0);
    const msg = captured.chat.at(-1);
    expect(msg.content).toContain("<label>Порог</label><b>50</b>"); // 40 + важный(+10) + 0
    expect(msg.content).not.toContain("Усталость");
  });

  it("уставший — порог падает на 10, и это видно в карточке", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor({ fatigue: 1, wp: 40 }), 1, "important", 0, 0);
    const msg = captured.chat.at(-1);
    expect(msg.content).toContain("<label>Порог</label><b>40</b>"); // 40 + 10 − 10
    expect(msg.content).toContain("😓 Усталость");
  });

  it("Infamy ≥ порога рейтинга — авто-успех, штраф Усталости уже неважен", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor({ fatigue: 5, wp: 40 }), 1, "important", 20, 0);
    const msg = captured.chat.at(-1);
    expect(msg.content).toContain("выстоял");
  });
});

describe("_executeFearRoll: возможность sarcophagus.autoPassFear (wdbc-drn)", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("пилот Саркофага Дредноута автоматически проходит тест Страха без Infamy", async () => {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "test.rule", when: {}, effects: [{ kind: "grantFlag", target: "sarcophagus.autoPassFear" }] }
    ]);
    captured.nextRoll = 99; // гарантированный провал без возможности — авто-успех обязан её перебить
    await _executeFearRoll(makeActor({ fatigue: 0, wp: 40 }), 1, "important", 0, 0);
    const msg = captured.chat.at(-1);
    expect(msg.content).toContain("выстоял");
  });

  it("без возможности — тот же бросок проваливается как обычно", async () => {
    clearRuleSources();
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor({ fatigue: 0, wp: 40 }), 1, "important", 0, 0);
    const msg = captured.chat.at(-1);
    expect(msg.content).not.toContain("выстоял");
  });
});

describe("_executeFearRoll: Стальное Сердце — все рейтинги Страха на 1 меньше (wdbc-tsz6)", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });
  const grantSteelHeart = () => {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "test.rule", when: {}, effects: [{ kind: "grantFlag", target: "mutation.heartOfSteel" }] }
    ]);
  };

  it("Страх 1 (эффективно 0) — игнорируется полностью, автоуспех", async () => {
    grantSteelHeart();
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor({ fatigue: 0, wp: 40 }), 1, "important", 0, 0);
    expect(captured.chat.at(-1).content).toContain("выстоял");
  });

  it("Страх 2 (эффективно Страх 1): порог считается по пониженному рейтингу, не по исходному", async () => {
    grantSteelHeart();
    captured.nextRoll = 99;
    // Страх 1 важный: +10 (см. FEAR_RATINGS). Порог = 40 (wp) + 10 = 50, не
    // 40+0=40, каким был бы порог настоящего Страха 2 (important:0).
    await _executeFearRoll(makeActor({ fatigue: 0, wp: 40 }), 2, "important", 0, 0);
    const msg = captured.chat.at(-1);
    expect(msg.content).toContain("<label>Порог</label><b>50</b>");
  });

  it("без Стального Сердца тот же Страх 1 не автопасс, порог считается по настоящему рейтингу", async () => {
    clearRuleSources();
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor({ fatigue: 0, wp: 40 }), 1, "important", 0, 0);
    const msg = captured.chat.at(-1);
    expect(msg.content).not.toContain("выстоял");
    expect(msg.content).toContain("<label>Порог</label><b>50</b>"); // 40 + важный(+10)
  });
});

describe("_executeFearRoll: общая возможность fear.immune (wdbc-m7we)", () => {
  // Иммунитет к Страху был выдан данными и не читался никем: Дар «Инфернальная
  // Воля» обещал его текстом, а система продолжала требовать тест. Читатель
  // при этом уже существовал — тот же автопасс, которым пользуется пилот
  // Саркофага Дредноута. Не хватало только общего имени, которое может выдать
  // любой предмет, а не одна конкретная подсистема.
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("носитель иммунитета проходит тест Страха автоматически", async () => {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "test.rule", when: {}, effects: [{ kind: "grantFlag", target: "fear.immune" }] }
    ]);
    captured.nextRoll = 99; // без иммунитета это гарантированный провал
    await _executeFearRoll(makeActor({ fatigue: 0, wp: 40 }), 3, "important", 0, 0);
    expect(captured.chat.at(-1).content).toContain("выстоял");
  });

  it("иммунитет работает и на высоком рейтинге Страха", async () => {
    // Отличие от «Стального Сердца», которое лишь снижает рейтинг на 1: там
    // Страх 3 остаётся Страхом 2 и тест по-прежнему нужен.
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "test.rule", when: {}, effects: [{ kind: "grantFlag", target: "fear.immune" }] }
    ]);
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor({ fatigue: 0, wp: 40 }), 4, "important", 0, 0);
    expect(captured.chat.at(-1).content).toContain("выстоял");
  });

  it("без иммунитета тот же бросок на том же рейтинге проваливается", async () => {
    clearRuleSources();
    captured.nextRoll = 99;
    await _executeFearRoll(makeActor({ fatigue: 0, wp: 40 }), 3, "important", 0, 0);
    expect(captured.chat.at(-1).content).not.toContain("выстоял");
  });
});

// Стр. 53: правила автоуспеха и памяти сцены из главы «Страх».
function makeFlagActor({ wp = 40, fearRating = 0, faced = 0 } = {}) {
  const flags = faced ? { fearFacedRating: faced } : {};
  return {
    ...makeActor({ wp }),
    system: { ...makeActor({ wp }).system, fearRating },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; },
    flags
  };
}

describe("_executeFearRoll: собственный Страх и Infamy (стр. 53)", () => {
  it("свой Страх 2 против Страха 2 — Важный проходит автоматически", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeFlagActor({ fearRating: 2 }), 2, "important", 0, 0);
    expect(captured.chat.at(-1).content).toContain("выстоял");
  });

  it("свой Страх 1 против Страха 2 — тест как обычно", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeFlagActor({ fearRating: 1 }), 2, "important", 0, 0);
    expect(captured.chat.at(-1).content).not.toContain("выстоял");
  });

  it("Обычный персонаж с Infamy 20 против Страха 1 — автоуспеха нет", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeFlagActor(), 1, "normal", 20, 0);
    expect(captured.chat.at(-1).content).not.toContain("выстоял");
  });

  it("Обычный персонаж не вычитает Infamy из броска Шока", async () => {
    captured.nextRoll = 99;
    await _executeFearRoll(makeFlagActor(), 1, "normal", 15, 0);
    expect(captured.chat.at(-1).content).not.toContain("−15");
  });
});

describe("_executeFearRoll: один тест против источника до конца сцены (стр. 53)", () => {
  it("после теста против Страха 2 тот же рейтинг и ниже не тестируются", async () => {
    const actor = makeFlagActor();
    captured.nextRoll = 99;
    await _executeFearRoll(actor, 2, "important", 0, 0);
    expect(actor.flags.fearFacedRating).toBe(2);
    await _executeFearRoll(actor, 1, "important", 0, 0);
    expect(captured.chat.at(-1).content).toContain("Не требуется");
  });

  it("более сильный источник — новый тест", async () => {
    const actor = makeFlagActor({ faced: 2 });
    captured.nextRoll = 99;
    await _executeFearRoll(actor, 3, "important", 0, 0);
    expect(captured.chat.at(-1).content).not.toContain("Не требуется");
    expect(actor.flags.fearFacedRating).toBe(3);
  });

  it("бесплатный переброс Демона — не новая встреча, не отсекается", async () => {
    const actor = makeFlagActor({ faced: 2 });
    captured.nextRoll = 99;
    await _executeFearRoll(actor, 2, "important", 0, 0, { demon: true }, { free: true });
    expect(captured.chat.at(-1).content).not.toContain("Не требуется");
  });
});
