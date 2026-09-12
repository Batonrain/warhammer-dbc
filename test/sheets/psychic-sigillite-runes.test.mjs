// test/sheets/psychic-sigillite-runes.test.mjs
//
// Руны Сигиллитов в конвейере манифестации (wdbc-fsl9).
//
// Половина проверок здесь — про ГРАНИЦУ, а не про Сигиллита: окно
// манифестации и психотест общие для ВСЕХ псайкеров системы, и правка обязана
// быть невидимой всем, у кого нет Черты «Магия Сигиллитов». Поэтому каждый
// сценарий Сигиллита имеет пару-близнеца на обычном псайкере.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { executePsychotest, showManifestDialog, learnSigilliteRune } from "../../module/sheets/tabs/psychic.mjs";
import { RUNE_MAGIC_FLAG, IMPROVISED_RUNE_FLAG, PROMETHEUS_FIRE_FLAG,
         RUNE_LEARN_COST, RUNE_LEARN_FORBIDDEN_EXTRA,
         PREPARED_RUNE_FLAG } from "../../module/rules/sigillite-runes.mjs";
import { characterContext } from "../../module/sheets/character-context.mjs";
import { sheetOf } from "../support/foundry-stub.mjs";
import { WarhammerCharacterSheet } from "../../module/sheets/actor-sheet.mjs";
import { buildGetData } from "../../module/sheets/sheet-helpers.mjs";

// wdbc-exjp: discipline/runeLearned — состояние Руны этой конкретной силы.
// `update` не только копится в `it.updates` (как раньше), но и мутирует
// `it.system` — иначе gate-проверки после learnSigilliteRune()/executePsychotest()
// продолжали бы видеть старое значение runeLearned в этом же тесте.
function power({ prRequired = 2, name = "Взор Варпа", discipline = "", runeLearned = false } = {}) {
  const it = {
    id: "power-1", name, type: "psychicPower",
    system: { testChar: "wp", powerType: "utility", prRequired, discipline, runeLearned },
    updates: [],
    update: async d => {
      it.updates.push(d);
      for (const [path, value] of Object.entries(d)) {
        const key = path.replace(/^system\./, "");
        it.system[key] = value;
      }
      return d;
    }
  };
  return it;
}

function capabilityItem(key) {
  return {
    id: `cap-${key}`, type: "trait", name: "Магия Сигиллитов",
    // system.benefit — buildGetData (sheet-helpers.mjs) группирует ВСЕ Черты
    // листа для панели «Черты» и читает .system.benefit у каждой; без него
    // подставная Черта-носитель возможности роняла бы buildGetData(), хотя
    // сама подсистема Рун этого поля не касается.
    system: { benefit: "" },
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  };
}

function actor({ sigillite = false, strikeTalent = false, runes = 20,
                  improvisedTalent = false, prometheusTalent = false,
                  psyRating = 3, experienceCurrent = 200 } = {}) {
  const list = [];
  if (sigillite) list.push(capabilityItem(RUNE_MAGIC_FLAG));
  if (strikeTalent) list.push({ id: "t-strike", type: "talent", name: "Rune Strike", system: {} });
  if (improvisedTalent) list.push(capabilityItem(IMPROVISED_RUNE_FLAG));
  if (prometheusTalent) list.push(capabilityItem(PROMETHEUS_FIRE_FLAG));
  list.get = id => list.find(i => i.id === id) ?? null;
  list.contents = list;
  const a = {
    id: "actor-1", name: "Псайкер", items: list, updates: [],
    getFlag: () => undefined, setFlag: async () => {},
    system: {
      race: "human",
      fatigue: { value: 0 },
      psyker: { rating: psyRating, currentRating: psyRating, sustain: 0, class: "bound" },
      skills: { psyniscience: { total: 52 } },
      groupSkills: { forbiddenLore: [] },
      corruption: { value: 12 }, corruptionBonus: 1,
      wounds: { value: 8, max: 10, critical: 0 },
      charDamage: { s: 0, ag: 0, wp: 0 },
      sigilliteRunes: { value: runes, max: 20 },
      experience: { current: experienceCurrent, log: [] },
      characteristics: {
        wp:  { total: 40, value: 40, bonus: 4 },
        int: { total: 40, value: 40, bonus: 4 },
        per: { total: 35, value: 35, bonus: 3 },
        t:   { total: 42, value: 42, bonus: 4 },
        s:   { total: 30, value: 30, bonus: 3 }
      }
    },
    update: async data => {
      a.updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let t = a;
        for (const p of parts.slice(0, -1)) { t[p] ??= {}; t = t[p]; }
        t[parts.at(-1)] = value;
      }
      return data;
    },
    updateEmbeddedDocuments: async () => []
  };
  return a;
}

