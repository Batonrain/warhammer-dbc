// test/combat/attack-maximal-blast-rng.test.mjs
//
// Максимальный режим (Maximal), Sahara maximal-blast-10-rng. Книга (core.json):
// «+10 Rng, +1d10 Dmg, +2 Pen, +2 к радиусу свойства Blast, если оно у оружия
// есть, и свойство Recharge, ценой удвоенного расхода боеприпасов». Мастерство
// Плазмы: «+2 к Dmg, Pen, и персонаж может также дать ему +2 к радиусу Blast.
// Если оружие не обладало Blast, может дать Blast (2) в режиме Maximal (не
// увеличивается этим Талантом и свойством Maximal)». Кубы/Pen/Recharge/расход
// считались и раньше; здесь радиус Взрыва, Rng и выбор по Мастерству.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets, char } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import {
  maximalBlastRating, maximalBlastNote, maximalRange, MAXIMAL_RNG_BONUS
} from "../../module/rules/maximal-mode.mjs";
import { plasmaMasteryBonus, plasmaMasteryBlastChoice } from "../../module/rules/damage-talents.mjs";
import { createMaximalRangeSync } from "../../module/sheets/attack/maximal-range.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

const card = () => captured.chat.at(-1)?.content ?? "";
const blastMeters = () => Number(card().match(/data-blast="(\d+)"/)?.[1]);

const MAXIMAL = { key: "maximal", rating: 0, rating2: 0 };
const BLAST = r => ({ key: "blast", rating: r, rating2: 0 });
const talent = key => ({
  id: "t-" + key, name: "ИСПОРЧЕННОЕ ИМЯ", type: "talent", system: {},
  flags: { "warhammer-dbc": { mechanics: [{ id: "g", operator: "AND", entries: [
    { id: "e", kind: "capability", capabilityKey: key, label: "" }
  ] }] } }
});
const MASTERY = "weaponsmith.core.plasmaMastery";

const gun = (props, type = "plasma") =>
  weaponFor({ weaponType: type, damage: "1d10", penetration: 4, weaponProps: props });
const fighter = items => actorFor({ items, characteristics: { ws: char(45), bs: char(45), s: char(9), t: char(40), ag: char(35) } });

beforeEach(() => { resetCaptured(); setTargets([]); });

describe("rules/maximal-mode: радиус Взрыва", () => {
  it("режим выключен — радиус как был", () => {
    expect(maximalBlastRating({ blast: 3, maximalOn: false, masteryBlast: true })).toBe(3);
  });
  it("Maximal: +2, только если Blast у оружия есть", () => {
    expect(maximalBlastRating({ blast: 3, maximalOn: true })).toBe(5);
    expect(maximalBlastRating({ blast: 0, maximalOn: true })).toBe(0);   // «Blast(2)» из старого описания — не по книге
  });
  it("Мастерство Плазмы: ещё +2 к имеющемуся радиусу", () => {
    expect(maximalBlastRating({ blast: 3, maximalOn: true, masteryBlast: true })).toBe(7);
  });
  it("Мастерство Плазмы без Blast у оружия: Blast (2), надбавки не растут", () => {
    expect(maximalBlastRating({ blast: 0, maximalOn: true, masteryBlast: true })).toBe(2);
  });
  it("подпись в карточке называет, что поменялось", () => {
    expect(maximalBlastNote({ blast: 3, maximalOn: true })).toContain("3 → 5");
    expect(maximalBlastNote({ blast: 0, maximalOn: true, masteryBlast: true })).toContain("Blast (2)");
    expect(maximalBlastNote({ blast: 0, maximalOn: true })).toBe("");
    expect(maximalBlastNote({ blast: 3, maximalOn: false })).toBe("");
  });
  it("Rng: +10 плоско, у оружия без дальности — 0", () => {
    expect(MAXIMAL_RNG_BONUS).toBe(10);
    expect(maximalRange(30, true)).toBe(40);
    expect(maximalRange(30, false)).toBe(30);
    expect(maximalRange(0, true)).toBe(0);
  });
});

