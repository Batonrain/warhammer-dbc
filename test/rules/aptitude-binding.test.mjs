// test/rules/aptitude-binding.test.mjs
//
// wdbc-1pvq: «какие две Склонности привязаны к Навыку/Характеристике» стало
// переопределяемым с листа. До этого поменять привязку можно было только
// правкой кода — то есть с игрового стола никак, даже когда у стола хоумрул
// или в книге опечатка.
//
// Проверяется и сам резолвер, и ГЛАВНОЕ — что переопределение доезжает до
// цены Продвижения. Цена — единственное, ради чего привязка существует; тест,
// который проверил бы только резолвер, зелёным пережил бы и неподключённый
// механизм.

import { describe, it, expect } from "vitest";

import { objectAptitudes, aptitudeBindingOverride, isAptitudeBindingOverridden,
         setBindingPatch, aptBindingContext, BINDING_SCOPES }
  from "../../module/rules/aptitude-binding.mjs";
import { resolveCharCat, resolveSkillCat, charAptitudeSet,
         charCostXP, skillCostXP, CHAR_COST, SKILL_COST, CHAR_APTITUDES }
  from "../../module/constants/advancement.mjs";
import { SKILLS_DEF } from "../../module/constants/skills.mjs";

/** Актор с переопределениями (или без них). */
const actorWith = (aptitudeBinding = undefined) => ({ system: { aptitudeBinding } });

const DODGE_APTS = [SKILLS_DEF.dodge.char, SKILLS_DEF.dodge.apt2]; // ["ag","defence"]

describe("aptitudeBindingOverride: что считается записью, а что нет", () => {
  it("нет актора или нет записи — null, книжная привязка", () => {
    expect(aptitudeBindingOverride(null, "char", "ws")).toBeNull();
    expect(aptitudeBindingOverride(actorWith(), "char", "ws")).toBeNull();
  });

  it("запись читается по области и ключу", () => {
    const a = actorWith({ char: { ws: ["int", "knowledge"] } });
    expect(aptitudeBindingOverride(a, "char", "ws")).toEqual(["int", "knowledge"]);
    expect(aptitudeBindingOverride(a, "char", "bs")).toBeNull();
    expect(aptitudeBindingOverride(a, "skill", "ws")).toBeNull();
  });

  it("пустой массив записью НЕ считается", () => {
    // Полупустая запись хуже отсутствия: она молча сделала бы объект
    // Нейтральным для всех, и найти это было бы нечем.
    expect(aptitudeBindingOverride(actorWith({ char: { ws: [] } }), "char", "ws")).toBeNull();
    expect(aptitudeBindingOverride(actorWith({ char: { ws: ["", "  "] } }), "char", "ws")).toBeNull();
  });

  it("не массив — тоже не запись, мусор в данных не должен ломать расчёт", () => {
    expect(aptitudeBindingOverride(actorWith({ char: { ws: "int" } }), "char", "ws")).toBeNull();
  });

  it("незнакомая область игнорируется", () => {
    expect(BINDING_SCOPES).toEqual(["char", "skill"]);
    expect(aptitudeBindingOverride(actorWith({ talent: { x: ["a"] } }), "talent", "x")).toBeNull();
  });
});

describe("objectAptitudes: переопределение сильнее книги", () => {
  it("без записи возвращается книжная привязка, переданная вызывающим", () => {
    expect(objectAptitudes(actorWith(), "char", "ws", CHAR_APTITUDES.ws))
      .toEqual(["ws", "offence"]);
  });

  it("с записью книжная привязка не используется вовсе", () => {
    const a = actorWith({ char: { ws: ["int", "knowledge"] } });
    expect(objectAptitudes(a, "char", "ws", CHAR_APTITUDES.ws)).toEqual(["int", "knowledge"]);
  });

  it("возвращается КОПИЯ — вызывающий не должен уметь испортить таблицу книги", () => {
    const book = ["ws", "offence"];
    const got = objectAptitudes(actorWith(), "char", "ws", book);
    got.push("сломал");
    expect(book).toEqual(["ws", "offence"]);
  });
});

