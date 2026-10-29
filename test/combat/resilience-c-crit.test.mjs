// test/combat/resilience-c-crit.test.mjs
//
// Таланты Стойкости (глава 3, пакет C) на карточке Критического Эффекта и вокруг неё:
//   Последний Рывок (T+0: эффекты откладываются до конца Хода носителя),
//   Не Умирать (Очко Бесчестия: эффекты гаснут, урон остаётся),
//   Боль — Лишь Иллюзия (W+0: уровень эффекта − Успехи, минимум 1),
//   Крепкий Орешек (кубик Кровотечения дважды; тест «смерть от шока» перебрасывается),
//   тест «смерть от шока» (правило мира, кнопка у любого персонажа).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CRITICAL_TABLES, getCriticalEffect } from "../../critical-tables.mjs";
import {
  parseShockDeathTest, shockDeathButtonHtml, textAssertsDeath
} from "../../module/combat/crit-effect-parser.mjs";
import {
  critTalentsHtml, dimCritEffects, collectCritEffects, applyCritTalentState
} from "../../module/combat/crit-talents.mjs";
import {
  useFinalPush, useNeverDie, usePainIllusion, finalPushTurnEnd, finalPushCombatEnd, applyDeferredEffects
} from "../../module/combat/crit-talents-actions.mjs";
import { rollShockDeath } from "../../module/combat/shock-death.mjs";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { processConditionTurnEnd } from "../../module/combat/condition-ticks.mjs";

const ch =total => ({ total, bonus: Math.floor(total / 10) });
const talentItem = name => ({ type: "talent", name, system: {}, flags: {}, getFlag: () => undefined });
const FP = "Final Push / Последний Рывок";
const ND = "Never Die / Не Умирать";
const PI = "Pain Is an Illusion / Боль – Лишь Иллюзия";
const DH = "Die Hard / Крепкий Орешек";

/** Персонаж с флагами, предметами и пулом Очков Бесчестия (system.fate.value). */
function hero({ talents = [], t = 50, wp = 50, fate = 2, uuid = "Actor.h1", wounds = 20, critical = 0 } = {}) {
  const store = {};
  const list = talents.map(talentItem);
  list.contents = list;
  list.get = id => list.find(i => i.id === id) ?? null;
  return {
    id: uuid.replace("Actor.", ""), name: "Герой", type: "character", uuid, isOwner: true, updates: [], _store: store,
    system: {
      absorption: { head: 0, body: 0, rightArm: 0, leftArm: 0, leftLeg: 0, rightLeg: 0, toughnessBonus: 0, propFlags: {}, armorOnly: {} },
      characteristics: { t: ch(t), wp: ch(wp), s: ch(40), ag: ch(40), int: ch(40) },
      wounds: { value: wounds, critical, max: 20 }, fate: { value: fate }, cover: { ap: 0 },
      armorCorrosion: { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 },
      actionPoints: { value: 2, max: 2 }, conditions: {}, fatigue: { value: 0, max: 10 }, patronGod: "", size: 4
    },
    items: list, effects: Object.assign([], { contents: [] }),
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, v) => { store[`${scope}.${key}`] = v; },
    unsetFlag: async (scope, key) => { delete store[`${scope}.${key}`]; },
    getActiveTokens: () => [],
    async update(data) {
      this.updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const m = path.match(/^flags\.([^.]+)\.(?:-=)?(.+)$/);
        if (m) { if (path.includes(".-=")) delete store[`${m[1]}.${m[2]}`]; else store[`${m[1]}.${m[2]}`] = value; continue; }
        const keys = path.split(".").slice(1);
        let node = this.system;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    },
    async updateEmbeddedDocuments() { return []; }
  };
}

