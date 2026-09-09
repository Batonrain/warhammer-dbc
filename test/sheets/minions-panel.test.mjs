// test/sheets/minions-panel.test.mjs
//
// Блок «МИНЬОНЫ» на вкладке СОЦИУМ и выбор при покупке Таланта (стр. 111-113).
//
// Главное здесь — когда блока НЕТ: слуг даёт Талант «Миньон Хаоса», и у того,
// кто его не покупал, панель только занимала бы место. Дальше — счётчик и
// кнопка «+»: она появляется ровно тогда, когда Талантов куплено больше, чем
// заведено слуг.

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { minionsPanelContext, minionsOfActor } from "../../module/sheets/tabs/minions-panel.mjs";
import { applyMinionSlot, minionSlotLabel } from "../../module/apps/minion-talent.mjs";
import { minionSlotOf } from "../../module/rules/minion-build.mjs";
import { clearRuleSources, registerRuleSource } from "../../module/rules/sources.mjs";

const talent = (group, tier, id) => ({
  id, type: "talent", name: "Minion of Chaos / Миньон Хаоса",
  flags: { "warhammer-dbc": { minionSlot: { group, tier } } }
});

/** Хозяин: список предметов и uuid, по которому слуги на него ссылаются. */
const master = (items = [], chars = { fel: 45, per: 32, int: 51, wp: 30 }) => ({
  uuid: "Actor.master", items,
  system: {
    characteristics: { ...Object.fromEntries(Object.entries(chars).map(([k, v]) => [k, { total: v }])), inf: { total: 40 } }
  }
});

const minion = (group, tier, name = "Слуга") => ({
  uuid: `Actor.${name}`, name, img: "icons/svg/mystery-man.svg",
  system: { masterUuid: "Actor.master", minionType: group, minionTier: tier, loyalty: { value: 30, max: 32 } }
});

describe("блок «МИНЬОНЫ»", () => {
  it("без Таланта и без уже привязанного слуги блока нет вовсе", () => {
    const ctx = minionsPanelContext(master([{ type: "talent", name: "Дуэлист" }]), []);
    expect(ctx.hasMinionTalent).toBe(false);
    expect(ctx.minionRows).toEqual([]);
    expect(ctx.actorUuid).toBeUndefined();
  });

  it("Талант куплен, слуги нет — блок есть, «+» доступна", () => {
    const ctx = minionsPanelContext(master([talent("beast", "lesser", "t1")]), []);
    expect(ctx.hasMinionTalent).toBe(true);
    expect(ctx.minionCount).toBe(0);
    expect(ctx.freeSlots).toHaveLength(1);
    expect(ctx.freeSlots[0].label).toBe("Зверь, Низший");
  });

  it("слуга занимает свой слот — свободных не остаётся", () => {
    const m = master([talent("beast", "lesser", "t1")]);
    const ctx = minionsPanelContext(m, [minion("beast", "lesser")]);
    expect(ctx.minionCount).toBe(1);
    expect(ctx.freeSlots).toHaveLength(0);
    expect(ctx.minionRows[0]).toMatchObject({ groupLabel: "Зверь", tierLabel: "Низший", loyaltyValue: 30 });
  });

  // Пример книги: I.b 5 и F.b 3 — потолок 3, пока человек в свите.
  it("максимум считается по наименьшему бонусу среди групп", () => {
    const m = master([talent("machine", "lesser", "t1"), talent("human", "lesser", "t2")],
      { fel: 35, per: 30, int: 55, wp: 30 });
    expect(minionsPanelContext(m, []).minionCapacity).toBe(3);
  });

  it("счётчик по группам идёт в шапку блока", () => {
    const m = master([talent("human", "lesser", "t1"), talent("human", "greater", "t2")]);
    const ctx = minionsPanelContext(m, [minion("human", "lesser", "Раб"), minion("human", "greater", "Оруженосец")]);
    expect(ctx.minionTally).toEqual([{ key: "human", label: "Человек", count: 2 }]);
  });

  it("у Орды Миньонов в карточке Магнитуда, а не Лояльность", () => {
    const horde = minion("human", "horde", "Толпа");
    horde.system.magnitude = { value: 20, max: 20 };
    const ctx = minionsPanelContext(master([talent("human", "horde", "t1")]), [horde]);
    expect(ctx.minionRows[0].magnitude).toBe(20);
  });

  it("слуги ищутся по ссылке у самого слуги, а не по списку у Хозяина", () => {
    const mine = minion("beast", "lesser", "Мой");
    const alien = { uuid: "Actor.x", name: "Чужой", system: { masterUuid: "Actor.other" } };
    expect(minionsOfActor(master(), [mine, alien]).map(a => a.name)).toEqual(["Мой"]);
  });

  // wdbc-1rno: Инфернальный Оруженосец/Рыцарь Бога дают слугу БЕЗ Таланта на
  // слот вовсе — блок обязан показать его, даже когда freeSlots/minionCapacity
  // не считаются ни по одной группе (Талантов нет совсем).
  it("нет Таланта, но слуга уже привязан без слота — блок есть", () => {
    const m = master([{ type: "talent", name: "Дуэлист" }]);
    const ctx = minionsPanelContext(m, [minion("daemon", "lesser", "Оруженосец")]);
    expect(ctx.hasMinionTalent).toBe(true);
    expect(ctx.minionCount).toBe(1);
    expect(ctx.freeSlots).toHaveLength(0);
    expect(ctx.minionRows[0].name).toBe("Оруженосец");
    // Не считается "лишним" (extra) в упрекающем смысле — просто нет слота,
    // под который его можно было бы сопоставить: тот же путь, что у слуги,
    // заведённого руками, честно посчитан в minionExtra, без иной семантики.
    expect(ctx.minionExtra).toBe(1);
  });

  it("контекст несёт uuid Хозяина для зоны дропа в шаблоне", () => {
    const ctx = minionsPanelContext(master([talent("beast", "lesser", "t1")]), []);
    expect(ctx.actorUuid).toBe("Actor.master");
  });
});

