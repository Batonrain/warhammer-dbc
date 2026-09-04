// test/combat/counter-attack.test.mjs
//
// Встречная атака (wdbc-2wy7, kind:"counterAttack" Конструктора) — Шипы и
// Цепные Бандольеры: противник, промахнувшийся рукопашной по владельцу или
// проведший против него безоружную атаку/приём «Захват», получает попадание
// в ответ. module/combat/counter-attack.mjs — чистый триггер + живой запрос
// Механики (никаких Foundry-документов в самом триггере), плюс сборка секции
// карточки (роллы через globalThis.Roll, как и весь остальной module/combat/).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import {
  counterAttackTriggers, counterAttackEntriesForActor, activeCounterAttackEntries,
  counterAttackDamageFormula, counterAttackSectionHtml
} from "../../module/combat/counter-attack.mjs";

afterEach(() => resetCaptured());

/** Предмет-armorMod с записью Механики kind:"counterAttack" (Шипы-подобный). */
function ccItem({
  id = "spikes", name = "Шипы", installedOn = "host-1", activatable = false, active = false,
  ccDamage = "1d5+S.b", ccPen = 2, ccDamageType = "rending", ccTearing = false,
  ccOnMiss = true, ccOnUnarmedOrGrapple = true, ccLabel = "", when = undefined
} = {}) {
  const entry = { id: "e1", kind: "counterAttack", ccDamage, ccPen, ccDamageType, ccTearing, ccOnMiss, ccOnUnarmedOrGrapple, ccLabel, when };
  const flags = { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [entry] }] } };
  return {
    id, name, type: "armorMod",
    system: { installedOn, activatable, active },
    flags,
    getFlag: (scope, key) => flags[scope]?.[key]
  };
}

function wearer({ items = [], s = 40, uuid = "Actor.wearer" } = {}) {
  return {
    id: "wearer-1", name: "Владелец брони", uuid,
    system: { characteristics: { s: { total: s, bonus: Math.floor(s / 10) } }, corruptionBonus: 0 },
    items
  };
}

describe("counterAttackTriggers", () => {
  it("стрелковое (не рукопашное) — оба триггера ложны независимо от исхода/приёма", () => {
    expect(counterAttackTriggers({ isMelee: false, hit: false, technique: "grapple" }))
      .toEqual({ onMiss: false, onUnarmedOrGrapple: false });
    expect(counterAttackTriggers({ isMelee: false, hit: true, meleeCategory: "Кулаки" }))
      .toEqual({ onMiss: false, onUnarmedOrGrapple: false });
  });

  it("рукопашная, промах — onMiss true", () => {
    expect(counterAttackTriggers({ isMelee: true, hit: false }).onMiss).toBe(true);
  });

  it("рукопашная, попадание — onMiss false (промаха не было)", () => {
    expect(counterAttackTriggers({ isMelee: true, hit: true }).onMiss).toBe(false);
  });

  it("приём «Захват» — onUnarmedOrGrapple true независимо от попадания", () => {
    expect(counterAttackTriggers({ isMelee: true, hit: true, technique: "grapple" }).onUnarmedOrGrapple).toBe(true);
    expect(counterAttackTriggers({ isMelee: true, hit: false, technique: "grapple" }).onUnarmedOrGrapple).toBe(true);
  });

  it("категория «Кулаки» (безоружная атака) — onUnarmedOrGrapple true", () => {
    expect(counterAttackTriggers({ isMelee: true, hit: true, meleeCategory: "Кулаки" }).onUnarmedOrGrapple).toBe(true);
  });

  it("обычное оружие, не Захват — onUnarmedOrGrapple false", () => {
    expect(counterAttackTriggers({ isMelee: true, hit: true, technique: "standard", meleeCategory: "Меч" }).onUnarmedOrGrapple).toBe(false);
  });

  it("мутация: любой третий признак технику/категорию не путает с промахом", () => {
    // Попадание обычным мечом — ни один из двух триггеров не должен сработать.
    const t = counterAttackTriggers({ isMelee: true, hit: true, technique: "standard", meleeCategory: "Меч" });
    expect(t).toEqual({ onMiss: false, onUnarmedOrGrapple: false });
  });
});

describe("counterAttackEntriesForActor", () => {
  it("активный armorMod с записью — найден", () => {
    const w = wearer({ items: [ccItem()] });
    const found = counterAttackEntriesForActor(w);
    expect(found).toHaveLength(1);
    expect(found[0].entry.kind).toBe("counterAttack");
    expect(found[0].item.name).toBe("Шипы");
  });

  it("не установлен (installedOn пуст) — не активен, не находится", () => {
    const w = wearer({ items: [ccItem({ installedOn: "" })] });
    expect(counterAttackEntriesForActor(w)).toHaveLength(0);
  });

  it("включаемый и выключенный (activatable+!active) — не активен", () => {
    const w = wearer({ items: [ccItem({ activatable: true, active: false })] });
    expect(counterAttackEntriesForActor(w)).toHaveLength(0);
  });

  it("включаемый и включённый — активен", () => {
    const w = wearer({ items: [ccItem({ activatable: true, active: true })] });
    expect(counterAttackEntriesForActor(w)).toHaveLength(1);
  });

  it("группа «ИЛИ» — живой запрос её не читает (как reroll/testMod)", () => {
    const item = ccItem();
    item.flags["warhammer-dbc"].mechanics[0].operator = "OR";
    const w = wearer({ items: [item] });
    expect(counterAttackEntriesForActor(w)).toHaveLength(0);
  });

  it("без актора — пустой список, не падает", () => {
    expect(counterAttackEntriesForActor(null)).toEqual([]);
  });

  it("запись другого kind — игнорируется", () => {
    const item = ccItem();
    item.flags["warhammer-dbc"].mechanics[0].entries[0].kind = "testMod";
    const w = wearer({ items: [item] });
    expect(counterAttackEntriesForActor(w)).toHaveLength(0);
  });
});