/** Кнопка карточки: достаточно для collectCritEffects/dimCritEffects. */
function btn(cls, dataset = {}, { disabled = false } = {}) {
  const classes = new Set(cls.split(/\s+/));
  return {
    disabled, dataset, title: "", classes,
    classList: { add: c => classes.add(c), contains: c => classes.has(c) },
    get outerHTML() { return `<button class="${cls}"${this.disabled ? " disabled" : ""}>x</button>`; }
  };
}
const fakeBlock = buttons => ({
  buttons,
  querySelectorAll(sel) {
    const wanted = sel.split(",").map(s => s.trim().replace(/^\./, ""));
    return buttons.filter(b => wanted.some(w => b.classes.has(w)));
  }
});
let msgSeq = 0;
function fakeMessage() {
  const flags = {};
  return { id: `m${++msgSeq}`, isOwner: true, flags,
    getFlag: (_s, k) => flags[k], setFlag: async (_s, k, v) => { flags[k] = v; } };
}

const chatText = () => captured.chat.map(m => m.content ?? "").join("\n");
const inCombat = actor => {
  globalThis.game.combat = { id: "c1", round: 1, started: true, combatants: [{ actor }] };
  globalThis.game.combats = [globalThis.game.combat];
};

const realGetProperty = globalThis.foundry.utils.getProperty;
beforeEach(() => {
  resetCaptured();
  globalThis.foundry.utils.getProperty = (o, p) => String(p).split(".").reduce((x, k) => x?.[k], o);
});
afterEach(() => {
  globalThis.foundry.utils.getProperty = realGetProperty;
  delete globalThis.game.combat; delete globalThis.game.combats; delete globalThis.fromUuid;
});

// ── Разбор строк «тест T+0, или умереть от шока» ────────────────────────────

describe("тест «смерть от шока»: разбор строк критических таблиц", () => {
  const allRows = () => {
    const rows = [];
    for (const [type, byLoc] of Object.entries(CRITICAL_TABLES))
      for (const [loc, entries] of Object.entries(byLoc))
        for (const [lvl] of entries) rows.push({ type, loc, lvl, text: getCriticalEffect(type, { head: "Голова", torso: "Торс", arm: "П. Рука", leg: "П. Нога" }[loc], lvl) });
    return rows;
  };

  it("разбираются ВСЕ условные строки книги — и только они", () => {
    const rows = allRows();
    const conditional = rows.filter(r => /или\s+(?:умереть|умирает)\s+от/iu.test(r.text ?? ""));
    expect(conditional.length).toBeGreaterThanOrEqual(12);
    for (const r of conditional) {
      const t = parseShockDeathTest(r.text);
      expect(t, `${r.type}/${r.loc}[${r.lvl}]`).not.toBeNull();
      expect(t).toMatchObject({ char: "t", mod: 0 });
    }
    // и ни одна другая строка таблиц ложно не разбирается
    for (const r of rows.filter(x => !conditional.includes(x))) expect(parseShockDeathTest(r.text), `${r.type}/${r.loc}[${r.lvl}]`).toBeNull();
  });

  it("причина: «шока» у 11 строк, «остановки сердца» у C/Торс 9", () => {
    const causes = allRows().map(r => parseShockDeathTest(r.text)?.cause).filter(Boolean);
    expect(causes.filter(c => c === "шока")).toHaveLength(causes.length - 1);
    expect(causes.filter(c => c === "остановки сердца")).toHaveLength(1);
  });

  it("условная смерть по-прежнему НЕ «констатируется» (страж textAssertsDeath)", () => {
    const text = "Цель должна пройти тест на T+0, или умереть от шока.";
    expect(textAssertsDeath(text)).toBe(false);
    expect(parseShockDeathTest(text)).toMatchObject({ char: "t", mod: 0, cause: "шока" });
  });

  it("модификатор и кириллическая Т разбираются", () => {
    expect(parseShockDeathTest("пройти тест на Т−10 или умереть от шока")).toMatchObject({ mod: -10 });
    expect(parseShockDeathTest("пройти тест T+20, или умереть от шока")).toMatchObject({ mod: 20 });
  });

  it("безусловная смерть и обычный текст — не тест", () => {
    expect(parseShockDeathTest("Цель умирает мгновенно.")).toBeNull();
    expect(parseShockDeathTest("Цель Оглушена на 1d5 Раундов.")).toBeNull();
    expect(parseShockDeathTest("")).toBeNull();
    expect(parseShockDeathTest(null)).toBeNull();
  });

  it("кнопка: у любого персонажа, с данными теста; блок Изгнанного из Смерти её убирает", () => {
    const html = shockDeathButtonHtml("Цель должна пройти тест на T+0 или умереть от шока.", "Actor.x");
    expect(html).toContain("wh-shock-death-btn");
    expect(html).toContain('data-actor-uuid="Actor.x"');
    expect(html).toContain("Тест T+0 (смерть от шока)");
    expect(shockDeathButtonHtml("Цель должна пройти тест на T+0 или умереть от шока.", "Actor.x", { blocked: true })).toBe("");
    expect(shockDeathButtonHtml("Цель Оглушена.", "Actor.x")).toBe("");
    expect(shockDeathButtonHtml("тест на T+0 или умереть от шока", "")).toBe("");
  });
});

