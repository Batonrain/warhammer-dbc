// test/combat/quad-cognis-independent.test.mjs
// Книга, «Особые Свойства Оружия»: Квад (две отдельные атаки), Когнис
// (допуск по Трейту, I вместо WS/BS за 1 Когниции), Независимое (выстрел
// раз в Раунд после любой атаки), Дуга (Pen 0).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { cognisDecision, hasMechanicumImplants } from "../../module/rules/cognis.mjs";
import { independentShotOfferHtml, isIndependentWeapon } from "../../module/combat/free-shot.mjs";
import { WEAPON_PROPERTIES } from "../../module/constants/weapon-properties.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const hitLines = () => (card().match(/roll-hit-dmg"/g) ?? []).length;

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("Квад: две отдельные атаки", () => {
  function quadGun() {
    const w = weaponFor({
      weaponClass: "basic", damage: "1d10+5", damageType: "I", penetration: 0,
      rof_single: true, weaponProps: [{ key: "quad" }]
    });
    w.type = "weapon";
    return w;
  }

  it("обе атаки попали — два попадания (второй d100 бросается отдельно)", async () => {
    const w = quadGun(); const a = actorFor({ items: [w] });
    // d100 первой, d100 второй, затем кубики урона двух попаданий
    captured.dice = [10, 20, 4, 6];
    await _executeAttackRoll(a, w, "bs", 45, "single", null, {});
    expect(hitLines()).toBe(2);
    expect(card()).toContain("Квад: вторая атака");
  });

  it("вторая промахнулась — одно попадание", async () => {
    const w = quadGun(); const a = actorFor({ items: [w] });
    captured.dice = [10, 95, 4];
    await _executeAttackRoll(a, w, "bs", 45, "single", null, {});
    expect(hitLines()).toBe(1);
    expect(card()).toContain("промах");
  });

  it("первая промахнулась, вторая попала — основной разбор идёт по попавшей", async () => {
    const w = quadGun(); const a = actorFor({ items: [w] });
    captured.dice = [95, 10, 4];
    await _executeAttackRoll(a, w, "bs", 45, "single", null, {});
    expect(hitLines()).toBe(1);
  });
});

describe("Когнис: допуск и цена", () => {
  const item = n => ({ type: "trait", name: n });
  it("Трейт Mechanicum Implants распознаётся", () => {
    expect(hasMechanicumImplants({ items: [item("Mechanicum Implants / Импланты Механикум")] })).toBe(true);
    expect(hasMechanicumImplants({ items: [item("Brutal")] })).toBe(false);
  });
  it("игрок без Трейта и не на технике — отказ", () => {
    const d = cognisDecision({ implants: false, onVehicle: false, isGM: false, charKey: "bs", cognition: 2 });
    expect(d.blocked).toBe(true);
  });
  it("ГМ без Трейта — предупреждение, но не блок", () => {
    const d = cognisDecision({ implants: false, onVehicle: false, isGM: true, charKey: "bs", cognition: 0 });
    expect(d.blocked).toBe(false);
    expect(d.warn).toContain("Mechanicum Implants");
  });
  it("оружие на технике — допуск без Трейта", () => {
    expect(cognisDecision({ implants: false, onVehicle: true, charKey: "bs" }).blocked).toBe(false);
  });
  it("атака через I стоит 1 Когниции; без Когниции нельзя", () => {
    expect(cognisDecision({ implants: true, onVehicle: false, charKey: "i", cognition: 3 }).spend).toBe(1);
    expect(cognisDecision({ implants: true, onVehicle: false, charKey: "i", cognition: 0 }).blocked).toBe(true);
    // Живая проверка 13.11: в окне атаки Интеллект — ключ "int", а не "i".
    expect(cognisDecision({ implants: true, onVehicle: false, charKey: "int", cognition: 3 }).spend).toBe(1);
    expect(cognisDecision({ implants: true, onVehicle: false, charKey: "int", cognition: 0 }).blocked).toBe(true);
    expect(cognisDecision({ implants: true, onVehicle: false, charKey: "bs", cognition: 0 }).spend).toBe(0);
  });
});

describe("Независимое оружие: выстрел раз в Раунд после любой атаки", () => {
  const gun = (id, props) => ({ id, name: `Пушка ${id}`, type: "weapon", system: { equipped: true, weaponProps: props } });
  const actorWith = items => ({ uuid: "Actor.a", items });

  it("предлагается кнопка для экипированного Независимого оружия", () => {
    const shoulder = gun("s1", [{ key: "independent" }]);
    expect(isIndependentWeapon(shoulder)).toBe(true);
    const html = independentShotOfferHtml(actorWith([gun("m1", []), shoulder]), { attackingItem: gun("m1", []) });
    expect(html).toContain('data-kind="independent"');
    expect(html).toContain('data-item-id="s1"');
  });
  it("не предлагается, если атакует само Независимое оружие или это и есть свободный выстрел", () => {
    const shoulder = gun("s1", [{ key: "independent" }]);
    expect(independentShotOfferHtml(actorWith([shoulder]), { attackingItem: shoulder })).toBe("");
    expect(independentShotOfferHtml(actorWith([shoulder]), { freeShotKind: "independent" })).toBe("");
  });
  it("без Независимого оружия — пусто", () => {
    expect(independentShotOfferHtml(actorWith([gun("m1", [])]), {})).toBe("");
  });
});

describe("Дуга: по книге Pen 0", () => {
  it("описание говорит Pen 0", () => {
    expect(WEAPON_PROPERTIES.arc.desc).toContain("Pen 0");
  });
});
