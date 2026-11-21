// test/rules/daemonic-armament.test.mjs
//
// Задача Studio 55-15 (21.11.2026): Daemonic Armament (X/Y) — «одно стандартное
// примитивное рукопашное, метательное или стрелковое оружие … призывать себе в
// руку, и оно получает +X Dmg, +Y Pen, свойство Reinforced и теряет свойство
// Primitive. Это оружие не тратит стандартные боеприпасы».

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  addFlatDamage, daemonicArmamentProps, daemonicArmamentWeaponData, isDaemonicArmament,
  isDaemonicArmamentCandidate, isDaemonicArmamentTrait, daemonicArmamentSummonAp,
  daemonicArmamentRatings, PRIMITIVE_FOLDER, DAEMONIC_ARMAMENT_FLAG
} from "../../module/rules/daemonic-armament.mjs";
import { ammoIsFree } from "../../module/rules/ammo-free.mjs";

const read = f => JSON.parse(fs.readFileSync(f, "utf8"));
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const q = path.join(d, e.name);
  return e.isDirectory() ? walk(q) : (e.name.endsWith(".json") && e.name !== "_Folder.json" ? [q] : []);
});

describe("урон +X", () => {
  it("складывает с имеющимся модификатором", () => {
    expect(addFlatDamage("1d10-2", 3)).toBe("1d10+1");
    expect(addFlatDamage("1d10+1", 2)).toBe("1d10+3");
    expect(addFlatDamage("2d10", 4)).toBe("2d10+4");
    expect(addFlatDamage("1d10-2", 2)).toBe("1d10");
  });
  it("X = 0 — формула как была", () => expect(addFlatDamage("1d5-1", 0)).toBe("1d5-1"));
});

describe("свойства", () => {
  it("снимает Primitive, добавляет Reinforced без дубля", () => {
    expect(daemonicArmamentProps([{ key: "primitive" }, { key: "felling", rating: 2 }]))
      .toEqual([{ key: "felling", rating: 2 }, { key: "reinforced" }]);
    expect(daemonicArmamentProps([{ key: "reinforced" }])).toEqual([{ key: "reinforced" }]);
  });
});

describe("призванное оружие на настоящем образце из пака", () => {
  const sword = read(path.resolve("packs-src/weapons/Имперское/Рукопашное/Примитивное/Sword___Меч_xt9bG5qJ2JLarOXG.json"));
  const data = daemonicArmamentWeaponData(sword, { x: 3, y: 4, traitId: "t1", sourceUuid: "Compendium.x" });

  it("Меч (3/4): 1d10+3, Pen 4, Reinforced, без Primitive, в руке", () => {
    expect(data.system.damage).toBe("1d10+3");
    expect(data.system.penetration).toBe(4);
    expect(data.system.weaponProps.map(p => p.key)).toContain("reinforced");
    expect(data.system.weaponProps.map(p => p.key)).not.toContain("primitive");
    expect(data.system.equipped).toBe(true);
    expect(data.name).toMatch(/Демоническое Вооружение/);
    expect(data._id).toBeUndefined();
  });
  it("образец не меняется", () => {
    expect(sword.system.damage).toBe("1d10");
    expect(sword.system.weaponProps.map(p => p.key)).toContain("primitive");
  });
  it("метка на оружии — патроны не тратятся, обычное оружие тратит", () => {
    expect(isDaemonicArmament(data)).toBe(true);
    expect(data.flags["warhammer-dbc"][DAEMONIC_ARMAMENT_FLAG]).toMatchObject({ traitId: "t1", x: 3, y: 4 });
    expect(ammoIsFree(data, null)).toBe(true);
    expect(ammoIsFree(sword, null)).toBe(false);
  });
  it("второй профиль (Алебарда: Крюк/Копьё/Посох) тоже получает +X/+Y", () => {
    const halberd = read(path.resolve("packs-src/weapons/Имперское/Рукопашное/Примитивное/Halberd___Алебарда_B5yVI3MFjYQ6OY8s.json"));
    const h = daemonicArmamentWeaponData(halberd, { x: 1, y: 2 });
    halberd.system.profiles.forEach((p, i) => {
      expect(h.system.profiles[i].damage).toBe(addFlatDamage(p.damage, 1));
      expect(h.system.profiles[i].penetration).toBe((Number(p.penetration) || 0) + 2);
      expect(h.system.profiles[i].weaponProps.map(q => q.key)).toContain("reinforced");
    });
  });
});

describe("выбор образца: стандартное примитивное", () => {
  const all = walk(path.resolve("packs-src/weapons")).map(f => ({ f, d: read(f) }));
  const entry = ({ f, d }) => ({ type: d.type, system: d.system, folderName: path.basename(path.dirname(f)) });
  const picked = all.filter(x => isDaemonicArmamentCandidate(entry(x)));

  it("в списке есть рукопашное, метательное и стрелковое", () => {
    const classes = new Set(picked.map(x => x.d.system.weaponClass));
    expect(classes.has("melee")).toBe(true);
    expect(classes.has("thrown")).toBe(true);
    expect(classes.has("basic") || classes.has("pistol")).toBe(true);
    expect(picked.length).toBeGreaterThan(40);
  });
  it("только из папок «Примитивное» и со свойством Primitive (не силовое, не цепное, не ксено)", () => {
    for (const x of picked) {
      expect(path.basename(path.dirname(x.f))).toBe(PRIMITIVE_FOLDER);
      expect(x.d.system.weaponProps.some(p => p.key === "primitive")).toBe(true);
    }
    expect(picked.some(x => /Силовое|Цепное|Азуриане|Друкхари/.test(x.f))).toBe(false);
  });
});

describe("цена призыва и рейтинги", () => {
  it("полудействие, с Quick Draw — свободное", () => {
    expect(daemonicArmamentSummonAp()).toBe(1);
    expect(daemonicArmamentSummonAp({ quickDraw: true })).toBe(0);
  });
  it("X — рейтинг, Y — второй рейтинг", () => {
    expect(daemonicArmamentRatings({ system: { rating: 3, rating2: 4 } })).toEqual({ x: 3, y: 4 });
  });
});

describe("Черта в паке", () => {
  const file = walk(path.resolve("packs-src/traits")).find(f => /Daemonic_Armament___/.test(f));
  const trait = read(file);
  it("опознаётся, принимает X/Y и несёт кнопку призыва", () => {
    expect(isDaemonicArmamentTrait(trait)).toBe(true);
    expect(trait.system.hasRating).toBe(true);
    expect(trait.system.hasRating2).toBe(true);
    const codes = trait.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries)
      .filter(e => e.kind === "script").map(e => e.code);
    expect(codes.some(c => /toggleDaemonicArmament\(actor, item\)/.test(c))).toBe(true);
    expect(codes.some(c => /Памятка/.test(c))).toBe(false);
  });
  it("Демоническое Присутствие и прочие Черты с «Daemonic» в имени — не она", () => {
    expect(isDaemonicArmamentTrait({ type: "trait", name: "Daemonic (+3) / Демонический" })).toBe(false);
    expect(isDaemonicArmamentTrait({ type: "weapon", name: "Daemonic Armament / Демоническое Вооружение" })).toBe(false);
  });
});