describe("activeCounterAttackEntries — фильтр по триггеру записи", () => {
  it("оба условия запрошены — совпадает по ЛЮБОМУ подходящему полю записи", () => {
    const w = wearer({ items: [ccItem({ ccOnMiss: true, ccOnUnarmedOrGrapple: false })] });
    expect(activeCounterAttackEntries(w, { onMiss: true, onUnarmedOrGrapple: false })).toHaveLength(1);
    expect(activeCounterAttackEntries(w, { onMiss: false, onUnarmedOrGrapple: true })).toHaveLength(0);
  });

  it("запись отключила промах галочкой — атака-промах её не задевает", () => {
    const w = wearer({ items: [ccItem({ ccOnMiss: false, ccOnUnarmedOrGrapple: true })] });
    expect(activeCounterAttackEntries(w, { onMiss: true, onUnarmedOrGrapple: false })).toHaveLength(0);
    expect(activeCounterAttackEntries(w, { onMiss: false, onUnarmedOrGrapple: true })).toHaveLength(1);
  });

  it("ни один триггер не запрошен — пусто, не сканирует акторов зря", () => {
    const w = wearer({ items: [ccItem()] });
    expect(activeCounterAttackEntries(w, { onMiss: false, onUnarmedOrGrapple: false })).toEqual([]);
  });
});

describe("counterAttackDamageFormula", () => {
  it("подставляет S.b в формулу (тот же resolveCharFormula, что у оружия)", () => {
    const w = wearer({ s: 40 }); // S.b = 4
    const entry = { ccDamage: "1d5+S.b", ccTearing: false };
    expect(counterAttackDamageFormula(entry, w)).toBe("1d5+4");
  });

  it("Рвущее — тот же движок applyDamageDiceMods, что у обычного оружия", () => {
    const w = wearer({ s: 40 });
    const entry = { ccDamage: "1d10+2+S.b", ccTearing: true };
    expect(counterAttackDamageFormula(entry, w)).toBe("2d10kh1+2+4");
  });

  it("без владельца (защита от падения) — формула без подстановки характеристик", () => {
    const entry = { ccDamage: "1d5", ccTearing: false };
    expect(counterAttackDamageFormula(entry, null)).toBe("1d5");
  });
});

describe("counterAttackSectionHtml", () => {
  it("промах Шипов: считает урон (1d5+S.b), кнопка бьёт напрямую по known-атакующему, только Уклонение", async () => {
    const w = wearer({ items: [ccItem()], s: 40 }); // S.b=4
    const attacker = { uuid: "Actor.attacker1", name: "Хаосит" };
    captured.dice = [3]; // 1d5 → 3, +4 (S.b) = 7
    const { html, rolls } = await counterAttackSectionHtml(w, attacker, { onMiss: true, onUnarmedOrGrapple: false });

    expect(rolls).toHaveLength(1);
    expect(html).toContain('data-force-target="Actor.attacker1"');
    expect(html).toContain('data-damage="7"');
    expect(html).toContain('data-penetration="2"');
    expect(html).toContain('data-damage-type="rending"');
    expect(html).toContain("wh-dodge-btn");
    expect(html).not.toContain("wh-parry-btn");
    expect(html).toContain("Применить урон: 7 → Хаосит");
  });

  it("Рвущее у Цепных Бандольеров — доп. куб учтён в итоговом уроне", async () => {
    const item = ccItem({
      name: "Цепные Бандольеры", ccDamage: "1d10+2+S.b", ccPen: 2, ccTearing: true, ccLabel: "Цепные Бандольеры"
    });
    const w = wearer({ items: [item], s: 40 }); // S.b=4
    const attacker = { uuid: "Actor.attacker2", name: "Еретик" };
    // Рвущее: 2 куба d10, оставить лучший — 7 и 3, оставляем 7. +2+4=13.
    captured.dice = [7, 3];
    const { html } = await counterAttackSectionHtml(w, attacker, { onMiss: true, onUnarmedOrGrapple: false });
    expect(html).toContain('data-damage="13"');
    expect(html).toContain("Цепные Бандольеры");
  });

  it("триггер не совпал — пустая секция, роллов нет", async () => {
    const w = wearer({ items: [ccItem({ ccOnMiss: true, ccOnUnarmedOrGrapple: false })] });
    const attacker = { uuid: "Actor.attacker3", name: "Кто-то" };
    const { html, rolls } = await counterAttackSectionHtml(w, attacker, { onMiss: false, onUnarmedOrGrapple: true });
    expect(html).toBe("");
    expect(rolls).toEqual([]);
  });

  it("несколько активных источников одновременно — по секции на каждый", async () => {
    const w = wearer({
      items: [
        ccItem({ id: "spikes", name: "Шипы", ccDamage: "1", ccPen: 1 }),
        ccItem({ id: "bandolier", name: "Цепные Бандольеры", ccDamage: "2", ccPen: 2 })
      ]
    });
    const attacker = { uuid: "Actor.attacker4", name: "Двойная Цель" };
    const { html, rolls } = await counterAttackSectionHtml(w, attacker, { onMiss: true, onUnarmedOrGrapple: false });
    expect(rolls).toHaveLength(2);
    expect(html).toContain("Шипы");
    expect(html).toContain("Цепные Бандольеры");
  });
});