describe("бросок: радиус шаблона и подпись на карточке", () => {
  async function fire(items, weapon, opts) {
    const actor = fighter([weapon, ...items]);
    captured.dice = [23, 5, 4];
    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, opts);
  }

  it("Maximal включён — радиус Blast растёт на 2 (кнопка шаблона и «Всем»)", async () => {
    await fire([], gun([MAXIMAL, BLAST(3)], "bolt"), { maximal: true });
    expect(blastMeters()).toBe(5);
    expect(card()).toContain("в радиусе 5м");
    expect(card()).toContain("3 → 5");
  });

  it("Maximal выключен — радиус прежний", async () => {
    await fire([], gun([MAXIMAL, BLAST(3)], "bolt"), { maximal: false });
    expect(blastMeters()).toBe(3);
    expect(card()).not.toContain("3 → 5");
  });

  it("Maximal у оружия без Blast Взрыва не создаёт", async () => {
    await fire([], gun([MAXIMAL], "bolt"), { maximal: true });
    expect(blastMeters()).toBe(0);
    expect(card()).not.toContain("в радиусе");
  });

  it("Мастерство Плазмы + выбор радиуса: Blast 3 → 7", async () => {
    await fire([talent(MASTERY)], gun([MAXIMAL, BLAST(3)]), { maximal: true, plasmaBlast: true });
    expect(blastMeters()).toBe(7);
  });

  it("Мастерство Плазмы без выбора радиуса: только +2 Максимального режима", async () => {
    await fire([talent(MASTERY)], gun([MAXIMAL, BLAST(3)]), { maximal: true });
    expect(blastMeters()).toBe(5);
  });

  it("Мастерство Плазмы + выбор у оружия без Blast: Blast (2), Взрыв появился", async () => {
    await fire([talent(MASTERY)], gun([MAXIMAL]), { maximal: true, plasmaBlast: true });
    expect(blastMeters()).toBe(2);
    expect(card()).toContain("в радиусе 2м");
  });

  it("выбор радиуса без Таланта или не на плазме — игнорируется", async () => {
    await fire([], gun([MAXIMAL, BLAST(3)]), { maximal: true, plasmaBlast: true });
    expect(blastMeters()).toBe(5);
    resetCaptured();
    await fire([talent(MASTERY)], gun([MAXIMAL, BLAST(3)], "bolt"), { maximal: true, plasmaBlast: true });
    expect(blastMeters()).toBe(5);
  });

  it("Maximal выключен — выбор Мастерства радиус не меняет", async () => {
    await fire([talent(MASTERY)], gun([MAXIMAL]), { maximal: false, plasmaBlast: true });
    expect(blastMeters()).toBe(0);
  });

  it("длина конуса Распыления в Максимальном режиме +10 м", async () => {
    await fire([], weaponFor({ weaponType: "bolt", range: 30, weaponProps: [MAXIMAL, { key: "spray", rating: 0, rating2: 0 }] }), { maximal: true });
    expect(card()).toContain('data-weapon-range="40"');
  });
});

describe("plasmaMasteryBonus / выбор в окне", () => {
  const actorWith = items => fighter(items);
  it("blast=true только при выборе, Maximal и плазме", () => {
    const a = actorWith([talent(MASTERY)]);
    const sys = { weaponType: "plasma" };
    expect(plasmaMasteryBonus(a, { isMelee: false, sys, maximalOn: true, blastChosen: true })).toEqual({ dmg: 2, pen: 2, blast: true });
    expect(plasmaMasteryBonus(a, { isMelee: false, sys, maximalOn: true })).toEqual({ dmg: 2, pen: 2, blast: false });
    expect(plasmaMasteryBonus(a, { isMelee: false, sys, maximalOn: false, blastChosen: true }).blast).toBe(false);
    expect(plasmaMasteryBonus(a, { isMelee: false, sys: { weaponType: "bolt" }, maximalOn: true, blastChosen: true }).blast).toBe(false);
  });
  it("галочка предлагается обладателю Таланта на плазме с Maximal", () => {
    const a = actorWith([talent(MASTERY)]);
    expect(plasmaMasteryBlastChoice(a, { isMelee: false, sys: { weaponType: "plasma" }, maximalAvailable: true })).toBe(true);
    expect(plasmaMasteryBlastChoice(a, { isMelee: false, sys: { weaponType: "plasma" }, maximalAvailable: false })).toBe(false);
    expect(plasmaMasteryBlastChoice(actorWith([]), { isMelee: false, sys: { weaponType: "plasma" }, maximalAvailable: true })).toBe(false);
  });
});