describe("покупка Таланта Миньона", () => {
  it("выбор пишется и для глаз, и для машины", () => {
    const obj = applyMinionSlot({ system: {} },
      { group: "daemon", tier: "greater", talentTier: 3, label: minionSlotLabel("daemon", "greater") });

    expect(obj.system.specialization).toBe("Демон, Высший");
    // Уровень Таланта подменяется выбранным: от него считается цена.
    expect(obj.system.tier).toBe(3);
    expect(minionSlotOf(obj)).toEqual({ group: "daemon", tier: "greater" });
  });

  it("прежние флаги предмета не затираются", () => {
    const obj = applyMinionSlot(
      { system: {}, flags: { "warhammer-dbc": { migratedEffect: true } } },
      { group: "human", tier: "lesser", talentTier: 1, label: "Человек, Низший" });

    expect(obj.flags["warhammer-dbc"].migratedEffect).toBe(true);
    expect(obj.flags["warhammer-dbc"].minionSlot.group).toBe("human");
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  Блок для того, кому он и нужен (wdbc-8t8)
//
//  «Контролировать как Миньона без траты слотов Миньонов» — это Инфернальный
//  Оруженосец, Таланта под такого слугу нет и не будет. Пока блок показывался
//  только при Таланте или уже привязанном слуге, выходил замкнутый круг: зона
//  дропа появлялась после привязки, а привязать было нечем.
// ════════════════════════════════════════════════════════════════════════════

describe("блок МИНЬОНЫ у чемпиона с Даром вместо Таланта", () => {
  afterEach(() => clearRuleSources());

  /** Актор без Талантов-слотов и без слуг, но с возможностью Дара. */
  const withGift = cap => {
    clearRuleSources();
    registerRuleSource("test", () => [{
      id: cap, label: cap, when: {}, effects: [{ kind: "grantFlag", target: cap }]
    }]);
    return { uuid: "Actor.champion", items: [], system: {} };
  };

  it("Инфернальный Оруженосец открывает блок и зону дропа", () => {
    const ctx = minionsPanelContext(withGift("gift.khorne.infernalArmiger"), []);
    expect(ctx.hasMinionTalent, "перетащить слугу некуда — фича недоступна").toBe(true);
  });

  it("любой из четырёх Богов — то же самое", () => {
    for (const god of ["nurgle", "slaanesh", "tzeentch"])
      expect(minionsPanelContext(withGift(`gift.${god}.infernalArmiger`), []).hasMinionTalent).toBe(true);
  });

  it("без Таланта, слуг и Дара блока по-прежнему нет", () => {
    clearRuleSources();
    registerRuleSource("test", () => []);
    expect(minionsPanelContext({ uuid: "Actor.plain", items: [], system: {} }, []).hasMinionTalent).toBe(false);
  });
});
