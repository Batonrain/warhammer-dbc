// test/combat/grapple.test.mjs
//
// Борьба (стр. 12): успешный Приём «Захват» связывает атакующего и цель —
// conditions.grappling на обоих + взаимный флаг партнёра.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyGrappleOnHit, grapplePartner, endGrapple, isBiteWeapon, crunchWeapon, tentacleTechDef, tentacleBonus, detachableTentacle, isDetachedGrapple, swingProfile, throwProfile } from "../../module/combat/grapple.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";
import { actorFor } from "../support/combat-fixtures.mjs";

const FLAG = "warhammer-dbc";

function actorWith(name, uuid) {
  const flags = {};
  const updates = [];
  return {
    id: uuid, name, uuid,
    system: { conditions: { grappling: false } },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async (changes) => {
      updates.push(changes);
      // Флаги теперь едут тем же update: разобрать пути flags.<scope>.<key> и -=<key>.
      for (const [path, v] of Object.entries(changes)) {
        let m = path.match(/^flags\.[^.]+\.-=(.+)$/);
        if (m) { delete flags[m[1]]; continue; }
        m = path.match(/^flags\.[^.]+\.(.+)$/);
        if (m) flags[m[1]] = v;
      }
      return changes;
    },
    _flags: flags, _updates: updates
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.settings = { get: () => "roll" };
  globalThis.ChatMessage = {
    applyRollMode: (data) => data,
    create: async () => {},
    getSpeaker: ({ actor }) => ({ actor: actor?.id })
  };
  globalThis.fromUuidSync = () => null;
});

describe("applyGrappleOnHit", () => {
  it("связывает атакующего и цель Борьбой при попадании Приёмом «Захват»", async () => {
    const attacker = actorWith("Атакующий", "Actor.a1");
    const target = actorWith("Цель", "Actor.t1");
    const targetToken = { actor: target };

    await applyGrappleOnHit(attacker, targetToken, true, { technique: "grapple" });

    expect(attacker._updates).toContainEqual(expect.objectContaining({ "system.conditions.grappling": true }));
    expect(target._updates).toContainEqual(expect.objectContaining({ "system.conditions.grappling": true }));
    expect(attacker._flags.grapplePartnerUuid).toBe("Actor.t1");
    expect(target._flags.grapplePartnerUuid).toBe("Actor.a1");
  });

  it("не связывает при промахе", async () => {
    const attacker = actorWith("Атакующий", "Actor.a1");
    const target = actorWith("Цель", "Actor.t1");
    await applyGrappleOnHit(attacker, { actor: target }, false, { technique: "grapple" });
    expect(attacker._updates).toHaveLength(0);
    expect(target._updates).toHaveLength(0);
  });

  it("не связывает, если Приём — не «Захват»", async () => {
    const attacker = actorWith("Атакующий", "Actor.a1");
    const target = actorWith("Цель", "Actor.t1");
    await applyGrappleOnHit(attacker, { actor: target }, true, { technique: "standard" });
    expect(attacker._updates).toHaveLength(0);
    expect(target._updates).toHaveLength(0);
  });

  it("не связывает актора с самим собой", async () => {
    const attacker = actorWith("Атакующий", "Actor.a1");
    await applyGrappleOnHit(attacker, { actor: attacker }, true, { technique: "grapple" });
    expect(attacker._updates).toHaveLength(0);
  });
});

describe("grapplePartner / endGrapple", () => {
  it("находит партнёра по флагу через fromUuidSync", () => {
    const partner = { id: "p1", name: "Партнёр" };
    globalThis.fromUuidSync = (uuid) => (uuid === "Actor.p1" ? partner : null);
    const actor = actorWith("Актор", "Actor.a1");
    actor.getFlag = (_s, k) => (k === "grapplePartnerUuid" ? "Actor.p1" : undefined);
    expect(grapplePartner(actor)).toBe(partner);
  });

  it("возвращает null без флага партнёра", () => {
    const actor = actorWith("Актор", "Actor.a1");
    expect(grapplePartner(actor)).toBeNull();
  });

  it("endGrapple снимает состояние и флаг с обоих участников", async () => {
    const attacker = actorWith("Атакующий", "Actor.a1");
    const target = actorWith("Цель", "Actor.t1");
    globalThis.fromUuidSync = (uuid) => (uuid === "Actor.t1" ? target : null);
    attacker.getFlag = (_s, k) => (k === "grapplePartnerUuid" ? "Actor.t1" : undefined);

    await endGrapple(attacker);

    expect(attacker._updates).toContainEqual(expect.objectContaining({ "system.conditions.grappling": false }));
    expect(target._updates).toContainEqual(expect.objectContaining({ "system.conditions.grappling": false }));
  });
});

