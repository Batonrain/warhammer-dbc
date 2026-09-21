// test/apps/legacy-weapon-infamy-activate.test.mjs
//
// activateKillerLegacyFelling / activateExcessBoost (module/apps/legacy-
// weapon.mjs) — Убийца/fearsome 9-9 и Перебор/fearsome 8-8, доп. предложение
// (wdbc-1rno.35, стр. 427): «...может потратить Очко Бесчестия, чтобы...» —
// системный пробел, отмеченный по ходу разбора всего тикета (кнопки такого
// рода у Мутаций Оружия Наследия не было вовсе).

import "../support/foundry-stub.mjs";
import { resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { activateKillerLegacyFelling, activateExcessBoost } from "../../module/apps/legacy-weapon.mjs";

// Заглушка foundry.utils.getProperty в стенде всегда отдаёт undefined —
// spendFromInfamyPool (module/apps/infamy-points.mjs) читает через неё
// текущий пул, здесь нужна настоящая реализация по пути через точку (тот же
// приём, что test/apps/infamy-points-gods.test.mjs).
foundry.utils.getProperty = (object, key) =>
  String(key).split(".").reduce((o, k) => o?.[k], object);

beforeEach(() => resetCaptured());

/** Владелец: пул Бесчестия (system.fate.value) + Inf.b, флаги на акторе. */
function actor({ fate = 1, infBonus = 5 } = {}) {
  const flags = {};
  return {
    id: "a1", name: "Чемпион",
    system: { fate: { value: fate }, characteristics: { inf: { bonus: infBonus, total: infBonus * 10 } } },
    updates: [],
    async update(data) {
      this.updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".");
        let node = this;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async setFlag(scope, key, value) { flags[`${scope}.${key}`] = value; }
  };
}

/** Оружие Наследия: свойства + флаги (Убийца хранит ревёрт-флаг на предмете). */
function weapon(props = []) {
  const flags = {};
  return {
    id: "w1", name: "Клинок Изгоя", type: "weapon",
    system: { weaponClass: "melee", weaponProps: props, legacy: { active: true, mutations: [{ name: "Убийца" }] } },
    actor: null,
    async update(data) {
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".");
        let node = this;
        for (const k of keys.slice(0, -1)) node = (node[k] ??= {});
        node[keys.at(-1)] = value;
      }
    },
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async setFlag(scope, key, value) { flags[`${scope}.${key}`] = value; }
  };
}

describe("activateKillerLegacyFelling", () => {
  it("есть Очко Бесчестия, нет Felling — списывает 1, грантует Felling(Inf.b), ставит ревёрт-флаг", async () => {
    const a = actor({ fate: 2, infBonus: 5 });
    const w = weapon([]);
    w.actor = a;
    await activateKillerLegacyFelling(w);
    expect(a.system.fate.value).toBe(1);
    expect(w.system.weaponProps).toEqual([{ key: "felling", rating: 5 }]);
    expect(w.getFlag("warhammer-dbc", "legacyKillerFellingRevert")).toEqual({ originalRating: null });
  });

  it("уже есть Felling(3) — +1 к рейтингу, originalRating запоминает 3", async () => {
    const a = actor({ fate: 1, infBonus: 5 });
    const w = weapon([{ key: "felling", rating: 3 }]);
    w.actor = a;
    await activateKillerLegacyFelling(w);
    expect(w.system.weaponProps).toEqual([{ key: "felling", rating: 4 }]);
    expect(w.getFlag("warhammer-dbc", "legacyKillerFellingRevert")).toEqual({ originalRating: 3 });
  });

  it("нет Очков Бесчестия — не тратит, не меняет свойства", async () => {
    const a = actor({ fate: 0 });
    const w = weapon([]);
    w.actor = a;
    await activateKillerLegacyFelling(w);
    expect(w.system.weaponProps).toEqual([]);
    expect(w.getFlag("warhammer-dbc", "legacyKillerFellingRevert")).toBeUndefined();
  });

  it("уже активирован в этом бою — второй клик ничего не делает (нет двойного списания)", async () => {
    const a = actor({ fate: 2, infBonus: 5 });
    const w = weapon([]);
    w.actor = a;
    await activateKillerLegacyFelling(w);
    await activateKillerLegacyFelling(w);
    expect(a.system.fate.value).toBe(1); // списано ровно один раз
    expect(w.system.weaponProps).toEqual([{ key: "felling", rating: 5 }]);
  });

  it("нет владельца — ничего не делает", async () => {
    const w = weapon([]);
    await activateKillerLegacyFelling(w);
    expect(w.system.weaponProps).toEqual([]);
  });
});

describe("activateExcessBoost", () => {
  it("есть Очко Бесчестия — списывает 1, ставит буст на ½Inf.b(окр.▲) Ходов", async () => {
    const a = actor({ fate: 1, infBonus: 5 }); // ½×5 = 2.5 → 3
    const w = weapon([]);
    w.id = "w1";
    w.actor = a;
    await activateExcessBoost(w);
    expect(a.system.fate.value).toBe(0);
    expect(a.getFlag("warhammer-dbc", "legacyExcessBoost")).toEqual({ weaponId: "w1", turnsLeft: 3 });
  });

  it("нет Очков Бесчестия — не ставит буст", async () => {
    const a = actor({ fate: 0 });
    const w = weapon([]);
    w.actor = a;
    await activateExcessBoost(w);
    expect(a.getFlag("warhammer-dbc", "legacyExcessBoost")).toBeUndefined();
  });

  it("буст уже активен на этом оружии — второй клик не тратит повторно", async () => {
    const a = actor({ fate: 2, infBonus: 5 });
    const w = weapon([]);
    w.id = "w1";
    w.actor = a;
    await activateExcessBoost(w);
    await activateExcessBoost(w);
    expect(a.system.fate.value).toBe(1); // списано ровно один раз
  });
});