describe("тест «смерть от шока»: бросок и смерть", () => {
  it("провал — смерть тем же путём, что от Состояний (флаг deceased)", async () => {
    const a = hero({ t: 40 });
    captured.dice = [90];
    await rollShockDeath(a, { cause: "шока" });
    expect(a._store["warhammer-dbc.deceased"]).toBe(true);
    expect(chatText()).toContain("смерть от шока");
  });

  it("успех — жив", async () => {
    const a = hero({ t: 40 });
    captured.dice = [20];
    await rollShockDeath(a, {});
    expect(a._store["warhammer-dbc.deceased"]).toBeUndefined();
    expect(chatText()).toContain("персонаж выжил");
  });

  it("Крепкий Орешек перебрасывает: два броска, засчитывается лучший (меньший)", async () => {
    const a = hero({ talents: [DH], t: 40 });
    captured.dice = [90, 15];          // первый — провал, второй — успех
    await rollShockDeath(a, {});
    expect(a._store["warhammer-dbc.deceased"]).toBeUndefined();
    expect(captured.rolls.filter(f => f === "1d100")).toHaveLength(2);
    expect(chatText()).toContain("Крепкий Орешек");
  });

  it("Крепкий Орешек: оба броска провальны — всё равно смерть", async () => {
    const a = hero({ talents: [DH], t: 40 });
    captured.dice = [90, 80];
    await rollShockDeath(a, {});
    expect(a._store["warhammer-dbc.deceased"]).toBe(true);
  });

  it("без Таланта бросок один", async () => {
    const a = hero({ t: 40 });
    captured.dice = [20];
    await rollShockDeath(a, {});
    expect(captured.rolls.filter(f => f === "1d100")).toHaveLength(1);
  });

  it("модификатор строки уходит в Порог", async () => {
    const a = hero({ t: 40 });
    captured.dice = [35];
    await rollShockDeath(a, { mod: -10 });     // Порог 30 → 35 провал
    expect(a._store["warhammer-dbc.deceased"]).toBe(true);
  });

  it("раз на карточку: повторный клик не бросает заново", async () => {
    const a = hero({ t: 40 });
    const message = fakeMessage();
    captured.dice = [20, 20];
    await rollShockDeath(a, { message });
    await rollShockDeath(a, { message });
    expect(captured.rolls.filter(f => f === "1d100")).toHaveLength(1);
    expect(captured.warnings.join(" ")).toContain("уже брошен");
  });

  it("Изгнанный из Смерти от Критического Эффекта не умирает — теста нет", async () => {
    const a = hero({ t: 40 });
    a.items.push({ type: "trait", name: "Cast Out of Death", system: {}, getFlag: () => undefined, flags: { "warhammer-dbc": { mechanics: [{ entries: [
      { kind: "capability", capabilityKey: "mutation.nurgle.castOutOfDeath" }] }] } } });
    const { CAST_OUT_OF_DEATH_CAPABILITY } = await import("../../module/rules/cast-out-of-death.mjs");
    a.items[0].flags["warhammer-dbc"].mechanics[0].entries[0].capabilityKey = CAST_OUT_OF_DEATH_CAPABILITY;
    captured.dice = [99];
    await rollShockDeath(a, {});
    expect(a._store["warhammer-dbc.deceased"]).toBeUndefined();
    expect(captured.rolls).toEqual([]);
  });
});

