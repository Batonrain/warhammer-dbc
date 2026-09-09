// test/apps/knight-of-god-ritual.test.mjs
//
// wdbc-1rno: «Рыцарь Бога» (Knight of Khorne/Nurgle/Slaanesh/Tzeentch) —
// демонический скакун, ×4 версии. Та же архитектура, что у Инфернального
// Оруженосца (test/apps/infernal-armiger-ritual.test.mjs): готовый Ритуал
// (kind:"equipment", equipMode:"direct") на новый item.system.noTest/
// asMinion/demonName, плюс ВТОРОЙ Ритуал того же Дара — asMount вместо
// asWeapon (вселение в уже имеющегося скакуна/технику, а не в оружие).
//
// Страж на РЕАЛЬНЫЕ данные: equipSourceUuid каждой Мутации обязан указывать
// на РЕАЛЬНО существующий Ритуал с правильным демоном, а не на опечатку в id.

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";
import { applyRitualItem } from "../../module/constants/rituals.mjs";

const GODS = [
  { god: "Кхорн",   dir: "packs-src/mutations/Дары_Богов/Кхорн",   mutationId: "qA0S0sVfQLF9EbF4",
    summonId: "KnightKhorneR1ax", mountId: "KnightKhMountS1a", demon: "Джаггернаут", godKey: "khorne" },
  { god: "Нургл",   dir: "packs-src/mutations/Дары_Богов/Нургл",   mutationId: "ax9ZWnfXuFYOgXnK",
    summonId: "KnightNurgleR2bx", mountId: "KnightNuMountS2b", demon: "Паланкин Нургла", godKey: "nurgle" },
  { god: "Слаанеш", dir: "packs-src/mutations/Дары_Богов/Слаанеш", mutationId: "EdwbZMDBWbqbIBSb",
    summonId: "KnightSlaanR3c1x", mountId: "KnightSlMountS3c", demon: "Скакун Слаанеш", godKey: "slaanesh" },
  { god: "Тзинч",   dir: "packs-src/mutations/Дары_Богов/Тзинч",   mutationId: "de3gvGhKnV1szIK0",
    summonId: "KnightTzeenR4d2x", mountId: "KnightTzMountS4d", demon: "Диск Тзинча", godKey: "tzeentch" }
];

const RITUALS_DIR = "packs-src/rituals/Архетипа";
const BESTIARY_BY_GOD = {
  "Кхорн":   { dir: "Кхорн",   id: "jcbnJn8KhVboxptb" },
  "Нургл":   { dir: "Нургл",   id: "nCMcUrHwHLTtS58r" },
  "Слаанеш": { dir: "Слаанеш", id: "cR3iocuPp8rd20Ai" },
  "Тзинч":   { dir: "Тзинч",   id: "BoSawYMtDC4dWsE5" }
};
const BESTIARY_DIR = "packs-src/bestiary/Демоны_Хаоса";

describe.each(GODS)("Рыцарь Бога ($god): ритуал призыва скакуна в Истинную Форму", ({ god, dir, mutationId, summonId, demon }) => {
  const mutation = packDocById(dir, mutationId);
  const entries = mutation.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);

  it("Мутация несёт запись kind:\"equipment\" (direct), ссылающуюся на реальный Ритуал", () => {
    const entry = entries.find(e => e.kind === "equipment" && e.id.endsWith("-ritual") && !e.id.endsWith("-ritual-mount"));
    expect(entry, "нет entry kind:equipment (summon) у Мутации").toBeTruthy();
    expect(entry.equipMode).toBe("direct");
    expect(entry.equipSourceUuid).toBe(`Compendium.warhammer-dbc.rituals.Item.${summonId}`);
  });

  it("Ритуал реально существует, называет верного демона, без теста, как Миньон без слота, и запускает дестабилизацию", () => {
    const ritual = packDocById(RITUALS_DIR, summonId);
    expect(ritual.type).toBe("ritual");
    expect(ritual.system.noTest).toBe(true);
    expect(ritual.system.asMinion).toBe(true);
    expect(ritual.system.demonName).toBe(demon);
    expect(ritual.system.failureType).toBe("summon");
    // wdbc-1rno: Рыцарь Бога (в отличие от Оруженосца) реально дестабилизируется —
    // demon-destabilize.mjs. veilThinner при этом НЕ ставится — книга не даёт
    // Рыцарю этой строки (в отличие от Оруженосца).
    expect(ritual.system.startDestabilize).toBe(true);
    expect(ritual.system.veilThinner).toBeFalsy();
  });

  it("демон реально существует в Бестиарии под тем же именем (findBestiaryActor его найдёт)", () => {
    const bestiaryHint = BESTIARY_BY_GOD[god];
    const daemon = packDocById(`${BESTIARY_DIR}/${bestiaryHint.dir}`, bestiaryHint.id);
    expect(daemon.name).toBe(demon);
    expect(daemon.type).toBe("daemon");
  });

  it("applyRitualItem превращает Ритуал в R с noTest/asMinion/demonName/startDestabilize", () => {
    const ritual = packDocById(RITUALS_DIR, summonId);
    const applied = applyRitualItem(null, { ...ritual, system: ritual.system }, () => []);

    expect(applied.noTest).toBe(true);
    expect(applied.asMinion).toBe(true);
    expect(applied.demonName).toBe(demon);
    expect(applied.type).toBe("summon");
    expect(applied.startDestabilize).toBe(true);
  });
});

