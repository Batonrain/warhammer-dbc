// test/sheets/attack-dialog.test.mjs
//
// Шаг 5.3: диалог атаки переезжает из листа в module/sheets/attack-dialog.mjs.
// Функции принимают актора, а не лист, поэтому проверяются без Foundry.
//
// Диалог сам ничего не считает про урон — он собирает выбор игрока (режим огня,
// прицел, ситуативные галочки, условные эффекты боеприпаса) в порог теста и
// отдаёт его конвейеру атаки. Проверяется ровно это: что попало в разметку, что
// вышло в порог и что дошло до карточки броска.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, fakeForm, checkbox } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor, ammoFor, setTargets } from "../support/combat-fixtures.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { showAttackDialog, showAttackDialogWithTechnique,
         showAttackDialogNoWeapon } from "../../module/sheets/attack-dialog.mjs";

const DEFAULT_SOURCES = getRuleSources();

/** Актор-атакующий: диалог сбрасывает ему прицеливание, тест смотрит на запись. */
function attacker({ items = [], ...system } = {}) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none", ...system });
  a.updates = [];
  a.update = async data => { a.updates.push(data); };
  return a;
}

/** Число, с которым окно открылось, — то самое, что видит игрок. */
function dialogThreshold() {
  const m = (captured.dialog?.content ?? "").match(/id="atk-total-display">(-?\d+)</);
  return m ? Number(m[1]) : null;
}

/** Порог, напечатанный в карточке броска. */
function thresholdInCard() {
  const m = (captured.chat.at(-1)?.content ?? "").match(/<label>Порог<\/label><b>(-?\d+)<\/b>/);
  return m ? Number(m[1]) : null;
}

/** Форма открытого окна с полями по умолчанию — то, что вернёт button.form. */
function attackForm(fields = {}, checks = {}) {
  return fakeForm({ "#atk-char": "bs", "#atk-modifier": "0", "#atk-aim": "", ...fields }, checks);
}

/** Нажать «Бросок!» с заданными полями и галочками. */
async function pressRoll(promise, fields = {}, checks = {}) {
  await captured.press("roll", attackForm(fields, checks));
  return promise;
}

/** Узел окна, который стрингует запись в textContent — как настоящий DOM. */
function textNode() {
  let text = "";
  return {
    get textContent() { return text; },
    set textContent(v) { text = String(v); },
    style: {}, classList: { add: () => {}, remove: () => {} }
  };
}

beforeEach(() => {
  resetCaptured();
  setTargets([]);
  captured.dice = [23, 6];
});

afterEach(() => {
  clearRuleSources();
  for (const [key, fn] of Object.entries(DEFAULT_SOURCES)) registerRuleSource(key, fn);
});