const base = { mPR: 2, prMod: 0, mode: "normal", modifier: 0, eldar: false,
               pushChoice: 1, damagePR: 0, rangePR: 0, profileIdx: -1, variantIdx: -1 };

beforeEach(resetCaptured);

describe("Шапка листа", () => {
  const ctxOf = items => {
    const sheet = sheetOf(WarhammerCharacterSheet, {
      items, characteristics: {}, skills: {}, groupSkills: {},
      sigilliteRunes: { value: 5, max: 20 }
    });
    sheet.actor.items.contents = sheet.actor.items;
    return characterContext(sheet.actor);
  };

  it("ячейка Рун предлагается только носителю Черты", () => {
    expect(ctxOf([]).hasSigilliteRunes).toBe(false);
    expect(ctxOf([capabilityItem(RUNE_MAGIC_FLAG)]).hasSigilliteRunes).toBe(true);
  });
});

describe("Окно манифестации — граница подсистемы", () => {
  it("у обычного псайкера Пути «Руны Сигиллитов» в списке нет вовсе", () => {
    showManifestDialog(actor(), power());
    expect(captured.dialog.content).not.toContain("Руны Сигиллитов");
    expect(captured.dialog.content).not.toContain("Рунный Удар");
    expect(captured.dialog.content).not.toContain('id="pm-rune-cost"');
  });

  it("у Сигиллита Путь в списке есть, а цена посчитана заранее", () => {
    showManifestDialog(actor({ sigillite: true, runes: 12 }), power({ prRequired: 3 }));
    expect(captured.dialog.content).toContain("Руны Сигиллитов");
    // бPR психосилы 3 × 2 = 6, при 12 имеющихся из 20.
    expect(captured.dialog.content).toContain('<b id="pm-rune-cost">6</b>');
    expect(captured.dialog.content).toContain("есть <b>12</b> из <b>20</b>");
  });

  it("нехватка Рун видна ещё до броска", () => {
    showManifestDialog(actor({ sigillite: true, runes: 3 }), power({ prRequired: 3 }));
    expect(captured.dialog.content).toContain("Рун не хватает: нужно 6, есть 3");
  });

  it("выбор «Рунного Удара» появляется только с Талантом", () => {
    showManifestDialog(actor({ sigillite: true }), power());
    expect(captured.dialog.content).not.toContain("+1 эPR (4 Рун)");
    showManifestDialog(actor({ sigillite: true, strikeTalent: true }), power());
    expect(captured.dialog.content).toContain("+1 эPR (4 Рун)");
  });
});

