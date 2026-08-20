// test/sheets/minions-panel.test.mjs
//
// Блок «МИНЬОНЫ» на вкладке СОЦИУМ и выбор при покупке Таланта (стр. 111-113).
//
// Главное здесь — когда блока НЕТ: слуг даёт Талант «Миньон Хаоса», и у того,
// кто его не покупал, панель только занимала бы место. Дальше — счётчик и
// кнопка «+»: она появляется ровно тогда, когда Талантов куплено больше, чем
// заведено слуг.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { minionsPanelContext, minionsOfActor } from "../../module/sheets/tabs/minions-panel.mjs";
import { applyMinionSlot, minionSlotLabel } from "../../module/apps/minion-talent.mjs";
import { minionSlotOf } from "../../module/rules/minion-build.mjs";

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
  it("без Таланта блока нет вовсе", () => {
    const ctx = minionsPanelContext(master([{ type: "talent", name: "Дуэлист" }]), []);
    expect(ctx.hasMinionTalent).toBe(false);
    expect(ctx.minionRows).toEqual([]);
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
