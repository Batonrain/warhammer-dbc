// test/combat/tyranthikos.test.mjs
//
// Талант элитного архетипа Чемпион-Терминатор «Tyranthikos / Тирантикос»
// (core.json, стр. 123-124; задача Sahara 10-2d10-2). Книга:
//
//   «Терминатор уменьшает штраф за стрельбу из любой пары стрелкового оружия
//    на 10, в том числе двух тяжелых оружий. Если он вооружен двумя тяжелыми
//    оружиями, стреляет из обоих в одну цель Размером 2 и более и попадает из
//    обоих, цель получает +2d10 Dmg от первого попадания второй атаки. Когда
//    атаки Терминатора повреждают Укрытия, те теряют 1d10 AP вместо 1.»
//
// Третья фраза (износ Укрытий) сделана раньше и проверяется в
// test/combat/cover-damage.test.mjs. Здесь — первые две: скидка −10 к парному
// штрафу (module/rules/dual-wield.mjs) и +2d10 первому попаданию второй руки
// (module/rules/dual-wield-talents.mjs → окно атаки → module/combat/attack.mjs).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, setTargets } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";
import { dualWieldMods, CAP_TYRANTHIKOS, PAIR_PENALTY } from "../../module/rules/dual-wield.mjs";
import { tyranthikosSecondAttackDice, TYRANTHIKOS_BONUS_DICE } from "../../module/rules/dual-wield-talents.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../module/rules/sources.mjs";
import { itemHasKey } from "../../module/rules/item-marker.mjs";
import { withEyeOfEnvy } from "../../module/rules/eye-of-envy.mjs";
import { packDocById } from "../support/pack-doc.mjs";
import { CAPABILITIES } from "../../module/constants/capabilities.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
// Документ Таланта — по id, не по имени файла (test/tools/pack-path-in-tests.test.mjs).
const TALENT_DIR = "packs-src/talents/Элитные_архетипы/Чемпион_Терминатор";
const TALENT_ID  = "kHbWbNHvqWpYEf0j";

const saved = getRuleSources();
afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of saved) registerRuleSource(key, fn);
});

/** Персонаж с перечисленными возможностями (как в test/rules/dual-wield.test.mjs). */
function hero(...caps) {
  clearRuleSources();
  registerRuleSource("test", () => caps.map(c => ({
    id: c, label: c, when: {}, effects: [{ kind: "grantFlag", target: c }]
  })));
  return { system: {}, items: [] };
}

const w = (weaponClass, meleeCategory = "", id = "w") =>
  ({ id, type: "weapon", system: { weaponClass, meleeCategory, equipped: true } });
const heavy  = id => w("heavy", "", id);
const basic  = id => w("basic", "", id);
const pistol = id => w("pistol", "", id);
const thrown = id => w("thrown", "", id);
const sword  = id => w("melee", "Меч", id);

/** Цель с Размером: у существа — system.size, у Орды — по Магнитуде (стр. 30). */
const target = size => ({ type: "character", system: { size } });

describe("Тирантикос: −10 к штрафу стрельбы парой стрелкового оружия", () => {
  const TWW = "dualWield.core.twoWeaponWielder";

  it("пара тяжёлого — штраф −20 становится −10", () => {
    const m = dualWieldMods(hero(TWW, CAP_TYRANTHIKOS), heavy("a"), heavy("b"));
    expect(m.pair).toBe(PAIR_PENALTY + 10);
    expect(m.reductions.map(r => r.label)).toEqual(["Тирантикос"]);
  });

  it("«любая пара стрелкового»: пистолеты, ручное, ручное + тяжёлое", () => {
    const has = (a, b) => dualWieldMods(hero(TWW, CAP_TYRANTHIKOS), a, b).reductions.map(r => r.label);
    expect(has(pistol("a"), pistol("b"))).toEqual(["Тирантикос"]);
    expect(has(basic("a"), basic("b"))).toEqual(["Тирантикос"]);
    expect(has(basic("a"), heavy("b"))).toEqual(["Тирантикос"]);
  });

  it("не на рукопашной паре и не на смеси стрелкового с рукопашным", () => {
    const has = (a, b) => dualWieldMods(hero(TWW, CAP_TYRANTHIKOS), a, b).reductions.map(r => r.label);
    expect(has(sword("a"), sword("b"))).toEqual([]);
    expect(has(heavy("a"), sword("b"))).toEqual([]);
    expect(has(sword("a"), pistol("b"))).toEqual([]);
  });

  it("метательное — не «стрелковое» (у метательных своя скидка, Веер Ножей)", () => {
    const has = (a, b) => dualWieldMods(hero(TWW, CAP_TYRANTHIKOS), a, b).reductions.map(r => r.label);
    expect(has(thrown("a"), thrown("b"))).toEqual([]);
  });

  it("складывается с Македонцем на паре пистолетов: штраф гаснет в ноль", () => {
    const m = dualWieldMods(hero(TWW, CAP_TYRANTHIKOS, "dualWield.core.gunslinger"), pistol("a"), pistol("b"));
    expect(m.pair).toBe(0);
  });

  it("без Таланта скидки нет", () => {
    expect(dualWieldMods(hero(TWW), heavy("a"), heavy("b")).pair).toBe(PAIR_PENALTY);
  });
});