describe("Психотест — цена и Рунный Удар", () => {
  it("обычный псайкер строки про Руны в карточке не получает", async () => {
    const a = actor();
    captured.nextRoll = 30;
    await executePsychotest(a, power(), { ...base, path: "" });
    expect(captured.chat[0].content).not.toContain("Руны:");
    expect(a.updates).toEqual([]);
  });

  it("Сигиллит платит бPR психосилы × 2 и видит остаток", async () => {
    const a = actor({ sigillite: true, runes: 20 });
    captured.nextRoll = 30;
    await executePsychotest(a, power({ prRequired: 3 }), { ...base, path: "sigillite" });
    expect(a.updates).toContainEqual({ "system.sigilliteRunes.value": 14 });
    expect(captured.chat[0].content).toContain("Руны: −<b>6</b>");
    expect(captured.chat[0].content).toContain("осталось <b>14</b> из 20");
  });

  it("Сигиллит на другом Пути Рунами не платит", async () => {
    const a = actor({ sigillite: true, runes: 20 });
    captured.nextRoll = 30;
    await executePsychotest(a, power({ prRequired: 3 }), { ...base, path: "meditation" });
    expect(a.updates).toEqual([]);
    expect(captured.chat[0].content).not.toContain("Руны:");
  });

  it("«Рунный Удар» поднимает эPR и цену на четыре Руны за шаг", async () => {
    const a = actor({ sigillite: true, strikeTalent: true, runes: 20 });
    captured.nextRoll = 5;   // успех при любом пороге
    await executePsychotest(a, power({ prRequired: 1 }), { ...base, path: "sigillite", runeStrike: 2 });
    // база 2 + 2×4 = 10 Рун; эPR 2 (mPR) + 2 = 4.
    expect(a.updates).toContainEqual({ "system.sigilliteRunes.value": 10 });
    expect(captured.chat[0].content).toContain("эPR <b>4</b>");
    expect(captured.chat[0].content).toContain("из них 8 на Рунный Удар +2 эPR");
  });

  // Нашлось этим тестом: зажим Рунного Удара стоял только в разметке окна, и
  // прямой вызов (HUD/макрос/старая точка входа) выдавал +эPR без Таланта.
  it("«Рунный Удар» без Таланта эPR не поднимает и Рун не тратит сверх цены", async () => {
    const a = actor({ sigillite: true, runes: 20 });
    captured.nextRoll = 5;
    await executePsychotest(a, power({ prRequired: 1 }), { ...base, path: "sigillite", runeStrike: 2 });
    expect(a.updates).toContainEqual({ "system.sigilliteRunes.value": 18 });
    expect(captured.chat[0].content).toContain("эPR <b>2</b>");
  });

  it("Рунный Удар не уходит дальше остатка Рун", async () => {
    // 7 Рун, сила бPR 1 → база 2, остаток 5 → влезает ровно один шаг из трёх.
    const a = actor({ sigillite: true, strikeTalent: true, runes: 7 });
    captured.nextRoll = 5;
    await executePsychotest(a, power({ prRequired: 1 }), { ...base, path: "sigillite", runeStrike: 3 });
    expect(a.updates).toContainEqual({ "system.sigilliteRunes.value": 1 });
    expect(captured.chat[0].content).toContain("эPR <b>3</b>");
  });

  it("провал с «Рунным Ударом» возвращает I.b Рун, но не больше вложенного", async () => {
    const a = actor({ sigillite: true, strikeTalent: true, runes: 20 });
    captured.nextRoll = 98;  // провал (не 99 — иначе сработал бы Феномен)
    await executePsychotest(a, power({ prRequired: 1 }), { ...base, path: "sigillite", runeStrike: 1 });
    // цена 2 + 4 = 6, возврат min(I.b 4, вложенные 4) = 4 → списано 2.
    expect(a.updates).toContainEqual({ "system.sigilliteRunes.value": 18 });
    expect(captured.chat[0].content).toContain("возврат за провал +<b>4</b>");
  });
});

describe("Психотест — режим и Феномены Пути", () => {
  it("Усиленный режим на Пути Рун заменяется Обычным", async () => {
    const a = actor({ sigillite: true });
    captured.nextRoll = 30;
    await executePsychotest(a, power(), { ...base, mode: "push", path: "sigillite" });
    expect(captured.chat[0].content).toContain("Усиленный режим недоступен");
  });

  it("Феномен на Пути Рун — только на 99", async () => {
    const a1 = actor({ sigillite: true });
    captured.nextRoll = 99;
    await executePsychotest(a1, power(), { ...base, path: "sigillite" });
    expect(captured.chat[0].content).toContain("Психический Феномен");

    resetCaptured();
    const a2 = actor({ sigillite: true });
    captured.nextRoll = 88;  // дубль: у обычного Пути дал бы Феномен
    await executePsychotest(a2, power(), { ...base, path: "sigillite" });
    expect(captured.chat[0].content).toContain("Феномен не вызван");
  });

  it("у обычного псайкера дубль на успехе по-прежнему даёт Феномен", async () => {
    const a = actor();
    captured.nextRoll = 44;   // Порог 50: успех, и дубль — книжное условие
    await executePsychotest(a, power(), { ...base, path: "" });
    expect(captured.chat[0].content).toContain("Психический Феномен");
  });

  it("у Сигиллита тот же дубль на успехе Феномена НЕ даёт — только 99", async () => {
    const a = actor({ sigillite: true });
    captured.nextRoll = 44;
    await executePsychotest(a, power(), { ...base, path: "sigillite" });
    expect(captured.chat[0].content).toContain("Феномен не вызван");
  });
});

