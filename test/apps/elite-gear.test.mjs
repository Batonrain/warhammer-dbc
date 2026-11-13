// test/apps/elite-gear.test.mjs
//
// Снаряжение Элитного Архетипа при покупке (стр. 24: «стартовое снаряжение от
// Расы, Архетипа и возможных Элитных Архетипов»). Проверяется разбор текста:
// что выдаётся само, что уже на листе, что остаётся ГМу. Создание предметов и
// шёпот проверяют живьём.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { planEliteGear, hasEquipmentMechanics } from "../../module/apps/gear-grant.mjs";

/** Компендиум из двух имён: Ghostplate Armor и Shrieker. */
const find = spec => /ghostplate|shrieker/i.test(spec.name ?? "")
  ? { pack: {}, id: spec.name, name: spec.name } : null;

describe("planEliteGear", () => {
  it("именной предмет, найденный в компендиуме, выдаётся сам", () => {
    const plan = planEliteGear("Ghostplate Armor", { find });
    expect(plan.grant.map(g => g.spec.name)).toEqual(["Ghostplate Armor"]);
    expect(plan.manual).toEqual([]);
  });

  it("выбор «или» остаётся игроку — Обозреватель посреди покупки не открывается", () => {
    const plan = planEliteGear("Ghostplate Armor; Splinter Cannon или Shredder, или Blaster", { find });
    expect(plan.grant.map(g => g.spec.name)).toEqual(["Ghostplate Armor"]);
    expect(plan.manual).toHaveLength(1);
    expect(plan.manual[0]).toContain("выбрать:");
    expect(plan.manual[0]).toContain("Splinter Cannon");
  });

  it("категория «до R3» — тоже ГМу: выдать само нельзя", () => {
    const plan = planEliteGear("Power Weapon (Good.Q, до R3)", { find });
    expect(plan.grant).toEqual([]);
    expect(plan.manual).toHaveLength(1);
  });

  it("то, что уже лежит на листе, второй раз не выдаётся", () => {
    const plan = planEliteGear("Shrieker; Ghostplate Armor", { find, owned: new Set(["shrieker"]) });
    expect(plan.skipped).toEqual(["Shrieker"]);
    expect(plan.grant.map(g => g.spec.name)).toEqual(["Ghostplate Armor"]);
  });

  it("имя не найдено — строка для ГМа, а не молчаливая потеря", () => {
    const plan = planEliteGear("Unknown Blaster Of Doom", { find });
    expect(plan.grant).toEqual([]);
    expect(plan.manual[0]).toContain("не найдено в компендиумах");
  });

  it("пустой текст — нечего выдавать", () => {
    for (const text of ["", "   ", undefined, null]) {
      expect(planEliteGear(text, { find })).toEqual({ grant: [], skipped: [], manual: [] });
    }
  });
});

describe("hasEquipmentMechanics", () => {
  const withMech = entries => ({ flags: { "warhammer-dbc": { mechanics: [{ entries }] } } });

  it("запись Конструктора «Снаряжение» — Механика выдаёт сама, текст не дублируем", () => {
    expect(hasEquipmentMechanics(withMech([{ kind: "equipment" }]))).toBe(true);
  });

  it("другие записи Конструктора и их отсутствие — текст выдаём", () => {
    expect(hasEquipmentMechanics(withMech([{ kind: "trait" }]))).toBe(false);
    expect(hasEquipmentMechanics({})).toBe(false);
    expect(hasEquipmentMechanics(null)).toBe(false);
  });
});

// Sahara task-e21e: grantEliteGear целиком пропускал текст снаряжения, если у
// архетипа есть ХОТЬ ОДНА запись Конструктора «Снаряжение». Где запись заведена
// на часть предметов, остальное терялось молча (Инкуб: Klaive — записью,
// «Incubus Warsuit» — только текстом). Теперь выдаётся то, что записями НЕ
// покрыто; покрытое Механикой второй раз не даётся.
import { equipmentCoverage } from "../../module/apps/gear-grant.mjs";
import { packDocById } from "../support/pack-doc.mjs";

