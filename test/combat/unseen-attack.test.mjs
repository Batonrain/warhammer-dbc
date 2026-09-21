// test/combat/unseen-attack.test.mjs
//
// wdbc-1rno.2: _performUnseenDetect — реальный тест Пси-чутья/
// Ноосканирования (штраф параметризован: 0 по умолчанию, Сокрытая Угроза
// передаёт −50), показ успеха/провала в карточке, возврат {success}.
// _performUnseenBypass — Sixth Sense/Music of Battle, трата 1 Очка
// Бесчестия вместо теста.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { _performUnseenDetect, _performUnseenBypass } from "../../module/combat/unseen-attack.mjs";

// spendFromInfamyPool читает текущий пул через foundry.utils.getProperty —
// стенд всегда отдаёт undefined, нужна настоящая реализация по точке-пути
// (тот же приём, что test/sheets/tabs/death.test.mjs).
foundry.utils.getProperty = (object, key) =>
  String(key).split(".").reduce((o, k) => o?.[k], object);

beforeEach(() => {
  resetCaptured();
});

const actor = (skills) => ({ name: "Наблюдатель", system: { skills } });

function fateActor({ fate = 1 } = {}) {
  const flags = {};
  const updates = [];
  return {
    id: "a1", name: "Защищающийся", type: "character",
    system: { fate: { value: fate } },
    updates,
    getFlag: (scope, key) => flags[`${scope}.${key}`],
    async setFlag(scope, key, value) { flags[`${scope}.${key}`] = value; },
    async unsetFlag(scope, key) { delete flags[`${scope}.${key}`]; },
    async update(data) {
      updates.push(data);
      if (data["system.fate.value"] !== undefined) this.system.fate.value = data["system.fate.value"];
    }
  };
}

describe("_performUnseenDetect", () => {
  it("без штрафа: Пси-чутьё 60, бросок 55 (<60) — успех", async () => {
    captured.nextRoll = 55;
    const { success } = await _performUnseenDetect(actor({ psyniscience: { total: 60 } }), "psyniscience");
    expect(success).toBe(true);
    const note = captured.chat.at(-1)?.content ?? "";
    expect(note).toContain("<label>Порог</label><b>60</b>");
    expect(note).toContain("Успех");
    expect(note).toContain("засечена");
  });

  it("без штрафа: бросок выше Порога — провал", async () => {
    captured.nextRoll = 65;
    const { success } = await _performUnseenDetect(actor({ psyniscience: { total: 60 } }), "psyniscience");
    expect(success).toBe(false);
    const note = captured.chat.at(-1)?.content ?? "";
    expect(note).toContain("Провал");
  });

  it("Сокрытая Угроза: penalty −50 — Психонаука 60, бросок 15 (< 60−50=10? нет) — провал", async () => {
    captured.nextRoll = 15;
    const { success } = await _performUnseenDetect(actor({ psyniscience: { total: 60 } }), "psyniscience", { penalty: -50 });
    expect(success).toBe(false);
    const note = captured.chat.at(-1)?.content ?? "";
    expect(note).toContain("<label>Порог</label><b>10</b>"); // 60 − 50
    expect(note).toContain("Сокрытая Угроза -50");
  });

  it("Сокрытая Угроза: penalty −50 — бросок = Порогу — успех", async () => {
    captured.nextRoll = 10;
    const { success } = await _performUnseenDetect(actor({ psyniscience: { total: 60 } }), "psyniscience", { penalty: -50 });
    expect(success).toBe(true);
  });

  it("Ноосканирование — другой Навык/Характеристика", async () => {
    captured.nextRoll = 5;
    const { success } = await _performUnseenDetect(actor({ techUse: { total: 40 } }), "techUse", { penalty: -50 });
    expect(success).toBe(false);
    const note = captured.chat.at(-1)?.content ?? "";
    expect(note).toContain("Ноосканирование");
    expect(note).toContain("<label>Порог</label><b>-10</b>"); // 40 − 50
  });

  it("нет такого Навыка у актора — total считается как -20, не бросает", async () => {
    captured.nextRoll = 1;
    await _performUnseenDetect(actor({}), "psyniscience");
    const note = captured.chat.at(-1)?.content ?? "";
    expect(note).toContain("<label>Порог</label><b>-20</b>");
  });

  it("неизвестный skillKey — тихо ничего не делает, карточка не постится", async () => {
    const { success } = await _performUnseenDetect(actor({ psyniscience: { total: 60 } }), "awareness");
    expect(success).toBe(false);
    expect(captured.chat.length).toBe(0);
  });
});

describe("_performUnseenBypass", () => {
  it("хватает 1 Очко — тратит, списывает пул, без persistent — карточка без упоминания Хода", async () => {
    const a = fateActor({ fate: 3 });
    const { spent, poolValue } = await _performUnseenBypass(a, { label: "Music of Battle/Музыка Битвы" });
    expect(spent).toBe(true);
    expect(poolValue).toBe(2);
    expect(a.system.fate.value).toBe(2);
    const note = captured.chat.at(-1)?.content ?? "";
    expect(note).toContain("Потрачено 1 Очко Бесчестия");
    expect(note).not.toContain("следующего Хода");
  });

  it("persistent=true (Sixth Sense) — карточка упоминает сохранение до следующего Хода, ставит флаг", async () => {
    const a = fateActor({ fate: 1 });
    const { spent } = await _performUnseenBypass(a, { persistent: true, label: "Sixth Sense/Шестое Чувство" });
    expect(spent).toBe(true);
    expect(a.getFlag("warhammer-dbc", "unseenDetectedUntilNextTurn")).toBe(true);
    const note = captured.chat.at(-1)?.content ?? "";
    expect(note).toContain("следующего Хода");
  });

  // У Демон-Принца пул Очков Бесчестия живёт в system.dp.ip (apps/
  // infamy-points.mjs::actorInfamyPath) — гейт «хватает ли» читал именно его,
  // а списание било в system.fate.value, которого лист Демон-Принца не
  // показывает: обход Незримого выходил бесплатным (приёмка стопки
  // #482-#504).
  it("Демон-Принц: списывается его собственный пул system.dp.ip, а не Судьба", async () => {
    const a = fateActor({ fate: 0 });
    a.type = "demonPrince";
    a.system.dp = { ip: 3 };
    a.update = async function (data) {
      this.updates.push(data);
      if (data["system.dp.ip"] !== undefined) this.system.dp.ip = data["system.dp.ip"];
    };
    const { spent, poolValue } = await _performUnseenBypass(a, { label: "Sixth Sense/Шестое Чувство" });
    expect(spent).toBe(true);
    expect(poolValue).toBe(2);
    expect(a.system.dp.ip).toBe(2);
    expect(a.updates).toContainEqual({ "system.dp.ip": 2 });
  });

  it("0 Очков — не тратит, не постит карточку", async () => {
    const a = fateActor({ fate: 0 });
    const { spent } = await _performUnseenBypass(a, { label: "x" });
    expect(spent).toBe(false);
    expect(a.updates.length).toBe(0);
    expect(captured.chat.length).toBe(0);
  });
});