// wdbc-1rno: «...может тем же ритуалом вселить [демона-скакуна] в ездовое
// животное или персональный транспорт» — второй Ритуал-предмет на ту же
// Мутацию (asMount вместо asMinion), тот же noTest-путь.
describe.each(GODS)("Рыцарь Бога ($god): ритуал вселения в скакуна/технику", ({ dir, mutationId, mountId, demon, godKey }) => {
  const mutation = packDocById(dir, mutationId);
  const entries = mutation.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);

  it("Мутация несёт вторую запись kind:\"equipment\" (direct), ссылающуюся на Ритуал вселения в скакуна/технику", () => {
    const entry = entries.find(e => e.kind === "equipment" && e.id.endsWith("-ritual-mount"));
    expect(entry, "нет entry *-ritual-mount у Мутации").toBeTruthy();
    expect(entry.equipMode).toBe("direct");
    expect(entry.equipSourceUuid).toBe(`Compendium.warhammer-dbc.rituals.Item.${mountId}`);
  });

  it("Ритуал вселения реально существует: без теста, asMount (не asMinion), верный демон и Бог", () => {
    const ritual = packDocById(RITUALS_DIR, mountId);
    expect(ritual.type).toBe("ritual");
    expect(ritual.system.noTest).toBe(true);
    expect(ritual.system.asMount).toBe(true);
    expect(ritual.system.asMinion).toBe(false);
    expect(ritual.system.demonName).toBe(demon);
    expect(ritual.system.demonGod).toBe(godKey);
    expect(ritual.system.failureType).toBe("summon");
  });

  it("applyRitualItem передаёт asMount/demonGod дальше в R", () => {
    const ritual = packDocById(RITUALS_DIR, mountId);
    const applied = applyRitualItem(null, { ...ritual, system: ritual.system }, () => []);

    expect(applied.noTest).toBe(true);
    expect(applied.asMount).toBe(true);
    expect(applied.demonName).toBe(demon);
    expect(applied.demonGod).toBe(godKey);
  });
});

// wdbc-1rno: у Слаанеш +20 на управление уже была ОТДЕЛЬНАЯ запись kind:
// "testMod" на Мутации (не трогали её этой работой) — страж, что она не
// потерялась при добавлении двух новых equipment-записей рядом.
describe("Рыцарь Слаанеш: существующая запись testMod (+20 управление) не задета", () => {
  it("Мутация всё ещё несёт knightOfSlaanesh-operate с value 20, modScope skill, skillKey operate", () => {
    const mutation = packDocById("packs-src/mutations/Дары_Богов/Слаанеш", "EdwbZMDBWbqbIBSb");
    const entries = mutation.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
    const entry = entries.find(e => e.id === "knightOfSlaanesh-operate");
    expect(entry).toBeTruthy();
    expect(entry.kind).toBe("testMod");
    expect(entry.value).toBe(20);
    expect(entry.modScope).toBe("skill");
    expect(entry.skillKey).toBe("operate");
  });
});