// ── wdbc-qd6w: сочетание Инкантации/Медитации/Нечестивых Символов ────────────
// Книга (стр. 101-102): «Этот путь может использовать механику ВСЕХ следующих
// путей ОДНОВРЕМЕННО (необязательно все сразу, псайкер может определять
// желаемые)». Числа читаются из тех же записей PSY_PATHS (incantation +1эPR/
// +20Феномен, meditation +3эPR, unholy −20Феномен) — здесь проверяется только
// СЛОЖЕНИЕ через executePsychotest, сама арифметика уже покрыта
// test/constants/psyker-sigillite-subpaths.test.mjs.
describe("Психотест — сочетание суб-механик Пути «Руны Сигиллитов» (wdbc-qd6w)", () => {
  it("ни одна суб-механика не отмечена — эPR как обычно, только базовый Best.Q Психофокус", async () => {
    const a = actor({ sigillite: true, runes: 20 });
    captured.nextRoll = 30;
    await executePsychotest(a, power({ prRequired: 1 }), { ...base, path: "sigillite" });
    expect(captured.chat[0].content).toContain("эPR <b>2</b>");
    expect(captured.chat[0].content).not.toContain("(Путь +");
  });

  it("одна суб-механика — Инкантация: +1 эPR", async () => {
    const a = actor({ sigillite: true, runes: 20 });
    captured.nextRoll = 30;
    await executePsychotest(a, power({ prRequired: 1 }),
      { ...base, path: "sigillite", sigilliteSubs: ["incantation"] });
    expect(captured.chat[0].content).toContain("эPR <b>3</b>");
    expect(captured.chat[0].content).toContain("(Путь +1)");
    expect(captured.chat[0].content).toContain("Руны Сигиллитов: сложены — Инкантация");
    expect(captured.chat[0].content).toContain("действие манифестации на ступень выше");
  });

  it("одна суб-механика — Медитация: +3 эPR", async () => {
    const a = actor({ sigillite: true, runes: 20 });
    captured.nextRoll = 30;
    await executePsychotest(a, power({ prRequired: 1 }),
      { ...base, path: "sigillite", sigilliteSubs: ["meditation"] });
    expect(captured.chat[0].content).toContain("эPR <b>5</b>");
    expect(captured.chat[0].content).toContain("(Путь +3)");
  });

  it("две суб-механики — Инкантация + Медитация: эPR +1+3=+4", async () => {
    const a = actor({ sigillite: true, runes: 20 });
    captured.nextRoll = 30;
    await executePsychotest(a, power({ prRequired: 1 }),
      { ...base, path: "sigillite", sigilliteSubs: ["incantation", "meditation"] });
    expect(captured.chat[0].content).toContain("эPR <b>6</b>");
    expect(captured.chat[0].content).toContain("(Путь +4)");
    expect(captured.chat[0].content).toContain("Инкантация, Медитация");
  });

  it("все три сразу — эPR как у двух (Нечестивые Символы эPR не трогают)", async () => {
    const a = actor({ sigillite: true, runes: 20 });
    captured.nextRoll = 30;
    await executePsychotest(a, power({ prRequired: 1 }),
      { ...base, path: "sigillite", sigilliteSubs: ["incantation", "meditation", "unholy"] });
    expect(captured.chat[0].content).toContain("эPR <b>6</b>");
    expect(captured.chat[0].content).toContain("(Путь +4)");
    expect(captured.chat[0].content).toContain("Инкантация, Медитация, Нечестивые Символы");
  });

  it("Инкантация + Нечестивые Символы одновременно — Феномен +20−20=0, суффикс мода пропадает", async () => {
    const a = actor({ sigillite: true, runes: 20 });
    captured.nextRoll = 99;   // единственное значение, вызывающее Феномен на Пути Рун
    await executePsychotest(a, power({ prRequired: 1 }),
      { ...base, path: "sigillite", sigilliteSubs: ["incantation", "unholy"] });
    expect(captured.chat[0].content).toContain("Психический Феномен");
    expect(captured.chat[0].content).not.toContain(", мод");
  });

  it("только Инкантация — Феномен с модификатором +20 виден в карточке", async () => {
    const a = actor({ sigillite: true, runes: 20 });
    captured.nextRoll = 99;
    await executePsychotest(a, power({ prRequired: 1 }),
      { ...base, path: "sigillite", sigilliteSubs: ["incantation"] });
    expect(captured.chat[0].content).toContain("мод +20");
  });

  it("только Нечестивые Символы — Феномен с модификатором −20 виден в карточке", async () => {
    const a = actor({ sigillite: true, runes: 20 });
    captured.nextRoll = 99;
    await executePsychotest(a, power({ prRequired: 1 }),
      { ...base, path: "sigillite", sigilliteSubs: ["unholy"] });
    expect(captured.chat[0].content).toContain("мод -20");
  });

  it("суб-механики отмечены, но выбран другой Путь — не учитываются вовсе", async () => {
    const a = actor({ sigillite: true, runes: 20 });
    captured.nextRoll = 30;
    await executePsychotest(a, power({ prRequired: 1 }),
      { ...base, path: "meditation", sigilliteSubs: ["incantation", "unholy"] });
    // Путь «Медитация» сам по себе даёт +3 эPR (запись PSY_PATHS.meditation) —
    // подсунутые sigilliteSubs игнорируются, а не складываются поверх.
    expect(captured.chat[0].content).toContain("эPR <b>5</b>");
    expect(captured.chat[0].content).not.toContain("Руны Сигиллитов: сложены");
  });

  it("обычный псайкер без Черты — поле sigilliteSubs ни на что не влияет (нет Пути в принципе)", async () => {
    const a = actor();
    captured.nextRoll = 30;
    await executePsychotest(a, power({ prRequired: 1 }),
      { ...base, path: "", sigilliteSubs: ["incantation", "meditation", "unholy"] });
    expect(captured.chat[0].content).toContain("эPR <b>2</b>");
    expect(captured.chat[0].content).not.toContain("Руны Сигиллитов: сложены");
  });

  it("окно манифестации: флажки суб-механик присутствуют в разметке только у Сигиллита", () => {
    showManifestDialog(actor({ sigillite: true }), power());
    expect(captured.dialog.content).toContain('id="psy-sub-incantation"');
    expect(captured.dialog.content).toContain('id="psy-sub-meditation"');
    expect(captured.dialog.content).toContain('id="psy-sub-unholy"');

    showManifestDialog(actor(), power());
    expect(captured.dialog.content).not.toContain('id="psy-sub-incantation"');
  });
});

