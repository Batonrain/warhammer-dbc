// test/combat/force-blade-one-weapon.test.mjs
//
// Force Blade / Психосиловой Клинок накладывается на ОДНО оружие.
//
// Книга (текст карточки психосилы): «Если данная психосила была
// манифестирована на не-психосиловом оружии, то ОНО получает свойство Force».
// Одно. До приёма стопки #478-#481 запись weaponBuff несла только
// scope:"equipped", и getModEffects раздавал Force и все купленные за Успехи
// свойства (Пламя 3d10, Witch's Edge, Mighty…) КАЖДОМУ надетому оружию —
// Варлок с мечом и пистолетом получал их на оба.
//
// Прежние тесты проверяли, что получилось внутри weaponBuff (цена, набор
// свойств), и ни разу не спрашивали getModEffects — то есть не проверяли, к
// какому оружию бафф реально прилипнет.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { getModEffects } from "../../module/combat/weapon-mods.mjs";
import { forceBladeShopUpdate } from "../../module/apps/force-blade-choice.mjs";

const weapon = (id, equipped = true) =>
  ({ id, type: "weapon", system: { equipped, melee: true, weaponProps: [] } });

/** Психосила с записью weaponBuff — так её держит актор после манифестации. */
function forceBladePower(weaponId, ids = ["tearing"]) {
  const { weaponBuff } = forceBladeShopUpdate(ids, 5, weaponId);
  return { id: "p1", name: "Force Blade / Психосиловой Клинок", type: "psychicPower",
           system: { isSustained: true, effects: { weaponBuff } } };
}

function actorWith(items) {
  const list = [...items];
  list.get = i => list.find(x => x.id === i) ?? null;
  return { id: "warlock", items: list };
}

const propKeys = fx => fx.addProps.map(p => p.key);

describe("Force Blade наложен на конкретное оружие", () => {
  it("выбранное оружие получает Force и купленные свойства", () => {
    const actor = actorWith([forceBladePower("sword")]);
    const fx = getModEffects(actor, weapon("sword"));
    expect(propKeys(fx)).toContain("force");
    expect(propKeys(fx)).toContain("tearing");
  });

  it("второе надетое оружие не получает НИЧЕГО — вот ради чего тест", () => {
    const actor = actorWith([forceBladePower("sword")]);
    const fx = getModEffects(actor, weapon("pistol"));
    expect(propKeys(fx)).not.toContain("force");
    expect(propKeys(fx)).not.toContain("tearing");
    expect(fx.names).not.toContain("Force Blade / Психосиловой Клинок");
  });

  it("оружие выбрать было не из чего (пустой weaponId) — прежнее поведение по всему надетому", () => {
    const actor = actorWith([forceBladePower("")]);
    expect(propKeys(getModEffects(actor, weapon("sword")))).toContain("force");
    expect(propKeys(getModEffects(actor, weapon("pistol")))).toContain("force");
  });

  it("выбранное оружие снято — свойств нет (scope:\"equipped\" по-прежнему работает)", () => {
    const actor = actorWith([forceBladePower("sword")]);
    expect(propKeys(getModEffects(actor, weapon("sword", false)))).not.toContain("force");
  });
});