// ── Кнопки Талантов на карточке ─────────────────────────────────────────────

describe("кнопки Талантов Критического Эффекта: только у носителя", () => {
  it("у не-носителя пусто", () => {
    expect(critTalentsHtml(hero(), { level: 5, damageType: "impact", hitLocation: "Торс" })).toBe("");
  });

  it("каждый Талант даёт свою кнопку", () => {
    const html = critTalentsHtml(hero({ talents: [FP, ND, PI] }), { level: 6, damageType: "rending", hitLocation: "П. Рука", netDamage: 9 });
    expect(html).toContain("wh-final-push-btn");
    expect(html).toContain("wh-never-die-btn");
    expect(html).toContain("wh-pain-illusion-btn");
    expect(html).toContain('data-level="6"');
    expect(html).toContain('data-damage-type="rending"');
    expect(html).toContain('data-hit-location="П. Рука"');
    expect(html).toContain('data-net-damage="9"');
    expect(critTalentsHtml(hero({ talents: [ND] }), { level: 3 })).not.toContain("wh-final-push-btn");
  });

});

describe("карточка урона: кнопки появляются сами", () => {
  const crit = (over = {}) => ({ rawDamage: 5, penetration: 0, damageType: "impact", hitLocation: "П. Рука",
    attackerName: "Враг", weaponName: "Молот", ...over });

  it("Критический Эффект с тестом «смерть от шока» — кнопка у ЛЮБОГО персонажа; кнопок Талантов нет", async () => {
    const a = hero({ wounds: 0, critical: 3 });        // 3 + 5 = критический урон 8: C/Рука 8 «…или умереть от шока»
    await applyDamageToActor(a, crit());
    const card = chatText();
    expect(card).toContain("wh-shock-death-btn");
    expect(card).not.toContain("wh-final-push-btn");
  });

  it("у носителя трёх Талантов в блоке эффекта — все три кнопки", async () => {
    const a = hero({ talents: [FP, ND, PI], wounds: 0, critical: 3 });
    await applyDamageToActor(a, crit());
    const card = chatText();
    for (const c of ["wh-final-push-btn", "wh-never-die-btn", "wh-pain-illusion-btn"]) expect(card).toContain(c);
    expect(card).toContain('data-level="8"');
  });
});

// ── Последний Рывок ─────────────────────────────────────────────────────────