// ── wdbc-exjp: список изученных Рун + Improvised Rune / Prometheus Fire ──────
// Поля окна манифестации для «нажатия» кнопки «Психотест!» через fakeHtml.
const castFields = (over = {}) => ({
  "#psy-pr": "1", "#psy-pr-mod": "0", "#psy-mode": "normal", "#psy-path": "sigillite",
  "#psy-mod": "0", "#psy-push-bonus": "1", "#psy-pr-dmg": "0", "#psy-pr-range": "0",
  "#psy-profile": "-1", "#psy-variant": "-1", "#psy-rune-strike": "0", ...over
});

describe("Окно манифестации — Руна не изучена (wdbc-exjp)", () => {
  it("без Таланта: предупреждение говорит, что манифестировать нельзя", () => {
    showManifestDialog(actor({ sigillite: true }), power({ runeLearned: false }));
    expect(captured.dialog.content).toContain("не изучена");
    expect(captured.dialog.content).toContain("манифестировать нельзя");
  });

  it("с Improvised Rune: предупреждение говорит про цену, а не про запрет", () => {
    showManifestDialog(actor({ sigillite: true, improvisedTalent: true }), power({ runeLearned: false }));
    expect(captured.dialog.content).toContain("Импровизированной Руной");
    expect(captured.dialog.content).not.toContain("манифестировать нельзя");
  });

  it("изученная Руна — предупреждения нет вовсе", () => {
    showManifestDialog(actor({ sigillite: true }), power({ runeLearned: true }));
    expect(captured.dialog.content).not.toContain("не изучена");
  });

  it("у обычного псайкера (нет Черты) предупреждения нет — блок целиком под гейтом подсистемы", () => {
    showManifestDialog(actor(), power({ runeLearned: false }));
    expect(captured.dialog.content).not.toContain("не изучена");
  });
});