// wdbc-l07y: раньше /укус/i (только русская половина) — оружие, записанное
// одной английской половиной («Bite»), не находилось вовсе.
describe("isBiteWeapon", () => {
  it("находит по русской половине двуязычного имени", () => {
    expect(isBiteWeapon({ type: "weapon", name: "Bite / Укус" })).toBe(true);
  });

  it("находит по чисто английскому имени (раньше не находил)", () => {
    expect(isBiteWeapon({ type: "weapon", name: "Bite" })).toBe(true);
  });

  it("находит по чисто русскому имени", () => {
    expect(isBiteWeapon({ type: "weapon", name: "Укус" })).toBe(true);
  });

  it("не оружие или не то оружие — нет", () => {
    expect(isBiteWeapon({ type: "weapon", name: "Bolt Pistol" })).toBe(false);
    expect(isBiteWeapon({ type: "implant", name: "Bite" })).toBe(false);
  });

  it("ranged/exotic класс оружия с этим именем не считается — только melee/пусто", () => {
    expect(isBiteWeapon({ type: "weapon", name: "Bite", system: { weaponClass: "ranged" } })).toBe(false);
    expect(isBiteWeapon({ type: "weapon", name: "Bite", system: { weaponClass: "melee" } })).toBe(true);
    expect(isBiteWeapon({ type: "weapon", name: "Bite", system: {} })).toBe(true);
  });
});

// wdbc-1d5u: auto.crunch (module/constants/weapon-properties.mjs) был заведён,
// но нигде не читался — crunchWeapon() смыкает Хруст с уже готовым
// aggregateAuto/resolveWeaponProps (тот же движок, что у диалога атаки).
describe("crunchWeapon", () => {
  const withProp = (key) => ({ type: "weapon", name: "Клешня", system: { weaponProps: [{ key }] } });

  it("оружие со свойством Crunch — да", () => {
    expect(crunchWeapon(withProp("crunch"))).toBe(true);
  });

  it("оружие без свойства Crunch — нет", () => {
    expect(crunchWeapon(withProp("tearing"))).toBe(false);
    expect(crunchWeapon({ type: "weapon", name: "Bolt Pistol", system: { weaponProps: [] } })).toBe(false);
  });

  it("не оружие — нет, даже если бы как-то нёс weaponProps", () => {
    expect(crunchWeapon({ type: "implant", name: "Клешня", system: { weaponProps: [{ key: "crunch" }] } })).toBe(false);
  });

  it("оружие без system/weaponProps вовсе — нет, не падает", () => {
    expect(crunchWeapon({ type: "weapon", name: "Голые руки" })).toBe(false);
  });
});

