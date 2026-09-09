// test/apps/content-sync-effects-disabled.test.mjs
//
// «Обновить мир» умеет сверять эффекты предметов (wdbc-9aj9). Точечно править
// ActiveEffect нечем — эффекты сносятся и создаются заново по паку, — и на
// этом терялись две вещи (wdbc-0ky):
//
//  1. Погашенный (disabled) эффект возвращался ВКЛЮЧЁННЫМ. А гашение — штатный
//     способ выключить механику предмета: ГМ выключил правило руками, сверка
//     включила обратно.
//  2. Если у пакового документа эффектов нет, предмет с флагом migratedEffect
//     оставался и без эффектов, и без чтения старого system.effects (актор его
//     у помеченного предмета не смотрит) — то есть без механики вовсе.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { replaceItemEffects } from "../../module/apps/content-sync.mjs";

const FLAG = "warhammer-dbc";

/** Предмет-заглушка с коллекцией эффектов и записью правок. */
function itemWith(effects, flags = {}) {
  const created = [];
  const updates = {};
  return {
    created, updates, flags: { [FLAG]: flags },
    effects: { contents: effects },
    getFlag: (sc, k) => (sc === FLAG ? flags[k] : undefined),
    deleteEmbeddedDocuments: async () => {},
    createEmbeddedDocuments: async (_type, data) => created.push(...data),
    update: async patch => Object.assign(updates, patch)
  };
}

const fx = (name, { disabled = false } = {}) => ({
  id: `fx-${name}`, name, disabled, changes: [], flags: {},
  toObject: () => ({ _id: `fx-${name}`, name, disabled: false, changes: [], flags: {} })
});

describe("сверка эффектов уважает выключенное вручную", () => {
  it("погашенный эффект возвращается погашенным", async () => {
    const item = itemWith([fx("Бонус Силы", { disabled: true })]);
    const pack = { effects: { contents: [fx("Бонус Силы")] }, system: {} };
    await replaceItemEffects(item, pack);
    expect(item.created).toHaveLength(1);
    expect(item.created[0].disabled, "ГМ выключил правило — сверка включила обратно").toBe(true);
  });

  it("включённый эффект остаётся включённым", async () => {
    const item = itemWith([fx("Бонус Силы")]);
    const pack = { effects: { contents: [fx("Бонус Силы")] }, system: {} };
    await replaceItemEffects(item, pack);
    expect(item.created[0].disabled).toBe(false);
  });
});

describe("предмет не остаётся без механики", () => {
  it("пак без эффектов — флаг «перенесено» снимается, старое поле снова читается", async () => {
    const item = itemWith([fx("Бонус Силы")], { migratedEffect: true });
    await replaceItemEffects(item, { effects: { contents: [] }, system: {} });
    expect(item.created).toHaveLength(0);
    expect(item.updates[`flags.${FLAG}.-=migratedEffect`]).toBe(null);
  });

  it("эффекты пришли — флаг не трогается", async () => {
    const item = itemWith([], { migratedEffect: true });
    await replaceItemEffects(item, { effects: { contents: [fx("Бонус Силы")] }, system: {} });
    expect(item.updates[`flags.${FLAG}.-=migratedEffect`]).toBeUndefined();
  });
});