describe("Тирантикос: +2d10 первому попаданию второй атаки", () => {
  const roll = (caps, main, off, tgt, firstHit) =>
    tyranthikosSecondAttackDice(hero(...caps), main, off, tgt, firstHit);

  it("две тяжёлые, цель Размера 2, первая рука попала — +2d10", () => {
    expect(roll([CAP_TYRANTHIKOS], heavy("a"), heavy("b"), target(2), true)).toBe(TYRANTHIKOS_BONUS_DICE);
    expect(TYRANTHIKOS_BONUS_DICE).toBe(2);
  });

  it("цель крупнее (Размер 4, техника) — тоже", () => {
    expect(roll([CAP_TYRANTHIKOS], heavy("a"), heavy("b"), { type: "vehicle", system: { size: 4 } }, true)).toBe(2);
  });

  it("первая рука промахнулась — ничего («попадает из обоих»)", () => {
    expect(roll([CAP_TYRANTHIKOS], heavy("a"), heavy("b"), target(2), false)).toBe(0);
  });

  it("цель Размера 1 — ничего («Размером 2 и более»)", () => {
    expect(roll([CAP_TYRANTHIKOS], heavy("a"), heavy("b"), target(1), true)).toBe(0);
  });

  it("цели нет (не выбрана) — ничего", () => {
    expect(roll([CAP_TYRANTHIKOS], heavy("a"), heavy("b"), null, true)).toBe(0);
  });

  it("одна из пары не тяжёлая — ничего («вооружён двумя тяжёлыми»)", () => {
    expect(roll([CAP_TYRANTHIKOS], heavy("a"), basic("b"), target(3), true)).toBe(0);
    expect(roll([CAP_TYRANTHIKOS], basic("a"), heavy("b"), target(3), true)).toBe(0);
  });

  it("без Таланта — ничего", () => {
    expect(roll([], heavy("a"), heavy("b"), target(3), true)).toBe(0);
  });

  it("Орда: Размер по Магнитуде, как во всех атаках по ней (стр. 30)", () => {
    // Магнитуда 10 — Размер 2 (rules/horde-damage.mjs::hordeSizeFor).
    const horde = m => ({ type: "horde", system: { size: 0, magnitude: { value: m } } });
    expect(roll([CAP_TYRANTHIKOS], heavy("a"), heavy("b"), horde(10), true)).toBe(2);
    expect(roll([CAP_TYRANTHIKOS], heavy("a"), heavy("b"), horde(5), true)).toBe(0);
  });
});

describe("бросок атаки: кубы Тирантикоса ложатся на первое попадание", () => {
  const card = () => captured.chat.at(-1)?.content ?? "";

  beforeEach(() => {
    resetCaptured();
    setTargets([]);
  });

  it("вторая рука попала — +2d10 к первому попаданию и строка в карточке", async () => {
    const weapon = weaponFor({ damage: "1d10", rof_single: 1 });
    const actor = actorFor({ items: [weapon] });
    // 10 — попадание (порог 45); 5 — урон 1d10; 3 и 4 — кубы Тирантикоса.
    captured.dice = [10, 5, 3, 4];

    const res = await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { tyranthikosDice: 2 });

    expect(card()).toContain('data-damage="12"'); // 5 + 3 + 4
    expect(card()).toContain("Тирантикос");
    expect(res?.hit).toBe(true);
  });

  it("вторая рука промахнулась — кубов нет, строки нет", async () => {
    const weapon = weaponFor({ damage: "1d10", rof_single: 1 });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [90];

    const res = await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, { tyranthikosDice: 2 });

    expect(card()).not.toContain("Тирантикос");
    expect(res?.hit).toBe(false);
  });

  it("без опции — обычный урон", async () => {
    const weapon = weaponFor({ damage: "1d10", rof_single: 1 });
    const actor = actorFor({ items: [weapon] });
    captured.dice = [10, 5];

    await _executeAttackRoll(actor, weapon, "bs", 45, "single", null, {});

    expect(card()).toContain('data-damage="5"');
  });
});

describe("окно атаки связывает обе руки", () => {
  // Окно (module/sheets/attack/dialog.mjs) живым DialogV2 в тестах не
  // поднимается — проверяются звенья цепочки по отдельности: обёртка Ока
  // Зависти отдаёт итог броска наружу, а окно этот итог читает и передаёт
  // ответ правила второй руке. Живое прощёлкивание — очередь testing.
  it("withEyeOfEnvy возвращает итог броска (по нему решается вторая рука)", async () => {
    const res = await withEyeOfEnvy({ system: {}, items: [] }, null, "bs", async () => ({ hit: true }));
    expect(res).toEqual({ hit: true });
  });

  it("окно передаёт кубы Тирантикоса второй руке по попаданию первой", () => {
    const src = fs.readFileSync(path.join(ROOT, "module/sheets/attack/dialog.mjs"), "utf8");
    expect(src).toMatch(/const mainResult = await withEyeOfEnvy\(/);
    // Обе руки именно СТРЕЛЯЮТ: удар прикладом (рукопашный профиль) не в счёт.
    expect(src).toMatch(/tyranthikosSecondAttackDice\(\s*actor, item, dualOff, targetActor, !!mainResult\?\.hit && !isMelee && !offMelee\)/);
    expect(src).toMatch(/allGunsBlazingMod: agbMod,\s*tyranthikosDice,/);
  });
});

describe("Талант в паке выдаёт возможность, реестр называет читателя", () => {
  it("документ Тирантикоса несёт ключ Возможности", () => {
    const doc = packDocById(TALENT_DIR, TALENT_ID);
    expect(itemHasKey(doc, CAP_TYRANTHIKOS)).toBe(true);
  });

  it("reader в capabilities.mjs не пустой и указывает на код", () => {
    expect(CAPABILITIES[CAP_TYRANTHIKOS]?.reader).toContain("dual-wield");
  });
});
