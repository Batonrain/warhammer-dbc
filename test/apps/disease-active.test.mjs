// test/apps/disease-active.test.mjs
//
// wdbc-dbveg, решение владельца 25.10.2026: «болезнь действует только когда
// включена (system.active)». До правки isItemActive для типа disease отдавал
// true независимо от system.active, и пять болезней с записью charRecovery
// (Гниль Нургла, Трескающиеся Кости, Хрупкая Кома, Цветение, Проклятие Гнили)
// блокировали восстановление T, даже если заражение отбито и болезнь выключена.
//
// Данные — настоящие JSON packs-src/diseases. Иммунитет Метки Нургла
// (rules/disease-immunity.mjs) гасит и ВКЛЮЧЁННУЮ болезнь — порядок проверок в
// isItemActive не должен это сломать.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import { isItemActive } from "../../module/apps/effects.mjs";
import { actorRecoveryPolicy } from "../../module/rules/char-loss.mjs";

const SYS = "warhammer-dbc";
const enName = d => d.name.split("/")[0].trim();

const DISEASES = allPackDocuments("diseases").map(d => d.doc);
const TRAITS = allPackDocuments("traits").map(d => d.doc);
const NURGLE = TRAITS.find(d => enName(d) === "Mark of Nurgle");

const withRecovery = DISEASES.filter(d =>
  (d.flags?.[SYS]?.mechanics ?? []).some(g => g.entries.some(e => e.kind === "charRecovery")));

/** Копия документа пака на акторе (parent, getFlag, плоский flags — как у живого). */
function owned(doc, actor, id, systemPatch = {}) {
  const item = {
    id, name: doc.name, type: doc.type, system: { ...structuredClone(doc.system ?? {}), ...systemPatch },
    flags: structuredClone(doc.flags ?? {}), parent: actor
  };
  item.getFlag = (s, k) => item.flags?.[s]?.[k];
  return item;
}
function actorWith(entries) {
  const actor = { system: { characteristics: {} }, items: [] };
  entries.forEach(([doc, patch], i) => actor.items.push(owned(doc, actor, `i${i}`, patch)));
  return actor;
}
const slowed = policy => Object.values(policy).some(p => p.blocked || p.hours > 1);

describe("isItemActive: болезнь действует только когда включена", () => {
  it("данные: в паке пять болезней с charRecovery, и все выданы выключенными", () => {
    expect(withRecovery.length).toBeGreaterThanOrEqual(5);
    for (const d of withRecovery) expect(d.system.active, enName(d)).toBe(false);
  }, PACK_SCAN_TIMEOUT);

  it("выключенная болезнь неактивна, включённая — активна (любая болезнь пака)", () => {
    for (const d of DISEASES) {
      const off = actorWith([[d, { active: false }]]).items[0];
      const on = actorWith([[d, { active: true }]]).items[0];
      expect(isItemActive(off), `${enName(d)} выкл.`).toBe(false);
      expect(isItemActive(on), `${enName(d)} вкл.`).toBe(true);
    }
  }, PACK_SCAN_TIMEOUT);

  it("болезнь, выданная как есть из пака (active:false), записей Конструктора не даёт", () => {
    for (const d of withRecovery) {
      expect(slowed(actorRecoveryPolicy(actorWith([[d, {}]]))), enName(d)).toBe(false);
    }
  }, PACK_SCAN_TIMEOUT);

  it("включили — T/Хар. не восстанавливаются; выключили (заражение отбито) — снова как у здорового", () => {
    for (const d of withRecovery) {
      expect(slowed(actorRecoveryPolicy(actorWith([[d, { active: true }]]))), `${enName(d)} вкл.`).toBe(true);
      expect(slowed(actorRecoveryPolicy(actorWith([[d, { active: false }]]))), `${enName(d)} выкл.`).toBe(false);
    }
  }, PACK_SCAN_TIMEOUT);

  it("Метка Нургла гасит и включённую болезнь; потеряли Метку — болезнь снова действует", () => {
    const rot = withRecovery[0];
    const actor = actorWith([[rot, { active: true }], [NURGLE, {}]]);
    const [sick, mark] = actor.items;
    expect(isItemActive(sick)).toBe(false);
    expect(isItemActive(mark)).toBe(true);
    actor.items.splice(actor.items.indexOf(mark), 1);
    expect(isItemActive(sick)).toBe(true);
  }, PACK_SCAN_TIMEOUT);

  it("другие типы предметов тумблер system.active болезни не касается", () => {
    const rot = withRecovery[0];
    const actor = { items: [] };
    const trait = owned({ ...structuredClone(rot), type: "trait" }, actor, "t1", { active: false });
    expect(isItemActive(trait)).toBe(true);
  }, PACK_SCAN_TIMEOUT);
});
