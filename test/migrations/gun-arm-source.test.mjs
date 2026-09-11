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

import { describe, it, expect, afterEach } from "vitest";
import { gunArmDecision, gunArmCandidates, migrateGunArmSource } from "../../module/migrations/gun-arm-source.mjs";

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

// wdbc-059h: цикл по акторам УЖЕ ловил ошибку на каждом (try внутри for), но
// не считал failed — версия миграции штамповалась безусловно, и недомигриро-
// ванный актор не подхватывался повторным запуском.
describe("migrateGunArmSource: изоляция сбоя одного актора (wdbc-059h)", () => {
  const savedGame = globalThis.game;
  afterEach(() => { globalThis.game = savedGame; });

  function actorWith(id, items, { throwOnGet = false } = {}) {
    const list = [...items];
    list.get = id2 => {
      if (throwOnGet) throw new Error(`boom on ${id}`);
      return list.find(i => i.id === id2) ?? null;
    };
    return { id, name: `Actor ${id}`, items: list };
  }

  it("сбой на одном акторе не прерывает простановку остальным и не топит их результат", async () => {
    const bad = actorWith("bad", [gift(), weapon("boltBad")], { throwOnGet: true });
    let goodMarked = false;
    const goodWeapon = weapon("boltGood");
    goodWeapon.setFlag = async (scope, key, value) => { goodMarked = (scope === FLAG && key === "gunArmSource" && value === true); };
    const good = actorWith("good", [gift(), goodWeapon]);

    globalThis.game = { user: { isGM: true }, actors: [bad, good], scenes: [] };
    globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

    const res = await migrateGunArmSource();

    expect(res.marked).toBe(1);
    expect(res.failed).toBe(1);
    expect(goodMarked).toBe(true);
  });
});
