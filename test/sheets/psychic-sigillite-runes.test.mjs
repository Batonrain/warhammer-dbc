// test/sheets/psychic-sigillite-runes.test.mjs
//
// Руны Сигиллитов в конвейере манифестации (wdbc-fsl9).
//
// Половина проверок здесь — про ГРАНИЦУ, а не про Сигиллита: окно
// манифестации и психотест общие для ВСЕХ псайкеров системы, и правка обязана
// быть невидимой всем, у кого нет Черты «Магия Сигиллитов». Поэтому каждый
// сценарий Сигиллита имеет пару-близнеца на обычном псайкере.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { executePsychotest, showManifestDialog } from "../../module/sheets/tabs/psychic.mjs";
import { RUNE_MAGIC_FLAG } from "../../module/rules/sigillite-runes.mjs";
import { characterContext } from "../../module/sheets/character-context.mjs";
import { sheetOf } from "../support/foundry-stub.mjs";
import { WarhammerCharacterSheet } from "../../module/sheets/actor-sheet.mjs";

function power({ prRequired = 2, name = "Взор Варпа" } = {}) {
  const it = {
    id: "power-1", name, type: "psychicPower",
    system: { testChar: "wp", powerType: "utility", prRequired },
    updates: [], update: async d => { it.updates.push(d); return d; }
  };
  return it;
}

function capabilityItem(key) {
  return {
    id: `cap-${key}`, type: "trait", name: "Магия Сигиллитов",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  };
}

function actor({ sigillite = false, strikeTalent = false, runes = 20 } = {}) {
  const list = [];
  if (sigillite) list.push(capabilityItem(RUNE_MAGIC_FLAG));
  if (strikeTalent) list.push({ id: "t-strike", type: "talent", name: "Rune Strike", system: {} });
  list.get = id => list.find(i => i.id === id) ?? null;
  list.contents = list;
  const a = {
    id: "actor-1", name: "Псайкер", items: list, updates: [],
    getFlag: () => undefined, setFlag: async () => {},
    system: {
      race: "human",
      fatigue: { value: 0 },
      psyker: { rating: 3, currentRating: 3, sustain: 0, class: "bound" },
      skills: { psyniscience: { total: 52 } },
      groupSkills: { forbiddenLore: [] },
      corruption: { value: 12 }, corruptionBonus: 1,
      wounds: { value: 8, max: 10, critical: 0 },
      sigilliteRunes: { value: runes, max: 20 },
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
