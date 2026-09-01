import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildTestContext, resolveTest, rollModsFromRules, critModsFromRules, failDegModFromRules, scriptTriggersFromRules } from "../../module/rules/resolve-test.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

/** Снимок настоящих источников: тесты подменяют реестр и возвращают как было. */
const DEFAULT_SOURCES = getRuleSources();

const actor = ({ items = [], ...system } = {}) => ({
  system: { characteristics: {}, ...system },
  items
});

let errors;

beforeEach(() => {
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
  clearRuleSources();
});

afterEach(() => {
  errors.mockRestore();
  clearRuleSources();
  for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
  delete globalThis.Hooks;
});

describe("фаза 1: контекст", () => {
  it("вид теста по умолчанию — навык: так лист собирал контекст и раньше", () => {
    expect(buildTestContext({ skill: "medicae" })).toMatchObject({ kind: "skill", skill: "medicae" });
  });

  it("переданные поля сохраняются, актор доступен отдельным полем", () => {
    const a = actor({ race: "astartes" });
    const ctx = buildTestContext({ actor: a, kind: "attack", char: "ws", target: true });
    expect(ctx).toMatchObject({ actor: a, kind: "attack", char: "ws", target: true });
  });

  it("без актора контекст всё равно собирается", () => {
    expect(buildTestContext().actor).toBe(null);
  });
});

describe("фаза 2: сбор", () => {
  it("правила приходят от всех источников, включая не подходящие актору", () => {
    registerRuleSource("first",  () => [{ id: "a" }]);
    registerRuleSource("second", () => [{ id: "b", when: { race: ["astartes"] } }]);

    const { rules } = resolveTest({ actor: actor({ race: "human" }) });
    // Собраны оба, отбор снял второе — значит сбор дошёл до обоих источников.
    expect(rules.map(r => r.id)).toEqual(["a"]);
  });

  it("хук дописывает правило до отбора, и оно просеивается наравне с остальными", () => {
    registerRuleSource("first", () => [{ id: "a" }]);
    globalThis.Hooks = {
      callAll: (name, ctx, bag) => {
        expect(name).toBe("dbc.collectRules");
        expect(ctx.skill).toBe("medicae");
        bag.push({ id: "fromHook" }, { id: "hookMiss", when: { race: ["astartes"] } });
      }
    };

    const { rules } = resolveTest({ actor: actor({ race: "human" }), skill: "medicae" });
    expect(rules.map(r => r.id)).toEqual(["a", "fromHook"]);
  });

  it("без Foundry конвейер работает: хука просто нет", () => {
    registerRuleSource("first", () => [{ id: "a" }]);
    expect(typeof globalThis.Hooks).toBe("undefined");
    expect(resolveTest({ actor: actor() }).rules.map(r => r.id)).toEqual(["a"]);
  });
});

describe("фаза 3: отбор", () => {
  it("вытеснение снимает правило по overrides", () => {
    registerRuleSource("s", () => [
      { id: "smite.baseline" },
      { id: "smite.astartes", overrides: ["smite.baseline"], when: { race: ["astartes"] } }
    ]);

    const astartes = resolveTest({ actor: actor({ race: "astartes" }) });
    const human    = resolveTest({ actor: actor({ race: "human" }) });
    expect(astartes.rules.map(r => r.id)).toEqual(["smite.astartes"]);
    expect(human.rules.map(r => r.id)).toEqual(["smite.baseline"]);
  });

  it("правило добавлено хуком и вытесняет собранное источником", () => {
    registerRuleSource("s", () => [{ id: "base" }]);
    globalThis.Hooks = { callAll: (name, ctx, bag) => bag.push({ id: "mod", overrides: ["base"] }) };
    expect(resolveTest({ actor: actor() }).rules.map(r => r.id)).toEqual(["mod"]);
  });
});

