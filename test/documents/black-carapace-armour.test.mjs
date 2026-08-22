// test/documents/black-carapace-armour.test.mjs
//
// Отчёт тестера (2026-08-22): у космодесантника в силовой броне в торсе на
// 4 АР больше, чем должно быть — «Чёрный Панцирь стакается с бронёй».
//
// Причина: имплант «19. Чёрный Панцирь / Black Carapace» нёс запись
// Конструктора kind:"armour" (armourLocation:"body", armourValue:4), которая
// СКЛАДЫВАЕТСЯ с носимой бронёй (тем же путём, что Естественная Броня Черт).
// Но по тексту самого предмета: «Без брони считается как нагрудник с АР 4» —
// это замена/подстраховка при ОТСУТСТВИИ брони на торсе, а не бонус поверх
// неё. Верное поведение — «лучшее из», как у брони/щита/ручного значения
// (best() в documents/actor.mjs), не сумма.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function itemFor({ type, name, system = {}, flags = {} } = {}) {
  return { id: `${type}-${name}`, name, type, system, getFlag: (_s, k) => flags[k] };
}

function blackCarapace() {
  return itemFor({ type: "implant", name: "19. Чёрный Панцирь / Black Carapace", flags: { installed: true } });
}

function armor(body) {
  return itemFor({ type: "armor", name: "Броня", system: { equipped: true, body } });
}

/** Персонаж: Стойкость 30 (T.b 3), без брони по умолчанию. */
function characterWith({ items = [] } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.t.base = 30;
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Подставной", system, items: list, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

describe("Чёрный Панцирь: АР 4 в торс не должен складываться с бронёй", () => {
  it("без брони: торс получает АР4 от импланта (T.b 3 → поглощение 7)", () => {
    const system = characterWith({ items: [blackCarapace()] });
    expect(system.absorption.armorOnly.body).toBe(4);
    expect(system.absorption.body).toBe(7);
  });

  it("с силовой бронёй АР8: торс = 8, НЕ 12 — имплант не стакается", () => {
    const system = characterWith({ items: [blackCarapace(), armor(8)] });
    expect(system.absorption.armorOnly.body).toBe(8);
    expect(system.absorption.body).toBe(11);
  });

  it("со слабой бронёй АР2: имплант поднимает до 4 (лучшее из двух, не сумма)", () => {
    const system = characterWith({ items: [blackCarapace(), armor(2)] });
    expect(system.absorption.armorOnly.body).toBe(4);
  });

  it("без импланта: обычная броня считается как раньше (регрессия)", () => {
    const system = characterWith({ items: [armor(8)] });
    expect(system.absorption.armorOnly.body).toBe(8);
  });
});
