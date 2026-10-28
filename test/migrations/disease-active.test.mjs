// test/migrations/disease-active.test.mjs
//
// wdbc-dbveg. isItemActive для болезни стал отдавать system.active (решение
// владельца 25.10.2026), а раньше отдавал true всегда. У уже выданных копий
// болезней с записями Конструктора поле active стоит выключенным (так болезни
// выдаются из пака) — без одноразового прохода «active=true» текущие больные
// потеряли бы эффект (charRecovery). Проход трогает ТОЛЬКО такие копии.
// Данные — настоящие JSON packs-src/diseases.

import { describe, it, expect } from "vitest";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import { diseaseActivePatch, diseaseActiveUpdates } from "../../module/migrations/disease-active.mjs";

const SYS = "warhammer-dbc";
const enName = d => d.name.split("/")[0].trim();
const DISEASES = allPackDocuments("diseases").map(d => d.doc);
const hasEntries = d => (d.flags?.[SYS]?.mechanics ?? []).some(g => (g.entries ?? []).length);
const WITH_MECH = DISEASES.filter(hasEntries);
const WITHOUT_MECH = DISEASES.filter(d => !hasEntries(d));

const PATCH = { "system.active": true, "flags.warhammer-dbc.diseaseActiveMigrated": true };

/** Копия на акторе «как выдали из пака»: снимок с active:false. */
const copy = (doc, id = "d1", patch = {}) => ({
  id, type: doc.type, name: doc.name,
  system: { ...structuredClone(doc.system), ...patch },
  flags: structuredClone(doc.flags ?? {}), effects: []
});
const apply = (item, patch) => {
  for (const [path, v] of Object.entries(patch ?? {})) {
    const keys = path.split(".");
    let o = item;
    for (const k of keys.slice(0, -1)) o = (o[k] ??= {});
    o[keys.at(-1)] = v;
  }
  return item;
};

describe("проход «active=true» для выданных болезней с записями Конструктора", () => {
  it("в паке пять болезней с механикой (Гниль Нургла, Трескающиеся Кости, Хрупкая Кома, Цветение, Проклятие Гнили)", () => {
    expect(WITH_MECH.length).toBe(5);
    expect(WITH_MECH.map(enName)).toContain("Nurgle's Rot");
  }, PACK_SCAN_TIMEOUT);

  it("копия с механикой и выключенной болезнью получает active:true и метку «проход был»; идемпотентно", () => {
    for (const d of WITH_MECH) {
      const item = copy(d);
      expect(item.system.active, enName(d)).toBe(false);
      expect(diseaseActivePatch(item), enName(d)).toEqual(PATCH);
      apply(item, diseaseActivePatch(item));
      expect(item.system.active).toBe(true);
      expect(diseaseActivePatch(item), `${enName(d)} повторно`).toBeNull();
    }
  }, PACK_SCAN_TIMEOUT);

  // Повтор при частичном сбое другого актора (runMigrationGate не ставит ключ при
  // failed) не должен включать заново то, что ГМ выключил после первого прохода.
  it("копия, уже прошедшая проход, и выключенная ГМом после — не включается повторно", () => {
    const item = copy(WITH_MECH[0]);
    apply(item, diseaseActivePatch(item));
    apply(item, { "system.active": false }); // ГМ выключил: заражение отбито
    expect(diseaseActivePatch(item)).toBeNull();
  }, PACK_SCAN_TIMEOUT);

  it("болезнь без записей Конструктора не трогается (включать нечего)", () => {
    expect(WITHOUT_MECH.length).toBeGreaterThan(0);
    for (const d of WITHOUT_MECH) expect(diseaseActivePatch(copy(d)), enName(d)).toBeNull();
  }, PACK_SCAN_TIMEOUT);

  it("уже включённая болезнь — не трогается", () => {
    expect(diseaseActivePatch(copy(WITH_MECH[0], "d1", { active: true }))).toBeNull();
  }, PACK_SCAN_TIMEOUT);

  it("группа механики без записей — записей нет, болезнь не включается", () => {
    const item = copy(WITH_MECH[0]);
    item.flags[SYS].mechanics = [{ id: "g", operator: "AND", entries: [] }];
    expect(diseaseActivePatch(item)).toBeNull();
  }, PACK_SCAN_TIMEOUT);

  it("самодельная болезнь с ActiveEffect на предмете тоже не теряет эффект", () => {
    const item = copy(WITHOUT_MECH[0]);
    item.effects = [{ id: "e1" }];
    expect(diseaseActivePatch(item)).toEqual(PATCH);
  }, PACK_SCAN_TIMEOUT);

  it("не-болезнь с такими же флагами не трогается", () => {
    const item = copy(WITH_MECH[0]);
    item.type = "trait";
    expect(diseaseActivePatch(item)).toBeNull();
    expect(diseaseActivePatch(null)).toBeNull();
  }, PACK_SCAN_TIMEOUT);

  it("diseaseActiveUpdates: набор предметов актора → обновления только для подходящих", () => {
    const items = [copy(WITH_MECH[0], "a"), copy(WITHOUT_MECH[0], "b"), copy(WITH_MECH[1], "c", { active: true })];
    expect(diseaseActiveUpdates(items)).toEqual([{ _id: "a", ...PATCH }]);
    expect(diseaseActiveUpdates(undefined)).toEqual([]);
  }, PACK_SCAN_TIMEOUT);
});
