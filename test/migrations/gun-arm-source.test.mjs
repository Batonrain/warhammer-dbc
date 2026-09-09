// test/migrations/gun-arm-source.test.mjs
//
// Дар «Рука-Пушка» действует ровно на одно помеченное оружие (wdbc-spsd).
// У персонажей, живших в мире до этой правки, метки нет ни на чём — Дар молча
// перестал работать, и заметно это только по кончившимся патронам (wdbc-vkt).
//
// Миграция ставит метку там, где выбор ОДНОЗНАЧЕН. Угадывать, какая из двух
// винтовок вросла в предплечье, движку нечем — там решает ГМ, и это не
// «недоделка», а единственный честный ответ.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { gunArmDecision, gunArmCandidates } from "../../module/migrations/gun-arm-source.mjs";

const FLAG = "warhammer-dbc";

const gift = () => ({
  id: "gift", type: "talent", name: "Gun Arm / Рука-Пушка",
  system: { capabilityKey: "weapon.noStandardAmmo" },
  getFlag: () => undefined
});
const weapon = (id, weaponClass = "pistol", marked = false) => ({
  id, type: "weapon", name: id, system: { weaponClass },
  flags: marked ? { [FLAG]: { gunArmSource: true } } : {},
  getFlag: (sc, k) => (marked && sc === FLAG && k === "gunArmSource") ? true : undefined
});

describe("простановка вросшего оружия «Руки-Пушки»", () => {
  it("один подходящий ствол — метка ставится сама", () => {
    expect(gunArmDecision([gift(), weapon("bolt"), { id: "sword", type: "weapon", system: { weaponClass: "melee" }, getFlag: () => undefined }]))
      .toEqual({ action: "mark", weaponId: "bolt" });
  });

  it("несколько стволов — выбирает ГМ, движок не угадывает", () => {
    const d = gunArmDecision([gift(), weapon("pistol1"), weapon("rifle1", "basic")]);
    expect(d.action).toBe("ask");
    expect(d.count).toBe(2);
  });

  it("метка уже стоит — второй раз не трогаем", () => {
    expect(gunArmDecision([gift(), weapon("bolt", "pistol", true), weapon("other")]).action).toBe("skip");
  });

  it("без Дара ничего не помечается", () => {
    expect(gunArmDecision([weapon("bolt")]).action).toBe("skip");
  });

  it("рукопашное и метательное Дар не втягивает", () => {
    expect(gunArmCandidates([weapon("bolt"), { id: "axe", type: "weapon", system: { weaponClass: "melee" } }])
      .map(i => i.id)).toEqual(["bolt"]);
  });
});