describe("Последний Рывок: T+0, эффекты откладываются до конца Хода", () => {
  const effects = () => [
    btn("wh-crit-apply-btn", { condKey: "bleeding", formula: "", permanent: "0", actorUuid: "Actor.h1" }),
    btn("wh-char-dmg-btn", { keys: "t", formula: "1d10", amount: "", permanent: "0", actorUuid: "Actor.h1" }),
    btn("wh-crit-death-btn", { actorUuid: "Actor.h1" }),
    btn("wh-crit-apply-btn", { condKey: "stunned", formula: "1d5" }, { disabled: true })   // уже проигнорирована — не откладывается
  ];

  it("успех: кнопки гаснут, описания лежат флагом на носителе", async () => {
    const a = hero({ talents: [FP], t: 50 });
    inCombat(a);
    const block = fakeBlock([...effects(), btn("wh-final-push-btn")]);
    const message = fakeMessage();
    captured.dice = [10];
    await useFinalPush(a, { message, block });
    expect(block.buttons.slice(0, 4).every(b => b.disabled)).toBe(true);
    expect(block.buttons[0].title).toContain("Последний Рывок");
    const flag = a._store["warhammer-dbc.finalPushDeferred"];
    expect(flag.items.map(i => i.kind)).toEqual(["apply", "charDmg", "death"]);
    expect(flag.items[0].html).not.toContain("disabled");
    expect(message.flags).toMatchObject({ finalPushUsed: true });
    expect(chatText()).toContain("отложены до конца Хода");
  });

  it("провал: ничего не погашено, попытка израсходована", async () => {
    const a = hero({ talents: [FP], t: 50 });
    inCombat(a);
    const block = fakeBlock(effects());
    const message = fakeMessage();
    captured.dice = [95];
    await useFinalPush(a, { message, block });
    expect(block.buttons.slice(0, 3).some(b => b.disabled)).toBe(false);
    expect(a._store["warhammer-dbc.finalPushDeferred"]).toBeUndefined();
    expect(message.flags.finalPushTried).toBeUndefined();   // попытка помнится только на этом клиенте
    expect(message.flags.finalPushUsed).toBeUndefined();
    // второй клик с этой карточки — не бросает заново
    captured.dice = [10];
    await useFinalPush(a, { message, block });
    expect(captured.rolls.filter(f => f === "1d100")).toHaveLength(1);
  });

  it("конец Хода носителя: в чат падает напоминание с теми же кнопками и «Применить», флаг снят", async () => {
    const a = hero({ talents: [FP], t: 50 });
    inCombat(a);
    const block = fakeBlock(effects());
    captured.dice = [10];
    await useFinalPush(a, { message: fakeMessage(), block });
    captured.chat = [];
    expect(await finalPushTurnEnd(a)).toBe(true);
    const card = chatText();
    expect(card).toContain("Ход закончен");
    expect(card).toContain("wh-crit-apply-btn");
    expect(card).toContain("wh-char-dmg-btn");
    expect(card).toContain("wh-crit-death-btn");
    expect(card).toContain("wh-final-push-apply-btn");
    expect(a._store["warhammer-dbc.finalPushDeferred"]).toBeUndefined();
    expect(await finalPushTurnEnd(a)).toBe(false);             // повторного напоминания нет
  });

  it("вне боя Ходов нет — напоминание выкладывается сразу", async () => {
    const a = hero({ talents: [FP], t: 50 });
    const block = fakeBlock(effects());
    captured.dice = [10];
    await useFinalPush(a, { message: fakeMessage(), block });
    expect(chatText()).toContain("Вне боя Хода нет");
    expect(a._store["warhammer-dbc.finalPushDeferred"]).toBeUndefined();
  });

  it("конец боя не теряет отложенное — напоминание", async () => {
    const a = hero({ talents: [FP], t: 50 });
    inCombat(a);
    captured.dice = [10];
    await useFinalPush(a, { message: fakeMessage(), block: fakeBlock(effects()) });
    captured.chat = [];
    await finalPushCombatEnd(globalThis.game.combat);
    expect(chatText()).toContain("wh-final-push-apply-btn");
  });

  it("applyDeferredEffects: накладывает пилюли и пропускает смерть", async () => {
    const a = hero({ talents: [FP] });
    const n = await applyDeferredEffects(a, [
      { kind: "apply", data: { condKey: "bleeding", formula: "", permanent: "0", side: "", healMod: "0" } },
      { kind: "death", data: {} },
      { kind: "shockDeath", data: {} }
    ]);
    expect(n).toBe(1);
    expect(a.system.conditions.bleeding).toBe(true);
    expect(a._store["warhammer-dbc.deceased"]).toBeUndefined();
  });

  it("не носитель: Талант не срабатывает", async () => {
    const a = hero();
    const r = await useFinalPush(a, { message: fakeMessage(), block: fakeBlock(effects()) });
    expect(r).toBe(false);
    expect(captured.rolls).toEqual([]);
  });
});