describe("разметка диалога: стрелковое оружие", () => {
  it("режимы огня строятся по скорострельности оружия", () => {
    const weapon = weaponFor({ rof_single: 1, rof_semi: 2, rof_full: 0 });
    showAttackDialog(attacker({ items: [weapon] }), weapon);
    const html = captured.dialog.content;

    expect(html).toContain("Одиночный выстрел (+10)");
    expect(html).toContain("Короткая очередь (±0, 2 выстр.)");
    expect(html).not.toContain("Длинная очередь");           // rof_full = 0
    expect(html).toContain("Стрельба на подавление (−20)");
    expect(html).not.toContain("Натиск");                     // это рукопашный режим
  });

  it("блок дистанций считает дальность с учётом боеприпаса", () => {
    const ammo   = ammoFor({ rangeMultiplier: 0.5, rangeMod: 10 });
    const weapon = weaponFor({ range: 100, loadedAmmoId: ammo.id });
    showAttackDialog(attacker({ items: [weapon, ammo] }), weapon);

    // 100 × 0,5 + 10 = 60м; половина боевой дистанции — 30м.
    expect(captured.dialog.content).toContain("Rng = 100м ×0.5 +10м = 60м");
    expect(captured.dialog.content).toContain("Боевая: 30–60м");
  });

  it("показывает заряженный боеприпас и магазин", () => {
    const ammo   = ammoFor({}, { name: "Разрывные" });
    const weapon = weaponFor({ magazineCur: 6, magazineMax: 24, loadedAmmoId: ammo.id });
    showAttackDialog(attacker({ items: [weapon, ammo] }), weapon);

    expect(captured.dialog.content).toContain("Разрывные");
    expect(captured.dialog.content).toContain("Магазин: <b>6/24</b>");
  });

  it("порог складывает характеристику, бонус оружия, боеприпас и прицеливание", () => {
    const ammo   = ammoFor({ attackMod: 5 });
    const weapon = weaponFor({ attackBonus: 10, loadedAmmoId: ammo.id });
    showAttackDialog(attacker({ items: [weapon, ammo], aiming: "full" }), weapon);

    expect(dialogThreshold()).toBe(80);        // BS 45 + 10 + 5 + прицел 20
  });

  it("Неточное оружие не даёт бонуса за прицеливание", () => {
    const weapon = weaponFor({ weaponProps: [{ key: "inaccurate" }] });
    showAttackDialog(attacker({ items: [weapon], aiming: "full" }), weapon);

    expect(dialogThreshold()).toBe(45);
  });
});

describe("разметка диалога: рукопашное оружие", () => {
  const sword = (system = {}, opts = {}) =>
    weaponFor({ weaponClass: "melee", damage: "1d10+3", rof_single: 0, ...system },
              { name: "Цепной меч", ...opts });

  it("режимы рукопашной вместо очередей, без дистанций и магазина", () => {
    const weapon = sword();
    showAttackDialog(attacker({ items: [weapon] }), weapon);
    const html = captured.dialog.content;

    expect(html).toContain("Рукопашная атака (±0)");
    expect(html).toContain("Натиск (+20, движение ≥4м)");
    expect(html).not.toContain("Дистанции (Rng");
    expect(html).not.toContain("Магазин:");
  });

  it("стойка входит в порог и показывается бейджем", () => {
    const weapon = sword();
    showAttackDialog(attacker({ items: [weapon], meleeStance: "aggressive" }), weapon);

    expect(dialogThreshold()).toBe(55);        // WS 45 + Агрессивная 10
    expect(captured.dialog.content).toContain("Стойка: +10");
  });

  it("качество рукопашного оружия меняет порог", () => {
    const weapon = sword({ quality: "best" });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    expect(dialogThreshold()).toBe(55);        // WS 45 + Лучшее +10
  });

  it("вторичный хват из HUD применяется молча и попадает в сводку", () => {
    const weapon = sword({ grips: "1р (Об)" },
                         { flags: { "warhammer-dbc.hudGrip": "Об" } });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    expect(dialogThreshold()).toBe(35);        // WS 45 − 10 за Обратный хват
    expect(captured.dialog.content).toContain("Хват: Обратный (Об) · WS -10");
  });

  it("цепное оружие можно погасить, стрелковое — нет", () => {
    const chain = sword({ weaponType: "chain" });
    showAttackDialog(attacker({ items: [chain] }), chain);
    expect(captured.dialog.content).toContain("Оружие выключено");

    const gun = weaponFor({ weaponType: "chain" });
    showAttackDialog(attacker({ items: [gun] }), gun);
    expect(captured.dialog.content).not.toContain("Оружие выключено");
  });
});