describe("галочки из эффектов", () => {
  const rule = (effects, over = {}) => ({ id: "r", label: "Правило", effects, ...over });

  it("rollBonus в любом тесте: target «all» и без target", () => {
    const mods = rollModsFromRules([
      rule([{ kind: "rollBonus", target: "all", value: 10 }]),
      rule([{ kind: "rollBonus", value: -5 }], { id: "r2" })
    ], buildTestContext({ skill: "medicae" }));
    expect(mods.map(m => m.value)).toEqual([10, -5]);
    expect(mods[0]).toMatchObject({ ruleId: "r", label: "Правило", halvePenalty: false });
  });

  it("skill:<ключ> попадает только в свой навык", () => {
    const rules = [rule([{ kind: "rollBonus", target: "skill:psyniscience", value: 10 }])];
    expect(rollModsFromRules(rules, buildTestContext({ skill: "psyniscience" }))).toHaveLength(1);
    expect(rollModsFromRules(rules, buildTestContext({ skill: "medicae" }))).toHaveLength(0);
  });

  it("skill:<ключ> ловит и групповой Навык через ctx.group (Cartograph/Forgery Kit, wdbc-5dyh)", () => {
    const rules = [rule([{ kind: "rollBonus", target: "skill:navigation", value: 10 }])];
    expect(rollModsFromRules(rules, buildTestContext({ group: "navigation", specialty: "Surface" }))).toHaveLength(1);
    expect(rollModsFromRules(rules, buildTestContext({ group: "trade", specialty: "Armourer" }))).toHaveLength(0);
  });

  it("char:<ключ> попадает в тест характеристики, но не в навык на той же характеристике", () => {
    const rules = [rule([{ kind: "rollBonus", target: "char:wp", value: 10 }])];
    expect(rollModsFromRules(rules, buildTestContext({ char: "wp" }))).toHaveLength(1);
    expect(rollModsFromRules(rules, buildTestContext({ skill: "psyniscience", char: "wp" }))).toHaveLength(0);
  });

  it("initiative — только бросок Инициативы", () => {
    const rules = [rule([{ kind: "rollBonus", target: "initiative", value: 4 }])];
    expect(rollModsFromRules(rules, buildTestContext({ kind: "initiative" }))).toHaveLength(1);
    expect(rollModsFromRules(rules, buildTestContext({ char: "ag" }))).toHaveLength(0);
  });

  it("penaltyMul 0.5 даёт галочку «ополовинить штраф»", () => {
    const mods = rollModsFromRules(
      [rule([{ kind: "penaltyMul", target: "skill:psyniscience", factor: 0.5 }])],
      buildTestContext({ skill: "psyniscience" }));
    expect(mods).toEqual([{ ruleId: "r", label: "Правило", value: 0, halvePenalty: true }]);
  });

  it("иной множитель штрафа диалог не умеет: галочки нет, в консоли ошибка", () => {
    const mods = rollModsFromRules(
      [rule([{ kind: "penaltyMul", target: "all", factor: 0.25 }])],
      buildTestContext({ skill: "medicae" }));
    expect(mods).toEqual([]);
    expect(errors).toHaveBeenCalledOnce();
  });

  it("эффекты урона и брони в диалог броска не просятся", () => {
    const mods = rollModsFromRules([rule([
      { kind: "damageBonus", target: "all", value: 2 },
      { kind: "apBonus", target: "all", value: 1 }
    ])], buildTestContext({ skill: "medicae" }));
    expect(mods).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("неизвестный вид эффекта — ошибка в консоль, а не молчание", () => {
    const mods = rollModsFromRules([rule([{ kind: "rolBonus", target: "all", value: 10 }])],
      buildTestContext({ skill: "medicae" }));
    expect(mods).toEqual([]);
    expect(errors).toHaveBeenCalledOnce();
  });

  it("своя подпись эффекта важнее подписи правила", () => {
    const [mod] = rollModsFromRules(
      [rule([{ kind: "rollBonus", target: "all", value: 10, label: "Подпись эффекта" }])],
      buildTestContext({ skill: "medicae" }));
    expect(mod.label).toBe("Подпись эффекта");
  });

  it("resolveTest отдаёт галочки вместе с правилами", () => {
    registerRuleSource("s", () => [
      { id: "bonus", label: "Плюс", effects: [{ kind: "rollBonus", target: "skill:medicae", value: 10 }] }
    ]);
    const { rules, mods } = resolveTest({ actor: actor(), skill: "medicae" });
    expect(rules.map(r => r.id)).toEqual(["bonus"]);
    expect(mods).toEqual([{ ruleId: "bonus", label: "Плюс", value: 10, halvePenalty: false }]);
  });
});

describe("critModsFromRules", () => {
  const rule = (side, value, target = "all") =>
    ({ id: "r", label: "Правило", effects: [{ kind: "critRangeMod", target, side, value }] });

  it("side «success» расширяет только Критический Успех", () => {
    expect(critModsFromRules([rule("success", 5)], buildTestContext({ skill: "medicae" })))
      .toEqual({ successExtra: 5, failExtra: 0 });
  });

  it("side «failure» расширяет только Критический Провал", () => {
    expect(critModsFromRules([rule("failure", 5)], buildTestContext({ skill: "medicae" })))
      .toEqual({ successExtra: 0, failExtra: 5 });
  });

  it("side «both» (по умолчанию) расширяет обе стороны", () => {
    expect(critModsFromRules([rule("both", 3)], buildTestContext({ skill: "medicae" })))
      .toEqual({ successExtra: 3, failExtra: 3 });
  });

  it("область сопоставляется так же, как у rollBonus", () => {
    const rules = [rule("success", 5, "skill:medicae")];
    expect(critModsFromRules(rules, buildTestContext({ skill: "medicae" }))).toEqual({ successExtra: 5, failExtra: 0 });
    expect(critModsFromRules(rules, buildTestContext({ skill: "psyniscience" }))).toEqual({ successExtra: 0, failExtra: 0 });
  });

  it("несколько правил суммируются", () => {
    const rules = [rule("success", 5), { ...rule("success", 3), id: "r2" }];
    expect(critModsFromRules(rules, buildTestContext({ skill: "medicae" })).successExtra).toBe(8);
  });

  it("resolveTest отдаёт crit вместе с mods и rerolls", () => {
    registerRuleSource("s", () => [rule("success", 5, "skill:medicae")]);
    const { crit } = resolveTest({ actor: actor(), skill: "medicae" });
    expect(crit).toEqual({ successExtra: 5, failExtra: 0 });
  });
});

describe("failDegModFromRules (wdbc-1rno, Sentient Cyst)", () => {
  const rule = (value, target = "all") =>
    ({ id: "r", label: "Правило", effects: [{ kind: "failDegMod", target, value }] });

  it("значение суммируется по подходящей области", () => {
    expect(failDegModFromRules([rule(3, "social")], buildTestContext({ skill: "charm" }))).toBe(3);
  });

  it("область не подходит — не суммируется", () => {
    expect(failDegModFromRules([rule(3, "social")], buildTestContext({ skill: "medicae" }))).toBe(0);
  });

  it("несколько правил суммируются", () => {
    const rules = [rule(3, "social"), { ...rule(2, "social"), id: "r2" }];
    expect(failDegModFromRules(rules, buildTestContext({ skill: "charm" }))).toBe(5);
  });

  it("пустой список правил — 0, не ошибка", () => {
    expect(failDegModFromRules([], buildTestContext({ skill: "charm" }))).toBe(0);
  });

  it("resolveTest отдаёт failDegExtra вместе с mods/rerolls/crit", () => {
    registerRuleSource("s", () => [rule(3, "social")]);
    const { failDegExtra } = resolveTest({ actor: actor(), skill: "charm" });
    expect(failDegExtra).toBe(3);
  });
});

describe("scriptTriggersFromRules (wdbc-1rno, Полимат/Библиотека Акаши)", () => {
  const rule = (side, target = "all", over = {}) => ({
    id: "r", label: "Правило",
    effects: [{ kind: "scriptTrigger", target, side, itemId: "it1", entryId: "e1", ...over }]
  });

  it("подходящая область отдаёт itemId/entryId/side/ruleId", () => {
    expect(scriptTriggersFromRules([rule("critSuccess", "skill:trade")], buildTestContext({ skill: "trade" })))
      .toEqual([{ itemId: "it1", entryId: "e1", side: "critSuccess", ruleId: "r" }]);
  });

  it("область не подходит — пустой список", () => {
    expect(scriptTriggersFromRules([rule("critSuccess", "skill:trade")], buildTestContext({ skill: "medicae" })))
      .toEqual([]);
  });

  it("несколько правил — несколько триггеров, порядок сохранён", () => {
    const rules = [
      rule("critSuccess", "all", { itemId: "it1" }),
      { ...rule("critFailure", "all", { itemId: "it2" }), id: "r2" }
    ];
    expect(scriptTriggersFromRules(rules, buildTestContext({ skill: "medicae" }))).toEqual([
      { itemId: "it1", entryId: "e1", side: "critSuccess", ruleId: "r" },
      { itemId: "it2", entryId: "e1", side: "critFailure", ruleId: "r2" }
    ]);
  });

  it("resolveTest отдаёт scriptTriggers вместе с mods/rerolls/crit/failDegExtra", () => {
    registerRuleSource("s", () => [rule("critSuccess", "skill:trade")]);
    const { scriptTriggers } = resolveTest({ actor: actor(), skill: "trade" });
    expect(scriptTriggers).toEqual([{ itemId: "it1", entryId: "e1", side: "critSuccess", ruleId: "r" }]);
  });
});

describe("область атаки", () => {
  const rule = (target, value = 10) => ({
    id: "r", label: "Правило", effects: [{ kind: "rollBonus", target, value }]
  });
  /** Контекст атаки: вид теста «attack», класс оружия и рукопашность. */
  const melee  = buildTestContext({ kind: "attack", weaponClass: "melee",  isMelee: true,  char: "ws" });
  const ranged = buildTestContext({ kind: "attack", weaponClass: "pistol", isMelee: false, char: "bs" });

  it("«attack» попадает в любую атаку и только в атаку", () => {
    expect(rollModsFromRules([rule("attack")], melee)).toHaveLength(1);
    expect(rollModsFromRules([rule("attack")], ranged)).toHaveLength(1);
    expect(rollModsFromRules([rule("attack")], buildTestContext({ skill: "medicae" }))).toHaveLength(0);
  });

  it("«weapon:melee» и «weapon:ranged» делят атаки надвое", () => {
    expect(rollModsFromRules([rule("weapon:melee")],  melee)).toHaveLength(1);
    expect(rollModsFromRules([rule("weapon:melee")],  ranged)).toHaveLength(0);
    expect(rollModsFromRules([rule("weapon:ranged")], ranged)).toHaveLength(1);
    expect(rollModsFromRules([rule("weapon:ranged")], melee)).toHaveLength(0);
  });

  it("метательное по умолчанию бросается по BS — как и в самой атаке (стр. 40)", () => {
    const thrown = buildTestContext({ kind: "attack", weaponClass: "thrown", isMelee: false, char: "bs" });
    expect(rollModsFromRules([rule("weapon:ranged")], thrown)).toHaveLength(1);
    expect(rollModsFromRules([rule("weapon:melee")],  thrown)).toHaveLength(0);
  });

  it("«weapon:<класс>» попадает только в свой класс оружия", () => {
    expect(rollModsFromRules([rule("weapon:pistol")], ranged)).toHaveLength(1);
    expect(rollModsFromRules([rule("weapon:heavy")],  ranged)).toHaveLength(0);
  });

  it("«all» действует и в атаке", () => {
    expect(rollModsFromRules([rule("all")], melee)).toHaveLength(1);
  });

  it("char:<ключ> в атаку не подхватывается, хотя атака идёт по этой характеристике", () => {
    // Иначе «+10 к тестам Оружейного Мастерства» молча стало бы «+10 ко всем
    // ударам» — это два разных правила книги, и различает их область.
    expect(rollModsFromRules([rule("char:ws")], melee)).toHaveLength(0);
  });

  it("область психосил в атаку не попадает", () => {
    expect(rollModsFromRules([rule("power:smite")], melee)).toHaveLength(0);
  });
});

describe("область психосил", () => {
  const rule = (target, value = 10) => ({
    id: "r", label: "Правило", effects: [{ kind: "rollBonus", target, value }]
  });
  /** Контекст манифестации: вид теста «power», сила лежит целиком в ctx.power. */
  const cast = (name, over = {}) => buildTestContext({
    kind: "power", char: "wp",
    power: { type: "psychicPower", name, system: { discipline: "biomancy" } },
    ...over
  });
  const smite = cast("Smite / Порицание");

  it("«power» попадает в любую манифестацию и только в неё", () => {
    expect(rollModsFromRules([rule("power")], smite)).toHaveLength(1);
    expect(rollModsFromRules([rule("power")], buildTestContext({ skill: "psyniscience" }))).toHaveLength(0);
    expect(rollModsFromRules([rule("power")], buildTestContext({ kind: "attack", isMelee: true }))).toHaveLength(0);
  });

  it("«power:<имя>» попадает только в свою силу, по любой половине имени", () => {
    expect(rollModsFromRules([rule("power:smite")], smite)).toHaveLength(1);
    expect(rollModsFromRules([rule("power:порицание")], smite)).toHaveLength(1);
    expect(rollModsFromRules([rule("power:smite")], cast("Warp Sight / Взор Варпа"))).toHaveLength(0);
  });

  it("специализация в скобках при сравнении отбрасывается — как у hasTalent", () => {
    expect(rollModsFromRules([rule("power:smite")], cast("Smite (Greater) / Порицание (Большое)"))).toHaveLength(1);
  });

  it("«all» действует и в манифестации", () => {
    expect(rollModsFromRules([rule("all")], smite)).toHaveLength(1);
  });

  it("char:<ключ> в психотест не подхватывается, хотя тест идёт по этой характеристике", () => {
    // «+10 к тестам Воли» и «+10 к манифестациям» — два разных правила книги.
    expect(rollModsFromRules([rule("char:wp")], smite)).toHaveLength(0);
  });

  it("skill:psyniscience в психотест не подхватывается даже у Прорицания", () => {
    const divination = cast("Foresight / Предвидение", { skill: "psyniscience" });
    expect(rollModsFromRules([rule("skill:psyniscience")], divination)).toHaveLength(0);
    expect(rollModsFromRules([rule("power")], divination)).toHaveLength(1);
  });
});

describe("значение эффекта от цели", () => {
  const target = (agBonus, traits = ["Nimble / Проворный"]) => ({
    system: { characteristics: { ag: { bonus: agBonus } } },
    items: traits.map(name => ({ type: "trait", name }))
  });
  const nimble = {
    id: "r", label: "Проворный",
    effects: [{ kind: "rollBonus", target: "attack", valueFrom: { targetCharBonus: "ag", multiplier: -1 } }]
  };

  it("значение берётся из бонуса характеристики цели", () => {
    const ctx = buildTestContext({ kind: "attack", isMelee: true, targetActor: target(4) });
    expect(rollModsFromRules([nimble], ctx)).toEqual([
      { ruleId: "r", label: "Проворный", value: -4, halvePenalty: false }
    ]);
  });

  it("другая цель — другое число: значение считается на каждый бросок", () => {
    const ctx = buildTestContext({ kind: "attack", isMelee: true, targetActor: target(7) });
    expect(rollModsFromRules([nimble], ctx)[0].value).toBe(-7);
  });

  it("без цели значение ноль, а не ошибка", () => {
    const ctx = buildTestContext({ kind: "attack", isMelee: true });
    expect(rollModsFromRules([nimble], ctx)[0].value).toBe(0);
  });

  it("множитель по умолчанию единица", () => {
    const rule = { id: "r", effects: [{ kind: "rollBonus", target: "attack", valueFrom: { targetCharBonus: "ag" } }] };
    const ctx  = buildTestContext({ kind: "attack", isMelee: true, targetActor: target(3) });
    expect(rollModsFromRules([rule], ctx)[0].value).toBe(3);
  });

  it("неизвестный источник значения — ошибка в консоль, а не молчаливый ноль", () => {
    const rule = { id: "r", effects: [{ kind: "rollBonus", target: "attack", valueFrom: { charBonusOfSomeone: "ag" } }] };
    const ctx  = buildTestContext({ kind: "attack", isMelee: true, targetActor: target(3) });
    expect(rollModsFromRules([rule], ctx)).toEqual([]);
    expect(errors).toHaveBeenCalledOnce();
  });

  it("valueFrom вытесняет value: два значения в одной записи — ошибка данных", () => {
    const rule = { id: "r", effects: [{ kind: "rollBonus", target: "attack", value: 99, valueFrom: { targetCharBonus: "ag" } }] };
    const ctx  = buildTestContext({ kind: "attack", isMelee: true, targetActor: target(3) });
    expect(rollModsFromRules([rule], ctx)[0].value).toBe(3);
  });
});

describe("значение эффекта: formula (kind:testMod, modValueMode:formula, wdbc-1rno)", () => {
  const actorWithCor = corruptionBonus => ({ system: { characteristics: {}, corruptionBonus } });
  const halfCor = {
    id: "r", label: "Чёрные Глаза",
    effects: [{ kind: "rollBonus", target: "skill:awareness", formula: "ceil(cor/2)" }]
  };

  it("формула считается от Cor.b актора (округление вверх)", () => {
    const ctx = buildTestContext({ skill: "awareness", actor: actorWithCor(5) });
    expect(rollModsFromRules([halfCor], ctx)).toEqual([
      { ruleId: "r", label: "Чёрные Глаза", value: 3, halvePenalty: false }
    ]);
  });

  it("другой актор — другое число: считается на каждый бросок, не застывает", () => {
    const ctx = buildTestContext({ skill: "awareness", actor: actorWithCor(8) });
    expect(rollModsFromRules([halfCor], ctx)[0].value).toBe(4);
  });

  it("нет актора — safe-вариант отдаёт 0, не бросает", () => {
    const ctx = buildTestContext({ skill: "awareness" });
    expect(rollModsFromRules([halfCor], ctx)[0].value).toBe(0);
  });

  it("недопустимая формула — safe-вариант отдаёт 0, а не роняет бросок", () => {
    const rule = { id: "r", effects: [{ kind: "rollBonus", target: "skill:awareness", formula: "alert(1)" }] };
    const ctx  = buildTestContext({ skill: "awareness", actor: actorWithCor(5) });
    expect(rollModsFromRules([rule], ctx)[0].value).toBe(0);
  });

  it("голое число как формула — работает тем же путём, что flat", () => {
    const rule = { id: "r", effects: [{ kind: "rollBonus", target: "skill:awareness", formula: "-5" }] };
    const ctx  = buildTestContext({ skill: "awareness", actor: actorWithCor(5) });
    expect(rollModsFromRules([rule], ctx)[0].value).toBe(-5);
  });
});