// ── Не Умирать ──────────────────────────────────────────────────────────────

describe("Не Умирать: Очко Бесчестия, все эффекты гаснут, урон остаётся", () => {
  it("тратит Очко и гасит кнопки-эффекты и кнопки Талантов", async () => {
    const a = hero({ talents: [ND], fate: 2 });
    const block = fakeBlock([btn("wh-crit-apply-btn", {}), btn("wh-crit-death-btn", {}), btn("wh-shock-death-btn", {}),
      btn("wh-never-die-btn"), btn("wh-pain-illusion-btn")]);
    const message = fakeMessage();
    expect(await useNeverDie(a, { message, block })).toBe(true);
    expect(a.system.fate.value).toBe(1);
    expect(block.buttons.every(b => b.disabled)).toBe(true);
    expect(message.flags.neverDieUsed).toBe(true);
    expect(chatText()).toContain("Урон остаётся");
  });

  it("раны не трогаются", async () => {
    const a = hero({ talents: [ND], fate: 1, wounds: 7 });
    await useNeverDie(a, { message: fakeMessage(), block: fakeBlock([]) });
    expect(a.system.wounds.value).toBe(7);
  });

  it("нет Очков — отказ, ничего не погашено, карточка остаётся свободной", async () => {
    const a = hero({ talents: [ND], fate: 0 });
    const block = fakeBlock([btn("wh-crit-apply-btn", {})]);
    const message = fakeMessage();
    expect(await useNeverDie(a, { message, block })).toBe(false);
    expect(block.buttons[0].disabled).toBe(false);
    expect(message.flags.neverDieUsed).toBeUndefined();
    expect(captured.warnings.join(" ")).toContain("Очков Бесчестия");
  });

  it("повторный клик с той же карточки Очко не тратит", async () => {
    const a = hero({ talents: [ND], fate: 3 });
    const message = fakeMessage();
    await useNeverDie(a, { message, block: fakeBlock([]) });
    await useNeverDie(a, { message, block: fakeBlock([]) });
    expect(a.system.fate.value).toBe(2);
  });

  it("не носитель — Очко цело", async () => {
    const a = hero({ fate: 2 });
    expect(await useNeverDie(a, { message: fakeMessage(), block: fakeBlock([]) })).toBe(false);
    expect(a.system.fate.value).toBe(2);
  });

  it("совместимо со Сладким Страданием: уже погашенные им кнопки остаются погашенными, живые гаснут", async () => {
    const a = hero({ talents: [ND], fate: 2 });
    const ignored = btn("wh-crit-apply-btn", {}, { disabled: true });
    ignored.title = "Проигнорировано: Сладкое Страдание";
    const live = btn("wh-crit-death-btn", {});
    await useNeverDie(a, { message: fakeMessage(), block: fakeBlock([ignored, live]) });
    expect(ignored.title).toContain("Не Умирать");   // перезаписано общей причиной, всё погашено
    expect(live.disabled).toBe(true);
  });
});

// ── Боль — Лишь Иллюзия ─────────────────────────────────────────────────────

