// test/apps/effects.test.mjs
//
// isItemActive решает, действуют ли эффекты предмета: именно им выставляется
// `disabled` при переносе механики (migrations/item-effects.mjs) и при каждой
// смене состояния (syncItemEffectsDisabled). У модификаций к «установлен и
// включён» добавляется надетость носителя: старый расчёт модификаций брони
// смотрел на неё (getInstalledArmorMods в combat/armor-mods.mjs), и механика,
// уехавшая в ActiveEffect, обязана считать так же — иначе Керамит из рюкзака
// даёт AP наравне с надетым.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";
import { isItemActive, createBlankEffect, gearRequiresWearing } from "../../module/apps/effects.mjs";

const MODULE = path.resolve(import.meta.dirname, "../../module");

/** Актор с предметами: модификации нужен доступ к носителю через parent. */
function actorWith(...items) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = { items: list };
  for (const item of list) item.parent = actor;
  return actor;
}

const armor = (id, equipped) => ({ id, type: "armor", system: { equipped } });
const mod   = (installedOn, extra = {}) =>
  ({ id: "mod", type: "armorMod", system: { installedOn, ...extra } });

describe("isItemActive: модификация и её носитель", () => {
  it("установлена на надетую броню — активна", () => {
    const m = mod("armor-1");
    actorWith(armor("armor-1", true), m);

    expect(isItemActive(m)).toBe(true);
  });

  it("носитель снят — неактивна", () => {
    const m = mod("armor-1");
    actorWith(armor("armor-1", false), m);

    expect(isItemActive(m)).toBe(false);
  });

  it("включаемая система на надетой броне без включения неактивна", () => {
    const m = mod("armor-1", { activatable: true, active: false });
    actorWith(armor("armor-1", true), m);

    expect(isItemActive(m)).toBe(false);
  });

  it("не установлена — неактивна", () => {
    expect(isItemActive(mod(""))).toBe(false);
  });

  it("предмет вне актора (компендиум, боковая панель) — судим по своим полям", () => {
    expect(isItemActive(mod("armor-1"))).toBe(true);
  });

  it("носитель удалён с актора — модификация осиротела и больше не действует (wdbc-z6em)", () => {
    // Тот же случай, что уже верно считает module/rules/character.mjs:205:
    // ссылка на носителя есть, а носителя на акторе нет. Оружия/брони, в
    // которую мод был вставлен, больше не существует — её улучшение обязано
    // выключиться вместе с ней, а не остаться висеть на персонаже.
    const m = mod("armor-1");
    actorWith(m);   // брони armor-1 на акторе нет: её удалили

    expect(isItemActive(m)).toBe(false);
  });

  it("включаемый мод-сирота не оживает от своего тумблера", () => {
    const m = mod("wpn-1", { activatable: true, active: true });
    m.type = "weaponMod";
    actorWith(m);

    expect(isItemActive(m)).toBe(false);
  });
});

const weapon = (id, equipped) => ({ id, type: "weapon", system: { equipped } });
const holder = (id, installedOn, slots = 3) =>
  ({ id, type: "armorMod", system: { installedOn, runicWeaveSlots: slots } });
const weave = (id, extra = {}) => ({ id, type: "runicWeave", system: { installedOnType: "carrier", ...extra } });