describe("planEliteGear + покрытие записями Конструктора", () => {
  const findAny = spec => spec.name ? { pack: {}, id: spec.name, name: spec.name } : null;

  it("именной предмет, покрытый записью, не выдаётся второй раз", () => {
    const plan = planEliteGear("Plague Knife, 7 Blight Grenades",
      { find: findAny, covered: new Set(["plague knife", "blight"]) });
    expect(plan.grant).toEqual([]);
    expect(plan.skipped).toHaveLength(2);
    expect(plan.manual).toEqual([]);
  });

  it("не покрытое записью выдаётся по тексту", () => {
    const plan = planEliteGear("Klaive, Incubus Warsuit",
      { find: findAny, covered: new Set(["klaive"]) });
    expect(plan.grant.map(g => g.spec.name)).toEqual(["Incubus Warsuit"]);
  });

  it("категория и выбор «или» молчат, если их покрывает запись-выбор; без неё — ГМу, как раньше", () => {
    const text = "Omnissiah Axe, 4 Мехадендрита (до R2)";
    const covered = new Set(["omnissiah axe"]);
    const withChoice = planEliteGear(text, { find: findAny, covered, coverNonNamed: true });
    expect(withChoice.manual).toEqual([]);
    expect(withChoice.grant).toEqual([]);
    const without = planEliteGear(text, { find: findAny, covered });
    expect(without.manual).toHaveLength(1);
  });

  it("без покрытия поведение прежнее", () => {
    const plan = planEliteGear("Ghostplate Armor", { find });
    expect(plan.grant.map(g => g.spec.name)).toEqual(["Ghostplate Armor"]);
  });
});

describe("equipmentCoverage", () => {
  const withMech = entries => ({ flags: { "warhammer-dbc": { mechanics: [{ entries }] } } });

  it("имена прямых записей — по каждой половине двуязычного имени; выбор и категория — отдельным признаком", () => {
    const cov = equipmentCoverage(withMech([
      { kind: "equipment", equipMode: "direct", equipSourceName: "Plague Knife / Чумной Нож" },
      { kind: "equipment", equipMode: "choice", equipSourceName: "" },
      { kind: "trait" }
    ]));
    expect([...cov.names].sort()).toEqual(["plague knife", "чумной нож"].sort());
    expect(cov.anyChoice).toBe(true);
  });

  it("без записей Снаряжение — пусто", () => {
    expect(equipmentCoverage(withMech([{ kind: "trait" }]))).toEqual({ names: new Set(), anyChoice: false });
    expect(equipmentCoverage(null)).toEqual({ names: new Set(), anyChoice: false });
  });
});

describe("данные архетипов: текст снаряжения против записей Конструктора", () => {
  const archetype = (dir, id) => packDocById(`packs-src/elite-archetypes/${dir}`, id);
  const findAny = spec => ({ pack: {}, id: spec.name, name: spec.name });
  const plan = doc => {
    const cov = equipmentCoverage(doc);
    return planEliteGear(doc.system.gear, { find: findAny, covered: cov.names, coverNonNamed: cov.anyChoice });
  };

  it("Инкуб: Клэйв выдаёт запись, «Incubus Warsuit» — по тексту (раньше терялся)", () => {
    const p = plan(archetype("Друкхари", "ManXi5ZzE0ZTjo5O"));
    expect(p.grant.map(g => g.spec.name)).toEqual(["Incubus Warsuit"]);
  });

  it("Чумной Десантник, Варп-Кузнец, Электрожрец: всё покрыто записями — по тексту ничего не дублируется и шёпота нет", () => {
    for (const [dir, id] of [["Космодесантник", "uz6NPu1w7EsBmYM2"], ["Космодесантник", "XvWY6lfVnNdCSJ46"], ["Человек", "yybk1faGxSF2volp"]]) {
      const p = plan(archetype(dir, id));
      expect(p.grant, id).toEqual([]);
      expect(p.manual, id).toEqual([]);
    }
  });
});
