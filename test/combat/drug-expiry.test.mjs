// test/combat/drug-expiry.test.mjs
//
// Струп «В течение 1 часа» (корбук стр. 284) заканчивается сам по игровому
// времени (Sahara task-3ab7, п.5): приём пишет отметку activeEffect.expiresAt,
// часы Календаря (combat/drug-expiry.mjs в CONDITION_CLOCK_HANDLERS) на
// отметке запускают пост-эффект. Настоящий Струп из packs-src/chemistry.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import { applyDrug } from "../../module/sheets/tabs/drugs.mjs";
import { drugExpiryClock } from "../../module/combat/drug-expiry.mjs";
import { sweepConditionClock } from "../../module/combat/condition-clock.mjs";

const SCAB = allPackDocuments("chemistry").map(d => d.doc).find(d => d.name.startsWith("Scab"));

function put(target, data) {
  for (const [path, value] of Object.entries(data)) {
    const parts = path.split(".");
    let node = target;
    for (const part of parts.slice(0, -1)) { node[part] ??= {}; node = node[part]; }
    node[parts.at(-1)] = value;
  }
}

function drugItem(system, { id = "d1", name = "Струп" } = {}) {
  const item = { id, name, type: "drug", system: structuredClone(system), flags: {}, updates: [] };
  item.update = async data => { item.updates.push(data); put(item, data); return data; };
  item.toObject = () => ({ _id: id, name, type: "drug", system: structuredClone(item.system) });
  return item;
}

function holder(items) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const a = {
    name: "Носитель", items: list, flags: { "warhammer-dbc": {} }, updates: [],
    getFlag: (_s, k) => a.flags["warhammer-dbc"][k],
    setFlag: async (_s, k, v) => { a.flags["warhammer-dbc"][k] = v; },
    system: {
      fatigue: { value: 0 }, conditions: {}, wounds: { value: 5, max: 10, critical: 0 },
      characteristics: { t: { total: 40, bonus: 4 }, wp: { total: 35, bonus: 3 }, int: { total: 40, bonus: 4 } },
      corruptionBonus: 0
    },
    update: async data => { a.updates.push(data); put(a, data); return data; }
  };
  return a;
}

const SCAB_SYSTEM = () => ({ ...SCAB.system, quantity: 1 });

beforeEach(() => {
  resetCaptured();
  game.time = { worldTime: 1000 };
});

describe("Струп: отметка конца при приёме", () => {
  it("настоящий Струп: expiresAt = момент приёма + 60 минут игрового времени", async () => {
    const item = drugItem(SCAB_SYSTEM());
    const a = holder([item]);
    captured.nextRoll = 60;     // формула duration «60»
    await applyDrug(a, item);
    expect(item.system.activeEffect.isActive).toBe(true);
    expect(item.system.activeEffect.expiresAt).toBe(1000 + 3600);
  }, PACK_SCAN_TIMEOUT);

  it("препарат без gameMinutes отметки не получает (вручную, как раньше)", async () => {
    const item = drugItem({ ...SCAB_SYSTEM(), gameMinutes: 0 });
    const a = holder([item]);
    captured.nextRoll = 60;
    await applyDrug(a, item);
    expect(item.system.activeEffect.expiresAt).toBeNull();
  }, PACK_SCAN_TIMEOUT);

  it("применение на другого: отметка уезжает в копию препарата цели", async () => {
    const item = drugItem(SCAB_SYSTEM());
    const owner = holder([item]);
    const target = holder([]);
    target.name = "Цель";
    const created = [];
    Item.create = async (data, options = {}) => { created.push({ data, parent: options.parent }); return data; };
    captured.nextRoll = 60;
    await applyDrug(owner, item, target);
    expect(created[0].data.system.activeEffect.expiresAt).toBe(1000 + 3600);
  }, PACK_SCAN_TIMEOUT);
});

describe("часы Календаря снимают Струп", () => {
  const applied = async () => {
    const item = drugItem(SCAB_SYSTEM());
    const a = holder([item]);
    captured.nextRoll = 60;
    await applyDrug(a, item);
    resetCaptured();
    return { item, a };
  };

  it("за минуту до срока ничего не происходит", async () => {
    const { item, a } = await applied();
    await drugExpiryClock(a, { from: 1000, to: 1000 + 3599 });
    expect(item.system.activeEffect.isActive).toBe(true);
    expect(item.system.activeEffect.isAfterEffect).toBe(false);
    expect(captured.chat).toHaveLength(0);
  }, PACK_SCAN_TIMEOUT);

  it("на сроке действие кончается: наступает пост-эффект Струпа (Оглушение 1d10 Раундов, стр. 284), отметка погашена", async () => {
    const { item, a } = await applied();
    captured.nextRoll = 7;
    await sweepConditionClock(a, { from: 1000, to: 1000 + 3600 });
    expect(item.system.activeEffect.isAfterEffect).toBe(true);
    expect(item.system.activeEffect.expiresAt).toBeNull();
    // Урона в T у Струпа нет (поправка владельца 26.10.2026) — Оглушение на выпавшее число Раундов.
    expect(item.system.activeEffect.charDamageStat).toBe("");
    expect(item.system.activeEffect.charDamageAmount).toBe(0);
    expect(a.system.conditions.stunned).toBe(true);
    expect(a.system.conditions.stunnedRounds).toBe(7);
    expect(captured.chat.map(m => m.content).join("\n")).toContain("Срок действия вышел");
  }, PACK_SCAN_TIMEOUT);

  it("повторный сдвиг Календаря второй раз Струп не заканчивает", async () => {
    const { item, a } = await applied();
    await sweepConditionClock(a, { from: 1000, to: 1000 + 3600 });
    const cards = captured.chat.length;
    const updates = item.updates.length;
    await sweepConditionClock(a, { from: 1000 + 3600, to: 1000 + 7200 });
    expect(captured.chat).toHaveLength(cards);
    expect(item.updates).toHaveLength(updates);
  }, PACK_SCAN_TIMEOUT);

  it("препарат без пост-эффекта просто снимается", async () => {
    const item = drugItem({ ...SCAB_SYSTEM(), hasAfterEffect: false });
    const a = holder([item]);
    captured.nextRoll = 60;
    await applyDrug(a, item);
    await drugExpiryClock(a, { from: 1000, to: 1000 + 3600 });
    expect(item.system.activeEffect.isActive).toBe(false);
    expect(item.system.activeEffect.expiresAt).toBeNull();
  }, PACK_SCAN_TIMEOUT);
});