describe("Психотест — гейт «манифестировать можно только изученную Руну» (wdbc-exjp)", () => {
  it("без Таланта и без изученной Руны — блокируется ДО броска", async () => {
    const a = actor({ sigillite: true, runes: 20 });
    showManifestDialog(a, power({ prRequired: 1, runeLearned: false }));
    await captured.dialog.buttons.cast.callback(fakeHtml(castFields()));
    expect(captured.warnings.some(w => w.includes("не изучена"))).toBe(true);
    expect(captured.chat.length).toBe(0);
    expect(a.updates).toEqual([]);
  });

  it("Improvised Rune разрешает манифестацию и списывает цену тела", async () => {
    const a = actor({ sigillite: true, runes: 20, improvisedTalent: true });
    showManifestDialog(a, power({ prRequired: 1, runeLearned: false }));
    captured.nextRoll = 30;
    await captured.dialog.buttons.cast.callback(fakeHtml(castFields()));
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).toContain("Импровизированная Руна");
    // цена Пути (бPR 1 × 2 = 2 Руны) + цена Импровизации (1 Рана, −1 S/A/W).
    expect(a.system.sigilliteRunes.value).toBe(18);
    expect(a.system.wounds.value).toBe(7);
    expect(a.system.charDamage.s).toBe(-1);
    expect(a.system.charDamage.ag).toBe(-1);
    expect(a.system.charDamage.wp).toBe(-1);
  });

  it("изученная Руна манифестируется без Improvised Rune и без цены тела", async () => {
    const a = actor({ sigillite: true, runes: 20 });
    showManifestDialog(a, power({ prRequired: 1, runeLearned: true }));
    captured.nextRoll = 30;
    await captured.dialog.buttons.cast.callback(fakeHtml(castFields()));
    expect(captured.chat.length).toBe(1);
    expect(captured.chat[0].content).not.toContain("Импровизированная Руна");
    expect(a.system.wounds.value).toBe(8);   // не тронуты
    expect(a.system.charDamage.s).toBe(0);
  });

  it("Путь, отличный от «Руны Сигиллитов», гейт не трогает даже без изученной Руны", async () => {
    const a = actor({ sigillite: true, runes: 20 });
    showManifestDialog(a, power({ prRequired: 1, runeLearned: false }));
    captured.nextRoll = 30;
    await captured.dialog.buttons.cast.callback(fakeHtml(castFields({ "#psy-path": "meditation" })));
    expect(captured.chat.length).toBe(1);
    expect(captured.warnings).toEqual([]);
    expect(a.system.wounds.value).toBe(8);
  });
});

