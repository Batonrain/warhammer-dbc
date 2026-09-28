// test/data/naga-vs-book.test.mjs
//
// Нага (глава I, «Расы») — данные пака против текста книги, присланного
// владельцем (сверка главы I, 28.09.2026), и механика Черт: у каждой расовой
// Черты — полный книжный текст в benefit и реальные записи Конструктора
// (возможности с читателями, иммунитет к Отравлению, кнопка Адаптивной
// Отравы). Рейтинги Стартовых Трейтов сверяет race-traits-vs-book.test.mjs.

import { describe, it, expect } from "vitest";
import { isKnownCapability, CAPABILITIES } from "../../module/constants/capabilities.mjs";
import { RACES } from "../../module/constants/races.mjs";
import { packDocByFileHint } from "../support/pack-doc.mjs";

const read = rel => packDocByFileHint(rel);
const entriesOf = doc => (doc.flags?.["warhammer-dbc"]?.mechanics ?? []).flatMap(g => g.entries ?? []);

const race = read("packs-src/races/Отродия/Naga___Нага_rKnwCr8wu9U5qOHu.json");
const T = "packs-src/traits/";
const TRAITS = {
  abominable: read(T + "Abominable_Physiology___Изуверская_Физио_KbbhVXr6uePZT2Jj.json"),
  venom: read(T + "Adaptive_Venom___Адаптивная_Отрава_YEwvFphUwqNEdgZj.json"),
  constrictor: read(T + "Constrictor___Удав_tj53xdxiYCmWn46y.json"),
  prince: read(T + "Dark_Prince_s_Child___Дитя_Т_много_Принц_sQusd40mR5dr9AIR.json"),
  vanity: read(T + "Vanity_Unbound___Безграничное_Тщеславие_r06Na2pEFJHMgZGJ.json")
};

// Книжный текст дословно (присланный владельцем текст главы I).
const BOOK = {
  abominable: "Нага иммунна к ядам, пост-эффектам и зависимости от наркотиков, даже откровенно сверхъестественных. Она лечится как Космодесантник, а не человек, и дополнительно вылечивает себе 1 Рану в сутки. Нага может в начале своего Хода затянуть свое Кровотечение тестом T+0.",
  venom: "Укус Наги использует кубик 1d10 вместо 1d5. Она может потратить Очко Бесчестия, чтобы превратить яд в своих клыках в любой другой яд с вектором рана, инъекция или еда (который нужно скормить цели) и Редкостью не более 2 на 1 укус или одну дозу в еду. Нага может создавать и более редкие яды, тратя 3 Очка Бесчестия для Редкости 3 и 5 Очков Бесчестия для Редкости 4.",
  constrictor: "Нага может использовать свой хвост для совершения Захвата и в Борьбе, освобождая руки. В расчете Захвата и Борьбы хвост считается парой рук с Трейтом Unnatural S (6) и получает +20 на все тесты Athletics.",
  prince: "Наги пользуются особой благосклонностью Слаанеш. Нага начинает игру с покровительством Слаанеш, и не может потерять его. Впервые набирая 30, 60, и 90 Inf, Нага может выбрать либо получить еще 2 пары рук (и Трейт Multiple Arms (+2)), либо получить +2 к максимуму Очков Бесчестия.",
  vanity: "Каждая из Наг считает себя совершенным созданием и величайшим триумфом породившего ее эксперимента, а всех остальных Наг – не более, чем провальным прототипом или дешевой подделкой. Ее Талант Hatred (Наги) также распространяющийся на персонажей с мутацией «Звероподобный (Змея)» или «Центавр (Змея)», и она едва может сдерживать гордыню в общении с другими змееподобными существами (что дает ей штраф –20 на социальные взаимодействия). Она не может признавать ничьего авторитета и получать преимущества Командования (даже от координатора, а не командира)."
};