describe("окно атаки: галочки и сетка дальности", () => {
  const attacker = items => {
    const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none" });
    a.update = async () => {};
    return a;
  };

  it("у обладателя Мастерства на плазме есть галочка радиуса; формулировка зависит от Blast", () => {
    const w = gun([MAXIMAL, BLAST(3)]);
    showAttackDialog(attacker([w, talent(MASTERY)]), w);
    expect(captured.dialog.content).toContain("atk-plasma-blast");
    expect(captured.dialog.content).toContain("+2 к радиусу Взрыва (только в Максимальном режиме)");
    resetCaptured();
    const w2 = gun([MAXIMAL]);
    showAttackDialog(attacker([w2, talent(MASTERY)]), w2);
    expect(captured.dialog.content).toContain("Взрыв (2) (только в Максимальном режиме)");
  });

  it("без Таланта галочки радиуса нет, у Maximal в тексте нет «Взрыв(2)»", () => {
    const w = gun([MAXIMAL]);
    showAttackDialog(attacker([w]), w);
    expect(captured.dialog.content).not.toContain("atk-plasma-blast");
    expect(captured.dialog.content).not.toContain("Взрыв(2)");
    expect(captured.dialog.content).toContain("+10 Rng");
  });

  it("сетка дальности: второй вариант с Rng +10 лежит скрытым", () => {
    const w = weaponFor({ weaponType: "plasma", range: 30, weaponProps: [MAXIMAL] });
    showAttackDialog(attacker([w]), w);
    const html = captured.dialog.content;
    expect(html).toContain("atk-range-normal");
    expect(html).toMatch(/atk-range-maximal" hidden/);
    expect(html).toContain("Rng +10м = 40м");
  });
});

describe("createMaximalRangeSync: +10 Rng сдвигает автоотметку полосы", () => {
  /** Галочки полос, как их рисует окно: отмечена та, что выбрал расчёт при открытии. */
  const bands = checkedKey => ["pointBlank", "short", "combat", "long", "extreme"].map(band => ({
    checked: band === checkedKey, disabled: false, dataset: { band }, closest: () => null
  }));
  const formWith = (cbs, extra = {}) => fakeForm({ ...extra }, { "input.atk-mod-cb[data-band]": cbs });
  const checked = cbs => cbs.find(c => c.checked)?.dataset.band;

  it("Rng 30, цель в 40 м: без режима Дальняя (до 60), с режимом (Rng 40) — Боевая", () => {
    const cbs = bands("long");
    const sync = createMaximalRangeSync(formWith(cbs), { edgeM: 40, gripRange: 30 });
    sync(true);
    expect(checked(cbs)).toBe("combat");
    sync(false);                                   // обратно — снова Дальняя
    expect(checked(cbs)).toBe("long");
  });

  it("цель в 50 м при Rng 30: Дальняя → Дальняя (50 ≤ 80); в 70 м: Экстрем. → Дальняя", () => {
    const cbs = bands("extreme");
    createMaximalRangeSync(formWith(cbs), { edgeM: 70, gripRange: 30 })(true);
    expect(checked(cbs)).toBe("long");
  });

  it("полосу, тронутую руками, окно не перебивает", () => {
    const cbs = bands("long");
    cbs.find(c => c.dataset.band === "long").checked = false;
    cbs.find(c => c.dataset.band === "short").checked = true;      // игрок выбрал сам
    createMaximalRangeSync(formWith(cbs), { edgeM: 40, gripRange: 30 })(true);
    expect(checked(cbs)).toBe("short");
  });

  it("Рассеивание/Мельта: «Короткая дистанция» догоняет Rng+10 (17 м при Rng 30: 15 → 20 м)", () => {
    const short = { checked: false, disabled: false };
    const sync = createMaximalRangeSync(formWith(bands("combat"), { "#atk-shortrange": short }), { edgeM: 17, gripRange: 30 });
    sync(true);
    expect(short.checked).toBe(true);
    sync(false);
    expect(short.checked).toBe(false);
  });

  it("«Короткая дистанция», снятая или поставленная руками, не перебивается", () => {
    const short = { checked: true, disabled: false };      // авто-состояние при Rng 30 и 20 м было бы «выкл»
    createMaximalRangeSync(formWith(bands("combat"), { "#atk-shortrange": short }), { edgeM: 20, gripRange: 30 })(true);
    expect(short.checked).toBe(true);
  });

  it("повторный вызов с тем же состоянием ничего не делает; без замера — пустышка", () => {
    const cbs = bands("long");
    const sync = createMaximalRangeSync(formWith(cbs), { edgeM: 40, gripRange: 30 });
    sync(false);
    expect(checked(cbs)).toBe("long");
    expect(createMaximalRangeSync(formWith(cbs), null)(true)).toBeUndefined();
    expect(checked(cbs)).toBe("long");
  });

  it("предупреждение «вне дальности» гаснет, когда +10 Rng возвращает цель в зону", () => {
    const out = { hidden: false, style: {} };
    const sync = createMaximalRangeSync(formWith(bands(null), { "#atk-out-of-range": out }), { edgeM: 100, gripRange: 31 });
    // Rng 31: 3×31 = 93 < 100 — вне зоны; Rng 41: 3×41 = 123 ≥ 100 — в зоне.
    sync(true);
    expect(out.hidden).toBe(true);
    sync(false);
    expect(out.hidden).toBe(false);
  });
});

describe("проводка окна атаки", () => {
  it("пересчёт окна сперва сверяет галочку Максимального режима с полосами дальности, потом читает форму", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("../../module/sheets/attack/dialog.mjs", import.meta.url), "utf8");
    expect(src).toMatch(/createMaximalRangeSync\(form, maximalRange\)/);
    expect(src).toMatch(/syncMaximalRange\(form\.querySelector\("#atk-maximal"\)\?\.checked\);\s*const f = readAttackForm/);
    expect(src).toMatch(/plasmaBlast: f\.plasmaBlast/);
  });
});