describe("избирательные попадания", () => {
  it("Точное оружие снимает часть штрафа за сочленение и глаз", () => {
    const weapon = weaponFor({ weaponProps: [{ key: "precise" }] });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    expect(captured.dialog.content).toContain("Сочленение/Шея (-20)");   // −40 + 20
    expect(captured.dialog.content).toContain("Глаз (-30)");             // −50 + 20
    expect(captured.dialog.content).toContain("Голова (−20)");           // не Точное — как в книге
  });

  it("Неточное оружие вовсе не даёт целиться в часть тела", () => {
    const weapon = weaponFor({ weaponProps: [{ key: "imprecise" }] });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    expect(captured.dialog.content).toContain("— Без прицела —");
    expect(captured.dialog.content).not.toContain("Голова");
  });
});

describe("свойства оружия и полосы дальности", () => {
  it("Мельта и Максимальное дают свои галочки", () => {
    const weapon = weaponFor({ weaponProps: [{ key: "melta" }, { key: "maximal" }] });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    expect(captured.dialog.content).toContain("Мельта ×2 Проб.");
    expect(captured.dialog.content).toContain("atk-maximal");
  });

  it("полосы дальности из профиля становятся списком", () => {
    const weapon = weaponFor({ rangeBands: [{ label: "Ближе 10м", dice: 1, pen: 2 }] });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    expect(captured.dialog.content).toContain('<select id="atk-band">');
    expect(captured.dialog.content).toContain("Ближе 10м — +1d10 урона, +2 Проб.");
  });

  it("без особых свойств лишних галочек нет", () => {
    const weapon = weaponFor();
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    expect(captured.dialog.content).not.toContain("atk-maximal");
    expect(captured.dialog.content).not.toContain("atk-shortrange");
    expect(captured.dialog.content).not.toContain('<select id="atk-band">');
  });
});

describe("усталость и условные эффекты боеприпаса", () => {
  it("Усталость отмечена заранее — её штраф нельзя проглядеть", () => {
    const weapon = weaponFor();
    showAttackDialog(attacker({ items: [weapon], fatigue: { value: 2 } }), weapon);

    expect(captured.dialog.content).toMatch(/atk-mod-auto[\s\S]*?Усталость/);
    expect(captured.dialog.content).toContain("−10");
  });

  it("условные модификаторы боеприпаса даются галочками, а не молча", () => {
    const ammo = ammoFor({ condMods: [
      { label: "против псайкеров", atk: 30, dmg: 2 },
      { label: "только памятка" }
    ] }, { name: "Псионические" });
    const weapon = weaponFor({ loadedAmmoId: ammo.id });
    showAttackDialog(attacker({ items: [weapon, ammo] }), weapon);
    const html = captured.dialog.content;

    expect(html).toContain('class="atk-ammo-cond"');
    expect(html).toContain('data-atk="30"');
    expect(html).toContain("+2 урона");
    // Пункт без чисел — памятка: галочке нечего прибавлять.
    expect(html).toMatch(/avc-row-note[^]*только памятка/);
  });

  it("отмеченный условный эффект поднимает порог и попадает в карточку", async () => {
    const ammo = ammoFor({ condMods: [{ label: "против псайкеров", atk: 30 }] });
    const weapon = weaponFor({ loadedAmmoId: ammo.id });
    const actor  = attacker({ items: [weapon, ammo] });
    const p = showAttackDialog(actor, weapon);
    await pressRoll(p, {}, { ".atk-ammo-cond:checked": [{ dataset: { idx: "0", atk: "30" } }] });

    expect(thresholdInCard()).toBe(75);        // 45 + 30
    expect(captured.chat.at(-1).content).toContain("против псайкеров");
  });
});