describe("isItemActive: Руническая Вязь", () => {
  it("не установлена — неактивна", () => {
    expect(isItemActive(weave("w"))).toBe(false);
  });

  it("установлена на снятую броню — неактивна", () => {
    const w = weave("w", { installedOn: "armor-1" });
    actorWith(armor("armor-1", false), w);
    expect(isItemActive(w)).toBe(false);
  });

  it("единственная вязь на надетой броне — активна", () => {
    const w = weave("w", { installedOn: "armor-1" });
    actorWith(armor("armor-1", true), w);
    expect(isItemActive(w)).toBe(true);
  });

  it("на надетом оружии — активна", () => {
    const w = weave("w", { installedOn: "wpn-1" });
    actorWith(weapon("wpn-1", true), w);
    expect(isItemActive(w)).toBe(true);
  });

  it("две вязи на одной броне — активна только ближайшая к телу (изнутри)", () => {
    const outer = weave("outer", { installedOn: "armor-1", wornPosition: "outer" });
    const inner = weave("inner", { installedOn: "armor-1", wornPosition: "inner" });
    actorWith(armor("armor-1", true), outer, inner);
    expect(isItemActive(inner)).toBe(true);
    expect(isItemActive(outer)).toBe(false);
  });

  it("держатель (Загадка Маата) — активность решает ручной тумблер, не положение", () => {
    const h = holder("holder", "armor-1");
    const on  = weave("on",  { installedOn: "holder", active: true });
    const off = weave("off", { installedOn: "holder", active: false });
    actorWith(armor("armor-1", true), h, on, off);
    expect(isItemActive(on)).toBe(true);
    expect(isItemActive(off)).toBe(false);
  });

  it("держатель установлен, но носитель держателя снят — неактивна", () => {
    const h = holder("holder", "armor-1");
    const on = weave("on", { installedOn: "holder", active: true });
    actorWith(armor("armor-1", false), h, on);
    expect(isItemActive(on)).toBe(false);
  });

  it("installedOnType:vehicle — активна самим фактом владения, без носителя", () => {
    const w = weave("w", { installedOnType: "vehicle" });
    actorWith(w);
    expect(isItemActive(w)).toBe(true);
  });

  it("installedOnType:region — активна всегда (живой пересчёт снаружи, см. runic-weave-zone.mjs)", () => {
    const w = weave("w", { installedOnType: "region", installedOn: "" });
    expect(isItemActive(w)).toBe(true);
  });
});

const tech = (extra = {}) => ({ type: "techPower", system: { miracleType: "imperative", sustained: false, compiled: false, extraTypes: [], ...extra } });

describe("isItemActive: Техночудо (wdbc-yu32)", () => {
  it("Процесс (sustained) — активно независимо от типа чуда", () => {
    expect(isItemActive(tech({ sustained: true }))).toBe(true);
  });

  it("Пассивное — активно всегда", () => {
    expect(isItemActive(tech({ miracleType: "passive", sustained: false }))).toBe(true);
  });

  it("Императив/Компенсатор/Манипула/Анима/Доктрина без Процесса — неактивно (не про удерживаемое состояние источника, см. разбор в тикете)", () => {
    for (const miracleType of ["imperative", "compensator", "manipula", "anima", "doctrine"]) {
      expect(isItemActive(tech({ miracleType }))).toBe(false);
    }
  });

  it("Славословие без компиляции — неактивно", () => {
    expect(isItemActive(tech({ miracleType: "slavoslovie", compiled: false }))).toBe(false);
  });

  it("Славословие скомпилировано — активно (книга: держится как Процесс, пока не использовано)", () => {
    expect(isItemActive(tech({ miracleType: "slavoslovie", compiled: true }))).toBe(true);
  });

  it("Славословие как дополнительный тип (extraTypes) — тоже учитывается", () => {
    const item = tech({ miracleType: "imperative", extraTypes: [{ type: "slavoslovie", x: 1 }], compiled: true });
    expect(isItemActive(item)).toBe(true);
  });
});

// wdbc-egll: у подавляющего большинства Мутаций/Даров своего «активна ли»
// нет вовсе (эффект действует, пока предмет на акторе) — activatable:true
// включает его именно для тех немногих, где книга сама говорит «до конца
// боя/сцены» (Живое Оружие и подобные).
describe("isItemActive: Мутация/Дар с activatable", () => {
  const mut = (extra = {}) => ({ id: "m", type: "mutation", system: { ...extra } });

  it("activatable не заведён — активна всегда, как Талант/Черта", () => {
    expect(isItemActive(mut())).toBe(true);
  });

  it("activatable:true, active:false — не активна", () => {
    expect(isItemActive(mut({ activatable: true, active: false }))).toBe(false);
  });

  it("activatable:true, active:true — активна", () => {
    expect(isItemActive(mut({ activatable: true, active: true }))).toBe(true);
  });
});