describe("Боль — Лишь Иллюзия: W+0, уровень эффекта − Успехи, минимум 1", () => {
  const pain = (a, over = {}) => usePainIllusion(a, {
    message: fakeMessage(), block: fakeBlock([btn("wh-crit-apply-btn", {}), btn("wh-pain-illusion-btn")]),
    level: 8, damageType: "impact", hitLocation: "П. Рука", netDamage: 6, ...over
  });

  it("успех на 3 Успеха: уровень 8 → 5, строка таблицы пересчитана, новая карточка с кнопками", async () => {
    const a = hero({ talents: [PI], wp: 50 });
    captured.dice = [30];              // (50−30)/10+1 = 3 Успеха
    const block = fakeBlock([btn("wh-crit-apply-btn", {}), btn("wh-pain-illusion-btn")]);
    const message = fakeMessage();
    expect(await pain(a, { message, block })).toBe(true);
    const card = chatText();
    expect(card).toContain("<b>8</b> → <b>5</b>");
    expect(card).toContain(getCriticalEffect("impact", "П. Рука", 5));
    expect(card).toContain("Критический эффект ослаблен");
    expect(block.buttons.every(b => b.disabled)).toBe(true);        // исходные кнопки погашены
    expect(message.flags).toMatchObject({ painIllusionUsed: true });
  });

  it("много Успехов — не ниже 1", async () => {
    const a = hero({ talents: [PI], wp: 80 });
    captured.dice = [1];               // 8 Успехов
    await pain(a, { level: 4 });
    expect(chatText()).toContain("<b>4</b> → <b>1</b>");
    expect(chatText()).toContain(getCriticalEffect("impact", "П. Рука", 1));
  });

  it("уровень уже 1 — ослаблять нечего, исходные кнопки живы", async () => {
    const a = hero({ talents: [PI], wp: 80 });
    captured.dice = [1];
    const block = fakeBlock([btn("wh-crit-apply-btn", {})]);
    await pain(a, { level: 1, block });
    expect(chatText()).toContain("ослаблять нечего");
    expect(block.buttons[0].disabled).toBe(false);
  });

  it("провал: эффект остаётся, повторить с этой карточки нельзя", async () => {
    const a = hero({ talents: [PI], wp: 40 });
    const message = fakeMessage();
    const block = fakeBlock([btn("wh-crit-apply-btn", {})]);
    captured.dice = [95];
    await pain(a, { message, block });
    expect(block.buttons[0].disabled).toBe(false);
    expect(message.flags.painTried).toBeUndefined();
    expect(message.flags.painIllusionUsed).toBeUndefined();
    captured.dice = [5];
    await pain(a, { message, block });
    expect(captured.rolls.filter(f => f === "1d100")).toHaveLength(1);
  });

  it("пересчитанный эффект приносит свои живые кнопки: пилюли, «смерть от шока»", async () => {
    const a = hero({ talents: [PI], wp: 70 });
    captured.dice = [40];               // 4 Успеха: 8 → 4
    await pain(a, { level: 8, damageType: "impact", hitLocation: "П. Рука" });
    const text = getCriticalEffect("impact", "П. Рука", 4);
    const card = chatText();
    expect(card).toContain("dmg-critical-block");
    expect(text).toBeTruthy();
    // уровень 8 содержал тест на смерть от шока — на 4-м его уже нет
    expect(card).not.toContain("wh-shock-death-btn");
  });

  it("эффект, который остался тестом на смерть, сохраняет кнопку теста", async () => {
    const a = hero({ talents: [PI], wp: 50 });
    captured.dice = [45];               // 1 Успех: 9 → 8, а строка 8 — «…или умереть от шока»
    const lvl8 = getCriticalEffect("impact", "П. Рука", 8);
    expect(parseShockDeathTest(lvl8)).not.toBeNull();
    await pain(a, { level: 9, damageType: "impact", hitLocation: "П. Рука" });
    expect(chatText()).toContain("wh-shock-death-btn");
  });

  it("не носитель — теста нет", async () => {
    const a = hero();
    expect(await pain(a)).toBe(false);
    expect(captured.rolls).toEqual([]);
  });
});

// ── Состояние показанной карточки ───────────────────────────────────────────

