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
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
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

    expect(html).toContain("Рукопашная атака");
    expect(html).not.toContain("Натиск (+20, движение ≥4м)");   // переехал в персистентную Базу
    expect(html).not.toContain("Дистанции (Rng");
    expect(html).not.toContain("Магазин:");
  });

  it("стойка входит в порог и показывается бейджем", () => {
    const weapon = sword();
    showAttackDialog(attacker({ items: [weapon], meleeStance: "aggressive" }), weapon);

    expect(dialogThreshold()).toBe(65);        // WS 45 + База «Стандартная» 10 + Агрессивная 10
    expect(captured.dialog.content).toContain("Стойка: +10");
  });

  it("качество рукопашного оружия меняет порог", () => {
    const weapon = sword({ quality: "best" });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    expect(dialogThreshold()).toBe(65);        // WS 45 + База «Стандартная» 10 + Лучшее +10
  });

  it("вторичный хват из HUD применяется молча и попадает в сводку", () => {
    const weapon = sword({ grips: "1р (Об)" },
                         { flags: { "warhammer-dbc.hudGrip": "Об" } });
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    expect(dialogThreshold()).toBe(45);        // WS 45 + База «Стандартная» 10 − 10 за Обратный хват
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

  // «Не для прицельных атак в сочленения и глаза» — закрыты ровно эти две цели.
  // Раньше Неточное убирало из списка все Избирательные разом, включая руки,
  // ноги и голову, которых запрет не касается.
  it("Неточное закрывает сочленения и глаза, но не конечности", () => {
    const weapon = weaponFor({ weaponProps: [{ key: "imprecise" }] });
    showAttackDialog(attacker({ items: [weapon] }), weapon);
    const html = captured.dialog.content;

    expect(html).toContain("— Без прицела —");
    expect(html).toContain("Нога (−15)");
    expect(html).toContain("Рука (−20)");
    expect(html).toContain("Голова (−20)");
    expect(html).not.toContain("Сочленение");
    expect(html).not.toContain("Глаз");
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
  it("бонус приёма входит в порог, а Приём и Стойка — выбираемые пилюли в окне", () => {
    const sword = weaponFor({ weaponClass: "melee" }, { name: "Цепной меч" });
    const techDef = { label: "Пила", wsBonus: -10, note: "WS −10.",
                      chatNote: "⚡ Игнорирует силовые щиты", targetDodgeMod: 0, targetParryMod: 0 };
    showAttackDialogWithTechnique(attacker({ items: [sword] }), sword,
      techDef, { label: "Агрессивная" }, "saw");

    expect(dialogThreshold()).toBe(45);        // WS 45 + База «Стандартная» 10 − 10 Пила
    // Приём открыт с предустановленным ключом "saw" — пилюля отмечена, а не
    // застывшая надпись: игрок волен выбрать другой Приём прямо в этом окне.
    expect(captured.dialog.content).toMatch(/name="atk-maneuver" value="saw" checked/);
    expect(captured.dialog.content).toContain("Пила");
    // Стойка не привязана к техDef — читается из актора (по умолчанию Стандартная).
    expect(captured.dialog.content).toMatch(/name="atk-stance" value="standard" checked/);
  });
});

/** Талант со специализацией — как его резолвит item-picker.mjs при покупке. */
const talentFor = (name, specialization) => ({ type: "talent", name, system: { specialization } });

describe("Арсенал: доступность Стойки/Хвата/Базы/Приёма в окне", () => {
  it("без Рукопашной Тренировки — только Обычная Атака/Стандартная Стойка/1-й Хват, остальное disabled", () => {
    const sword = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "1р (2р)" });
    showAttackDialog(attacker({ items: [sword] }), sword);
    const html = captured.dialog.content;

    expect(html).toMatch(/name="atk-maneuver" value="standard"[^>]*checked/);
    expect(html).toMatch(/name="atk-maneuver" value="sweep"[^>]*disabled/);
    expect(html).toMatch(/name="atk-stance" value="aggressive"[^>]*disabled/);
    expect(html).toMatch(/name="atk-grip" value="2р"[^>]*disabled/);
    // База книгой не ограничена Талантом — Стандартная/Натиск/Полная/Осторожная
    // доступны и без Тренировки; Верховая Атака недоступна отдельно (не верхом).
    expect(html).not.toMatch(/name="atk-base" value="standard"[^>]*disabled/);
    expect(html).not.toMatch(/name="atk-base" value="charge"[^>]*disabled/);
    expect(html).not.toMatch(/name="atk-base" value="fullatk"[^>]*disabled/);
    expect(html).not.toMatch(/name="atk-base" value="careful"[^>]*disabled/);
    expect(html).toMatch(/name="atk-base" value="mounted"[^>]*disabled/);
    expect(html).toContain("Без Тренировки (Меч)");
  });

  it("с подходящей Рукопашной Тренировкой — всё разрешено (кроме Приёмов другой категории)", () => {
    const sword = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "1р (2р)" });
    const training = talentFor("Melee Training / Рукопашная Тренировка", "Меч");
    showAttackDialog(attacker({ items: [sword, training] }), sword);
    const html = captured.dialog.content;

    expect(html).not.toContain("Без Тренировки");
    expect(html).not.toMatch(/name="atk-stance" value="aggressive"[^>]*disabled/);
    expect(html).not.toMatch(/name="atk-grip" value="2р"[^>]*disabled/);
    // «Захват» — категории Когти/Кулаки/Крюк/Укус, «Меч» туда не входит.
    expect(html).toMatch(/name="atk-maneuver" value="grapple"[^>]*disabled/);
    expect(html).not.toMatch(/name="atk-maneuver" value="sweep"[^>]*disabled/);
  });

  it("без meleeCategory на предмете — фильтр не применяется (данные ещё не пришли из пака)", () => {
    const sword = weaponFor({ weaponClass: "melee" });   // meleeCategory не задан
    showAttackDialog(attacker({ items: [sword] }), sword);
    const html = captured.dialog.content;

    expect(html).not.toContain("Без Тренировки");
    expect(html).not.toMatch(/name="atk-maneuver"[^>]*disabled/);
  });

  it("Свободная Атака доступна без Тренировки, как Обычная Атака", () => {
    const sword = weaponFor({ weaponClass: "melee", meleeCategory: "Меч" });
    showAttackDialog(attacker({ items: [sword] }), sword);
    expect(captured.dialog.content).not.toMatch(/name="atk-maneuver" value="freeattack"[^>]*disabled/);
  });

  it("Верховая Атака доступна только персонажу верхом на байке/скакуне", () => {
    const sword = weaponFor({ weaponClass: "melee" });
    showAttackDialog(attacker({ items: [sword] }), sword);
    expect(captured.dialog.content).toMatch(/name="atk-base" value="mounted"[^>]*disabled/);

    resetCaptured();
    showAttackDialog(attacker({ items: [sword], mount: { uuid: "Actor.mount-1" } }), sword);
    expect(captured.dialog.content).not.toMatch(/name="atk-base" value="mounted"[^>]*disabled/);
  });

  it("Пружинящая Стойка требует Баланс не ниже 0", () => {
    const knife = weaponFor({ weaponClass: "melee", balance: -1 });
    showAttackDialog(attacker({ items: [knife] }), knife);
    expect(captured.dialog.content).toMatch(/name="atk-stance" value="springing"[^>]*disabled/);

    resetCaptured();
    const sword = weaponFor({ weaponClass: "melee", balance: 0 });
    showAttackDialog(attacker({ items: [sword] }), sword);
    expect(captured.dialog.content).not.toMatch(/name="atk-stance" value="springing"[^>]*disabled/);
  });

  it("Частокол доступен только Глефе/Копью/Штыку и запрещает Натиск, пока выбран", () => {
    const mace = weaponFor({ weaponClass: "melee", meleeCategory: "Булава" });
    showAttackDialog(attacker({ items: [mace] }), mace);
    expect(captured.dialog.content).toMatch(/name="atk-stance" value="rapidstrike"[^>]*disabled/);

    resetCaptured();
    const spear = weaponFor({ weaponClass: "melee", meleeCategory: "Копьё" });
    const training = talentFor("Melee Training / Рукопашная Тренировка", "Копьё");
    showAttackDialog(attacker({ items: [spear, training], meleeStance: "rapidstrike" }), spear);
    const html = captured.dialog.content;
    expect(html).not.toMatch(/name="atk-stance" value="rapidstrike"[^>]*disabled/);
    // Актор уже в Частоколе при открытии окна — Натиск сразу недоступен.
    expect(html).toMatch(/name="atk-base" value="charge"[^>]*disabled/);
  });

  it("Защитная Стойка без щита блокирует бросок; со щитом — нет", async () => {
    const sword = weaponFor({ weaponClass: "melee" });
    const p = showAttackDialog(attacker({ items: [sword], meleeStance: "defensive" }), sword);

    const display = textNode();
    captured.rerender(attackForm({ "#atk-total-display": display, ".av-adv-hint": textNode() }));
    expect(display.textContent).toBe("ЗАБЛОКИРОВАНО");

    await pressRoll(p, {});
    expect(captured.chat.at(-1).content).toContain("атака запрещена");
    expect(captured.rolls).toHaveLength(0);
    await expect(p).resolves.toBeNull();

    resetCaptured();
    const shield = { id: "shield-1", type: "weapon",
      system: { weaponClass: "melee", equipped: true, shieldAP: 5 }, getFlag: () => undefined };
    const sword2 = weaponFor({ weaponClass: "melee" });
    const p2 = showAttackDialog(attacker({ items: [sword2, shield], meleeStance: "defensive" }), sword2);
    const display2 = textNode();
    captured.rerender(attackForm({ "#atk-total-display": display2, ".av-adv-hint": textNode() }));
    expect(display2.textContent).not.toBe("ЗАБЛОКИРОВАНО");
    captured.dismiss();
    await p2;
  });

  it("Стойка цели (Защитная/Прикрывающая) меняет порог атакующего", () => {
    const sword = weaponFor({ weaponClass: "melee" });
    const target = attacker({ meleeStance: "defensive" });
    setTargets([target]);
    showAttackDialog(attacker({ items: [sword] }), sword);
    expect(captured.dialog.content).toContain("Цель: Защитная (-20)");
    expect(dialogThreshold()).toBe(35);   // WS 45 + База «Стандартная» 10 − 20 (цель в Защитной Стойке)
  });
});

