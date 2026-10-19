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

// Четыре болезни Книги Болезней (стр. 4, 26, 28, 29 PDF) с тем же правилом, что у
// Гнили Нургла. Книга: «не может восстанавливать урон в T [и W] и восстанавливает
// урон во все остальные Характеристики раз в 7 часов» (Трескающиеся Кости — только
// блок T, без замедления остальных).
describe("болезни Книги Болезней (пак)", () => {
  const all = ["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel", "inf"];
  const check = (folder, id, name, blocked, slowed) => {
    const doc = packDocById(`packs-src/diseases/${folder}`, id);
    expect(doc.name).toBe(name);
    const pol = policyOf([asItem(doc)]);
    for (const k of all) {
      expect(pol[k].blocked, `${name}: ${k} blocked`).toBe(blocked.includes(k));
      expect(pol[k].hours, `${name}: ${k} hours`).toBe(slowed.includes(k) ? 7 : 1);
    }
  };
  const rest = (...skip) => all.filter(k => !skip.includes(k));

  it("Проклятие Гнили: блок T, остальные раз в 7 ч", () => {
    check("Обычные_болезни", "zH0XsBb4WDBekFKx", "Проклятие Гнили", ["t"], rest("t"));
  });
  it("Трескающиеся Кости: блок T, остальные как обычно", () => {
    check("Варп_болезни", "sE6WQTWSblQPvPeC", "Трескающиеся Кости", ["t"], []);
  });
  it("Хрупкая Кома: блок T и W, остальные раз в 7 ч", () => {
    check("Варп_болезни", "QxvPT1POm8Kp2moG", "Хрупкая Кома", ["t", "wp"], rest("t", "wp"));
  });
  it("Цветение: блок T, остальные раз в 7 ч", () => {
    check("Варп_болезни", "llDq83pk2B0wIGBY", "Цветение", ["t"], rest("t"));
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