describe("флаги карточки гасят её кнопки при каждом показе", () => {
  const rootWith = buttons => ({ querySelectorAll: sel => (sel === ".dmg-critical-block" ? [fakeBlock(buttons)] : []) });

  it("Не Умирать использован — все эффекты погашены после перерисовки", () => {
    const buttons = [btn("wh-crit-apply-btn", {}), btn("wh-crit-death-btn", {}), btn("wh-never-die-btn")];
    const message = fakeMessage();
    message.flags.neverDieUsed = true;
    applyCritTalentState(message, rootWith(buttons));
    expect(buttons.every(b => b.disabled)).toBe(true);
  });

  it("«Применить отложенные эффекты» нажата — напоминание гаснет у всех при показе", () => {
    const deferred = [btn("wh-final-push-apply-btn"), btn("wh-crit-apply-btn", {}), btn("wh-crit-death-btn", {})];
    const root = { querySelectorAll: sel => (sel === ".dmg-critical-block" ? []
      : deferred.filter(b => sel.split(",").some(s => {
          const cls = s.trim().split(" ").pop().replace(/^./, "");
          return b.classes.has(cls);
        }))) };
    const message = fakeMessage();
    message.flags.finalPushApplied = true;
    applyCritTalentState(message, root);
    expect(deferred[0].disabled).toBe(true);
    expect(deferred[1].disabled).toBe(true);
    expect(deferred[2].disabled).toBe(false);          // смерть остаётся осознанной отдельной кнопкой
  });

  it("Рывок удался — эффекты погашены; Боль заменила эффект — тоже", () => {
    for (const key of ["finalPushUsed", "painIllusionUsed"]) {
      const buttons = [btn("wh-crit-apply-btn", {}), btn("wh-shock-death-btn", {})];
      const message = fakeMessage();
      message.flags[key] = true;
      applyCritTalentState(message, rootWith(buttons));
      expect(buttons.every(b => b.disabled), key).toBe(true);
    }
  });

  it("без флагов карточка не тронута", () => {
    const buttons = [btn("wh-crit-apply-btn", {})];
    applyCritTalentState(fakeMessage(), rootWith(buttons));
    expect(buttons[0].disabled).toBe(false);
  });

  it("collectCritEffects пропускает погашенные, dimCritEffects считает живые", () => {
    const block = fakeBlock([btn("wh-crit-apply-btn", {}), btn("wh-crit-apply-btn", {}, { disabled: true })]);
    expect(collectCritEffects(block)).toHaveLength(1);
    expect(dimCritEffects(block, "причина")).toBe(1);
  });
});

// ── Крепкий Орешек: Кровотечение ────────────────────────────────────────────

describe("Крепкий Орешек: кубик Кровотечения бросается дважды, берётся лучший (больший)", () => {
  function bleeder(talents) {
    const a = hero({ talents });
    a.system.conditions = { bleeding: true, haemorrhagingLevel: 0 };
    return a;
  }

  it("носитель: 1 и 8 → берётся 8 — «обошлось»", async () => {
    const a = bleeder([DH]);
    captured.dice = [1, 8];
    await processConditionTurnEnd(a);
    expect(captured.rolls.filter(f => f === "1d10")).toHaveLength(2);
    const card = chatText();
    expect(card).toContain("Крепкий Орешек");
    expect(card).toContain("берётся 8");
    expect(card).toContain("обошлось");
    expect(a._store["warhammer-dbc.deceased"]).toBeUndefined();
  });

  it("носитель: второй бросок хуже первого — остаётся первый", async () => {
    const a = bleeder([DH]);
    captured.dice = [9, 2];
    await processConditionTurnEnd(a);
    expect(chatText()).toContain("берётся 9");
    expect(chatText()).toContain("обошлось");
  });

  it("носитель: оба броска ≤ 5 — набирается Обескровливание", async () => {
    const a = bleeder([DH]);
    captured.dice = [2, 3];
    await processConditionTurnEnd(a);
    expect(chatText()).toContain("+1 Обескровливание");
  });

  it("страж: без Таланта бросок один, и плохой бросок убивает", async () => {
    const a = bleeder([]);
    captured.dice = [0];
    await processConditionTurnEnd(a);
    expect(captured.rolls.filter(f => f === "1d10")).toHaveLength(1);
    expect(a._store["warhammer-dbc.deceased"]).toBe(true);
  });
});
