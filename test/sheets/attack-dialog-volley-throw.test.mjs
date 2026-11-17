// test/sheets/attack-dialog-volley-throw.test.mjs
//
// Volley Throw / Залповый Бросок (Талант Метания, Sahara 3-8318): метательный нож/флешета бросается режимом Длинной очереди
// +0 вместо −10, RoF 2..4 по выбору, без бонуса Прицеливания. Тот же механизм поля «RoF по выбору», что у Быстрого Курка.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

function attacker({ items = [], ...system } = {}) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none", ...system });
  a.updates = [];
  a.update = async data => { a.updates.push(data); };
  const flagStore = {};
  a.getFlag = (scope, key) => flagStore[`${scope}.${key}`];
  a.setFlag = async (scope, key, value) => { flagStore[`${scope}.${key}`] = value; };
  a.unsetFlag = async (scope, key) => { delete flagStore[`${scope}.${key}`]; };
  return a;
}
const thresholdInCard = () => {
  const m = (captured.chat.at(-1)?.content ?? "").match(/<label>Порог<\/label><b>(-?\d+)<\/b>/);
  return m ? Number(m[1]) : null;
};
const attackForm = (fields = {}, checks = {}) =>
  fakeForm({ "#atk-char": "bs", "#atk-modifier": "0", "#atk-aim": "", ...fields }, checks);
async function pressRoll(promise, fields = {}, checks = {}) {
  await captured.press("roll", attackForm(fields, checks));
  return promise;
}

const TALENT = (key = "throwing.core.volleyThrow") => ({
  type: "talent", name: "Volley Throw / Залповый Бросок", system: {}, getFlag: () => undefined,
  flags: { "warhammer-dbc": { mechanics: [{ id: "g1", operator: "AND", entries: [{ id: "e1", kind: "capability", capabilityKey: key, label: "" }] }] } }
});
const knife = (over = {}) => weaponFor({
  weaponClass: "thrown", weaponType: "lowtech", weight: 0.2, damage: "1d5", damageType: "rending",
  rof_single: 1, rof_semi: 0, rof_full: 0, magazineCur: 6, magazineMax: 6, weaponProps: [{ key: "primitive" }], ...over
}, { name: "Метательный нож" });

beforeEach(() => { resetCaptured(); setTargets([]); captured.dice = [23, 6]; });

describe("разметка окна атаки метательным ножом", () => {
  it("без Таланта — только одиночный бросок, очередей нет", () => {
    const w = knife();
    showAttackDialog(attacker({ items: [w] }), w);
    expect(captured.dialog.content).toContain("Одиночный выстрел");
    expect(captured.dialog.content).not.toContain("Залповый Бросок");
    expect(captured.dialog.content).not.toMatch(/id="atk-fanning-rof"/);
  });

  it("с Талантом — режим «Залповый Бросок (±0 …)» и поле выбора 2..4", () => {
    const w = knife();
    showAttackDialog(attacker({ items: [w, TALENT()] }), w);
    expect(captured.dialog.content).toContain("Залповый Бросок (±0");
    expect(captured.dialog.content).toMatch(/id="atk-fanning-rof"[^>]*min="2"[^>]*max="4"/);
    expect(captured.dialog.content).toContain("Залповый Бросок: сколько метнуть");
  });

  it("тяжёлое метательное (дротик 0,8 кг) залпом не бросают", () => {
    const w = knife({ weight: 0.8 });
    showAttackDialog(attacker({ items: [w, TALENT()] }), w);
    expect(captured.dialog.content).not.toContain("Залповый Бросок");
  });

  it("граната и стрелковое оружие — режима нет", () => {
    const g = knife({ weaponType: "grenade", weight: 0.2 });
    showAttackDialog(attacker({ items: [g, TALENT()] }), g);
    expect(captured.dialog.content).not.toContain("Залповый Бросок");
    resetCaptured();
    const pistol = weaponFor({ weaponClass: "pistol", rof_full: 4 });
    showAttackDialog(attacker({ items: [pistol, TALENT()] }), pistol);
    expect(captured.dialog.content).not.toContain("Залповый Бросок");
  });
});

describe("бросок залпа", () => {
  it("Прицеливание не прибавляется, штрафа −10 нет: порог = BS − 20 (без Тренировки) без +10 Прицеливания; попаданий по числу выбранного RoF, расход = RoF", async () => {
    const w = knife();
    const a = attacker({ items: [w, TALENT()], aiming: "half", characteristics: { bs: char(45), s: char(40), ag: char(35), ws: char(45), t: char(40) } });
    const p = showAttackDialog(a, w);
    captured.dice = [1, 2, 2, 2, 2, 2, 2];                // deg велик; урон по 2
    await pressRoll(p, {
      "input[name='atk-rof']:checked": { value: "full", dataset: { bonus: "0" } },
      "#atk-fanning-rof": "3"
    });
    // BS 45 + 0 (залп) − 20 (нож — Примитивное оружие без Тренировки); с Прицеливанием «половинным» было бы +10.
    expect(thresholdInCard()).toBe(25);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Залповый Бросок");
    expect(w.system.magazineCur).toBe(3);                  // 6 − 3 брошенных
    expect((card.match(/Применить урон/g) ?? []).length).toBe(3);
  });

  it("подделанное в окне RoF 9 зажимается до 4", async () => {
    const w = knife({ magazineCur: 10, magazineMax: 10 });
    const a = attacker({ items: [w, TALENT()], characteristics: { bs: char(90), s: char(40), ag: char(35), ws: char(45), t: char(40) } });
    const p = showAttackDialog(a, w);
    captured.dice = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2];
    await pressRoll(p, {
      "input[name='atk-rof']:checked": { value: "full", dataset: { bonus: "0" } },
      "#atk-fanning-rof": "9"
    });
    expect(w.system.magazineCur).toBe(6);                  // 10 − 4
  });

  it("одиночный бросок тем же ножом идёт как обычно: +10 и расход 1", async () => {
    const w = knife();
    const a = attacker({ items: [w, TALENT()], characteristics: { bs: char(45), s: char(40), ag: char(35), ws: char(45), t: char(40) } });
    const p = showAttackDialog(a, w);
    captured.dice = [23, 2];
    await pressRoll(p, { "input[name='atk-rof']:checked": { value: "single", dataset: { bonus: "10" } } });
    expect(thresholdInCard()).toBe(35);                    // 45 + 10 (одиночный) − 20 (без Тренировки)
    expect(w.system.magazineCur).toBe(5);
  });
});
