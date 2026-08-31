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
import { showAttackDialog, showAttackDialogNoWeapon } from "../../module/sheets/attack-dialog.mjs";

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

/** Тот же приём, но для innerHTML — построчная разбивка порога пишет в него. */
function htmlNode() {
  let html = "";
  return { get innerHTML() { return html; }, set innerHTML(v) { html = String(v); } };
}

/** Сумма всех <b>±N</b> в HTML построчной разбивки — должна равняться итогу. */
function sumBreakdown(html) {
  return [...html.matchAll(/<b>([+-]?\d+)<\/b>/g)].reduce((n, m) => n + Number(m[1]), 0);
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

  // Взрывное: можно целиться под цель вместо неё самой (−20, Избирательная) —
  // тогда промах смещает взрыв по розе, а не пропадает бесследно (attack.mjs,
  // module/combat/scatter.mjs), а не только предупреждает как noCalledShot.
  it("Взрывное добавляет прицел «Под цель», обычное оружие — нет", () => {
    const blast = weaponFor({ weaponProps: [{ key: "blast", rating: 3 }] });
    showAttackDialog(attacker({ items: [blast] }), blast);
    expect(captured.dialog.content).toContain('value="underfoot"');
    expect(captured.dialog.content).toContain("Под цель (Взрывное, −20)");

    const plain = weaponFor();
    showAttackDialog(attacker({ items: [plain] }), plain);
    expect(captured.dialog.content).not.toContain("underfoot");
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

  it("особые атаки (Атака всем телом) прибавляются к порогу", async () => {
    const weapon = weaponFor();
    const p = showAttackDialog(attacker({ items: [weapon] }), weapon);
    await pressRoll(p, { "#atk-allout": true });

    expect(thresholdInCard()).toBe(65);        // 45 + 20
  });

  // Быстрая/Молниеносная Атака переехали в Приём (стр. 14) — доступны только
  // с соответствующим Талантом (requiresCapability), их штраф теперь идёт
  // через обычный bonus Приёма (mDef.wsBonus), не отдельной галочкой.
  it("Быстрая Атака — Приём с requiresCapability, штраф −10 входит в порог как обычный Приём", async () => {
    registerRuleSource("test", () => [{ id: "a", label: "Тест",
      effects: [{ kind: "grantFlag", target: "technique.swiftAttack" }] }]);
    const weapon = weaponFor({ weaponClass: "melee" });
    const p = showAttackDialog(attacker({ items: [weapon] }), weapon);
    expect(captured.dialog.content).toMatch(/name="atk-maneuver" value="swift"/);

    // Промах намеренно (96 > порога): множитель попаданий Быстрой Атаки
    // потребовал бы своей очереди кубов урона на каждое попадание — здесь
    // важен только порог в карточке, не сам исход.
    captured.dice = [96];
    await pressRoll(p, { "input[name='atk-maneuver']:checked": "swift", "#atk-allout": true });

    expect(thresholdInCard()).toBe(65);        // 45 WS + 10 База − 10 Быстрая Атака + 20 Атака всем телом
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

// wdbc-53lh: под итоговым порогом — список слагаемых, а не одно непрозрачное
// число. Сумма списка должна ровно совпадать с показанным итогом (та же
// арифметика, что thresholdOf), нулевые слагаемые в списке не показываются.
describe("построчная разбивка порога (wdbc-53lh)", () => {
  it("сумма слагаемых равна показанному итогу, нулевые слагаемые скрыты", () => {
    const weapon = weaponFor();
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    const display   = textNode();
    const breakdown = htmlNode();
    const form = attackForm(
      { "#atk-modifier": "-5",
        "input[name='atk-rof']:checked": { dataset: { bonus: "10" } },
        "#atk-total-display": display, "#atk-threshold-breakdown": breakdown,
        ".av-adv-hint": textNode() },
      { ".atk-mod-cb:not([data-autofail]):checked": [checkbox(20)],
        ".atk-mod-cb:checked": [checkbox(20)] });

    captured.rerender(form);
    expect(display.textContent).toBe("70");                    // 45 − 5 + 10 + 20
    expect(sumBreakdown(breakdown.innerHTML)).toBe(70);

    expect(breakdown.innerHTML).toContain("BS <b>+45</b>");
    expect(breakdown.innerHTML).toContain("Режим огня <b>+10</b>");
    expect(breakdown.innerHTML).toContain("Доп. модификатор <b>-5</b>");
    expect(breakdown.innerHTML).toContain("Ситуативные <b>+20</b>");
    // Легион/Тренировка/Боеприпас и т.п. у этой заготовки все нулевые — не в списке.
    expect(breakdown.innerHTML).not.toContain("Легион");
    expect(breakdown.innerHTML).not.toContain("Боеприпас");
  });

  it("ополовиненный правилом штраф даёт отдельную поправочную строку, сумма всё равно сходится", () => {
    const weapon = weaponFor();
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    const display   = textNode();
    const breakdown = htmlNode();
    const form = attackForm(
      { "#atk-total-display": display, "#atk-threshold-breakdown": breakdown, ".av-adv-hint": textNode() },
      { ".rule-mod:checked": [{ dataset: { value: "-30", halve: "1" } }] });

    captured.rerender(form);
    // 45 база − 30 правило, ополовинено (округление в пользу игрока) → −15.
    expect(display.textContent).toBe("30");
    expect(sumBreakdown(breakdown.innerHTML)).toBe(30);
    expect(breakdown.innerHTML).toContain("Спецправила <b>-30</b>");
    expect(breakdown.innerHTML).toContain("Ополовинено");
  });

  it("заблокировано/провал/авто-успех — список слагаемых очищается, а не показывает устаревшее", () => {
    const weapon = weaponFor();
    showAttackDialog(attacker({ items: [weapon] }), weapon);

    const display   = textNode();
    const breakdown = htmlNode();
    breakdown.innerHTML = "стухший список";
    const form = attackForm(
      { "#atk-total-display": display, "#atk-threshold-breakdown": breakdown, ".av-adv-hint": textNode() },
      { ".atk-mod-cb[data-autofail]:checked": [checkbox(0)] });

    captured.rerender(form);
    expect(display.textContent).toBe("ПРОВАЛ");
    expect(breakdown.innerHTML).toBe("");
  });
});

// Дуэлянтское (стр. 73 Книги Аэльдари): +5 на все тесты в дуэли 1-на-1 —
// галочка в специфичных модах рукопашной атаки, видна только когда у оружия
// есть свойство duelingWeapon.
describe("Дуэлянтское: галочка «бой 1-на-1»", () => {
  it("оружие без Дуэлянтского — галочки в диалоге нет", () => {
    const sword = weaponFor({ weaponClass: "melee" });
    showAttackDialog(attacker({ items: [sword] }), sword);

    expect(captured.dialog.content).not.toContain("бой 1-на-1");
  });

  it("Дуэлянтское оружие показывает галочку +5", () => {
    const sword = weaponFor({ weaponClass: "melee", weaponProps: [{ key: "duelingWeapon", rating: 0, rating2: 0 }] });
    showAttackDialog(attacker({ items: [sword] }), sword);

    expect(captured.dialog.content).toContain("Дуэлянтское: бой 1-на-1 (никто не мешает)");
    // Нет токена атакующего в тестовом сборе — не пытаемся угадать число
    // контактов, честно просим отметить руками.
    expect(captured.dialog.content).toContain("отметьте вручную");
  });

  it("отмеченная галочка добавляет ровно +5 к порогу", async () => {
    // Промах намеренно (96): интересен только порог в карточке, не урон —
    // тот же приём, что у теста Быстрой Атаки выше (не нужна очередь кубов урона).
    const sword = weaponFor({ weaponClass: "melee", weaponProps: [{ key: "duelingWeapon", rating: 0, rating2: 0 }] });

    captured.dice = [96];
    await pressRoll(showAttackDialog(attacker({ items: [sword] }), sword));
    const baseline = thresholdInCard();

    resetCaptured();
    captured.dice = [96];
    await pressRoll(
      showAttackDialog(attacker({ items: [sword] }), sword),
      {}, { ".atk-mod-cb:not([data-autofail]):checked": [checkbox(5)] });

    expect(thresholdInCard()).toBe(baseline + 5);
  });
});

// Шаг За Шагом (стр. 73 Книги Аэльдари): +10 к рукопашной атаке безусловно.
describe("Шаг За Шагом: +10 к рукопашной атаке", () => {
  it("рукопашное оружие со Шаг За Шагом поднимает порог на 10", async () => {
    const plain = weaponFor({ weaponClass: "melee" });
    captured.dice = [96];
    await pressRoll(showAttackDialog(attacker({ items: [plain] }), plain));
    const baseline = thresholdInCard();

    resetCaptured();
    captured.dice = [96];
    const sword = weaponFor({ weaponClass: "melee", weaponProps: [{ key: "stepByStep", rating: 0, rating2: 0 }] });
    await pressRoll(showAttackDialog(attacker({ items: [sword] }), sword));

    expect(thresholdInCard()).toBe(baseline + 10);
  });

  it("на стрелковое оружие бонус не действует (свойство cat:melee, но проверим прямым путём)", async () => {
    const plain = weaponFor();
    captured.dice = [96];
    await pressRoll(showAttackDialog(attacker({ items: [plain] }), plain));
    const baseline = thresholdInCard();

    resetCaptured();
    captured.dice = [96];
    const gun = weaponFor({ weaponProps: [{ key: "stepByStep", rating: 0, rating2: 0 }] });
    await pressRoll(showAttackDialog(attacker({ items: [gun] }), gun));

    expect(thresholdInCard()).toBe(baseline);
  });
});

// Перемены (Change, стр. 74 Книги Аэльдари): +X Pen против бездушных/техники —
// галочка в диалоге (не к попаданию, к Pen), видна только при этом свойстве.
describe("Перемены: галочка «цель бездушна»", () => {
  it("оружие без Перемен — галочки нет", () => {
    const gun = weaponFor();
    showAttackDialog(attacker({ items: [gun] }), gun);
    expect(captured.dialog.content).not.toContain("atk-change-soulless");
  });

  it("оружие с Перемены (X) показывает галочку с рейтингом в подписи", () => {
    const gun = weaponFor({ weaponProps: [{ key: "change", rating: 3, rating2: 0 }] });
    showAttackDialog(attacker({ items: [gun] }), gun);
    expect(captured.dialog.content).toContain("atk-change-soulless");
    expect(captured.dialog.content).toContain("+3 Pen");
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
    // Предустановленный Приём — просто techniqueOpts.technique у showAttackDialog
    // (отдельной showAttackDialogWithTechnique больше нет: с БОЙ-панели её
    // некому звать — обычные Приёмы теперь выбираются только в этом окне).
    const sword = weaponFor({ weaponClass: "melee" }, { name: "Цепной меч" });
    showAttackDialog(attacker({ items: [sword] }), sword, { technique: "saw" });

    expect(dialogThreshold()).toBe(45);        // WS 45 + База «Стандартная» 10 − 10 Пила
    // Приём открыт с предустановленным ключом "saw" — пилюля отмечена, а не
    // застывшая надпись: игрок волен выбрать другой Приём прямо в этом окне.
    expect(captured.dialog.content).toMatch(/name="atk-maneuver" value="saw" checked/);
    expect(captured.dialog.content).toContain("Пила");
    // Стойка читается из актора (по умолчанию Стандартная).
    expect(captured.dialog.content).toMatch(/name="atk-stance" value="standard" checked/);
  });
});

/** Талант со специализацией — как его резолвит item-picker.mjs при покупке. */
const talentFor = (name, specialization) => ({ type: "talent", name, system: { specialization } });

describe("Арсенал: доступность Стойки/Хвата/Базы/Приёма в окне", () => {
  it("без Рукопашной Тренировки — только Обычная Атака/Стандартная Стойка/1-й Хват, остальное скрыто из разметки", () => {
    const sword = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "1р (2р)" });
    showAttackDialog(attacker({ items: [sword] }), sword);
    const html = captured.dialog.content;

    expect(html).toMatch(/name="atk-maneuver" value="standard"[^>]*checked/);
    // Недоступные варианты не дизейблятся серым, а совсем убираются из
    // разметки — не текущий выбор, поэтому пилюли нет вовсе.
    expect(html).not.toMatch(/name="atk-maneuver" value="sweep"/);
    expect(html).not.toMatch(/name="atk-stance" value="aggressive"/);
    expect(html).not.toMatch(/name="atk-grip" value="2р"/);
    // База книгой не ограничена Талантом — Стандартная/Натиск/Полная/Осторожная
    // доступны и без Тренировки; Верховая Атака недоступна отдельно (не верхом).
    expect(html).toMatch(/name="atk-base" value="standard"/);
    expect(html).toMatch(/name="atk-base" value="charge"/);
    expect(html).toMatch(/name="atk-base" value="fullatk"/);
    expect(html).toMatch(/name="atk-base" value="careful"/);
    expect(html).not.toMatch(/name="atk-base" value="mounted"/);
    expect(html).toContain("Без Тренировки (Меч)");
  });

  it("с подходящей Рукопашной Тренировкой — всё разрешено (кроме Приёмов другой категории)", () => {
    const sword = weaponFor({ weaponClass: "melee", meleeCategory: "Меч", grips: "1р (2р)" });
    const training = talentFor("Melee Training / Рукопашная Тренировка", "Меч");
    showAttackDialog(attacker({ items: [sword, training] }), sword);
    const html = captured.dialog.content;

    expect(html).not.toContain("Без Тренировки");
    expect(html).toMatch(/name="atk-stance" value="aggressive"/);
    expect(html).not.toMatch(/name="atk-stance" value="aggressive"[^>]*disabled/);
    expect(html).toMatch(/name="atk-grip" value="2р"/);
    expect(html).not.toMatch(/name="atk-grip" value="2р"[^>]*disabled/);
    // «Захват» — категории Когти/Кулаки/Крюк/Укус, «Меч» туда не входит —
    // не текущий выбор, поэтому пилюля скрыта.
    expect(html).not.toMatch(/name="atk-maneuver" value="grapple"/);
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
    // Не верхом и не текущий выбор — пилюля Верховой Атаки скрыта совсем.
    expect(captured.dialog.content).not.toMatch(/name="atk-base" value="mounted"/);

    resetCaptured();
    showAttackDialog(attacker({ items: [sword], mount: { uuid: "Actor.mount-1" } }), sword);
    expect(captured.dialog.content).toMatch(/name="atk-base" value="mounted"/);
    expect(captured.dialog.content).not.toMatch(/name="atk-base" value="mounted"[^>]*disabled/);
  });

  it("Пружинящая Стойка требует Баланс не ниже 0", () => {
    const knife = weaponFor({ weaponClass: "melee", balance: -1 });
    showAttackDialog(attacker({ items: [knife] }), knife);
    expect(captured.dialog.content).not.toMatch(/name="atk-stance" value="springing"/);

    resetCaptured();
    const sword = weaponFor({ weaponClass: "melee", balance: 0 });
    showAttackDialog(attacker({ items: [sword] }), sword);
    expect(captured.dialog.content).toMatch(/name="atk-stance" value="springing"/);
    expect(captured.dialog.content).not.toMatch(/name="atk-stance" value="springing"[^>]*disabled/);
  });

  it("Частокол доступен только Глефе/Копью/Штыку и запрещает Натиск, пока выбран", () => {
    const mace = weaponFor({ weaponClass: "melee", meleeCategory: "Булава" });
    showAttackDialog(attacker({ items: [mace] }), mace);
    expect(captured.dialog.content).not.toMatch(/name="atk-stance" value="rapidstrike"/);

    resetCaptured();
    const spear = weaponFor({ weaponClass: "melee", meleeCategory: "Копьё" });
    const training = talentFor("Melee Training / Рукопашная Тренировка", "Копьё");
    showAttackDialog(attacker({ items: [spear, training], meleeStance: "rapidstrike" }), spear);
    const html = captured.dialog.content;
    expect(html).toMatch(/name="atk-stance" value="rapidstrike"/);
    expect(html).not.toMatch(/name="atk-stance" value="rapidstrike"[^>]*disabled/);
    // Актор уже в Частоколе при открытии окна — Натиск недоступен и не текущий
    // выбор (текущая База — Стандартная), поэтому пилюля скрыта совсем.
    expect(html).not.toMatch(/name="atk-base" value="charge"/);
  });

  it("Частокол — исключение из «мягкого» пропуска: без meleeCategory всё равно скрыт", () => {
    // В отличие от Приёмов (categoryOk = ... || !meleeCategory), Частокол
    // требует реальную геометрию древкового оружия — неизвестная категория
    // (данные ещё не пришли из пака) не должна предлагать его как попало.
    const sword = weaponFor({ weaponClass: "melee" });   // meleeCategory не задан
    showAttackDialog(attacker({ items: [sword] }), sword);
    expect(captured.dialog.content).not.toMatch(/name="atk-stance" value="rapidstrike"/);
  });

  it("Профиль меняет категорию оружия (стр. 14) — Приём/Стойка пересчитываются под альт-профиль", () => {
    // «Психокостяная Алебарда»-подобное оружие: основная категория «Глефа»,
    // альт-профиль «Посох» (метка профиля и есть категория этой «головы»).
    const halberd = weaponFor({
      weaponClass: "melee", meleeCategory: "Глефа", grips: "2р (Бл)",
      profiles: [{ label: "Посох", damage: "1d10+1" }]
    }, { name: "Психокостяная Алебарда" });
    const trainGlefa = talentFor("Melee Training / Рукопашная Тренировка", "Глефа");
    const trainPosoh = talentFor("Melee Training / Рукопашная Тренировка", "Посох");
    const actor = attacker({ items: [halberd, trainGlefa, trainPosoh] });

    // Основной профиль — категория «Глефа»: Оглушить (Булава/Кистень/Кулаки/
    // Молот/Посох/Щит) недоступен, Частокол (Глефа/Копьё/Штык) — доступен.
    showAttackDialog(actor, halberd);
    let html = captured.dialog.content;
    expect(html).not.toMatch(/name="atk-maneuver" value="stun"/);
    expect(html).toMatch(/name="atk-stance" value="rapidstrike"/);

    // Профиль «Посох» (idx 0) — категория меняется на «Посох»: наоборот,
    // Оглушить доступен, а Частокол больше не подходит категории.
    resetCaptured();
    showAttackDialog(actor, halberd, { profileIdx: 0 });
    html = captured.dialog.content;
    expect(html).toMatch(/name="atk-maneuver" value="stun"/);
    expect(html).not.toMatch(/name="atk-stance" value="rapidstrike"/);
  });

  it("Профиль с requiresCapability (Unarmed Warrior, стр. 40) скрыт без нужной способности", () => {
    const fist = weaponFor({
      weaponClass: "melee", meleeCategory: "Кулаки", grips: "1р",
      profiles: [{ label: "Unarmed Warrior", damage: "1d10", requiresCapability: "unarmed.warriorProfile" }]
    }, { name: "Fist / Удар кулаком" });
    showAttackDialog(attacker({ items: [fist] }), fist);
    expect(captured.dialog.content).not.toMatch(/name="atk-profile" value="0"/);

    resetCaptured();
    registerRuleSource("test", () => [{ id: "a", label: "Тест",
      effects: [{ kind: "grantFlag", target: "unarmed.warriorProfile" }] }]);
    showAttackDialog(attacker({ items: [fist] }), fist);
    const html = captured.dialog.content;
    expect(html).toMatch(/name="atk-profile" value="0"/);
    expect(html).not.toMatch(/name="atk-profile" value="0"[^>]*disabled/);
  });

  it("Приём завязан на текущую Базу (стр. 14) — Оглушить доступен только с совместимой Базой", () => {
    // Оглушить: «База: Стандартная Атака, Натиск, Полная Атака» (MELEE_MANEUVERS.stun.bases).
    const hammer = weaponFor({ weaponClass: "melee", meleeCategory: "Молот" });
    const training = talentFor("Melee Training / Рукопашная Тренировка", "Молот");
    showAttackDialog(attacker({ items: [hammer, training], meleeBase: "careful" }), hammer);
    expect(captured.dialog.content).not.toMatch(/name="atk-maneuver" value="stun"/);

    resetCaptured();
    showAttackDialog(attacker({ items: [hammer, training], meleeBase: "standard" }), hammer);
    const html = captured.dialog.content;
    expect(html).toMatch(/name="atk-maneuver" value="stun"/);
    expect(html).not.toMatch(/name="atk-maneuver" value="stun"[^>]*disabled/);
  });

  it("Приём без bases (Захват) доступен при любой Базе", () => {
    const claws = weaponFor({ weaponClass: "melee", meleeCategory: "Когти" });
    const training = talentFor("Melee Training / Рукопашная Тренировка", "Когти");
    showAttackDialog(attacker({ items: [claws, training], meleeBase: "careful" }), claws);
    expect(captured.dialog.content).toMatch(/name="atk-maneuver" value="grapple"/);
  });

  it("Стойка — только в пешем бою (стр. 15): верхом доступна только Стандартная", () => {
    const sword = weaponFor({ weaponClass: "melee" });
    showAttackDialog(attacker({ items: [sword], mount: { uuid: "Actor.mount-1" } }), sword);
    expect(captured.dialog.content).not.toMatch(/name="atk-stance" value="aggressive"/);

    resetCaptured();
    showAttackDialog(attacker({ items: [sword] }), sword);   // не верхом
    const html = captured.dialog.content;
    expect(html).toMatch(/name="atk-stance" value="aggressive"/);
    expect(html).not.toMatch(/name="atk-stance" value="aggressive"[^>]*disabled/);
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

describe("метка профиля — не категория (стр. 14)", () => {
  // «Unarmed Warrior», «Подавительный», «Булава (нимб втянут)» — метки
  // профилей, которых нет в MELEE_CATEGORIES: они не «другая голова» оружия
  // и не должны давать trained:false с ложным замком на Приёмы/Стойки.
  // Неизвестная метка трактуется как пустая категория — мягкий пропуск.
  it("профиль с неизвестной меткой не запирает тренировку", () => {
    const sword = weaponFor({ weaponClass: "melee", meleeCategory: "Меч",
      profiles: [{ label: "Подавительный", damage: "1d10" }] });
    // Без Melee Training (Меч): основной профиль честно заперт…
    showAttackDialog(attacker({ items: [sword] }), sword);
    expect(captured.dialog.content).toContain("Без Тренировки (Меч)");

    // …а альт-профиль с меткой-не-категорией — нет: категория неизвестна,
    // фильтр не применяется (тот же приём, что у предмета без meleeCategory).
    resetCaptured();
    showAttackDialog(attacker({ items: [sword] }), sword, { profileIdx: 0 });
    const html = captured.dialog.content;
    expect(html).not.toContain("Без Тренировки");
    expect(html).toMatch(/name="atk-stance" value="aggressive"/);
  });
});

describe("недоступный, но отмеченный вариант не уходит в бросок", () => {
  // readAttackForm читает :checked независимо от disabled — если смена Базы
  // сделала выбранный Приём недоступным, он сбрасывается на standard и в
  // перерисованных пилюлях, и в самом броске (resolveSelectionSafe).
  it("смена Базы делает выбранный Приём недоступным — в форме standard", async () => {
    // Оглушить: «База: Стандартная/Натиск/Полная» — с Осторожной несовместим.
    const hammer   = weaponFor({ weaponClass: "melee", meleeCategory: "Молот" });
    // getFlag нужен конвейеру броска (поиск «сдвинуть место попадания»).
    const training = { ...talentFor("Melee Training / Рукопашная Тренировка", "Молот"),
      getFlag: () => undefined };
    const p = showAttackDialog(attacker({ items: [hammer, training], meleeBase: "standard" }), hammer);

    const pillsEl = { innerHTML: "" };
    const form = attackForm({
      "#atk-char": "ws",
      "input[name='atk-base']:checked": "careful",
      "input[name='atk-maneuver']:checked": "stun",
      "#atk-maneuver-pills": pillsEl,
      "#atk-total-display": textNode(), ".av-adv-hint": textNode()
    });
    captured.rerender(form);

    // Перерисованные пилюли Приёма: Оглушить исчез, отмечена Обычная Атака.
    expect(pillsEl.innerHTML).toMatch(/value="standard" checked/);
    expect(pillsEl.innerHTML).not.toContain('value="stun"');

    // И бросок с той же формой уходит с Приёмом «Обычная Атака», не «Оглушить».
    await captured.press("roll", form);
    expect(captured.chat.at(-1).content).not.toContain("Оглушить");
    await p;
  });
});

describe("приём без оружия", () => {
  const kick = { label: "Пинок", wsBonus: -10, damage: "1d5-1+S.b",
                 damageType: "impact", pen: 0 };

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
                   damageType: "impact", pen: 0 };

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

// Числовой перевес 2к1/3к1 (wdbc-5il7, п.5): meleeContactCount с ОБРАТНЫМ
// обходом — считаем не врагов у атакующего, а «врагов цели» (т.е. атакующего
// и его союзников) в контакте с целью.
describe("Числ. перевес: автоотметка 2к1/3к1 по контактам у цели", () => {
  const prevCanvas = globalThis.canvas;

  beforeEach(() => {
    // grid.size 1 — doc.x/y читаются как метры напрямую (см. test/combat/
    // tactical-map.test.mjs), без пересчёта клетка↔пиксель↔метр.
    globalThis.canvas = { grid: { size: 1 }, tokens: { placeables: [] } };
  });

  afterEach(() => { globalThis.canvas = prevCanvas; });

  function contactToken({ x, y, disposition }) {
    return { document: { x, y, width: 1, height: 1, disposition } };
  }

  function setTargetToken(tt) {
    globalThis.game.user = { ...globalThis.game.user, targets: new Set([tt]) };
  }

  it("без цели на сцене — нет автоотметки, галочки снимаемы вручную", () => {
    const sword = weaponFor({ weaponClass: "melee" });
    showAttackDialog(attacker({ items: [sword] }), sword);
    const html = captured.dialog.content;
    expect(html).toContain("Числ. перевес 2к1");
    expect(html).not.toMatch(/data-value="10"[^>]*checked/);
    expect(html).not.toMatch(/data-value="20"[^>]*checked/);
  });

  it("двое в контакте с целью — автоотмечена «2к1», «3к1» — нет", () => {
    const target = contactToken({ x: 0, y: 0, disposition: -1 });
    const ally1  = contactToken({ x: 1, y: 0, disposition: 1 });
    const ally2  = contactToken({ x: 0, y: 1, disposition: 1 });
    canvas.tokens.placeables = [target, ally1, ally2];
    setTargetToken(target);

    const sword = weaponFor({ weaponClass: "melee" });
    showAttackDialog(attacker({ items: [sword] }), sword);
    const html = captured.dialog.content;
    expect(html).toMatch(/data-value="10"[^>]*checked/);
    expect(html).not.toMatch(/data-value="20"[^>]*checked/);
    expect(html).toContain("в контакте с целью: 2");
  });

  it("трое и больше в контакте с целью — автоотмечена «3к1»", () => {
    const target = contactToken({ x: 0, y: 0, disposition: -1 });
    const allies = [
      contactToken({ x: 1, y: 0, disposition: 1 }),
      contactToken({ x: 0, y: 1, disposition: 1 }),
      contactToken({ x: -1, y: 0, disposition: 1 })
    ];
    canvas.tokens.placeables = [target, ...allies];
    setTargetToken(target);

    const sword = weaponFor({ weaponClass: "melee" });
    showAttackDialog(attacker({ items: [sword] }), sword);
    const html = captured.dialog.content;
    expect(html).toMatch(/data-value="20"[^>]*checked/);
    expect(html).not.toMatch(/data-value="10"[^>]*checked/);
  });
});
