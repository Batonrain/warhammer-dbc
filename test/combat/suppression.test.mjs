// test/combat/suppression.test.mjs
//
// Подавление (стр. 32-33): тест W+0, тест Морали. Провал → conditions.pinned.
// Снимается тестом W+0 (+30 по решению ГМ) в конце Хода Подавленного.
// Раньше conditions.pinned был флагом без единого механического следствия —
// теперь есть сам тест, который его накладывает/снимает.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { suppressionTestMod, rollSuppressionTest, rollSuppressionRecovery,
         postSuppressionRecoveryPrompt, applySuppressionProne, clearPinnedOnMeleeEntry } from "../../module/combat/suppression.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";
import { COVER_TYPE } from "../../module/regions/cover.mjs";

function actor({ wp = 40, pinned = false, prone = false } = {}) {
  const store = {};
  const a = {
    id: "actor-1", name: "Стрелок", uuid: "Actor.actor-1", type: "character",
    system: { characteristics: { wp: { total: wp } }, conditions: { pinned, prone } },
    async update(data) {
      if ("system.conditions.pinned" in data) this.system.conditions.pinned = data["system.conditions.pinned"];
      if ("system.conditions.prone" in data) this.system.conditions.prone = data["system.conditions.prone"];
    },
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; }
  };
  return a;
}

/** Токен-заглушка того же формата, что free-attack.mjs::enemyContactTokenDocs ждёт. */
function tokenDoc({ id, x = 0, y = 0, width = 2, height = 2, disposition = -1, actor: a = null } = {}) {
  return { id, x, y, width, height, disposition, actor: a };
}

beforeEach(() => {
  resetCaptured();
  globalThis.canvas = { tokens: { placeables: [] } };
});

describe("suppressionTestMod: штраф зависит от RoF, не от класса оружия", () => {
  it("оружие с автоматической RoF (rof_full > 0) — −20", () => {
    expect(suppressionTestMod({ rof_semi: 2, rof_full: 6 })).toBe(-20);
  });
  it("только полуавтомат (rof_full = 0) — −10", () => {
    expect(suppressionTestMod({ rof_semi: 2, rof_full: 0 })).toBe(-10);
  });
  it("нет rof_full вовсе — −10", () => {
    expect(suppressionTestMod({ rof_semi: 2 })).toBe(-10);
  });
});

describe("rollSuppressionTest", () => {
  it("успех — не накладывает Подавление", async () => {
    captured.nextRoll = 10; // WP 40+0 → порог 40, 10 ≤ 40 успех
    const a = actor({ wp: 40 });
    const { success } = await rollSuppressionTest(a, { mod: 0 });
    expect(success).toBe(true);
    expect(a.system.conditions.pinned).toBe(false);
  });

  it("провал — накладывает conditions.pinned", async () => {
    captured.nextRoll = 90; // порог 40, 90 > 40 провал
    const a = actor({ wp: 40 });
    const { success } = await rollSuppressionTest(a, { mod: 0 });
    expect(success).toBe(false);
    expect(a.system.conditions.pinned).toBe(true);
  });

  it("штраф снижает порог — успех на 35 при mod −10 (порог 30) не проходит", async () => {
    captured.nextRoll = 35;
    const a = actor({ wp: 40 });
    const { success, threshold } = await rollSuppressionTest(a, { mod: -10 });
    expect(threshold).toBe(30);
    expect(success).toBe(false);
  });

  it("карточка называет источник и показывает исход", async () => {
    captured.nextRoll = 10;
    const a = actor({ wp: 40 });
    await rollSuppressionTest(a, { mod: -10, sourceLabel: "Стрельба на подавление" });
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Стрельба на подавление");
    expect(card).toContain("<label>Порог</label><b>30</b>");
    expect(card).toContain("Успех");
  });

  // Перебежка/Duck and Cover (стр. 30, wdbc-x1nz.2.38): переброс Подавления
  // до конца Раунда.
  it("Перебежка активна — два броска, лучший (меньший) взят", async () => {
    captured.dice = [80, 20]; // порог 40 — 80 провал, 20 успех
    const a = actor({ wp: 40 });
    await a.setFlag("warhammer-dbc", "duckAndCoverActive", true);
    const { success } = await rollSuppressionTest(a, { mod: 0 });
    expect(success).toBe(true);
    expect(captured.chat.at(-1).content).toContain("Перебежка");
  });

  it("без Перебежки — один бросок как раньше", async () => {
    captured.nextRoll = 90;
    const a = actor({ wp: 40 });
    const { success } = await rollSuppressionTest(a, { mod: 0 });
    expect(success).toBe(false);
    expect(captured.chat.at(-1).content).not.toContain("Перебежка");
  });
});