// wdbc-vkwe (продолжение): «...+20 на приём Захват и все тесты в Борьбе» —
// приём читается в attack-dialog.mjs (resolveSelection), а 5 РОЛЕВЫХ тестов
// раздела (Заломить/Пересилить/Вырваться/Выкрутиться/Перехватить Контроль,
// см. ALL_TESTS в grapple.mjs) — здесь, через tentacleTechDef перед вызовом
// _showContestDialog. Сжать/Хруст броска не делают вовсе (см. шапку файла) —
// бонусу там нечего усиливать, поэтому в дело не идут.
// tentacleBonus — общий расчёт под tentacleTechDef (5 контестов) И _doBite/
// _doThrow (wdbc-oxdn: Укус/Метнуть/Замахнуться — три «безролловых» на вид
// действия Борьбы, которые на деле идут полным тестом WS/BS через
// attack-dialog.mjs — тоже «тесты в Борьбе» по тексту мутации, просто со
// своим бонусом techDef.wsBonus/bsBonus вместо tentacleTechDef/extraBonus).
// _doBite/_doThrow сами не экспортированы и не тестируются изолированно
// здесь: showGrappleDialog рендерит кастомные кнопки внутри DialogV2.wait и
// зовёт dialog.close() у результата рендера — этого пути текущая заглушка
// (test/support/foundry-stub.mjs) не поддерживает вовсе (не только для этой
// правки — showGrappleDialog не был протестирован и до неё). Проверяется
// чистая логика бонуса здесь и приём techDef.ranged/forceTargetActor,
// который _doThrow задействует, в test/sheets/attack-dialog.test.mjs.
describe("tentacleBonus", () => {
  const DEFAULT_SOURCES = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
  });

  it("без мутации — 0", () => {
    expect(tentacleBonus(actorFor({}))).toBe(0);
  });

  it("с mutation.tentacle — 20", () => {
    registerRuleSource("test", () => [{ id: "tentacle", label: "Щупальце",
      effects: [{ kind: "grantFlag", target: "mutation.tentacle" }] }]);
    expect(tentacleBonus(actorFor({}))).toBe(20);
  });

  // Субмутация 9 «Изменчивое» (wdbc-2ynk): пока предмет-Щупальце временно в
  // форме руки — бонусу нечем помогать ни приёму Захват, ни этим тестам, ни
  // Укусу (все три читают один и тот же tentacleBonus).
  it("с mutation.tentacle, но предмет-Щупальце в форме руки — 0", () => {
    registerRuleSource("test", () => [{ id: "tentacle", label: "Щупальце",
      effects: [{ kind: "grantFlag", target: "mutation.tentacle" }] }]);
    const tentacleItem = {
      type: "mutation", name: "Tentacle / Щупальце",
      system: { submutation: { label: "9" } },
      flags: { "warhammer-dbc": { tentacleHandForm: true } }
    };
    expect(tentacleBonus(actorFor({ items: [tentacleItem] }))).toBe(0);
  });

  it("с mutation.tentacle, предмет-Щупальце ещё в форме щупальца — 20", () => {
    registerRuleSource("test", () => [{ id: "tentacle", label: "Щупальце",
      effects: [{ kind: "grantFlag", target: "mutation.tentacle" }] }]);
    const tentacleItem = {
      type: "mutation", name: "Tentacle / Щупальце",
      system: { submutation: { label: "9" } },
      flags: { "warhammer-dbc": {} }
    };
    expect(tentacleBonus(actorFor({ items: [tentacleItem] }))).toBe(20);
  });
});

describe("tentacleTechDef", () => {
  const DEFAULT_SOURCES = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
  });

  it("без мутации — techDef возвращается как есть", () => {
    const techDef = { label: "Заломить", defaultChar: "s" };
    expect(tentacleTechDef(actorFor({}), techDef)).toBe(techDef);
  });

  it("с mutation.tentacle — добавляет +20 и подпись «Щупальце»", () => {
    registerRuleSource("test", () => [{ id: "tentacle", label: "Щупальце",
      effects: [{ kind: "grantFlag", target: "mutation.tentacle" }] }]);
    const techDef = { label: "Заломить", defaultChar: "s" };
    const result = tentacleTechDef(actorFor({}), techDef);
    expect(result.extraBonus).toBe(20);
    expect(result.extraBonusLabel).toBe("Щупальце");
    expect(result.label).toBe("Заломить"); // остальные поля techDef сохранены
  });

  it("складывается с уже существующим extraBonus, а не перезаписывает его", () => {
    registerRuleSource("test", () => [{ id: "tentacle", label: "Щупальце",
      effects: [{ kind: "grantFlag", target: "mutation.tentacle" }] }]);
    const result = tentacleTechDef(actorFor({}), { extraBonus: 5 });
    expect(result.extraBonus).toBe(25);
  });

  it("не мутирует исходный techDef", () => {
    registerRuleSource("test", () => [{ id: "tentacle", label: "Щупальце",
      effects: [{ kind: "grantFlag", target: "mutation.tentacle" }] }]);
    const techDef = { label: "Пересилить" };
    tentacleTechDef(actorFor({}), techDef);
    expect(techDef.extraBonus).toBeUndefined();
  });

  it("субмутация 9 в форме руки (wdbc-2ynk) — techDef возвращается как есть", () => {
    registerRuleSource("test", () => [{ id: "tentacle", label: "Щупальце",
      effects: [{ kind: "grantFlag", target: "mutation.tentacle" }] }]);
    const tentacleItem = {
      type: "mutation", name: "Tentacle / Щупальце",
      system: { submutation: { label: "9" } },
      flags: { "warhammer-dbc": { tentacleHandForm: true } }
    };
    const techDef = { label: "Заломить", defaultChar: "s" };
    expect(tentacleTechDef(actorFor({ items: [tentacleItem] }), techDef)).toBe(techDef);
  });
});