describe("бросок из диалога", () => {
  it("ситуативные галочки и доп. мод складываются в порог броска", async () => {
    const weapon = weaponFor();
    const actor  = attacker({ items: [weapon] });
    const p = showAttackDialog(actor, weapon);
    await pressRoll(p,
      { "#atk-modifier": "-5", "input[name='atk-rof']:checked": { dataset: { bonus: "10" } } },
      { ".atk-mod-cb:not([data-autofail]):checked": [checkbox(20), checkbox(-10)] });

    expect(thresholdInCard()).toBe(60);        // 45 − 5 + 10 + 20 − 10
  });

  it("особые атаки прибавляются к порогу", async () => {
    const weapon = weaponFor();
    const p = showAttackDialog(attacker({ items: [weapon] }), weapon);
    await pressRoll(p, { "#atk-swift": true, "#atk-allout": true });

    expect(thresholdInCard()).toBe(75);        // 45 + 10 + 20
  });

  it("прицеливание тратится броском", async () => {
    const weapon = weaponFor();
    const actor  = attacker({ items: [weapon], aiming: "full" });
    const p = showAttackDialog(actor, weapon);
    await pressRoll(p);

    expect(actor.updates).toContainEqual({ "system.aiming": "none" });
  });

  it("отмена не бросает кубы и не пишет в чат", async () => {
    const weapon = weaponFor();
    const p = showAttackDialog(attacker({ items: [weapon] }), weapon);
    await captured.press("cancel", attackForm());

    await expect(p).resolves.toBeNull();
    expect(captured.chat).toHaveLength(0);
    expect(captured.rolls).toHaveLength(0);
  });

  it("закрытие окна равнозначно отмене, а не ошибке", async () => {
    const weapon = weaponFor();
    const p = showAttackDialog(attacker({ items: [weapon] }), weapon);
    // rejectClose по умолчанию true: без этой строки закрытое окно роняло бы
    // необработанным отказом каждого, кто ждёт результата атаки.
    expect(captured.dialog.rejectClose).toBe(false);
    captured.dismiss();

    await expect(p).resolves.toBeNull();
    expect(captured.chat).toHaveLength(0);
  });
});

describe("пересчёт порога в открытом окне", () => {
  it("показанное число — ровно то, что уйдёт в бросок", async () => {
    const weapon = weaponFor();
    const p = showAttackDialog(attacker({ items: [weapon] }), weapon);

    // Одна и та же форма: сперва её читает живой пересчёт, потом — сам бросок.
    // Разъедься эти два чтения, игрок увидел бы одно число, а кинул другое.
    const display = textNode();
    const form = attackForm(
      { "#atk-modifier": "-5",
        "input[name='atk-rof']:checked": { dataset: { bonus: "10" } },
        "#atk-total-display": display, ".av-adv-hint": textNode() },
      { ".atk-mod-cb:not([data-autofail]):checked": [checkbox(20)],
        ".atk-mod-cb:checked": [checkbox(20)] });

    captured.rerender(form);
    expect(display.textContent).toBe("70");                 // 45 − 5 + 10 + 20

    await captured.press("roll", form);
    expect(thresholdInCard()).toBe(Number(display.textContent));
    await p;
  });

  it("сводка в заголовке считает отмеченные ситуативные", () => {
    const weapon = weaponFor();
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    const hint = textNode();
    captured.rerender(attackForm(
      { "#atk-total-display": textNode(), ".av-adv-hint": hint },
      { ".atk-mod-cb:not([data-autofail]):checked": [checkbox(20)],
        ".atk-mod-cb:checked": [checkbox(20)] }));

    expect(hint.textContent).toContain("активно 1");
  });

  it("Ослеплён у стрелкового — автоматический провал вместо броска", async () => {
    const weapon = weaponFor();
    const p = showAttackDialog(attacker({ items: [weapon] }), weapon);
    expect(captured.dialog.content).toContain('data-autofail="true"');

    const display = textNode();
    const form = attackForm({ "#atk-total-display": display, ".av-adv-hint": textNode() },
      { ".atk-mod-cb[data-autofail]:checked": [checkbox(0)] });
    captured.rerender(form);
    expect(display.textContent).toBe("ПРОВАЛ");

    await captured.press("roll", form);
    expect(captured.chat.at(-1).content).toContain("Автоматический провал (Ослеплён)");
    expect(captured.rolls).toHaveLength(0);
    await expect(p).resolves.toBeNull();
  });

  it("в рукопашной Ослеплён — это штраф, а не провал", () => {
    const sword = weaponFor({ weaponClass: "melee" });
    showAttackDialog(attacker({ items: [sword] }), sword);

    expect(captured.dialog.content).not.toContain('data-autofail="true"');
    expect(captured.dialog.content).toContain("Ослеплён (-30)");
  });
});

