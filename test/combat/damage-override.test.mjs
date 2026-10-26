// test/combat/damage-override.test.mjs
//
// Правка урона попадания («Кубик → Успехи», «Искры») лежит во флаге сообщения чата, а не только в DOM
// нажавшего клиента (Sahara covering-fire-hip-shooting п.3): ГМ, применяющий урон со своей карточки, видит
// заменённое число; после перерисовки правка и погашенные кнопки не пропадают. Число — в том же флаге
// damageBoosts, что у Огня Души и Смертельной Ловушки (одно место правды), тексты кнопок — в dmgOverrides.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  applyDamageOverrides, recordDamageOverride, hitGroupIndex, DMG_OVERRIDES_FLAG
} from "../../module/combat/damage-override.mjs";

// Минимальная разметка: селекторы только вида «.класс» и «тег» — этого хватает коду под тестом.
class El {
  constructor(cls, parent = null) {
    this.cls = cls; this.parent = parent; this.children = []; this.dataset = {}; this.disabled = false; this.textContent = "";
    parent?.children.push(this);
  }
  all() { return this.children.flatMap(c => [c, ...c.all()]); }
  querySelectorAll(sel) { const c = sel.replace(/^[.]/, ""); return this.all().filter(e => e.cls === c); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  closest(sel) { const c = sel.replace(/^[.]/, ""); let e = this; while (e) { if (e.cls === c) return e; e = e.parent; } return null; }
}
function card({ hits = 2 } = {}) {
  const root = new El("card");
  const groups = [];
  for (let i = 0; i < hits; i++) {
    const g = new El("roll-dmg-hit-group", root);
    const apply = new El("wh-apply-dmg-btn", g); apply.dataset.damage = "12";
    new El("b", apply).textContent = "12";
    groups.push({ g, apply, swap: new El("wh-dmg-swap-btn", g), sparks: new El("wh-sparks-btn", g) });
  }
  return { root, groups };
}
/** Сообщение-заглушка: update разбирает пути «flags.warhammer-dbc.a.b.c» во вложенный объект. */
function message({ owner = true } = {}) {
  const flags = {};
  const setPath = (obj, keys, v) => { let n = obj; for (const k of keys.slice(0, -1)) n = (n[k] ??= {}); n[keys.at(-1)] = v; };
  return {
    isOwner: owner,
    flags: { "warhammer-dbc": flags },
    getFlag: (s, k) => flags[k],
    update: async data => { for (const [p, v] of Object.entries(data)) setPath(flags, p.replace(/^flags\.warhammer-dbc\./, "").split("."), structuredClone(v)); },
    store: flags
  };
}

describe("правка урона в данных сообщения", () => {
  it("запись автором: число — в damageBoosts (общий механизм), тексты — в dmgOverrides, одним обновлением", async () => {
    const { root, groups } = card();
    const msg = message();
    expect(await recordDamageOverride(msg, root, groups[1].swap, "wh-dmg-swap-btn", { damage: 9, text: "заменён" })).toBe(true);
    expect(msg.store.damageBoosts["1"]).toEqual({ damage: 9 });
    expect(msg.store[DMG_OVERRIDES_FLAG].groups["1"]).toEqual({ buttons: { "wh-dmg-swap-btn:0": "заменён" } });
    expect(hitGroupIndex(root, groups[1].swap)).toBe(1);
  });

  it("свежая разметка получает погашенную кнопку и текст; число накладывает applyDamageBoosts (общий механизм)", async () => {
    const msg = message();
    const mine = card();
    await recordDamageOverride(msg, mine.root, mine.groups[1].swap, "wh-dmg-swap-btn", { damage: 9, text: "заменён" });
    const gm = card();
    applyDamageOverrides(gm.root, msg.store[DMG_OVERRIDES_FLAG]);
    expect(gm.groups[1].swap.disabled).toBe(true);
    expect(gm.groups[1].swap.textContent).toBe("заменён");
    expect(gm.groups[0].swap.disabled).toBe(false);
  });

  it("Искры гасятся на всех попаданиях карточки (раз за атаку), текст — только у нажатой", async () => {
    const msg = message();
    const mine = card();
    await recordDamageOverride(msg, mine.root, mine.groups[0].sparks, "wh-sparks-btn",
      { damage: 15, text: "Искры", disableCardWide: ".wh-sparks-btn" });
    const gm = card();
    applyDamageOverrides(gm.root, msg.store[DMG_OVERRIDES_FLAG]);
    expect(gm.groups[0].sparks.disabled && gm.groups[1].sparks.disabled).toBe(true);
    expect(gm.groups[0].sparks.textContent).toBe("Искры");
    expect(gm.groups[1].sparks.textContent).toBe("");
    expect(msg.store.damageBoosts["0"].damage).toBe(15);
  });

  it("Кубик, потом Искры в одной группе: в damageBoosts остаётся итог второй правки, кнопки обеих погашены", async () => {
    const msg = message();
    const c = card();
    await recordDamageOverride(msg, c.root, c.groups[0].swap, "wh-dmg-swap-btn", { damage: 9, text: "кубик" });
    await recordDamageOverride(msg, c.root, c.groups[0].sparks, "wh-sparks-btn", { damage: 14, text: "искры", disableCardWide: ".wh-sparks-btn" });
    expect(msg.store.damageBoosts["0"].damage).toBe(14);
    const gm = card();
    applyDamageOverrides(gm.root, msg.store[DMG_OVERRIDES_FLAG]);
    expect(gm.groups[0].swap.disabled).toBe(true);
    expect(gm.groups[0].sparks.disabled).toBe(true);
  });

  it("правка Огня Души (damageBoosts) и последующая правка Кубика пишут в ОДНО место — откатывать нечему", async () => {
    const msg = message();
    msg.store.damageBoosts = { 0: { damage: 20, ignoreSubtypeImmunity: true } };   // как после Огня Души
    const c = card();
    await recordDamageOverride(msg, c.root, c.groups[0].swap, "wh-dmg-swap-btn", { damage: 17, text: "кубик" });
    expect(msg.store.damageBoosts["0"]).toEqual({ damage: 17, ignoreSubtypeImmunity: true });
  });

  it("пустой/чужой флаг ничего не ломает", () => {
    const c = card();
    applyDamageOverrides(c.root, undefined);
    applyDamageOverrides(c.root, { groups: { "7": { buttons: { "wh-dmg-swap-btn:0": "x" } } } });   // группы с таким номером нет
    expect(c.groups[0].swap.disabled).toBe(false);
  });
});

describe("стыковка", () => {
  const hooks = fs.readFileSync(path.join(path.resolve(import.meta.dirname, "../.."), "module/hooks.mjs"), "utf8");
  it("обе кнопки пишут правку в сообщение, а отрисовка накладывает её до обработчиков", () => {
    expect(hooks).toMatch(/recordDamageOverride\(message, html, el, "wh-dmg-swap-btn"/);
    expect(hooks).toMatch(/recordDamageOverride\(message, html, el, "wh-sparks-btn"/);
    expect(hooks.indexOf("applyDamageOverrides(html,")).toBeLessThan(hooks.indexOf('html.querySelectorAll(".wh-dmg-swap-btn")'));
  });
});
