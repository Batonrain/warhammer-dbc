// test/rules/recovery-content.test.mjs
//
// Болезни и зависимости держат урон в Характеристики (task-56da). Данные —
// настоящие записи packs-src (см. память «форма тестовой фикстуры»).

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { rulesFromItemMechanics, addictionRecoveryRules } from "../../module/rules/item-rules.mjs";
import { recoveryPolicy } from "../../module/rules/char-loss.mjs";
import { packDocById } from "../support/pack-doc.mjs";

const asItem = j => ({ ...j, id: j._id, getFlag: (s, k) => j.flags?.[s]?.[k] });
const policyOf = items => recoveryPolicy(rulesFromItemMechanics(items).flatMap(r => r.effects.map(e => ({ ...e, label: r.label }))));

describe("Гниль Нургла (пак)", () => {
  it("урон в T не восстанавливается, остальные — раз в 7 ч", () => {
    const rot = asItem(packDocById("packs-src/diseases/Варп_болезни", "hfck3ePSodX4RmUD"));
    const pol = policyOf([rot]);
    expect(pol.t.blocked).toBe(true);
    expect(pol.wp).toMatchObject({ blocked: false, hours: 7 });
    expect(pol.s.hours).toBe(7);
  });
});

describe("зависимость от препарата (пак)", () => {
  const slaught = packDocById("packs-src/chemistry/Наркотики", "jsJSYQUePrltHspj");
  it("без зависимости — ничего не держит", () => {
    expect(addictionRecoveryRules([asItem(slaught)])).toEqual([]);
  });
  it("с зависимостью — блок I, P, W и F", () => {
    const addicted = asItem({ ...slaught, system: { ...slaught.system, addiction: { ...slaught.system.addiction, isAddicted: true } } });
    const pol = recoveryPolicy(addictionRecoveryRules([addicted]).flatMap(r => r.effects));
    expect(["int", "per", "wp", "fel"].every(k => pol[k].blocked)).toBe(true);
    expect(pol.t.blocked).toBe(false);
  });
});