describe("Нага: раса против книги", () => {
  it("Характеристики 25/25/30/35/30/20/25/25/20, Inf 24, Cor 5; Броски 2, Очки 7, Смещение 2", () => {
    expect(race.system.chars).toEqual({ ws: 25, bs: 25, s: 30, t: 35, ag: 30, int: 20, per: 25, wp: 25, fel: 20, inf: 24 });
    expect(race.system.startCorruption).toBe(5);
    expect([race.system.bonusRolls, race.system.bonusPoints, race.system.charShift]).toEqual([2, 7, 2]);
    // Резерв-константы держатся в согласии с паком.
    expect(RACES.naga.chars).toEqual(race.system.chars);
  });

  it("Common Lore — любые 3, Linguistics (Low Gothic)", () => {
    const skills = entriesOf(race).filter(e => e.kind === "skill");
    expect(skills.map(e => [e.skillKey, e.specKey, e.specChoiceCount])).toEqual([
      ["commonLore", "__choice__", 3], ["linguistics", "lowGothic", 1]
    ]);
    expect(RACES.naga.skills).toBe("Common Lore (любые 3), Linguistics (Low Gothic)");
  });

  it("снаряжение — дословно книга (его разбирает Этап 5 Мастера), выдачи Конструктором нет", () => {
    const gear = "4 элемента Снаряжения и Инструментов до R1, из них 1 Good.Q и 1 Best.Q";
    expect(race.system.gear).toBe(gear);
    expect(RACES.naga.gear).toBe(gear);
    expect(entriesOf(race).some(e => e.kind === "equipment")).toBe(false);
  });

  it("Hatred (Наги) нацелен на Нагу и на мутантов-змей (Безграничное Тщеславие)", () => {
    const hatred = entriesOf(race).find(e => e.kind === "talent" && /Hatred/.test(e.sourceName));
    expect(hatred.targets.map(t => [t.kind, t.value])).toEqual([["race", "naga"], ["feature", "snakeMutation"]]);
  });

  it("выдаёт все расовые Черты книги", () => {
    const names = entriesOf(race).filter(e => e.kind === "trait").map(e => e.sourceName.split(" / ")[0]);
    for (const n of ["The Quick and The Dead", "Abominable Physiology", "Adaptive Venom", "Constrictor",
      "Dark Prince's Child", "Vanity Unbound"]) expect(names).toContain(n);
  });
});

describe("Нага: расовые Черты — книжный текст и механика", () => {
  it.each(Object.keys(BOOK))("%s: benefit — полный текст книги", key => {
    expect(TRAITS[key].system.benefit).toBe(BOOK[key]);
  });

  const caps = doc => entriesOf(doc).filter(e => e.kind === "capability").map(e => e.capabilityKey);

  it("каждая возможность Черт зарегистрирована и имеет читателя", () => {
    for (const doc of Object.values(TRAITS)) {
      for (const key of caps(doc)) {
        expect(isKnownCapability(key), key).toBe(true);
        expect(CAPABILITIES[key].reader, key).not.toBe("");
      }
    }
  });

  it("Изуверская Физиология: яды, пост-эффекты, лечение Астартес, +1 Рана/сутки, Кровотечение; иммунитет к Отравлению", () => {
    expect(caps(TRAITS.abominable)).toEqual(["poison.immune", "drugs.afterEffectAddictionImmune",
      "healing.astartes", "healing.extraWoundDaily", "bleeding.selfStanchTurnStart"]);
    const cond = entriesOf(TRAITS.abominable).find(e => e.kind === "condition");
    expect(cond).toMatchObject({ condKey: "poisoned", condMode: "immunity" });
  });

  it("Адаптивная Отрава: Укус 1d10 и кнопка смены яда", () => {
    expect(caps(TRAITS.venom)).toEqual(["bite.venomD10"]);
    const script = entriesOf(TRAITS.venom).find(e => e.kind === "script");
    expect(script.code).toContain("useAdaptiveVenom(actor)");
  });

  it("Удав, Дитя Тёмного Принца, Безграничное Тщеславие — свои возможности", () => {
    expect(caps(TRAITS.constrictor)).toEqual(["grapple.constrictorTail"]);
    expect(caps(TRAITS.prince)).toEqual(["patronage.lockedSlaanesh", "infamy.darkPrinceMilestones"]);
    expect(caps(TRAITS.vanity)).toEqual(["command.cannotReceive"]);
  });

  it("заглушки trait.* Черт Наги больше не пустые", () => {
    for (const key of ["trait.abominablePhysiology", "trait.adaptiveVenom", "trait.constrictor",
      "trait.darkPrinceSChild", "trait.vanityUnbound"]) {
      expect(CAPABILITIES[key].reader, key).not.toBe("");
    }
  });

  it("id записей Конструктора — ровно 16 символов [A-Za-z0-9]", () => {
    for (const doc of Object.values(TRAITS)) {
      for (const g of doc.flags["warhammer-dbc"].mechanics) {
        expect(g.id).toMatch(/^[A-Za-z0-9]{16}$/);
        for (const e of g.entries) expect(e.id).toMatch(/^[A-Za-z0-9]{16}$/);
      }
    }
  });
});