// wdbc-1f5j: субмутация 10 «Отделяемое» (стр. 440) — единственная из шести
// оставшихся необработанных строк Щупальца, что трогает сам движок Захвата
// (асимметричный выход Атакующего), а не просто числовой бонус. Мутация
// ищется по двуязычному имени, как isBiteWeapon, плюс выпавшая
// system.submutation.label==="10" — та же строка, что читает Механика
// (rules/mech-when.mjs, when.submutations) для gate записей типа
// tentacle-armour/tentacle-mighty-* выше в паке.
describe("detachableTentacle", () => {
  const tentacle = (label) => ({ type: "mutation", name: "Tentacle / Щупальце", system: { submutation: { label } } });

  it("субмутация 10 выпала — находит мутацию", () => {
    expect(detachableTentacle(actorFor({ items: [tentacle("10")] }))).toBeTruthy();
  });

  it("выпала другая субмутация — не находит", () => {
    expect(detachableTentacle(actorFor({ items: [tentacle("2-3")] }))).toBeNull();
  });

  it("субмутация ещё не брошена (label пуст) — не находит", () => {
    expect(detachableTentacle(actorFor({ items: [tentacle("")] }))).toBeNull();
  });

  it("нет мутации Щупальце вовсе — не находит", () => {
    expect(detachableTentacle(actorFor({}))).toBeNull();
  });

  it("другая мутация с той же выпавшей меткой — имя не совпадает, не находит", () => {
    const actor = actorFor({ items: [{ type: "mutation", name: "Пожиратель", system: { submutation: { label: "10" } } }] });
    expect(detachableTentacle(actor)).toBeNull();
  });
});

// Асимметрия endGrapple после Отсоединить: Цель ещё связана, а её партнёр
// (владелец щупальца) уже нет — состояние ВЫЧИСЛЯЕТСЯ, отдельного флага нет
// (см. комментарий у isDetachedGrapple в grapple.mjs).
describe("isDetachedGrapple", () => {
  const grappling = (v) => ({ system: { conditions: { grappling: v } } });

  it("оба ещё в Захвате — не расщеплён", () => {
    expect(isDetachedGrapple(grappling(true), grappling(true))).toBe(false);
  });

  it("актор в Захвате, партнёр уже вышел — расщеплён", () => {
    expect(isDetachedGrapple(grappling(true), grappling(false))).toBe(true);
  });

  it("актор сам не в Захвате — не расщеплён", () => {
    expect(isDetachedGrapple(grappling(false), grappling(true))).toBe(false);
  });

  it("партнёр не найден (null) — не расщеплён, отследить нечем", () => {
    expect(isDetachedGrapple(grappling(true), null)).toBe(false);
  });
});