describe("правила реестра в диалоге", () => {
  it("галочка правила меняет порог броска", async () => {
    clearRuleSources();
    registerRuleSource("test", () => [{ id: "r", label: "Проверочное правило",
      effects: [{ kind: "rollBonus", target: "attack", value: 15 }] }]);

    const weapon = weaponFor();
    const p = showAttackDialog(attacker({ items: [weapon] }), weapon);
    expect(captured.dialog.content).toContain("Проверочное правило");

    await pressRoll(p, {}, { ".rule-mod:checked": [checkbox(15)] });
    expect(thresholdInCard()).toBe(60);
  });
});

describe("приём с оружием", () => {
  it("бонус приёма входит в порог, а приём и стойка видны в окне", () => {
    const sword = weaponFor({ weaponClass: "melee" }, { name: "Цепной меч" });
    const techDef = { label: "Пила", wsBonus: -10, note: "WS −10.",
                      chatNote: "⚡ Игнорирует силовые щиты", targetDodgeMod: 0, targetParryMod: 0 };
    showAttackDialogWithTechnique(attacker({ items: [sword] }), sword,
      techDef, { label: "Агрессивная" }, "saw");

    expect(dialogThreshold()).toBe(35);        // WS 45 − 10
    expect(captured.dialog.content).toContain("Приём: <b>Пила</b>");
    expect(captured.dialog.content).toContain("Стойка: <b>Агрессивная</b>");
  });
});

describe("приём без оружия", () => {
  const kick = { label: "Пинок", wsBonus: -10, damage: "1d5-1+S.b",
                 damageAstartes: "1d10+2+S.b", damageType: "impact", pen: 0 };

  it("порог собирается из WS, приёма, стойки и усталости", async () => {
    captured.dice = [30, 4];
    const actor = attacker({ meleeStance: "aggressive", fatigue: { value: 1 } });
    await showAttackDialogNoWeapon(actor, kick);

    // WS 45 − 10 приём + 10 стойка − 10 усталость = 35; бросок 30 → попадание.
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Порог: <b>35</b>");
    expect(card).toContain("Попадание");
    expect(card).toContain("wh-dodge-btn");
  });

  it("промах не предлагает защищаться", async () => {
    captured.dice = [96];
    await showAttackDialogNoWeapon(attacker(), kick);

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Промах");
    expect(card).not.toContain("wh-dodge-btn");
    expect(card).not.toContain("wh-apply-dmg-btn");
  });

  it("урон кидается и вешается кнопкой применения", async () => {
    captured.dice = [10, 3];
    await showAttackDialogNoWeapon(attacker(), kick);

    // 1d5−1+S.b при S 40 (бонус 4): 3 − 1 + 4 = 6.
    const card = captured.chat.at(-1).content;
    expect(card).toContain('data-damage="6"');
    expect(card).toContain("Применить урон: 6 → Торс");
    expect(card).not.toContain("профиль Астартес");
  });

  it("правило «профиль Астартес» переключает формулу удара", async () => {
    clearRuleSources();
    registerRuleSource("test", () => [{ id: "a", label: "Астартес",
      effects: [{ kind: "grantFlag", target: "unarmed.astartesProfile" }] }]);
    captured.dice = [10, 8];
    await showAttackDialogNoWeapon(attacker(), kick);

    // 1d10+2+S.b: 8 + 2 + 4 = 14.
    const card = captured.chat.at(-1).content;
    expect(card).toContain('data-damage="14"');
    expect(card).toContain("профиль Астартес");
  });
});
