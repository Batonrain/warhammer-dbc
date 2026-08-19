// test/apps/sus-an-heal.test.mjs
//
// Активное исцеление Сус-ан Мембраны у Призраков Смерти (module/apps/
// sus-an-heal.mjs): раз в сутки по Календарю (game.time.worldTime), не по
// раундам боя. Кулдаун — 86400 секунд от последнего использования.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import {
  isDeathSpectre, isSusAnMembraneItem, susAnHealCooldownRemaining, useSusAnHeal,
  susAnHealPending, resolvePendingSusAnHeals
} from "../../module/apps/sus-an-heal.mjs";

const FLAG = "warhammer-dbc";

function actorWith({ id = "actor-1", t = 50, woundsValue = 10, woundsMax = 20, legion = "XIX", chapter = "deathspectres", items = [] } = {}) {
  const actor = {
    id, name: "Тестовый Астартес",
    system: {
      geneSeed: { legion, chapter },
      characteristics: { t: { total: t } },
      wounds: { value: woundsValue, max: woundsMax }
    },
    items,
    update: async data => {
      captured.updates.push(data);
      if ("system.wounds.value" in data) actor.system.wounds.value = data["system.wounds.value"];
    }
  };
  return actor;
}

function itemWith(flags = {}) {
  const own = { ...flags };
  return {
    id: "item-1", name: "12. Сус-ан Мембрана / Sus-an Membrane", type: "implant",
    getFlag: (_s, k) => own[k],
    setFlag: async (_s, k, v) => { own[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete own[k]; }
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.time = { worldTime: 100000 };
  globalThis.game.combat = undefined;
  globalThis.game.user = { isGM: true };
});

describe("isDeathSpectre", () => {
  it("легион и орден совпали — да", () => {
    expect(isDeathSpectre(actorWith())).toBe(true);
  });
  it("другой орден того же легиона — нет", () => {
    expect(isDeathSpectre(actorWith({ chapter: "raptors" }))).toBe(false);
  });
  it("другой легион — нет", () => {
    expect(isDeathSpectre(actorWith({ legion: "VI", chapter: "" }))).toBe(false);
  });
  it("нет актора — нет", () => {
    expect(isDeathSpectre(null)).toBe(false);
  });
});

describe("isSusAnMembraneItem", () => {
  it("имя и тип совпали — да", () => {
    expect(isSusAnMembraneItem(itemWith())).toBe(true);
  });
  it("другой имплант — нет", () => {
    expect(isSusAnMembraneItem({ type: "implant", name: "2. Оссмодула / Ossmodula" })).toBe(false);
  });
});

describe("susAnHealCooldownRemaining", () => {
  it("флага нет — доступно сейчас", () => {
    expect(susAnHealCooldownRemaining(itemWith())).toBe(0);
  });
  it("использовано только что — сутки в запасе", () => {
    const item = itemWith({ susAnHealUsedAt: 100000 });
    expect(susAnHealCooldownRemaining(item)).toBe(86400);
  });
  it("использовано 20 часов назад — ещё не готово", () => {
    const item = itemWith({ susAnHealUsedAt: 100000 - 20 * 3600 });
    expect(susAnHealCooldownRemaining(item)).toBe(4 * 3600);
  });
  it("использовано больше суток назад — снова доступно", () => {
    const item = itemWith({ susAnHealUsedAt: 100000 - 90000 });
    expect(susAnHealCooldownRemaining(item)).toBe(0);
  });
});

describe("useSusAnHeal", () => {
  it("на перезарядке — предупреждает и не бросает кубы", async () => {
    const actor = actorWith();
    const item = itemWith({ susAnHealUsedAt: 100000 });
    await useSusAnHeal(actor, item);
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat).toEqual([]);
  });

  it("успех — лечит 2×СУ Ран, не выше максимума, и заводит перезарядку", async () => {
    captured.nextRoll = 20;                       // T 50, бросок 20 → СУ = floor((50-20)/10)+1 = 4
    const actor = actorWith({ t: 50, woundsValue: 10, woundsMax: 20 });
    const item = itemWith();
    await useSusAnHeal(actor, item);
    expect(actor.system.wounds.value).toBe(18);    // 10 + 2*4 = 18, не выше 20
    expect(item.getFlag(FLAG, "susAnHealUsedAt")).toBe(100000);
    expect(captured.chat.length).toBe(1);
  });

  it("успех у максимума Ран — не превышает максимум", async () => {
    captured.nextRoll = 1;                         // максимальный успех
    const actor = actorWith({ t: 50, woundsValue: 19, woundsMax: 20 });
    const item = itemWith();
    await useSusAnHeal(actor, item);
    expect(actor.system.wounds.value).toBe(20);
  });

  it("провал — Раны не лечит, но перезарядку всё равно заводит", async () => {
    captured.nextRoll = 99;                        // выше T 50 — провал
    const actor = actorWith({ t: 50, woundsValue: 10, woundsMax: 20 });
    const item = itemWith();
    await useSusAnHeal(actor, item);
    expect(actor.system.wounds.value).toBe(10);
    expect(item.getFlag(FLAG, "susAnHealUsedAt")).toBe(100000);
  });
});