// Мутация/Дар подавлена Чистой Формой (rules/mutation-suppression.mjs, wdbc-1rno).
describe("isItemActive: Мутация/Дар (подавление Чистой Формой)", () => {
  const mutation = (suppressed) => ({
    id: "m1", type: "mutation", system: {},
    getFlag: (scope, key) => (scope === "warhammer-dbc" && key === "suppressed") ? suppressed : undefined
  });

  it("флаг suppressed не выставлен — активна", () => {
    expect(isItemActive(mutation(undefined))).toBe(true);
  });

  it("suppressed:false — активна", () => {
    expect(isItemActive(mutation(false))).toBe(true);
  });

  it("suppressed:true — не активна", () => {
    expect(isItemActive(mutation(true))).toBe(false);
  });
});

// У ActiveEffect картинка называется img: поле icon Foundry объединила с ним в
// v12, и схема v13+ чужое имя молча отбрасывает — эффект получает умолчание
// ядра icons/svg/aura.svg. Видно по packs-src: у всех созданных миграцией
// эффектов стоит именно оно.
describe("isItemActive: снаряжение и признак «надето» (wdbc-9h7g)", () => {
  // До wdbc-9h7g снаряжение попадало в default «активен всегда»: противогаз
  // защищал от газа, лёжа в рюкзаке. Теперь носимая вещь (у которой книга
  // сказала, КУДА она надевается — заполнено system.worn) работает только
  // надетой, а ненадеваемая (хим-лаборатория) — как раньше.
  const gear = (system) => ({ id: "g", type: "gear", system });

  it("носимое и надетое — активно", () => {
    expect(isItemActive(gear({ worn: "Голова (И)", equipped: true }))).toBe(true);
  });

  it("носимое, но не надетое — неактивно (противогаз в рюкзаке не защищает)", () => {
    expect(isItemActive(gear({ worn: "Голова (И)", equipped: false }))).toBe(false);
  });

  it("ненадеваемое снаряжение работает как раньше, без тумблера", () => {
    expect(isItemActive(gear({ worn: "", equipped: false }))).toBe(true);
    expect(isItemActive(gear({ equipped: false }))).toBe(true);
  });

  it("пробелы в «Носится» за пометку не считаются", () => {
    expect(isItemActive(gear({ worn: "   ", equipped: false }))).toBe(true);
  });

  it("gearRequiresWearing отвечает на тот же вопрос отдельно", () => {
    expect(gearRequiresWearing({ worn: "Кисть" })).toBe(true);
    expect(gearRequiresWearing({ worn: "" })).toBe(false);
    expect(gearRequiresWearing(undefined)).toBe(false);
  });
});

describe("картинка создаваемого эффекта", () => {
  it("createBlankEffect берёт картинку предмета", async () => {
    const created = [];
    const item = {
      img: "systems/warhammer-dbc/assets/item-icons/talent.svg",
      createEmbeddedDocuments: async (_type, docs) => {
        created.push(...docs);
        return docs.map(() => ({ sheet: { render: () => {} } }));
      }
    };

    await createBlankEffect(item);

    expect(created[0].img).toBe(item.img);
    expect(created[0].icon).toBeUndefined();
  });

  it("ни одна точка создания эффекта не передаёт icon", () => {
    // Точек семь и правка в них одинаковая — проверка ловит и восьмую, которую
    // напишут по образцу соседней (wdbc-s94).
    const offenders = [];
    const walk = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith(".mjs")) continue;
        const src = fs.readFileSync(full, "utf8");
        for (const call of src.matchAll(/createEmbeddedDocuments\("ActiveEffect",[^;]*?icon:/gs))
          offenders.push(`${path.relative(MODULE, full)}: ${call[0].split("\n").at(-1).trim()}`);
      }
    };
    walk(MODULE);
    expect(offenders).toEqual([]);
  });
});
