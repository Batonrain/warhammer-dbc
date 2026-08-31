// test/documents/initiative-mutation-effect.test.mjs
//
// Инициатива от Мутации/Дара (wdbc-v9a7): kind:"characteristic" с
// charKey:"initiative" (apps/mechanics.mjs) выдаётся как embedded
// ActiveEffect с ключом system.initiative, фаза "final" — применяется
// Foundry раньше character.mjs::prepareCharacterDerived. Тот же разрыв фаз,
// что у Размера (test/documents/size-reaches-movement.test.mjs): без
// чтения назад унаследованная перезапись system.initiative = Ag.b + Таланты
// стирала бы вклад эффекта («Безголовый» −2 к Инициативе).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function characterWith({ items = [], initiative = 0 } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.ag.base = 30; // Ag.b 3
  // Предзаполнено так, как выглядело бы УЖЕ ПОСЛЕ применения Foundry-эффекта
  // фазы "final" — стенд не эмулирует сам applyActiveEffects (тот же приём,
  // что у sizeMod в size-reaches-movement.test.mjs).
  system.initiative = initiative;
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Подставной", system, items: list, getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

describe("Инициатива от эффекта Мутации доходит до брос­ка, не стирается", () => {
  it("без эффекта: Инициатива = Ag.b", () => {
    const system = characterWith();
    expect(system.initiative).toBe(3);
  });

  it("Мутация «Безголовый» (−2) снижает Инициативу, а не обнуляется перезаписью", () => {
    const system = characterWith({ initiative: -2 });
    expect(system.initiative).toBe(1); // Ag.b 3 − 2
  });

  it("складывается с модификатором Таланта (легаси-цикл), а не вытесняет его", () => {
    const talent = { id: "t1", name: "Combat Formation", type: "talent",
                      system: { effects: { initMod: 1 } }, getFlag: () => undefined };
    const system = characterWith({ items: [talent], initiative: -2 });
    expect(system.initiative).toBe(2); // Ag.b 3 + Талант 1 − 2 (эффект Мутации)
  });
});
