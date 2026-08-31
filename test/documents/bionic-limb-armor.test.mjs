// test/documents/bionic-limb-armor.test.mjs
//
// wdbc-hgua: +2 Поглощения бионической руки/ноги решал classifyImplant() —
// regex по ИМЕНИ предмета поверх общей category "bionic". Переименование
// импланта в паке молча теряло броню, а слово вроде "коготь" в названии могло
// увести классификацию не в ту конечность (файл body-map.mjs сам документирует
// такой ложный случай — Серво-Коготь по слову "коготь" уезжал в kind:"leg").
//
// Фикс: kind решает system.category ("bionic-arm"/"bionic-leg") напрямую —
// classifyImplant по имени остаётся фоллбэком только для легаси-копий с общей
// category "bionic" без своего подвида.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

/** Установленный бионический имплант на конкретной стороне. */
function bionicImplant(name, category, side) {
  return {
    id: `implant-${name}-${side}`, name, type: "implant",
    system: { effects: {}, category, installed: "" },
    getFlag: (_s, k) => {
      if (k === "installed") return true;
      if (k === "bodySide") return side;
      return undefined;
    }
  };
}

/** Персонаж: Стойкость 40 (T.b = 4), без брони — голое Поглощение = T.b. */
function characterWith(items = []) {
  const system = new ACTOR_DATA_MODELS.character({}).toObject();
  system.characteristics.t.base = 40;
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  WarhammerActor.prototype.prepareDerivedData.call({
    type: "character", name: "Подставной", system, items: list, getFlag: () => undefined
  });
  return system;
}

describe("бионические рука/нога: +2 АР по system.category, не по имени", () => {
  it("category bionic-arm даёт +2 АР правой руке, даже если имя не матчит ни один regex", () => {
    const system = characterWith([bionicImplant("Custom-Renamed Thing", "bionic-arm", "right")]);
    expect(system.absorption.rightArm).toBe(6); // T.b 4 + 2
    expect(system.absorption.leftArm).toBe(4);
  });

  it("category bionic-leg даёт +2 АР левой ноге, даже если имя не матчит ни один regex", () => {
    const system = characterWith([bionicImplant("Совершенно Другое Название", "bionic-leg", "left")]);
    expect(system.absorption.leftLeg).toBe(6);
    expect(system.absorption.rightLeg).toBe(4);
  });

  it("имя с ложным словом 'коготь' не сбивает category bionic-arm в ногу", () => {
    // Прецедент из body-map.mjs: Серво-Коготь по слову "коготь" уезжал в
    // kind:"leg" при классификации по имени. С category bionic-arm имя больше
    // не участвует в решении.
    const system = characterWith([bionicImplant("Серво-Коготь (Рука)", "bionic-arm", "right")]);
    expect(system.absorption.rightArm).toBe(6);
    expect(system.absorption.rightLeg).toBe(4);
  });

  it("сторона не выбрана — бонус не начисляется никуда", () => {
    const system = characterWith([bionicImplant("Bionic Arm", "bionic-arm", undefined)]);
    expect(system.absorption.leftArm).toBe(4);
    expect(system.absorption.rightArm).toBe(4);
  });

  it("легаси category 'bionic' без подвида — фоллбэк на classifyImplant по имени", () => {
    const system = characterWith([bionicImplant("Bionic Leg / Бионическая Нога", "bionic", "right")]);
    expect(system.absorption.rightLeg).toBe(6);
  });
});
