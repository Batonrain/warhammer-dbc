// test/rules/sigillite-runes-combat.test.mjs
//
// Руны Сигиллитов — такты боя (wdbc-fsl9): начало боя ставит пул в бPR,
// начало своего Хода прибавляет бPR + ступени Археотеха, а «Вычислитель Рун»
// добавляет свой бонус ровно один раз за бой.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { processSigilliteRunesTurnStart, processSigilliteRunesCombatStart,
         RUNE_CALCULATOR_FLAG } from "../../module/rules/sigillite-runes-combat.mjs";
import { RUNE_MAGIC_FLAG } from "../../module/rules/sigillite-runes.mjs";

function capabilityItem(key) {
  return {
    id: `cap-${key}`, type: "trait", name: "Магия Сигиллитов",
    flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
      { id: "e", kind: "capability", capabilityKey: key, label: "" }
    ] }] } }
  };
}

/** Актор с подставными getFlag/setFlag — их читает троттлинг «раз за бой». */
function actorOf({ runeMagic = true, calculators = 0, psyRating = 3,
                   intBonus = 4, runes = 0 } = {}) {
  const items = [];
  if (runeMagic) items.push(capabilityItem(RUNE_MAGIC_FLAG));
  for (let i = 0; i < calculators; i++)
    items.push({ id: `calc${i}`, type: "talent", name: "Rune Calculator", system: {} });
  const flags = {};
  const updates = [];
  const actor = {
    name: "Сигиллит", type: "character", updates,
    system: {
      characteristics: { int: { total: 40, bonus: intBonus } },
      psyker: { rating: psyRating, currentRating: psyRating, class: "bound" },
      groupSkills: { forbiddenLore: [] },
      sigilliteRunes: { value: runes, max: 0 }
    },
    items: Object.assign(items.slice(), { contents: items }),
    getFlag: (_ns, path) => path.split(".").reduce((o, k) => o?.[k], flags),
    setFlag: async (_ns, path, value) => {
      const keys = path.split(".");
      let cur = flags;
      while (keys.length > 1) cur = (cur[keys.shift()] ??= {});
      cur[keys[0]] = value;
    },
    // Подставной документ ПРИМЕНЯЕТ запись, как настоящий: следующий такт
    // обязан видеть новое значение, иначе проверка «второй Ход того же боя»
    // была бы слепой (тот же приём, что у актора вкладки «Развитие»).
    update: async patch => {
      updates.push(patch);
      const v = patch["system.sigilliteRunes.value"];
      if (v !== undefined) actor.system.sigilliteRunes.value = v;
    }
  };
  return actor;
}

/** Бой-заглушка: троттлинг «раз за бой» сравнивает сохранённую метку с id. */
async function withCombat(id, fn) {
  const prev = game.combat;
  game.combat = { id, round: 1 };
  try { return await fn(); } finally { game.combat = prev; }
}

describe("Руны Сигиллитов — начало боя", () => {
  it("пул выставляется в бPR, а не прибавляется", async () => {
    const a = actorOf({ psyRating: 5, runes: 17 });
    await processSigilliteRunesCombatStart({ combatants: [{ actor: a }] });
    expect(a.updates).toEqual([{ "system.sigilliteRunes.value": 5 }]);
  });

  it("псайкера без Черты не трогает вовсе", async () => {
    const a = actorOf({ runeMagic: false, psyRating: 5, runes: 17 });
    await processSigilliteRunesCombatStart({ combatants: [{ actor: a }] });
    expect(a.updates).toEqual([]);
  });

  it("бой без бойцов ничего не роняет", async () => {
    await expect(processSigilliteRunesCombatStart({})).resolves.toBeUndefined();
  });
});

describe("Руны Сигиллитов — начало Хода", () => {
  beforeEach(() => { delete game.combat; });

  it("прибавляет бPR", async () => {
    const a = actorOf({ psyRating: 4, runes: 2 });
    const gain = await withCombat("c1", () => processSigilliteRunesTurnStart(a));
    expect(gain).toBe(4);
    expect(a.updates).toEqual([{ "system.sigilliteRunes.value": 6 }]);
  });

  it("«Вычислитель Рун» добавляет I.b — и ровно один раз за бой", async () => {
    const a = actorOf({ psyRating: 2, intBonus: 4, calculators: 1, runes: 0 });
    // Первый Ход: 2 (бPR) + 4 (Вычислитель).
    expect(await withCombat("c1", () => processSigilliteRunesTurnStart(a))).toBe(6);
    // Второй Ход того же боя: только бPR.
    expect(await withCombat("c1", () => processSigilliteRunesTurnStart(a))).toBe(2);
    // Новый бой — бонус снова доступен.
    expect(await withCombat("c2", () => processSigilliteRunesTurnStart(a))).toBe(6);
  });

  it("три взятия «Вычислителя» дают тройной I.b", async () => {
    const a = actorOf({ psyRating: 0, intBonus: 3, calculators: 3 });
    expect(await withCombat("c1", () => processSigilliteRunesTurnStart(a))).toBe(9);
  });

  it("без Черты не начисляет ничего", async () => {
    const a = actorOf({ runeMagic: false, psyRating: 5, calculators: 3 });
    expect(await withCombat("c1", () => processSigilliteRunesTurnStart(a))).toBe(0);
    expect(a.updates).toEqual([]);
  });

  it("нет актора — нет начисления", async () => {
    expect(await processSigilliteRunesTurnStart(null)).toBe(0);
  });

  it("метка «раз за бой» лежит там же, где у прочих возможностей", async () => {
    const a = actorOf({ calculators: 1 });
    await withCombat("c9", () => processSigilliteRunesTurnStart(a));
    expect(a.getFlag("warhammer-dbc", `usageLimits.${RUNE_CALCULATOR_FLAG.replace(/\./g, "-")}`))
      .toMatchObject({ scope: "battle", battle: "c9" });
  });
});
