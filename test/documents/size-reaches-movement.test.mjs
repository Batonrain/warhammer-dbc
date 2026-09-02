// test/documents/size-reaches-movement.test.mjs
//
// Отчёт тестеров (wdbc-cvc): SPD не учитывает Размер персонажа. Тот же разрыв
// фаз, что у T.b→броня (char-bonus-reaches-armor.test.mjs) и Значение→Навыки:
// Трейт «Size / Размер (X)» и «Hulking / Громила» несут embedded ActiveEffect
// с ключом system.sizeMod — раньше фазой "final", которая ложится ПОСЛЕ
// prepareDerivedData. Бейдж «Размер» на листе от этого выглядел верным (final
// успевал к рендеру), а Движение (halfMove/move/charge/run) считалось как у
// персонажа без Размера вовсе — подтверждено на живых данных: у всех Астартес
// мира было sizeMod=1, sizeTotal=0, halfMove = Ag.b без +1.
//
// Фаза ключа теперь "initial" (module/constants/effect-keys.mjs), а
// documents/actor.mjs складывает уже применённый system.sizeMod с traitSizeMod
// (легаси-циклом, который сам мигрированные предметы пропускает), а не
// затирает его — иначе эффект и хардкод (напр. Гигант) взаимно исключались бы.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

function characterWith({ items = [], ...patch } = {}) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.ag.base = 30; // Ag.b 3, без Размера SPD=3 → halfMove 3
  Object.assign(system, patch);
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { type: "character", name: "Подставной", system, items: list,
                  getFlag: () => undefined };
  WarhammerActor.prototype.prepareDerivedData.call(actor);
  return system;
}

describe("Размер от эффекта доходит до Движения", () => {
  it("без Размера: Ag.b 3 → halfMove 3", () => {
    const system = characterWith();
    expect(system.characteristics.ag.bonus).toBe(3);
    expect(system.movement.halfMove).toBe(3);
    expect(system.sizeTotal).toBe(0);
  });

  // system.sizeMod предзаполнен так, как он выглядел бы уже ПОСЛЕ применения
  // Foundry-эффекта фазы "initial" (тот же приём, что у bonusFx/totalFx в
  // char-bonus-reaches-armor.test.mjs — стенд не эмулирует сам applyActiveEffects).
  it("Размер (X) от эффекта поднимает SPD, а не только бейдж", () => {
    const system = characterWith({});
    system.sizeMod = 1;
    WarhammerActor.prototype.prepareDerivedData.call({
      type: "character", name: "Подставной", system,
      items: Object.assign([], { get: () => null }), getFlag: () => undefined
    });

    expect(system.sizeTotal).toBe(1);
    expect(system.movement.halfMove).toBe(4);   // Ag.b 3 + Размер 1
    expect(system.movement.move).toBe(8);       // ×2
    expect(system.movement.charge).toBe(12);    // ×3
    expect(system.movement.run).toBe(24);       // ×6
  });

  it("Размер от эффекта складывается со старым легаси-полем Черты, не вытесняет его", () => {
    // Немигрированная Черта: старое поле system.effects.sizeMod (actor.mjs:861)
    // читается напрямую в traitSizeMod — тот же путь, что до перевода на
    // ActiveEffect, и должен продолжать складываться, а не подменяться эффектом.
    const legacySize = { id: "trait-legacy-size", name: "Черта (легаси)", type: "trait",
                          system: { effects: { sizeMod: 1 } }, getFlag: () => undefined };
    const system = characterWith({ items: [legacySize] });
    system.sizeMod = 1; // от предзаполненного эффекта "Размер (X)" (мигрированный источник)
    WarhammerActor.prototype.prepareDerivedData.call({
      type: "character", name: "Подставной", system,
      items: Object.assign([legacySize], { get: () => null }), getFlag: () => undefined
    });

    expect(system.sizeTotal).toBe(2); // 1 (легаси) + 1 (эффект)
    expect(system.movement.halfMove).toBe(5); // Ag.b 3 + Размер 2
  });

  // wdbc-w8ws (Absurdly Fat/Абсурдно Толстый: «+1 Размер, не влияя на SPD») —
  // kind:"characteristic"/charKey:"sizeNoSpd" целится в отдельное
  // system.sizeModNoSpd, которое НЕ входит в size, уходящий в calcMovement.
  it("system.sizeModNoSpd поднимает sizeTotal, но не трогает Движение", () => {
    const system = characterWith({});
    system.sizeModNoSpd = 1;
    WarhammerActor.prototype.prepareDerivedData.call({
      type: "character", name: "Подставной", system,
      items: Object.assign([], { get: () => null }), getFlag: () => undefined
    });

    expect(system.sizeTotal).toBe(1);
    expect(system.movement.halfMove).toBe(3); // Ag.b 3, без изменений
    expect(system.movement.move).toBe(6);
  });

  it("sizeMod (двигает SPD) и sizeModNoSpd (не двигает) складываются в sizeTotal независимо", () => {
    const system = characterWith({});
    system.sizeMod = 1;
    system.sizeModNoSpd = 2;
    WarhammerActor.prototype.prepareDerivedData.call({
      type: "character", name: "Подставной", system,
      items: Object.assign([], { get: () => null }), getFlag: () => undefined
    });

    expect(system.sizeTotal).toBe(3);              // 1 + 2
    expect(system.movement.halfMove).toBe(4);       // Ag.b 3 + только sizeMod 1
  });
});