describe("переопределение доезжает до ЦЕНЫ Продвижения (wdbc-1pvq)", () => {
  // Ради этого тикет и заведён: смысл привязки — цена, а не сама привязка.
  const apts = charAptitudeSet(["int", "knowledge"]);

  it("Характеристика: книжная привязка даёт Враждебную, переопределённая — Дружественную", () => {
    expect(resolveCharCat("ws", apts, actorWith())).toBe("enemy");
    const a = actorWith({ char: { ws: ["int", "knowledge"] } });
    expect(resolveCharCat("ws", apts, a)).toBe("ally");
    expect(charCostXP(0, "ws", apts, null, { actor: a })).toBe(CHAR_COST.ally[0]);
    expect(charCostXP(0, "ws", apts, null, { actor: actorWith() })).toBe(CHAR_COST.enemy[0]);
  });

  it("Навык: то же самое через свою точку входа", () => {
    expect(resolveSkillCat("dodge", "", DODGE_APTS, apts, actorWith())).toBe("enemy");
    const a = actorWith({ skill: { dodge: ["int", "knowledge"] } });
    expect(resolveSkillCat("dodge", "", DODGE_APTS, apts, a)).toBe("ally");
    // skillKey у skillCostXP идёт в opts, а не позиционно: без него функция
    // не знает, ЧЕЙ это Навык, и переопределение искать негде. Оба реальных
    // вызывающих (apps/duplicate-refund.mjs, sheets/tabs/advance.mjs) его
    // передают — тест повторяет их вызов, а не упрощённый.
    const opts = { actor: a, skillKey: "dodge", specialty: "" };
    expect(skillCostXP(0, DODGE_APTS, apts, null, opts)).toBe(SKILL_COST.ally[0]);
    expect(skillCostXP(0, DODGE_APTS, apts, null, { actor: actorWith(), skillKey: "dodge" }))
      .toBe(SKILL_COST.enemy[0]);
  });

  it("готовая категория (раса/культура легиона) СИЛЬНЕЕ привязки — она последнее слово", () => {
    // sheets/tabs/advance.mjs считает cultCat раньше и передаёт его: «этот
    // Навык Дружественный независимо от Покровительства» — это уже ИТОГ, а
    // привязка только вход, из которого итог считается. Перебивать итог
    // входом значило бы вывернуть приоритет наизнанку.
    const a = actorWith({ skill: { dodge: ["fel", "social"] } });
    const opts = { actor: a, skillKey: "dodge", specialty: "" };
    expect(skillCostXP(0, DODGE_APTS, apts, "ally", opts)).toBe(SKILL_COST.ally[0]);
  });

  it("переопределение может сделать и ДОРОЖЕ, а не только дешевле", () => {
    const friendly = charAptitudeSet(["ws", "offence"]);
    expect(resolveCharCat("ws", friendly, actorWith())).toBe("ally");
    const a = actorWith({ char: { ws: ["fel", "social"] } });
    expect(resolveCharCat("ws", friendly, a)).toBe("enemy");
  });

  it("чужой объект не задет: переопределили WS — BS считается по книге", () => {
    const a = actorWith({ char: { ws: ["int", "knowledge"] } });
    expect(resolveCharCat("bs", apts, a)).toBe("enemy");
  });

  it("запасная привязка вызывающего уважается, когда записи нет", () => {
    // Специализации групповых Навыков считают первую Склонность у самой
    // специализации («Навигация (Варп) — это Воля, а не Интеллект группы»),
    // и вывести её из одного ключа Навыка нечем — она приходит аргументом.
    const wp = charAptitudeSet(["wp", "knowledge"]);
    expect(resolveSkillCat("navigate", "warp", ["wp", "knowledge"], wp, actorWith())).toBe("ally");
  });
});

describe("setBindingPatch: как переопределение записывается и снимается", () => {
  it("непустой список пишется по своему пути", () => {
    expect(setBindingPatch("char", "ws", ["int", "knowledge"]))
      .toEqual({ "system.aptitudeBinding.char.ws": ["int", "knowledge"] });
  });

  it("пустой список СНИМАЕТ запись штатным «-=», а не пишет пустоту", () => {
    // Пустой массив в данных неотличим от «переопределяли и вернули назад».
    expect(setBindingPatch("skill", "dodge", []))
      .toEqual({ "system.aptitudeBinding.skill.-=dodge": null });
  });

  it("незнакомая область — пустой патч, а не порча данных", () => {
    expect(setBindingPatch("talent", "x", ["a", "b"])).toEqual({});
    expect(setBindingPatch("char", "", ["a", "b"])).toEqual({});
  });

  it("пометка «переопределено» для листа", () => {
    const a = actorWith({ skill: { dodge: ["int", "knowledge"] } });
    expect(isAptitudeBindingOverridden(a, "skill", "dodge")).toBe(true);
    expect(isAptitudeBindingOverridden(a, "skill", "awareness")).toBe(false);
  });
});

describe("aptBindingContext: что видит игрок в строке листа", () => {
  const labelOf = a => ({ ws: "Рукопашный навык (WS)", offence: "Нападение",
                          int: "Интеллект (I)", knowledge: "Знание" }[a] || a);

  it("книжная привязка — подпись из двух Склонностей, пометки нет", () => {
    const ctx = aptBindingContext(actorWith(), "char", "ws", ["ws", "offence"], labelOf);
    expect(ctx.aptBoundLabel).toBe("Рукопашный навык (WS) + Нападение");
    expect(ctx.aptOverridden).toBe(false);
    expect(ctx.aptScope).toBe("char");
    expect(ctx.aptKey).toBe("ws");
  });

  it("переопределённая — подпись по записи И пометка, чтобы было видно без наведения", () => {
    const a = actorWith({ char: { ws: ["int", "knowledge"] } });
    const ctx = aptBindingContext(a, "char", "ws", ["ws", "offence"], labelOf);
    expect(ctx.aptBoundLabel).toBe("Интеллект (I) + Знание");
    expect(ctx.aptOverridden).toBe(true);
  });

  it("без словаря подписей подставляются сами ключи, а не пустота", () => {
    const ctx = aptBindingContext(actorWith(), "skill", "dodge", ["ag", "defence"]);
    expect(ctx.aptBoundLabel).toBe("ag + defence");
  });
});