// «В конце следующего Хода» — идёт бой, актор в нём комбатант: исцеление
// откладывается до конца Раунда N+1, а не применяется тем же кликом.
describe("useSusAnHeal — бой идёт (Раунд отслеживается)", () => {
  it("актор — комбатант: лечение откладывается, Раны не меняются сразу", async () => {
    captured.nextRoll = 20;                         // T 50 → СУ 4 → 8 Ран
    const actor = actorWith({ t: 50, woundsValue: 10, woundsMax: 20 });
    const item = itemWith();
    globalThis.game.combat = { round: 3, combatants: [{ actor }] };

    await useSusAnHeal(actor, item);

    expect(actor.system.wounds.value).toBe(10);      // не применилось сразу
    expect(susAnHealPending(item)).toEqual({ amount: 8, dueRound: 4 });
    expect(item.getFlag(FLAG, "susAnHealUsedAt")).toBe(100000); // суточный кулдаун — сразу
  });

  it("актор НЕ комбатант этого боя — лечение всё равно сразу", async () => {
    captured.nextRoll = 20;
    const actor = actorWith({ t: 50, woundsValue: 10, woundsMax: 20 });
    const item = itemWith();
    globalThis.game.combat = { round: 3, combatants: [{ actor: { id: "кто-то-другой" } }] };

    await useSusAnHeal(actor, item);

    expect(actor.system.wounds.value).toBe(18);
    expect(susAnHealPending(item)).toBeFalsy();
  });
});

describe("resolvePendingSusAnHeals", () => {
  function pendingSetup({ round = 3, dueRound = 4, amount = 8, woundsValue = 10, woundsMax = 20 } = {}) {
    const item = itemWith({ susAnHealUsedAt: 100000, susAnHealPending: { amount, dueRound } });
    const actor = actorWith({ woundsValue, woundsMax, items: [item] });
    const combat = { round, combatants: [{ actor }] };
    return { actor, item, combat };
  }

  it("Раунд ещё не прошёл — не трогает", async () => {
    const { actor, item, combat } = pendingSetup({ round: 4, dueRound: 4 });
    await resolvePendingSusAnHeals(combat);
    expect(actor.system.wounds.value).toBe(10);
    expect(susAnHealPending(item)).toBeTruthy();
  });

  it("Раунд перевалил за dueRound — применяет и снимает флаг", async () => {
    const { actor, item, combat } = pendingSetup({ round: 5, dueRound: 4, amount: 8, woundsValue: 10 });
    await resolvePendingSusAnHeals(combat);
    expect(actor.system.wounds.value).toBe(18);
    expect(susAnHealPending(item)).toBeFalsy();
    expect(captured.chat.length).toBe(1);
  });

  it("не выше максимума Ран", async () => {
    const { actor, item, combat } = pendingSetup({ round: 5, dueRound: 4, amount: 8, woundsValue: 19, woundsMax: 20 });
    await resolvePendingSusAnHeals(combat);
    expect(actor.system.wounds.value).toBe(20);
  });

  it("force — применяет немедленно, не дожидаясь Раунда (бой кончился раньше)", async () => {
    const { actor, item, combat } = pendingSetup({ round: 3, dueRound: 4, amount: 8, woundsValue: 10 });
    await resolvePendingSusAnHeals(combat, { force: true });
    expect(actor.system.wounds.value).toBe(18);
    expect(susAnHealPending(item)).toBeFalsy();
  });

  it("не-ГМ ничего не трогает — правки идут от ГМа, как сброс счётчика Орды", async () => {
    globalThis.game.user = { isGM: false };
    const { actor, combat } = pendingSetup({ round: 5, dueRound: 4 });
    await resolvePendingSusAnHeals(combat);
    expect(actor.system.wounds.value).toBe(10);
  });
});