describe("Изучение Руны за опыт (wdbc-exjp, learnSigilliteRune)", () => {
  it("без Черты «Магия Сигиллитов» — ничего не происходит", async () => {
    const a = actor({ sigillite: false });
    await learnSigilliteRune(a, power({ runeLearned: false }));
    expect(a.updates).toEqual([]);
    expect(captured.chat).toEqual([]);
  });

  it("уже изученная Руна — ничего не происходит", async () => {
    const a = actor({ sigillite: true });
    const p = power({ runeLearned: true });
    await learnSigilliteRune(a, p);
    expect(p.updates).toEqual([]);
  });

  it("обычная дисциплина, бPR хватает — 50 опыта, отмечена изученной", async () => {
    const a = actor({ sigillite: true, psyRating: 3, experienceCurrent: 200 });
    const p = power({ prRequired: 2, discipline: "telekinesis", runeLearned: false });
    await learnSigilliteRune(a, p);
    expect(p.system.runeLearned).toBe(true);
    expect(p.system.runeLearnCost).toBe(RUNE_LEARN_COST);
    expect(a.system.experience.log).toContainEqual(
      expect.objectContaining({ amount: -RUNE_LEARN_COST }));
    expect(captured.chat[0].content).toContain(String(RUNE_LEARN_COST));
  });

  it("Божественная дисциплина без Prometheus Fire — жёсткий запрет, опыт не тратится", async () => {
    const a = actor({ sigillite: true });
    const p = power({ discipline: "tzeentch", runeLearned: false });
    await learnSigilliteRune(a, p);
    expect(p.system.runeLearned).toBe(false);
    expect(p.updates).toEqual([]);
    expect(captured.warnings.some(w => w.includes("Прометеев Огонь"))).toBe(true);
  });

  it("Божественная дисциплина с Prometheus Fire — разрешено, 100 опыта", async () => {
    const a = actor({ sigillite: true, prometheusTalent: true, psyRating: 3 });
    const p = power({ prRequired: 2, discipline: "librarium", runeLearned: false });
    await learnSigilliteRune(a, p);
    expect(p.system.runeLearned).toBe(true);
    expect(p.system.runeLearnCost).toBe(RUNE_LEARN_COST + RUNE_LEARN_FORBIDDEN_EXTRA);
  });

  it("бPR ниже требования психосилы — спрашивает подтверждение, отказ прерывает покупку", async () => {
    const a = actor({ sigillite: true, psyRating: 1 });
    const p = power({ prRequired: 5, runeLearned: false });
    captured.confirmAnswer = false;
    await learnSigilliteRune(a, p);
    expect(captured.dialog.title).toContain("не хватает бPR");
    expect(p.system.runeLearned).toBe(false);
  });

  it("бPR ниже требования, подтверждено — покупка проходит", async () => {
    const a = actor({ sigillite: true, psyRating: 1 });
    const p = power({ prRequired: 5, runeLearned: false });
    captured.confirmAnswer = true;
    await learnSigilliteRune(a, p);
    expect(p.system.runeLearned).toBe(true);
  });

  it("не хватает опыта — спрашивает подтверждение, отказ прерывает покупку", async () => {
    const a = actor({ sigillite: true, psyRating: 3, experienceCurrent: 10 });
    const p = power({ prRequired: 2, runeLearned: false });
    captured.confirmAnswer = false;
    await learnSigilliteRune(a, p);
    expect(captured.dialog.title).toContain("не хватает опыта");
    expect(p.system.runeLearned).toBe(false);
  });
});

describe("Таблица Психосил — колонка «Руна» (wdbc-exjp, buildGetData)", () => {
  const powerDoc = (over = {}) => ({
    id: "p1", name: "Разрушение", type: "psychicPower",
    system: { testChar: "wp", powerType: "attack", prRequired: 2, discipline: "", runeLearned: false, ...over },
    getFlag: () => undefined
  });

  it("у обычного псайкера колонки не видно вовсе (нет флага показа)", () => {
    const sheet = sheetOf(WarhammerCharacterSheet, {
      items: [powerDoc()], characteristics: {}, skills: {}, groupSkills: {},
      psyker: { rating: 3, currentRating: 3 }
    });
    sheet.actor.items.contents = sheet.actor.items;
    const row = buildGetData(sheet.actor).psyPowers.find(p => p.id === "p1");
    expect(row.runeLearned).toBe(false);
    expect(row.runeForbidden).toBe(false);
    expect(row.runeLearnCost).toBe(0);
  });

  it("Сигиллит, обычная дисциплина, Руна не изучена — цена 50 к показу", () => {
    const sheet = sheetOf(WarhammerCharacterSheet, {
      items: [powerDoc({ discipline: "telekinesis" }), capabilityItem(RUNE_MAGIC_FLAG)],
      characteristics: {}, skills: {}, groupSkills: {},
      psyker: { rating: 3, currentRating: 3 }
    });
    sheet.actor.items.contents = sheet.actor.items;
    const row = buildGetData(sheet.actor).psyPowers.find(p => p.id === "p1");
    expect(row.runeLearned).toBe(false);
    expect(row.runeForbidden).toBe(false);
    expect(row.runeLearnCost).toBe(RUNE_LEARN_COST);
  });

  it("Сигиллит, Руна уже изучена — кнопки нет (форбидден-флаг тоже опущен)", () => {
    const sheet = sheetOf(WarhammerCharacterSheet, {
      items: [powerDoc({ runeLearned: true }), capabilityItem(RUNE_MAGIC_FLAG)],
      characteristics: {}, skills: {}, groupSkills: {},
      psyker: { rating: 3, currentRating: 3 }
    });
    sheet.actor.items.contents = sheet.actor.items;
    const row = buildGetData(sheet.actor).psyPowers.find(p => p.id === "p1");
    expect(row.runeLearned).toBe(true);
    expect(row.runeLearnCost).toBe(0);
  });

  it("Сигиллит, Божественная дисциплина без Prometheus Fire — колонка отмечает запрет", () => {
    const sheet = sheetOf(WarhammerCharacterSheet, {
      items: [powerDoc({ discipline: "tzeentch" }), capabilityItem(RUNE_MAGIC_FLAG)],
      characteristics: {}, skills: {}, groupSkills: {},
      psyker: { rating: 3, currentRating: 3 }
    });
    sheet.actor.items.contents = sheet.actor.items;
    const row = buildGetData(sheet.actor).psyPowers.find(p => p.id === "p1");
    expect(row.runeForbidden).toBe(true);
  });
});

