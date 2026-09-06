// test/rules/recoil-glove-quality.test.mjs
//
// wdbc-9k2q: гейт «Когда Качество» (entry.when.quality) — первый живой
// потребитель. Книга даёт Откатной Перчатке разное по ступеням: Poor.Q
// требует S.b 5 для самой работы, Good.Q вдобавок игнорирует свойство Recoil
// оружия, Best.Q — то же плюс оружие Легиона и Огринов. Возможность
// weapon.ignoreRecoil была заведена и читалась обоими потребителями
// (module/rules/hands.mjs, module/sheets/attack/selection.mjs), но выдать её
// было нечем: безусловная запись дала бы её и Poor.Q, чего книга не даёт.
//
// Здесь — не повтор общего механизма entryWhenOk (он проверен в
// mech-when.test.mjs), а страж на РЕАЛЬНЫЕ данные пака: запись на предмете
// обязана быть гейтована именно по качеству и именно на good/best. Синтетическая
// фикстура этого бы не поймала — она проверяет только код, а сломаться здесь
// может как раз JSON.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const GLOVE_PATH = path.join(ROOT,
  "packs-src/gear/Разное/Recoil_Glove___Откатная_Перчатка_tb5aWcIQDP9tzw8N.json");

const glove = JSON.parse(fs.readFileSync(GLOVE_PATH, "utf8"));

/** Предмет-перчатка ровно с данными пака, но заданной ступени качества. */
const gloveOfQuality = quality => ({
  id: "glove", name: glove.name,
  type: glove.type,
  system: { ...glove.system, quality },
  flags: glove.flags
});

/** Владелец с заданным Бонусом Силы — Poor.Q Перчатка спрашивает именно его. */
const wearer = (sBonus = 3) => ({
  system: { geneSeed: {}, bio: { age: 0 }, characteristics: { s: { total: 40, bonus: sBonus } } },
  items: []
});

const actor = wearer();

const capsOf = (quality, owner = actor) =>
  rulesFromItemMechanics([gloveOfQuality(quality)], () => true, owner)
    .flatMap(r => (r.effects || []).filter(e => e.kind === "grantFlag").map(e => e.target));

describe("Откатная Перчатка: возможности по ступеням качества (wdbc-9k2q)", () => {
  it("стрельба одной рукой из винтовки — с Обычного качества и выше", () => {
    for (const q of ["common", "good", "best"])
      expect(capsOf(q)).toContain("weapon.oneHandedRifle");
  });

  // wdbc-vsma: «Poor.Q: требует S.b 5 или выше для работы» — у слабого
  // владельца дешёвая перчатка не даёт даже базовой стрельбы одной рукой.
  it("Poor.Q работает только при S.b 5 и выше", () => {
    expect(capsOf("poor", wearer(4))).not.toContain("weapon.oneHandedRifle");
    expect(capsOf("poor", wearer(5))).toContain("weapon.oneHandedRifle");
  });

  it("Poor.Q спрашивает Бонус Силы, а не полное значение Силы", () => {
    // S 40 (полное) с Unnatural Strength даёт S.b 6 — книга смотрит на Бонус,
    // и такой владелец дешёвой перчаткой пользуется.
    expect(capsOf("poor", wearer(6))).toContain("weapon.oneHandedRifle");
  });

  it("порог Силы не мешает остальным ступеням — там его нет", () => {
    for (const q of ["common", "good", "best"])
      expect(capsOf(q, wearer(1))).toContain("weapon.oneHandedRifle");
  });

  // «Best.Q: люди оперируют оружием Легиона и Огринов без штрафов за размер и
  // S.b (но -10 за неудобную форму остаётся)» — читает rules/legion-fit.mjs.
  it("Best.Q снимает штрафы за Размер и Силу у оружия не по размеру", () => {
    expect(capsOf("best")).toContain("weapon.oversizedIgnoreSizeStrength");
    for (const q of ["poor", "common", "good"])
      expect(capsOf(q)).not.toContain("weapon.oversizedIgnoreSizeStrength");
  });

  it("Good.Q и Best.Q игнорируют Recoil", () => {
    expect(capsOf("good")).toContain("weapon.ignoreRecoil");
    expect(capsOf("best")).toContain("weapon.ignoreRecoil");
  });

  it("Poor.Q и Comm.Q Recoil НЕ игнорируют — книга даёт это только Good.Q/Best.Q", () => {
    expect(capsOf("poor")).not.toContain("weapon.ignoreRecoil");
    expect(capsOf("common")).not.toContain("weapon.ignoreRecoil");
  });

  it("данные пака: запись про Recoil гейтована именно качеством good/best", () => {
    const entries = glove.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
    const recoil = entries.find(e => e.capabilityKey === "weapon.ignoreRecoil");
    expect(recoil, "запись weapon.ignoreRecoil должна быть на предмете").toBeTruthy();
    expect(recoil.when?.quality).toEqual(["good", "best"]);
    expect(recoil.when?.negateQuality).toBeFalsy();
  });

  it("текст качества на предмете не разъехался с Механикой", () => {
    // Если из qualityEffects.good исчезнет Recoil, значит правило переписали —
    // и запись Механики надо пересматривать вместе с текстом, а не молча.
    expect(glove.system.qualityEffects.good).toMatch(/Recoil/i);
  });
});