// wdbc-oxdn (переработка после уточнения правил Метания/Дубины, стр. 27-28):
// swingProfile/throwProfile — чистая годность/классификация тира по весу
// партнёра относительно бросающего, module/rules/improvised-weapon.mjs.
// Сами _doSwing/_doThrow (реальные броски/чат) не экспортированы и не
// тестируются изолированно здесь — тот же путь через DialogV2.wait, что и у
// _doBite (см. комментарий у tentacleBonus выше).
describe("swingProfile", () => {
  const DEFAULT_SOURCES = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
  });

  it("партнёр ≤¼ Ношения и Размер не больше — годен, WS−20", () => {
    const wielder = actorFor({ encumbrance: { carry: 100 } });
    const partner = actorFor({ bio: { weight: 20 } });
    const p = swingProfile(wielder, partner);
    expect(p.ok).toBe(true);
    expect(p.wsBonus).toBe(-20);
    expect(p.tentacleBonus).toBe(0);
    expect(p.diceCount).toBe(1);
  });

  it("партнёр тяжелее ¼ Ношения — не годен", () => {
    const wielder = actorFor({ encumbrance: { carry: 100 } });
    const partner = actorFor({ bio: { weight: 26 } });
    expect(swingProfile(wielder, partner).ok).toBe(false);
  });

  it("Размер партнёра больше владельца — не годен, даже если лёгкий", () => {
    const wielder = actorFor({ encumbrance: { carry: 100 }, size: 0 });
    const partner = actorFor({ bio: { weight: 10 }, size: 1 });
    expect(swingProfile(wielder, partner).ok).toBe(false);
  });

  it("Размер партнёра больше 0 — доп. кости урона (+1d10 за каждый)", () => {
    const wielder = actorFor({ encumbrance: { carry: 100 }, size: 2 });
    const partner = actorFor({ bio: { weight: 10 }, size: 2 });
    expect(swingProfile(wielder, partner).diceCount).toBe(3); // 1 база + 2 за Размер
  });

  it("с mutation.tentacle — WS−20+20=0, tentacleBonus 20", () => {
    registerRuleSource("test", () => [{ id: "tentacle", label: "Щупальце",
      effects: [{ kind: "grantFlag", target: "mutation.tentacle" }] }]);
    const wielder = actorFor({ encumbrance: { carry: 100 } });
    const partner = actorFor({ bio: { weight: 10 } });
    const p = swingProfile(wielder, partner);
    expect(p.wsBonus).toBe(0);
    expect(p.tentacleBonus).toBe(20);
  });
});

describe("throwProfile", () => {
  const DEFAULT_SOURCES = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of DEFAULT_SOURCES) registerRuleSource(key, fn);
  });

  it("лёгкий тир (≤¼ Ношения) — BS, дальность S.b×3", () => {
    const thrower = actorFor({ encumbrance: { carry: 100 } }); // S.b по умолчанию 4
    const partner = actorFor({ bio: { weight: 25 } });
    const p = throwProfile(thrower, partner);
    expect(p.tier).toBe("light");
    expect(p.testChar).toBe("bs");
    expect(p.testLabel).toBe("BS");
    expect(p.testBonus).toBe(0);
    expect(p.rangeM).toBe(12); // 4×3
  });

  it("средний тир (¼-½ Ношения) — Athletics(S)+0, без штрафа", () => {
    const thrower = actorFor({ encumbrance: { carry: 100 } });
    const partner = actorFor({ bio: { weight: 40 } });
    const p = throwProfile(thrower, partner);
    expect(p.tier).toBe("medium");
    expect(p.testChar).toBe("s");
    expect(p.testBonus).toBe(0);
    expect(p.athleticsPenalty).toBe(0);
  });

  it("тяжёлый тир (½-полного Ношения) — Athletics(S)−30", () => {
    const thrower = actorFor({ encumbrance: { carry: 100 } });
    const partner = actorFor({ bio: { weight: 90 } });
    const p = throwProfile(thrower, partner);
    expect(p.tier).toBe("heavy");
    expect(p.testBonus).toBe(-30);
    expect(p.athleticsPenalty).toBe(-30);
  });

  it("партнёр тяжелее полного Ношения — null, метать нельзя", () => {
    const thrower = actorFor({ encumbrance: { carry: 100 } });
    const partner = actorFor({ bio: { weight: 150 } });
    expect(throwProfile(thrower, partner)).toBeNull();
  });

  it("с mutation.tentacle — +20 добавляется к testBonus любого тира", () => {
    registerRuleSource("test", () => [{ id: "tentacle", label: "Щупальце",
      effects: [{ kind: "grantFlag", target: "mutation.tentacle" }] }]);
    const thrower = actorFor({ encumbrance: { carry: 100 } });
    const light = throwProfile(thrower, actorFor({ bio: { weight: 25 } }));
    const heavy = throwProfile(thrower, actorFor({ bio: { weight: 90 } }));
    expect(light.testBonus).toBe(20);
    expect(heavy.testBonus).toBe(-10); // -30 + 20
  });
});