// Рукопашный контакт (стр. 33, wdbc-x1nz.2.62): «персонажи в рукопашной не
// подвержены Подавлению» — тест не катается вовсе, Подавление не наложится.
describe("rollSuppressionTest: рукопашный контакт — иммунитет к самому тесту", () => {
  it("в Базовом контакте с врагом — тест не катается, Подавление не накладывается", async () => {
    const enemy = tokenDoc({ id: "e", x: 2, y: 0, disposition: 1, actor: { type: "character" } });
    const self  = tokenDoc({ id: "m", x: 0, y: 0, disposition: -1 });
    canvas.tokens.placeables = [{ document: self }, { document: enemy }];
    captured.dice = []; // не должен катать вовсе — пустая очередь не потревожена

    const a = actor({ wp: 40 });
    a.getActiveTokens = () => [{ document: self }];

    const { success, immune } = await rollSuppressionTest(a, { mod: 0 });

    expect(success).toBe(true);
    expect(immune).toBe(true);
    expect(a.system.conditions.pinned).toBe(false);
    expect(captured.chat.at(-1).content).toContain("Подавлению не подвержен");
  });

  it("врага рядом нет — тест катается как обычно", async () => {
    const self = tokenDoc({ id: "m", x: 0, y: 0, disposition: -1 });
    canvas.tokens.placeables = [{ document: self }];
    captured.nextRoll = 90;

    const a = actor({ wp: 40 });
    a.getActiveTokens = () => [{ document: self }];

    const { success, immune } = await rollSuppressionTest(a, { mod: 0 });

    expect(immune).toBeUndefined();
    expect(success).toBe(false);
  });
});

// «Заведомо безопасно» (стр. 33, wdbc-x1nz.2.62) — галочка ГМа на карточке
// атаки (attack-card.mjs), передаётся сюда уже прочитанным булевым флагом.
describe("rollSuppressionTest: safeOverride — ГМ отметил «заведомо безопасно»", () => {
  it("safeOverride: true — авто-успех, тест не катается", async () => {
    captured.dice = [];
    const a = actor({ wp: 40 });
    const { success, autoSafe } = await rollSuppressionTest(a, { mod: 0, safeOverride: true });

    expect(success).toBe(true);
    expect(autoSafe).toBe(true);
    expect(a.system.conditions.pinned).toBe(false);
    expect(captured.chat.at(-1).content).toContain("Заведомо безопасно");
  });

  it("safeOverride: false (по умолчанию) — тест катается как обычно", async () => {
    captured.nextRoll = 90;
    const a = actor({ wp: 40 });
    const { success } = await rollSuppressionTest(a, { mod: 0 });
    expect(success).toBe(false);
  });
});

