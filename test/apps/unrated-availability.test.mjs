// test/apps/unrated-availability.test.mjs
//
// Задача r0 (23.10.2026): предмет БЕЗ Редкости не равен предмету с Редкостью 0.
// Потолок/нижняя граница Редкости (maxAvailability/minAvailability) считали
// Number(availability) || 0, и 26 Имплантов без книжной Редкости (7 стартовой
// кибернетики людей и 19 органов геносемени Астартес) проходили любой потолок
// ≥ 0 и покупались за Очки Снаряжения как «бесплатные R0».
//
// Решение владельца: Импланты остаются без Редкости (null), чинятся фильтры.
// Тонкость: «нет Редкости» — законное состояние ТОЛЬКО у Имплантов и Ритуалов
// (record 0). У Талантов, Психосил, Черт, Мутаций поля Редкости нет вовсе, а
// запись Конструктора «выбор» по умолчанию кладёт потолок 5 («Любая») — если
// бы «нет поля» везде значило «нет Редкости», все такие выборы опустели бы.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import {
  matchesFilters, isUnrated, UNRATED_TYPES, indexAvailability
} from "../../module/apps/compendium-filters.mjs";
import { upgradeQualityCandidates } from "../../module/apps/character-wizard.mjs";
import { packDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";

const node = (over = {}) => ({ id: "x", name: "N", type: "gear", availability: 0, ...over });

describe("isUnrated: «нет Редкости» отличается от настоящего R0", () => {
  it("Имплант и Ритуал без значения (null, нет поля, пусто) — без Редкости", () => {
    for (const type of ["implant", "ritual"]) {
      expect(isUnrated({ type, availability: null }), `${type} null`).toBe(true);
      expect(isUnrated({ type, availability: undefined }), `${type} undefined`).toBe(true);
      expect(isUnrated({ type, availability: "" }), `${type} пусто`).toBe(true);
    }
  });

  it("законный ноль и любое число — это Редкость, а не её отсутствие", () => {
    expect(isUnrated({ type: "implant", availability: 0 })).toBe(false);
    expect(isUnrated({ type: "implant", availability: -1 })).toBe(false);
    expect(isUnrated({ type: "implant", availability: 4 })).toBe(false);
  });

  it("у типов, где поля Редкости нет по схеме, пустое значение — не «без Редкости»", () => {
    for (const type of ["talent", "psychicPower", "trait", "mutation", "techPower", "weapon", "gear"]) {
      expect(isUnrated({ type, availability: undefined }), type).toBe(false);
    }
    expect([...UNRATED_TYPES].sort()).toEqual(["implant", "ritual"]);
  });
});

describe("maxAvailability / minAvailability", () => {
  it("Имплант без Редкости не проходит потолок — ни R0, ни R4", () => {
    const bare = node({ type: "implant", availability: null });
    const bareUndef = node({ type: "implant", availability: undefined });
    for (const cap of [-1, 0, 1, 4, 5]) {
      expect(matchesFilters(bare, { maxAvailability: cap }), `null ≤ ${cap}`).toBe(false);
      expect(matchesFilters(bareUndef, { maxAvailability: cap }), `нет поля ≤ ${cap}`).toBe(false);
    }
  });

  it("Имплант без Редкости не проходит и нижнюю границу", () => {
    expect(matchesFilters(node({ type: "implant", availability: null }), { minAvailability: 0 })).toBe(false);
    expect(matchesFilters(node({ type: "implant", availability: null }), { minAvailability: -5 })).toBe(false);
  });

  it("Имплант с настоящим R0 по-прежнему проходит потолок 0 и покупается за R0", () => {
    const r0 = node({ type: "implant", availability: 0 });
    expect(matchesFilters(r0, { maxAvailability: 0 })).toBe(true);
    expect(matchesFilters(r0, { maxAvailability: 4 })).toBe(true);
    expect(matchesFilters(r0, { maxAvailability: -1 })).toBe(false);
    expect(matchesFilters(r0, { minAvailability: 0 })).toBe(true);
    expect(matchesFilters(r0, { minAvailability: 1 })).toBe(false);
  });

  it("Таланты/Психосилы/Черты без поля Редкости проходят потолок «Любая» (5), как и прежде", () => {
    for (const type of ["talent", "psychicPower", "trait", "mutation", "techPower"]) {
      expect(matchesFilters(node({ type, availability: undefined }), { maxAvailability: 5 }), type).toBe(true);
    }
  });

  it("Ритуал без Записи не проходит потолок (раньше проходил как R0); с Записью — по Записи", () => {
    const rit = record => node({ type: "ritual", availability: indexAvailability({ type: "ritual", system: { record } }) });
    expect(matchesFilters(rit(0), { maxAvailability: 3 })).toBe(false);
    expect(matchesFilters(rit(3), { maxAvailability: 3 })).toBe(true);
    expect(matchesFilters(rit(4), { maxAvailability: 3 })).toBe(false);
    // выдача Демонолога (потолок 3 + нижняя 1) не изменилась
    expect([0, 1, 2, 3, 4, 5].map(r => matchesFilters(rit(r), { maxAvailability: 3, minAvailability: 1 })))
      .toEqual([false, true, true, true, false, false]);
  });
});

// Магазин Очков Снаряжения, строка «улучшить Качество» (character-wizard.mjs,
// _equipUpgradeQuality) отбирает предметы на листе тем же правилом.
describe("upgradeQualityCandidates: улучшение Качества не берёт предметы без Редкости", () => {
  const owned = (type, name, availability) => ({ type, name, system: { availability } });
  const row = { maxAvailability: 1, minAvailability: null };

  it("Имплант с null не кандидат, Имплант с R0/R1 и обычный R0 — кандидаты", () => {
    const list = [
      owned("implant", "Без Редкости", null),
      owned("implant", "R0", 0),
      owned("implant", "R1", 1),
      owned("gear", "Нож R0", 0),
      owned("weapon", "Болтер R3", 3),
      owned("talent", "Не снаряжение", 0)
    ];
    expect(upgradeQualityCandidates(list, row).map(i => i.name)).toEqual(["R0", "R1", "Нож R0"]);
  });

  it("нижняя граница диапазона тоже не пускает предмет без Редкости", () => {
    const list = [owned("implant", "Без Редкости", null), owned("gear", "R2", 2)];
    expect(upgradeQualityCandidates(list, { maxAvailability: 4, minAvailability: 2 }).map(i => i.name)).toEqual(["R2"]);
    expect(upgradeQualityCandidates(list, { maxAvailability: 4, minAvailability: 0 }).map(i => i.name)).toEqual(["R2"]);
  });
});

// Настоящие данные: ровно те 26 Имплантов, о которых задача, не проходят ни один
// потолок Магазина Очков Снаряжения, а R0 по книге (17 штук) — проходят потолок 0.
describe("данные: Импланты пака и потолки Магазина Очков Снаряжения", () => {
  const CIVIL_CYBER = ["Cranial Circuitry", "Cyber-Mantle", "Electoo-Inductors", "Electro-Grafts",
    "Noospheric Uplink", "Potentia Coil", "Respirator Unit"];

  it("26 Имплантов без Редкости: 7 кибернетики людей + 19 органов геносемени — ни один потолок их не пускает", () => {
    const docs = packDocuments("implants", "implant");
    const unrated = docs.filter(({ doc }) => doc.system?.availability == null);
    expect(unrated).toHaveLength(26);
    const names = unrated.map(({ doc }) => doc.name);
    for (const n of CIVIL_CYBER) expect(names.some(x => x.startsWith(n)), n).toBe(true);
    expect(names.length - CIVIL_CYBER.length).toBe(19);
    for (const { doc } of unrated) {
      const n = node({ type: doc.type, availability: indexAvailability(doc) });
      for (const cap of [-1, 0, 1, 2, 3, 4, 5]) {
        expect(matchesFilters(n, { maxAvailability: cap }), `${doc.name} ≤ ${cap}`).toBe(false);
      }
    }
  }, PACK_SCAN_TIMEOUT);

  it("Импланты с настоящим R0 (17) проходят потолок 0 — законный ноль не потерян", () => {
    const zero = packDocuments("implants", "implant").filter(({ doc }) => doc.system?.availability === 0);
    expect(zero).toHaveLength(17);
    for (const { doc } of zero) {
      expect(matchesFilters(node({ type: "implant", availability: indexAvailability(doc) }), { maxAvailability: 0 }), doc.name).toBe(true);
    }
  }, PACK_SCAN_TIMEOUT);

  it("нигде, кроме Имплантов, «нет Редкости» при потолке не возникает: остальные предметы паков снаряжения Редкость хранят", () => {
    for (const [pack, type] of [["weapons", "weapon"], ["armor", "armor"], ["gear", "gear"], ["tools", "tool"], ["ammunition", "ammo"],
      ["weapon-mods", "weaponMod"], ["armor-mods", "armorMod"]]) {
      const docs = packDocuments(pack, type);
      expect(docs.length, pack).toBeGreaterThan(0);
      for (const { doc } of docs) expect(doc.system?.availability, `${pack}/${doc.name}`).not.toBeUndefined();
    }
  }, PACK_SCAN_TIMEOUT);
});
