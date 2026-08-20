// test/combat/horde-damage.test.mjs
//
// Применение урона к Орде через общий конвейер (combat/damage.mjs). До этого
// Орда ловила расчёт для персонажей: её Поглощение (одно число) читалось как
// объект зон брони, а урон писался в Раны, которых у неё в схеме нет, — и
// кнопка «Применить урон» по Орде не делала ровно ничего.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { applyDamageToActor } from "../../module/combat/damage.mjs";
import { talentMagBonus } from "../../module/combat/horde-damage.mjs";

/** Подставная Орда: считает только то, что нужно применению урона. */
function hordeActor({ magnitude = 40, start = 40, absorption = 4, sizeMod = 0,
                      psychDamage = 0, flags = {} } = {}) {
  const updates = [];
  return {
    id: "horde1", name: "Орда рабов", type: "horde", updates,
    system: {
      magnitude: { value: magnitude, start },
      psychDamage, sizeMod,
      characteristics: { wp: { total: 30, bonus: 3 } },
      derived: { absorptionTotal: absorption }
    },
    items: [],
    async update(data) {
      updates.push(data);
      if (data["system.magnitude.value"] !== undefined)
        this.system.magnitude.value = data["system.magnitude.value"];
      if (data["system.psychDamage"] !== undefined)
        this.system.psychDamage = data["system.psychDamage"];
    },
    getFlag: (_ns, key) => flags[key],
    async setFlag(_ns, key, value) { flags[key] = value; }
  };
}

const damage = (over = {}) => ({
  rawDamage: 12, penetration: 0, damageType: "impact", hitLocation: "Торс",
  attackerName: "Стрелок", weaponName: "Лазган", ...over
});

beforeEach(resetCaptured);

describe("урон по Орде вместо расчёта Ран", () => {
  it("пробившее попадание снимает ровно одну Магнитуду", async () => {
    const horde = hordeActor();
    await applyDamageToActor(horde, damage());
    expect(horde.system.magnitude.value).toBe(39);
  });

  it("огромный урон снимает столько же — толпе всё равно", async () => {
    const horde = hordeActor();
    await applyDamageToActor(horde, damage({ rawDamage: 300 }));
    expect(horde.system.magnitude.value).toBe(39);
  });

  it("Поглощение Орды считается её собственным числом, а не зонами брони", async () => {
    const horde = hordeActor({ absorption: 12 });
    await applyDamageToActor(horde, damage({ rawDamage: 12 }));
    expect(horde.system.magnitude.value).toBe(40);
    expect(horde.updates).toEqual([]);
  });

  it("Раны Орде не пишутся — их у неё нет", async () => {
    const horde = hordeActor();
    await applyDamageToActor(horde, damage());
    for (const update of horde.updates)
      expect(Object.keys(update).some(k => k.startsWith("system.wounds"))).toBe(false);
  });

  it("Взрывное снимает по Магнитуде за каждое попадание", async () => {
    const horde = hordeActor();
    await applyDamageToActor(horde, damage({ blast: 3 }));
    expect(horde.system.magnitude.value).toBe(36);
  });

  it("Распыление считает попадания от дальности конуса", async () => {
    const horde = hordeActor();
    await applyDamageToActor(horde, damage({ spray: true, weaponRange: 20 }));
    expect(horde.system.magnitude.value).toBe(35);   // 1 + 20/5
  });

  it("Опустошительное добавляет урон сверх попаданий", async () => {
    const horde = hordeActor();
    await applyDamageToActor(horde, damage({ devastating: 2 }));
    expect(horde.system.magnitude.value).toBe(37);
  });

  it("Магнитуда не уходит в минус", async () => {
    const horde = hordeActor({ magnitude: 2 });
    await applyDamageToActor(horde, damage({ blast: 9 }));
    expect(horde.system.magnitude.value).toBe(0);
  });

  it("карточка называет число попаданий и остаток Магнитуды", async () => {
    const horde = hordeActor();
    await applyDamageToActor(horde, damage({ flame: true }));
    const card = captured.chat.map(c => c.content).join("");
    expect(card).toContain("Попаданий по Орде");
    expect(card).toContain("40");
    expect(card).toContain("38");
  });
});

describe("накопитель потерь за Раунд", () => {
  it("копит урон и предупреждает о тесте при переходе через 25% стартовой", async () => {
    const flags = {};
    const horde = hordeActor({ magnitude: 40, start: 40, flags });
    // Порог — 10; за два удара по 6 попаданий он перекрывается.
    await applyDamageToActor(horde, damage({ blast: 5 }));
    expect(flags.hordeRoundDamage).toBe(6);
    expect(captured.chat.map(c => c.content).join("")).not.toContain("массивные потери");

    await applyDamageToActor(horde, damage({ blast: 5 }));
    expect(flags.hordeRoundDamage).toBe(12);
    expect(captured.chat.map(c => c.content).join("")).toContain("массивные потери");
  });

  it("предупреждение выдаётся один раз, а не с каждым ударом за порогом", async () => {
    const flags = { hordeRoundDamage: 20 };
    const horde = hordeActor({ start: 40, flags });
    await applyDamageToActor(horde, damage());
    expect(captured.chat.map(c => c.content).join("")).not.toContain("массивные потери");
  });
});

describe("Таланты, усиливающие урон по Ордам", () => {
  const withTalent = name => ({
    system: { characteristics: { ws: { bonus: 5 }, bs: { bonus: 7 } } },
    items: [{ type: "talent", name }]
  });

  it("«Ураган Смерти» даёт ½WS.b в рукопашной", () => {
    expect(talentMagBonus(withTalent("Whirlwind of Death / Ураган Смерти"), { melee: true }).bonus)
      .toBe(3);
  });

  it("«Ураган Смерти» не работает в стрельбе", () => {
    expect(talentMagBonus(withTalent("Whirlwind of Death / Ураган Смерти"), { melee: false }).bonus)
      .toBe(0);
  });

  it("«Свинцовый Дождь» даёт ½BS.b очередью и оружием Blast/Spray", () => {
    const actor = withTalent("Storm of Lead / Свинцовый Дождь");
    expect(talentMagBonus(actor, { burst: true }).bonus).toBe(4);
    expect(talentMagBonus(actor, { blast: 2 }).bonus).toBe(4);
    expect(talentMagBonus(actor, { spray: true }).bonus).toBe(4);
  });

  it("«Свинцовый Дождь» молчит на одиночном выстреле обычного оружия", () => {
    expect(talentMagBonus(withTalent("Storm of Lead / Свинцовый Дождь"), {}).bonus).toBe(0);
  });

  it("без Таланта надбавки нет", () => {
    expect(talentMagBonus(withTalent("Что-то другое"), { melee: true }).bonus).toBe(0);
    expect(talentMagBonus(null, { melee: true }).bonus).toBe(0);
  });
});
