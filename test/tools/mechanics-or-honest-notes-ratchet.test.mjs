// test/tools/mechanics-or-honest-notes-ratchet.test.mjs
//
// wdbc-3x86, часть 1 (храповик): шесть ручных марафонов (wdbc-g53k/j1nc/jw81/
// 5dyh/khpb/pmdu) довели ряд паков до инварианта «каждая запись с текстом
// правила несёт ИЛИ flags.warhammer-dbc.mechanics, ИЛИ нативные effects[],
// ИЛИ честную причину в system.notes» — и ничто до сих пор не мешало
// следующей правке это откатить молча. Этот тест закрепляет инвариант.
//
// СТРОГИЙ список (0 нарушений, проверено вручную построчным аудитом):
// gear/tools (wdbc-5dyh), talents (wdbc-g53k), traits (wdbc-j1nc), chemistry
// (структурные statMods/specialEffects — см. ниже), aeldari-talents/
// aeldari-traits (тот же формат записи, что talents/traits, ноль нарушений
// на момент написания), implants (wdbc-3x86, аудит 235 записей).
//
// ДОЛГ (числовой белый список, «может только уменьшаться» — toBeLessThanOrEqual,
// чтобы будущее улучшение не ломало тест, а откат — ломал):
// armour-histories, divinations, mutations, races — см. комментарии у каждого.
//
// ЯВНО ВНЕ СКОУПА (не входят ни в один список): weapons/armor/vehicle-weapons/
// vehicle-traits/ammunition — их «настоящая» механизация идёт через
// СТРУКТУРНЫЕ поля (properties[]/condMods[]/scatter и т.п. в
// combat/attack-weapon.mjs), не через flags.mechanics/effects[]/notes — тот же
// класс, что chemistry, но каждый по-своему и без единой готовой схемы
// «структурное поле = учтено». Требует отдельного тикета с тем же ручным
// методом (dump→прочитать→решить), не эвристики этого файла.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PACKS_SRC = path.resolve(import.meta.dirname, "../../packs-src");

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith(".json") && e.name !== "_Folder.json") out.push(p);
  }
  return out;
}

/** Текст правила: у talent/trait/mutation — benefit, у остальных строгих/долговых паков — effect. */
function ruleText(doc) {
  const s = doc.system || {};
  if (typeof s.effect === "string" && s.effect.trim()) return s.effect;
  if (typeof s.benefit === "string" && s.benefit.trim()) return s.benefit;
  return "";
}

function hasMechanicsOrEffects(doc) {
  const mech = doc.flags?.["warhammer-dbc"]?.mechanics;
  if (Array.isArray(mech) && mech.length) return true;
  if (Array.isArray(doc.effects) && doc.effects.length) return true;
  return false;
}

function hasHonestNotes(doc) {
  return typeof doc.system?.notes === "string" && doc.system.notes.trim() !== "";
}

/** chemistry: механика зашита в структурные statMods/specialEffects/addiction, не в flags.mechanics. */
function chemistryHasStructuralMech(doc) {
  const s = doc.system || {};
  const nonZero = obj => !!obj && Object.values(obj).some(v =>
    typeof v === "number" ? v !== 0 : typeof v === "boolean" ? v : typeof v === "string" ? v.trim() !== "" : false);
  return nonZero(s.statMods) || nonZero(s.specialEffects) || nonZero(s.afterEffectStatMods) ||
         nonZero(s.afterEffectSpecial) || nonZero(s.addiction) || (Array.isArray(s.poisonVector) && s.poisonVector.length > 0);
}

/** implants: Энергия/Компенсатор/Технофокус (wdbc-9bzv/hgua) — своя структурная директива, не flags.mechanics. */
function implantHasStructuralMech(doc) {
  const s = doc.system || {};
  const qbNonZero = qb => !!qb && Object.values(qb).some(v => v !== 0);
  return qbNonZero(s.energyMax) || qbNonZero(s.compensator) || s.ironFocus === true;
}

/** Офендеры пака: текст правила есть, а механики/effects/честной причины — нет. */
function offendersOf(pack) {
  const dir = path.join(PACKS_SRC, pack);
  if (!fs.existsSync(dir)) return { offenders: [], withText: 0 };
  const offenders = [];
  let withText = 0;
  for (const f of walk(dir)) {
    const doc = JSON.parse(fs.readFileSync(f, "utf8"));
    const txt = ruleText(doc);
    if (!txt) continue;
    withText++;
    if (hasMechanicsOrEffects(doc) || hasHonestNotes(doc)) continue;
    if (pack === "chemistry" && chemistryHasStructuralMech(doc)) continue;
    if (pack === "implants" && implantHasStructuralMech(doc)) continue;
    offenders.push(`${path.relative(PACKS_SRC, f)} (${doc.name}): «${txt.slice(0, 80)}» без mechanics/effects/notes`);
  }
  return { offenders, withText };
}

const STRICT_PACKS = ["gear", "tools", "talents", "traits", "chemistry", "aeldari-talents", "aeldari-traits", "implants"];

describe("храповик: текст правила несёт механику или честную причину (wdbc-3x86)", () => {
  it("список строгих паков не выродился в пустышку (≥5 паков, как того требует тикет)", () => {
    expect(STRICT_PACKS.length).toBeGreaterThanOrEqual(5);
  });

  for (const pack of STRICT_PACKS) {
    it(`${pack}: 0 нарушений`, () => {
      const { offenders, withText } = offendersOf(pack);
      expect(withText).toBeGreaterThan(0); // пак реально существует и содержит текст — иначе проверка пуста
      expect(offenders).toEqual([]);
    });
  }

  describe("долг неаудированных паков — числа зафиксированы, могут только уменьшаться", () => {
    // armour-histories: 23/25 — НЕ юный долг. По wdbc-sg57 эти Item-документы —
    // мёртвые данные: единственная читаемая программой истина — хардкод
    // PA_TABLES (module/constants/power-armour-lore.mjs), эти записи UI никогда
    // не читает. Правильное действие — пометить/удалить их, не механизировать;
    // до этого числа зафиксированы как есть.
    const DEBT = { "armour-histories": 23, divinations: 6, mutations: 7, races: 1 };

    for (const [pack, max] of Object.entries(DEBT)) {
      it(`${pack}: не больше ${max} нарушений`, () => {
        const { offenders } = offendersOf(pack);
        expect(offenders.length).toBeLessThanOrEqual(max);
      });
    }
  });
});
