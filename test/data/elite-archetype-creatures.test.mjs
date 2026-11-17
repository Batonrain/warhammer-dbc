// test/data/elite-archetype-creatures.test.mjs
//
// Профили существ из Элитных архетипов Основной книги — Голем Рубрики (Колдун
// Рубрики), Тварь Ночи (Вампир, Стадия Пакта 4), Извивающийся Рой (Король Червей)
// и Тех-Тралл (Лакрималлус). Раньше их профили жили только текстом внутри Черты или
// Таланта (а Голема и Тралла в паке не было вовсе): призвать Рой или взять Тралла
// Миньоном было не из чего. Числа — из книги (скриншоты профилей, сверка 03.11.2026).

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import { WarhammerActor } from "../../module/documents/actor.mjs";
import { ACTOR_DATA_MODELS } from "../../module/data/index.mjs";

const en = (doc) => doc.name.split("/")[0].trim();
const BY_NAME = new Map(allPackDocuments("bestiary").map(({ doc }) => [en(doc), doc]));
/** «Bite (3)» находит и «Bite (3)», и «Bite / Укус (3)»: в бестиарии оба вида имён. */
const has = (doc, type, want) => {
  const m = want.match(/^([^(]+?)\s*(?:\((.*?)\)?)?$/);
  const base = m[1].trim(), rating = m[2];
  return doc.items.some(i => i.type === type && i.name.startsWith(base) && (rating == null || i.name.includes("(" + rating)));
};
const stat = (doc, key) => doc.system.characteristics[key].total;

// «size» — БАЗА system.size. Книжный «Размер 1» этих двух существ приходит от Трейта
// Size (1) (sizeMod +1 в system.sizeTotal, rules/character/movement.mjs): база 1
// плюс Трейт давали бы 2 (живая проверка 03.11.2026).
const PROFILES = {
  "Rubric Golem":   { wounds: 30, size: 0, ws: 40, bs: 50, s: 60, t: 55, ag: 30, int: 20, per: 42, wp: 50, fel: 5 },
  "Night Fiend":    { wounds: 30, size: 0, ws: 45, bs: 0,  s: 40, t: 40, ag: 40, int: 5,  per: 25, wp: 5,  fel: 5 },
  "Writhing Swarm": { wounds: 10, size: 0, ws: 34, bs: 1,  s: 21, t: 25, ag: 34, int: 7,  per: 34, wp: 16, fel: 7 },
  "Tech-Thrall":    { wounds: 7,  size: 0, ws: 25, bs: 25, s: 30, t: 40, ag: 20, int: 20, per: 15, wp: 10, fel: 5 }
};

describe("Существа Элитных архетипов в бестиарии", () => {
  it("все четыре профиля есть и числа совпадают с книгой", () => {
    for (const [name, p] of Object.entries(PROFILES)) {
      const doc = BY_NAME.get(name);
      expect(doc, `нет существа ${name}`).toBeTruthy();
      expect(doc.system.wounds.max, `${name}: Раны`).toBe(p.wounds);
      expect(doc.system.size, `${name}: Размер`).toBe(p.size);
      for (const k of ["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel"]) expect(stat(doc, k), `${name}: ${k}`).toBe(p[k]);
    }
  }, PACK_SCAN_TIMEOUT);

  it("Голем Рубрики: Трейты, броня и Таланты по книге", () => {
    const g = BY_NAME.get("Rubric Golem");
    for (const t of ["Fanatic", "From Beyond", "Stuff of Nightmares", "Regeneration (4)", "Size (1)", "Shield of Rubric", "Rubricae", "Unnatural S (4)", "Unnatural T (5)"])
      expect(has(g, "trait", t), t).toBe(true);
    const armour = g.items.find(i => i.type === "armor");
    expect([armour.system.head, armour.system.body, armour.system.leftArm, armour.system.leftLeg]).toEqual([8, 10, 8, 8]);
    expect(g.items.filter(i => i.type === "talent").length).toBe(11);
  }, PACK_SCAN_TIMEOUT);

  it("Тварь Ночи: Трейты и Таланты по книге", () => {
    const f = BY_NAME.get("Night Fiend");
    for (const t of ["Bite (3)", "Daemonic (2)", "Dark Sight", "Deadly Natural Weapons (3", "Fanatic", "Flyer (12)", "From Beyond", "Natural Armour (2)", "Stuff of Nightmares", "Size (1)", "Unnatural S (2)", "Unnatural T (2)", "Unnatural A (2)", "The Thirst"])
      expect(has(f, "trait", t), t).toBe(true);
    expect(f.items.filter(i => i.type === "talent").length).toBe(8);
    expect(f.system.skills.athletics.rank).toBe("veteran");
    // Красные бонусы книги S 6 / T 8 / A 6; T.b 8 = 4 (T 40) + Unnatural T (2) + Daemonic (2) — формула владельца.
    const rating = (stem) => f.items.find(i => i.type === "trait" && i.name.startsWith(stem));
    expect([rating("Unnatural S").system.rating, rating("Unnatural T").system.rating, rating("Unnatural A").system.rating]).toEqual([2, 2, 2]);
    expect(rating("Unnatural T").system.effects.charBonuses).toEqual([{ stat: "t", value: 2 }]);
    const bonus4 = Math.floor(stat(f, "t") / 10);
    expect(bonus4 + rating("Unnatural T").system.rating + rating("Daemonic").system.rating).toBe(8);
  }, PACK_SCAN_TIMEOUT);

  // Итог, а не сумма рейтингов: считаем Бонус Стойкости так, как его получит живой актор.
  // prepareDerivedData берёт Unnatural/Daemonic из system.effects.charBonuses, а эффект предмета
  // (ActiveEffect «(перенесено)») Foundry применяет сам — его вклад в bonusFx прибавляем вручную.
  // До правки 03.11.2026 Daemonic (2) Твари Ночи нёс устаревший эффект донора (+1) вместо +2:
  // живая проверка показала T.b 9 при Unnatural T (4) (4+4+1), книга требует 4+2+2 = 8.
  function derivedTb(doc) {
    const system = new ACTOR_DATA_MODELS[doc.type](structuredClone(doc.system)).toObject();
    const items = doc.items.map(i => ({
      id: i._id, _id: i._id, name: i.name, type: i.type, system: structuredClone(i.system),
      flags: structuredClone(i.flags ?? {}), effects: [], getFlag(sc, k) { return this.flags?.[sc]?.[k]; }
    }));
    items.get = () => null;
    items.contents = items;
    WarhammerActor.prototype.prepareDerivedData.call({ type: doc.type, name: doc.name, system, items, getFlag: () => undefined });
    const fx = doc.items.flatMap(i => i.effects ?? []).flatMap(e => e.system?.changes ?? [])
      .filter(c => c.key === "system.characteristics.t.bonusFx").reduce((a, c) => a + Number(c.value || 0), 0);
    return system.characteristics.t.bonus + fx;
  }

  it("Тварь Ночи: итоговый T.b актора = 8 (4 + Unnatural T 2 + Daemonic 2), вклад Daemonic равен рейтингу", () => {
    const f = BY_NAME.get("Night Fiend");
    expect(derivedTb(f)).toBe(8);
    // Предмет с флагом migratedEffect несёт вклад ТОЛЬКО встроенным эффектом (system.effects при расчёте
    // игнорируется, character.mjs): значение эффекта обязано равняться рейтингу Daemonic.
    const d = f.items.find(i => i.type === "trait" && i.name.startsWith("Daemonic /"));
    const vals = (d.effects ?? []).flatMap(e => e.system?.changes ?? []).filter(c => c.key === "system.characteristics.t.bonusFx").map(c => Number(c.value));
    expect(vals, "Daemonic (X) даёт +X к T.b ровно одним эффектом").toEqual([d.system.rating]);
    expect(d.system.effects.charBonusStat || "", "устаревшая пара charBonusStat/Value не дублирует вклад").toBe("");
  }, PACK_SCAN_TIMEOUT);

  it("Кровопускатель считается тем же способом: T.b = 4 + Unnatural/Daemonic из записей", () => {
    const b = BY_NAME.get("Bloodletter");
    expect(derivedTb(b)).toBe(8);
  }, PACK_SCAN_TIMEOUT);

  // Охранный тест по ВСЕМУ бестиарию: Daemonic (X) даёт +X к Бонусу Стойкости (соглашение бестиария,
  // module/rules/character.mjs; «Daemonic → T.b»). Без этого демон тихо недосчитывает Стойкость: так были
  // потеряны +3 у Мандрагоры и +4 у Кхимеры (сверка 03.11.2026).
  // Исключения — только там, где печатная книга САМА даёт T.b без Daemonic; каждое с цитатой.
  const DAEMONIC_TB_EXCEPTIONS = {
    // Книга (aeldari-branches.json, Khymera): «T 35 +7 … T.b: 7 | Погл.: 7/7/7/7», Unnatural T (4), Daemonic (4):
    // 7 = 3 + 4 — печатный профиль не включает Daemonic. Решение владельца: оставить, как напечатано.
    Khymera: 7
  };

  it("каждый демон с Daemonic (X) получает +X к T.b (исключения перечислены поимённо, с цитатой книги)", () => {
    const bad = [];
    const seenExceptions = new Set();
    for (const doc of BY_NAME.values()) {
      const d = doc.items.find(i => i.type === "trait" && /^Daemonic( \/|\s*\()/.test(i.name) && !/Armament|Presence/.test(i.name));
      if (!d) continue;
      const x = Number(d.system.rating) || 0;
      const ut = doc.items.find(i => i.type === "trait" && /^Unnatural T/.test(i.name));
      const want = Math.floor(stat(doc, "t") / 10) + (ut ? Number(ut.system.rating) || 0 : 0) + x;
      const got = derivedTb(doc);
      const name = en(doc);
      if (name in DAEMONIC_TB_EXCEPTIONS) {
        seenExceptions.add(name);
        if (got !== DAEMONIC_TB_EXCEPTIONS[name]) bad.push(`${name}: исключение ждёт T.b ${DAEMONIC_TB_EXCEPTIONS[name]}, получено ${got}`);
      } else if (got !== want) {
        bad.push(`${name}: Daemonic (${x}), T ${stat(doc, "t")} → T.b ${got}, ожидалось ${want}`);
      }
    }
    expect([...seenExceptions].sort(), "исключение без существа — уберите его из списка").toEqual(Object.keys(DAEMONIC_TB_EXCEPTIONS).sort());
    expect(bad, bad.join("\n")).toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  it("Извивающийся Рой и Тех-Тралл: Трейты по книге", () => {
    const s = BY_NAME.get("Writhing Swarm");
    for (const t of ["Amorphous", "Deadly Natural Weapons (1)", "Swarm", "Toxic (3)"]) expect(has(s, "trait", t), t).toBe(true);
    const sa = s.items.find(i => i.type === "armor");
    expect([sa.system.head, sa.system.body, sa.system.leftArm, sa.system.leftLeg]).toEqual([3, 3, 3, 3]);
    const t = BY_NAME.get("Tech-Thrall");
    for (const n of ["Fanatic", "From Beyond", "Machine (2)"]) expect(has(t, "trait", n), n).toBe(true);
    // Machine (2) = броня 2/2/2/2 (Погл. 6): значение эффекта совпадает с рейтингом, а не с шаблоном Machine (3).
    const m = t.items.find(i => i.type === "trait" && i.name.startsWith("Machine"));
    const vals = (m.effects || []).flatMap(e => (e.system?.changes || []).map(c => c.value));
    expect(vals.length).toBe(6);
    expect([...new Set(vals)]).toEqual([m.system.rating]);
  }, PACK_SCAN_TIMEOUT);

  it("Трейт Size (X) не считается дважды: у существ с ним база system.size = 0", () => {
    const withTrait = [...BY_NAME.values()].filter(d => d.items.some(i => i.type === "trait" && /^Size \(\d+\)/.test(i.name)));
    expect(withTrait.length, "существа с Трейтом Size").toBeGreaterThanOrEqual(6);
    const wrong = withTrait.filter(d => d.system.size !== 0).map(d => en(d));
    expect(wrong, "база Размера + Трейт Size = двойной счёт").toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  it("профиль Твари Ночи в Стадии Пакта 4 Вампира несёт BS 0, Навыки и T.b 8", () => {
    const stage = allPackDocuments("talents").map(({ doc }) => doc).find(d => d.name.startsWith("Pact Stage 4") && /Тварь Ночи/.test(d.system?.benefit || ""));
    expect(stage, "Стадия Пакта 4 Вампира").toBeTruthy();
    const b = stage.system.benefit;
    for (const frag of ["BS 0", "T.b 8", "Athletics+20", "Operate (Aeronautica)+10", "Deadly Natural Weapons (3, Укус, Когти)", "Unnatural S (2), Unnatural T (2), Unnatural A (2)"]) expect(b, frag).toContain(frag);
  }, PACK_SCAN_TIMEOUT);
});
