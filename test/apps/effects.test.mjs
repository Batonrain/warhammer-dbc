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
import { isItemActive, createBlankEffect } from "../../module/apps/effects.mjs";

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

  it("носителя не найти (предмет пака, битая ссылка) — судим по своим полям", () => {
    expect(isItemActive(mod("armor-1"))).toBe(true);
  });
});

// У ActiveEffect картинка называется img: поле icon Foundry объединила с ним в
// v12, и схема v13+ чужое имя молча отбрасывает — эффект получает умолчание
// ядра icons/svg/aura.svg. Видно по packs-src: у всех созданных миграцией
// эффектов стоит именно оно.
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
