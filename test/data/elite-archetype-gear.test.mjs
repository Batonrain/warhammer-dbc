// test/data/elite-archetype-gear.test.mjs
//
// Снаряжение из «Преимуществ» Элитного архетипа выдаётся по ИМЕНИ из текста
// system.gear (apps/gear-grant.mjs::planEliteGear): что нашлось в компендиумах —
// ложится на лист, ненайденное остаётся шёпотом ГМу «не найдено в
// компендиумах». Три архетипа ходили с шёпотом вместо предмета: у Моритата
// не было «Moritat Power Pack» вовсе (сверка Главы 3, 03.11.2026).
//
// Тест ищет каждое именное снаряжение этих архетипов в паках тем же ключом,
// что и выдача (namedLookupKeys / normName по каждой половине двуязычного
// имени). Два исключения законны и закрыты списком ниже: новая строка без
// предмета роняет тест, а исчезнувшая из исключений причина — тоже.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { planEliteGear, equipmentCoverage } from "../../module/apps/gear-grant.mjs";
import { packDocById, packDocByFileHint } from "../support/pack-doc.mjs";
import { ELITE_ARCHETYPES } from "../../module/constants/elite-archetypes.mjs";
import { splitGearTopLevel, gearChoiceOptions, parseGearEntry, namedLookupKeys, normName, compactKey } from "../../module/rules/creation-gear.mjs";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";

/** Паки, в которых выдача ищет снаряжение (apps/gear-grant.mjs::GEAR_INDEX_PACKS). */
const GEAR_PACKS = ["weapons", "armor", "gear", "ammunition", "shields", "tools", "armour-systems",
  "traits", "implants", "weapon-mods", "armor-mods"];

/** Архетипы, чьё именное снаряжение проверяется (русские имена записей). */
const CHECKED = ["Чемпион-Терминатор", "Лорд-Дискордант", "Моритат"];

/**
 * Именное снаряжение, которого в паках нет и которое выдать нельзя — и почему.
 * Закрытый список. «Terminator Armour» из него убрана 03.11.2026: книга не
 * называет Мк, владелец решил — выбор из четырёх (запись «Снаряжение» с
 * equipMode:"choice", см. тест ниже).
 */
const UNRESOLVED = {
  "Hell Stalker": "оболочка-машина: профиль только в книге «Машины» (стр. 85), машины через выдачу снаряжения не выдаются (gear-grant ищет предметы, не акторов)"
};

const packKeys = () => {
  const keys = new Set();
  for (const pack of GEAR_PACKS) {
    for (const { doc } of allPackDocuments(pack)) {
      for (const part of String(doc.name).split("/")) {
        const k0 = normName(part);
        if (!k0) continue;
        keys.add(k0); keys.add(compactKey(k0));
      }
    }
  }
  return keys;
};

// Выбор «А или Б» выдача (planEliteGear) не ищет по имени — его предлагает запись
// «Снаряжение» (Terminator Armour), поэтому и тест его пропускает.
const namedSpecs = (gear) => splitGearTopLevel(String(gear ?? ""))
  .filter(e => gearChoiceOptions(e).length <= 1)
  .flatMap(e => parseGearEntry(e))
  .filter(s => s.kind === "named");

describe("снаряжение Чемпиона-терминатора, Лорда-Дискорданта и Моритата находится в компендиумах", () => {
  const keys = packKeys();
  const resolves = (spec) => namedLookupKeys(spec).some(k => keys.has(k));
  const rows = CHECKED.map(name => ({ name, arch: ELITE_ARCHETYPES.find(a => String(a.name).includes(name)) }));

  it("архетипы найдены в ELITE_ARCHETYPES и у них есть снаряжение", () => {
    for (const { name, arch } of rows) {
      expect(arch, `нет архетипа ${name}`).toBeTruthy();
      expect(String(arch.gear || "").trim(), `у ${name} пусто gear`).not.toBe("");
    }
  });

  it("каждое именное снаряжение есть в паках, кроме закрытого списка исключений", () => {
    const missing = [];
    for (const { name, arch } of rows) {
      for (const spec of namedSpecs(arch.gear)) {
        if (spec.name in UNRESOLVED) continue;
        if (!resolves(spec)) missing.push(`${name}: «${spec.name}» не найдено в компендиумах`);
      }
    }
    expect(missing, missing.join("\n")).toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  it("исключение без предмета всё ещё без предмета", () => {
    const stale = [];
    for (const { arch } of rows) {
      for (const spec of namedSpecs(arch.gear)) {
        if (spec.name in UNRESOLVED && resolves(spec)) stale.push(spec.name);
      }
    }
    expect(stale, "у снаряжения появился предмет в паке — уберите его из UNRESOLVED").toEqual([]);
  }, PACK_SCAN_TIMEOUT);
});

describe("Terminator Armour у Чемпиона-терминатора — выбор из четырёх Мк", () => {
  const ARMOUR_DIR = "packs-src/armor/Астартес/Броня/Терминаторская";
  const rec = () => packDocByFileHint("packs-src/elite-archetypes/Космодесантник/Terminator_Champion___Чемпион_Терминатор_tVTuyAs6qcSvAYJ3.json");
  const choiceEntry = (doc) => doc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries)
    .find(e => e.kind === "equipment" && e.equipMode === "choice");

  it("запись «Снаряжение»-выбор закрывает список четырьмя Мк I–IV, без Эгиды Серых Рыцарей", () => {
    const e = choiceEntry(rec());
    expect(e, "у Чемпиона нет записи Снаряжение-выбор").toBeTruthy();
    expect(e.equipCategoryPack).toBe("armor");
    expect(e.equipBudgetValue).toBe(1);
    const names = (e.equipChoiceIds ?? []).map(id => packDocById(ARMOUR_DIR, id).name);
    expect(names.sort()).toEqual([
      "Mk II Cataphractii / Мк II Катафракт",
      "Mk III Indominus / Мк III Индомитус",
      "Mk IV Tartaros / Мк IV Тартарос",
      "Mk I Saturnyne / Мк I Сатурнин"
    ].sort());
    expect(names.some(n => /Aegis|Эгида/i.test(n))).toBe(false);
  });

  it("текст снаряжения не даёт шёпота «не найдено»: выбор покрыт записью, дубля нет", () => {
    const doc = rec();
    expect(equipmentCoverage(doc).anyChoice).toBe(true);
    const plan = planEliteGear(doc.system.gear, { find: () => null, coverNonNamed: true });
    expect(plan.manual, plan.manual.join("; ")).toEqual([]);
    expect(plan.grant).toEqual([]);
  });

  it("константа ELITE_ARCHETYPES несёт тот же текст, что запись пака", () => {
    const arch = ELITE_ARCHETYPES.find(a => String(a.name).includes("Чемпион-Терминатор"));
    expect(arch.gear).toBe(rec().system.gear);
  });
});