describe("приём без оружия", () => {
  const kick = { label: "Пинок", wsBonus: -10, damage: "1d5-1+S.b",
                 damageAstartes: "1d10+2+S.b", damageType: "impact", pen: 0 };

  it("порог собирается из WS, приёма, стойки и усталости", async () => {
    captured.dice = [30, 4];
    const actor = attacker({ meleeStance: "aggressive", fatigue: { value: 1 } });
    await showAttackDialogNoWeapon(actor, kick);

    // WS 45 + 10 база − 10 приём + 10 стойка − 10 усталость = 45; бросок 30 → попадание.
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Порог: <b>45</b>");
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

// Локус Сокрушения (стр. 31, module/constants/capabilities.mjs —
// "technique.baseFullAttack"): раз в Раунд любая рукопашная атака считается
// имеющей Базу «Полная Атака» (+30 вместо персистентного system.meleeBase).
describe("Локус Сокрушения: раз в Раунд База «Полная Атака»", () => {
  /** Актор с getFlag/setFlag — «раз-в-Раунд» метка хранится флагом на акторе. */
  function actorWithFlags(overrides = {}) {
    const a = attacker(overrides);
    const store = {};
    a.getFlag = (scope, key) => store[`${scope}.${key}`];
    a.setFlag = async (scope, key, value) => { store[`${scope}.${key}`] = value; };
    return a;
  }

  function grantCapability() {
    registerRuleSource("test", () => [{ id: "loc-sokrusheniya", label: "Локус Сокрушения",
      effects: [{ kind: "grantFlag", target: "technique.baseFullAttack" }] }]);
  }

  afterEach(() => { globalThis.game.combat = undefined; });

  describe("оружие (showAttackDialog)", () => {
    it("порог и бейдж отражают Базу «Полная Атака», пока способность не потрачена", () => {
      globalThis.game.combat = { round: 1 };
      grantCapability();
      const sword = weaponFor({ weaponClass: "melee" });
      showAttackDialog(actorWithFlags({ items: [sword] }), sword);

      expect(dialogThreshold()).toBe(75);        // WS 45 + База «Полная Атака» +30
      expect(captured.dialog.content).toContain("Локус Сокрушения");
    });

    it("уже потраченная в этом Раунде — обычная персистентная База", async () => {
      globalThis.game.combat = { round: 1 };
      grantCapability();
      const sword = weaponFor({ weaponClass: "melee" });
      const actor = actorWithFlags({ items: [sword] });
      await actor.setFlag("warhammer-dbc", "usageLimits.technique-baseFullAttack",
        { scope: "round", used: true, round: 1 });

      showAttackDialog(actor, sword);
      expect(dialogThreshold()).toBe(55);        // WS 45 + База «Стандартная» +10
      expect(captured.dialog.content).not.toContain("Локус Сокрушения");
    });

    it("бросок расходует способность до конца текущего Раунда", async () => {
      globalThis.game.combat = { round: 1 };
      grantCapability();
      const sword = weaponFor({ weaponClass: "melee" });
      const actor = actorWithFlags({ items: [sword] });

      const p1 = showAttackDialog(actor, sword);
      await pressRoll(p1);
      expect(actor.getFlag("warhammer-dbc", "usageLimits.technique-baseFullAttack"))
        .toMatchObject({ round: 1 });

      const p2 = showAttackDialog(actor, sword);
      expect(dialogThreshold()).toBe(55);        // способность уже потрачена
      await captured.press("cancel", attackForm());
      await p2;
    });

    it("отменённое окно не тратит способность", async () => {
      globalThis.game.combat = { round: 1 };
      grantCapability();
      const sword = weaponFor({ weaponClass: "melee" });
      const actor = actorWithFlags({ items: [sword] });

      const p = showAttackDialog(actor, sword);
      await captured.press("cancel", attackForm());
      await p;

      expect(actor.getFlag("warhammer-dbc", "usageLimits.technique-baseFullAttack")).toBeUndefined();
    });

    it("новый Раунд возвращает способность", async () => {
      globalThis.game.combat = { round: 1 };
      grantCapability();
      const sword = weaponFor({ weaponClass: "melee" });
      const actor = actorWithFlags({ items: [sword] });
      const p1 = showAttackDialog(actor, sword);
      await pressRoll(p1);

      globalThis.game.combat = { round: 2 };
      showAttackDialog(actor, sword);
      expect(dialogThreshold()).toBe(75);
    });

    it("без активного Combat способность доступна всегда — раунд отследить нечем", () => {
      grantCapability();
      const sword = weaponFor({ weaponClass: "melee" });
      showAttackDialog(actorWithFlags({ items: [sword] }), sword);

      expect(dialogThreshold()).toBe(75);
    });

    it("на стрелковое оружие не действует", () => {
      globalThis.game.combat = { round: 1 };
      grantCapability();
      const weapon = weaponFor();
      showAttackDialog(actorWithFlags({ items: [weapon] }), weapon);

      expect(captured.dialog.content).not.toContain("Локус Сокрушения");
    });
  });

  describe("голыми руками (showAttackDialogNoWeapon)", () => {
    const kick = { label: "Пинок", wsBonus: -10, damage: "1d5-1+S.b",
                   damageAstartes: "1d10+2+S.b", damageType: "impact", pen: 0 };

    it("подменяет Базу на «Полная Атака» (+30 вместо +10)", async () => {
      globalThis.game.combat = { round: 1 };
      grantCapability();
      captured.dice = [30, 4];
      await showAttackDialogNoWeapon(actorWithFlags(), kick);

      // WS 45 + 30 (Полная Атака) − 10 (Пинок) = 65.
      const card = captured.chat.at(-1).content;
      expect(card).toContain("Порог: <b>65</b>");
      expect(card).toContain("Локус Сокрушения");
    });

    it("расходуется за Раунд: вторая безоружная атака — обычная База", async () => {
      globalThis.game.combat = { round: 1 };
      grantCapability();
      const actor = actorWithFlags();
      captured.dice = [30, 4];
      await showAttackDialogNoWeapon(actor, kick);

      captured.dice = [30, 4];
      await showAttackDialogNoWeapon(actor, kick);

      // WS 45 + 10 (обычная База) − 10 (Пинок) = 45 — способность уже потрачена.
      const card = captured.chat.at(-1).content;
      expect(card).toContain("Порог: <b>45</b>");
      expect(card).not.toContain("Локус Сокрушения");
    });

    it("новый Раунд возвращает способность", async () => {
      globalThis.game.combat = { round: 1 };
      grantCapability();
      const actor = actorWithFlags();
      captured.dice = [30, 4];
      await showAttackDialogNoWeapon(actor, kick);

      globalThis.game.combat = { round: 2 };
      captured.dice = [30, 4];
      await showAttackDialogNoWeapon(actor, kick);

      const card = captured.chat.at(-1).content;
      expect(card).toContain("Порог: <b>65</b>");
    });
  });
});