// Движение в укрытие при провале (стр. 33, wdbc-x1nz.2.62): не в укрытии —
// напоминание с кнопкой «Залечь»; в укрытии — карточка молчит об этом.
describe("rollSuppressionTest: провал — напоминание про укрытие", () => {
  function coverRegion(ap) {
    return { behaviors: [{ type: COVER_TYPE, disabled: false, system: { coverAp: ap } }] };
  }

  it("провал, НЕ в зоне Укрытия — печатает напоминание и кнопку «Залечь»", async () => {
    captured.nextRoll = 90;
    const self = { document: { regions: new Set() } };
    const a = actor({ wp: 40 });
    a.getActiveTokens = () => [self];

    await rollSuppressionTest(a, { mod: 0 });

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Не в укрытии");
    expect(card).toContain("wh-suppression-prone-btn");
  });

  it("провал, СТОИТ в зоне Укрытия — напоминания нет", async () => {
    captured.nextRoll = 90;
    const self = { document: { regions: new Set([coverRegion(6)]) } };
    const a = actor({ wp: 40 });
    a.getActiveTokens = () => [self];

    await rollSuppressionTest(a, { mod: 0 });

    const card = captured.chat.at(-1).content;
    expect(card).not.toContain("Не в укрытии");
    expect(card).not.toContain("wh-suppression-prone-btn");
  });

  it("успех — напоминания нет независимо от укрытия", async () => {
    captured.nextRoll = 10;
    const a = actor({ wp: 40 });

    await rollSuppressionTest(a, { mod: 0 });

    expect(captured.chat.at(-1).content).not.toContain("wh-suppression-prone-btn");
  });
});

describe("applySuppressionProne: кнопка «Залечь»", () => {
  it("накладывает conditions.prone", async () => {
    const a = actor({ wp: 40 });
    await applySuppressionProne(a);
    expect(a.system.conditions.prone).toBe(true);
  });
});

describe("clearPinnedOnMeleeEntry", () => {
  it("снимает pinned", async () => {
    const a = actor({ wp: 40, pinned: true });
    await clearPinnedOnMeleeEntry(a);
    expect(a.system.conditions.pinned).toBe(false);
  });

  it("не Подавлен — не трогает (не падает без conditions)", async () => {
    const a = actor({ wp: 40, pinned: false });
    await expect(clearPinnedOnMeleeEntry(a)).resolves.toBeUndefined();
    expect(a.system.conditions.pinned).toBe(false);
  });

  it("актор без system вовсе — не падает", async () => {
    await expect(clearPinnedOnMeleeEntry(null)).resolves.toBeUndefined();
  });
});

describe("rollSuppressionRecovery", () => {
  it("успех снимает conditions.pinned", async () => {
    captured.nextRoll = 10;
    const a = actor({ wp: 40, pinned: true });
    const { success } = await rollSuppressionRecovery(a, { bonus: 0 });
    expect(success).toBe(true);
    expect(a.system.conditions.pinned).toBe(false);
  });

  it("провал оставляет conditions.pinned как есть", async () => {
    captured.nextRoll = 90;
    const a = actor({ wp: 40, pinned: true });
    const { success } = await rollSuppressionRecovery(a, { bonus: 0 });
    expect(success).toBe(false);
    expect(a.system.conditions.pinned).toBe(true);
  });

  it("бонус +30 поднимает порог", async () => {
    captured.nextRoll = 65;
    const a = actor({ wp: 40, pinned: true });
    const { success, threshold } = await rollSuppressionRecovery(a, { bonus: 30 });
    expect(threshold).toBe(70);
    expect(success).toBe(true);
  });
});

// Lord of the Exodites (wdbc-zepq): бонус/переброс с областью "morale" из
// реестра правил применяются автоматически — у Подавления нет диалога.
describe("интеграция с реестром правил (область morale)", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("rollSuppressionTest: rollBonus с target morale поднимает порог автоматически", async () => {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "x", label: "Аура", effects: [{ kind: "rollBonus", target: "morale", value: 30 }] }
    ]);
    captured.nextRoll = 65; // порог 40+30=70, 65 ≤ 70 успех
    const a = actor({ wp: 40 });
    const { success, threshold } = await rollSuppressionTest(a, { mod: 0 });
    expect(threshold).toBe(70);
    expect(success).toBe(true);
  });

  it("rollSuppressionRecovery: rollMode с target morale даёт переброс (keepBest)", async () => {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "x", label: "Аура", effects: [{ kind: "rollMode", target: "morale", mode: "keepBest", rolls: 2 }] }
    ]);
    captured.dice = [90, 10]; // без переброса — провал (90>40), с переброском — лучший (10) успех
    const a = actor({ wp: 40, pinned: true });
    const { success } = await rollSuppressionRecovery(a, { bonus: 0 });
    expect(success).toBe(true);
  });
});