// ── wdbc-p2it: Заготовленная Руна — скидка I.b на первую манифестацию ───────
describe("Заготовленная Руна — скидка на первую манифестацию в бою (wdbc-p2it)", () => {
  /** Даёт актору Талант и подставные getFlag/setFlag под флаг "preparedRune". */
  function withPrepared(a, initial = null) {
    let store = initial;
    a.items.push(capabilityItem(PREPARED_RUNE_FLAG));
    a.getFlag = (_ns, key) => (key === "preparedRune" ? store : undefined);
    a.setFlag = async (_ns, key, value) => { if (key === "preparedRune") store = value; };
    return a;
  }

  it("окно манифестации показывает уже сниженную цену и заметку о скидке", () => {
    const a = withPrepared(actor({ sigillite: true, runes: 20 }), { itemId: "power-1", used: false });
    showManifestDialog(a, power({ prRequired: 3 }));
    // бPR 3 × 2 = 6, минус I.b 4 = 2.
    expect(captured.dialog.content).toContain('<b id="pm-rune-cost">2</b>');
    expect(captured.dialog.content).toContain("Заготовленная Руна");
  });

  it("первая манифестация выбранной Руны — цена ниже на I.b, отмечено в карточке", async () => {
    const a = withPrepared(actor({ sigillite: true, runes: 20 }), { itemId: "power-1", used: false });
    captured.nextRoll = 30;
    await executePsychotest(a, power({ prRequired: 3 }), { ...base, path: "sigillite" });
    expect(a.updates).toContainEqual({ "system.sigilliteRunes.value": 18 });
    expect(captured.chat[0].content).toContain("Руны: −<b>2</b>");
    expect(captured.chat[0].content).toContain("Заготовленная Руна: −4");
  });

  it("вторая манифестация той же Руны в этом же бою — скидки уже нет", async () => {
    const a = withPrepared(actor({ sigillite: true, runes: 20 }), { itemId: "power-1", used: false });
    captured.nextRoll = 30;
    await executePsychotest(a, power({ prRequired: 3 }), { ...base, path: "sigillite" });
    resetCaptured();
    await executePsychotest(a, power({ prRequired: 3 }), { ...base, path: "sigillite" });
    expect(captured.chat[0].content).toContain("Руны: −<b>6</b>");
    expect(captured.chat[0].content).not.toContain("Заготовленная Руна");
  });

  it("выбрана ДРУГАЯ психосила — цена этой силы не падает", async () => {
    const a = withPrepared(actor({ sigillite: true, runes: 20 }), { itemId: "other-power", used: false });
    captured.nextRoll = 30;
    await executePsychotest(a, power({ prRequired: 3 }), { ...base, path: "sigillite" });
    expect(captured.chat[0].content).toContain("Руны: −<b>6</b>");
    expect(captured.chat[0].content).not.toContain("Заготовленная Руна");
  });

  it("Талант есть, но выбора на этот бой нет — цена обычная", async () => {
    const a = withPrepared(actor({ sigillite: true, runes: 20 }), null);
    captured.nextRoll = 30;
    await executePsychotest(a, power({ prRequired: 3 }), { ...base, path: "sigillite" });
    expect(captured.chat[0].content).toContain("Руны: −<b>6</b>");
  });

  it("без Таланта «Заготовленная Руна» — обычная цена, даже с флагом выбора", async () => {
    const a = actor({ sigillite: true, runes: 20 });
    a.getFlag = (_ns, key) => (key === "preparedRune" ? { itemId: "power-1", used: false } : undefined);
    captured.nextRoll = 30;
    await executePsychotest(a, power({ prRequired: 3 }), { ...base, path: "sigillite" });
    expect(captured.chat[0].content).toContain("Руны: −<b>6</b>");
  });
});