describe("rollSuppressionTest: возможность sarcophagus.autoPassFear (wdbc-drn)", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("пилот Саркофага Дредноута автоматически проходит тест Подавления", async () => {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "test.rule", when: {}, effects: [{ kind: "grantFlag", target: "sarcophagus.autoPassFear" }] }
    ]);
    captured.nextRoll = 90; // гарантированный провал без возможности
    const a = actor({ wp: 40 });
    const { success } = await rollSuppressionTest(a, { mod: 0 });
    expect(success).toBe(true);
    expect(a.system.conditions.pinned).toBe(false);
  });

  it("без возможности — тот же бросок проваливается как обычно", async () => {
    clearRuleSources();
    captured.nextRoll = 90;
    const a = actor({ wp: 40 });
    const { success } = await rollSuppressionTest(a, { mod: 0 });
    expect(success).toBe(false);
    expect(a.system.conditions.pinned).toBe(true);
  });
});

describe("rollSuppressionRecovery: возможность sarcophagus.autoPassFear (wdbc-drn)", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("пилот автоматически преодолевает Подавление без успешного броска", async () => {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "test.rule", when: {}, effects: [{ kind: "grantFlag", target: "sarcophagus.autoPassFear" }] }
    ]);
    captured.nextRoll = 90;
    const a = actor({ wp: 40, pinned: true });
    const { success } = await rollSuppressionRecovery(a, { bonus: 0 });
    expect(success).toBe(true);
    expect(a.system.conditions.pinned).toBe(false);
  });
});

// sourceActor (wdbc-1rno, 12.09.2026): стрелок известен на момент выстрела
// (attack-card.mjs несёт attackerUuid), но терялся к моменту клика по кнопке
// теста в чате — владелец ТОКЕНА ЦЕЛИ жмёт её позже. hooks.mjs теперь читает
// data-attacker-uuid и передаёт actor'ом сюда; rollMoraleTest едет ctx.
// targetActor тем же путём, что и у любых других cross-actor правил
// (Ненависть, module/rules/hatred.mjs).
describe("rollSuppressionTest: sourceActor едет в ctx.targetActor правил", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
  });

  it("с sourceActor — правило видит его как ctx.targetActor", async () => {
    let seenTarget;
    clearRuleSources();
    registerRuleSource("test", (a, ctx) => { seenTarget = ctx.targetActor; return []; });
    captured.nextRoll = 10;
    const shooter = { id: "shooter-1", name: "Стрелок", uuid: "Actor.shooter-1" };
    const a = actor({ wp: 40 });
    await rollSuppressionTest(a, { mod: 0, sourceActor: shooter });
    expect(seenTarget).toBe(shooter);
  });

  it("без sourceActor — ctx.targetActor null, ведёт себя как раньше", async () => {
    let seenTarget = "непроверено";
    clearRuleSources();
    registerRuleSource("test", (a, ctx) => { seenTarget = ctx.targetActor; return []; });
    captured.nextRoll = 10;
    const a = actor({ wp: 40 });
    await rollSuppressionTest(a, { mod: 0 });
    expect(seenTarget).toBeNull();
  });
});

describe("postSuppressionRecoveryPrompt", () => {
  it("публикует карточку с двумя кнопками (+0 и +30)", async () => {
    const a = actor({ wp: 40, pinned: true });
    await postSuppressionRecoveryPrompt(a);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("wh-suppression-recovery-btn");
    expect(card).toContain('data-bonus="0"');
    expect(card).toContain('data-bonus="30"');
    expect(card).toContain(`data-actor-uuid="${a.uuid}"`);
  });
});
