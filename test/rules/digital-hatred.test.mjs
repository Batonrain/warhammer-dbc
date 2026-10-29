// test/rules/digital-hatred.test.mjs
//
// Digital Hatred / Цифровая Ненависть (Техномистик, Sahara 3-2501):
// «Он уменьшает цену активации (но не Процессов) своих негативно воздействующих
// Техночудес на 1 ⚙, если они действуют только на его Ненавистных врагов.»
//
// Что проверяется:
//   1. схема Техночуда хранит `harmful` (поле, забытое в схеме, пропадает при
//      первой правке предмета в игре) — на настоящих документах packs-src;
//   2. список «негативных» Техночудес в паке зафиксирован (проставлен по книге);
//   3. читатель: скидка 1 ⚙ — только при Таланте + harmful + ВСЕ цели Ненавистные
//      (книга: «только на»); цена не уходит ниже 0; Процессы не трогаются;
//   4. Талант в паке несёт запись Конструктора (ключ Возможности) и опознаётся
//      по ней даже с испорченным именем.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { activateTechMiracle } from "../../module/sheets/tabs/tech.mjs";

import { TechPowerData } from "../../module/data/item/tech-power.mjs";
import { allPackDocuments, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";
import {
  hasDigitalHatred, digitalHatredDiscount, techActivationCost
} from "../../module/rules/digital-hatred.mjs";
import { raceTarget, allTarget } from "../../module/rules/talent-targets.mjs";

/**
 * Техночудеса, которым в паке стоит harmful:true (проставлено по книге
 * 23.10.2026: у Техночуда есть урон, помеха, отключение или иное вредящее
 * воздействие на цель). Список — намеренно явный: новое «вредящее» чудо или
 * снятая отметка должны попадать сюда осознанно, а не молча.
 */
const HARMFUL = [
  "Moravec Breath / Дыхание Моравека",
  "Moravec Eyes / Глаза Моравека",
  "Moravec Maw / Пасть Моравека",
  "Moravec Net / Сеть Моравека",
  "Dataquake / Дататрясение",
  "Devastator of Elder Anacharis / Опустошитель Старца Аначариса",
  "Enraging of Animus / Разъярение Анимуса",
  "Maledict of Cracks / Проклятье Трещин",
  "Maledict of Jamming / Проклятье Заклинивания",
  "Maledict of Momentum / Проклятье Момента",
  "Maledict of Rust / Проклятье Ржавчины",
  "Quelling of Animus / Усмирение Анимуса",
  "Whip of Elder Arkhan / Плеть Старца Аркхана",
  "Runic Exorcism / Рунический Экзорцизм",
  "Scrapcode Injection / Инъекция Скрапкода",
  "Techsorcism Rebellion / Восстание Техзорцизма",
  "Feedback Screech / Кольцевой Визг",
  "Rite of Awe / Обряд Трепета",
  "Rite of Dread / Обряд Ужаса",
  "Rite of Silent Renunciation / Обряд Молчаливого Отречения",
  "Psalm of the Ashen Steps / Псалом Пепельной Поступи",
  "Psalm of the Death's Breath / Псалом Дыхания Смерти",
  "Psalm of the Parting / Псалом Разделения",
  "Psalm of the Thousand Suns / Псалом Тысячи Солнц",
  "Voltagheist Retribution / Вольтагейст Воздаяние",
  "Invocation of the Storm / Обращение к Шторму",
  "Luminen Desecration / Люминен Осквернение",
  "Luminen Pila / Люминен Шар",
  "Luminen Shock / Люминен Шок",
  "Luminen Smite / Люминен Сокрушение",
  "Luminen Surge / Люминен Всплеск",
  "Litany of the Ruinex / Литания Руинэкса",
  "Ferric Chains / Феррические Цепи",
  "Vox Seal / Вокс Печать",
  "Digital Phantasm / Цифровой Фантазм",
  "Numerica Curse / Нумерика Проклятье",
  "Numerica Dominion / Нумерика Владычество",
  "Numerica Subjugation / Нумерика Покорение"
];

describe("Техночудо: поле harmful в схеме и в паке", () => {
  it("умолчание — false, у пустого предмета поле есть", () => {
    const obj = new TechPowerData({}).toObject();
    expect(obj.harmful).toBe(false);
  });

  it("true переживает прохождение через схему (поле не потеряно)", () => {
    expect(new TechPowerData({ harmful: true }).toObject().harmful).toBe(true);
  });

  it("в паке отмечены ровно перечисленные Техночудеса — и после схемы тоже", () => {
    const docs = allPackDocuments("tech-powers").map(({ doc }) => doc).filter(d => d.type === "techPower");
    expect(docs.length).toBeGreaterThan(100);
    const marked = docs
      .filter(d => new TechPowerData(d.system).toObject().harmful === true)
      .map(d => d.name)
      .sort();
    expect(marked).toEqual([...HARMFUL].sort());
  }, PACK_SCAN_TIMEOUT);

  it("отмеченное — именно булево значение в исходнике, не строка", () => {
    const docs = allPackDocuments("tech-powers").map(({ doc }) => doc).filter(d => d.type === "techPower");
    const bad = docs.filter(d => d.system.harmful !== undefined && typeof d.system.harmful !== "boolean").map(d => d.name);
    expect(bad).toEqual([]);
  }, PACK_SCAN_TIMEOUT);
});

// ── Читатель ────────────────────────────────────────────────────────────────

const ORK = raceTarget("ork", "Орк");
const talent = (name = "Digital Hatred / Цифровая Ненависть") => ({
  type: "talent", name, system: {}, flags: {}, getFlag: () => undefined
});
const hatred = targets => ({ type: "talent", name: "Hatred / Ненависть", system: { targets } });
const priest = (...items) => ({ items });
const foe = race => ({ type: "character", system: { race } });
const power = (harmful, extra = {}) => ({ system: { harmful, cognitionCost: 3, sustainCost: 1, ...extra } });

describe("hasDigitalHatred", () => {
  it("по имени (любая половина двуязычного)", () => {
    expect(hasDigitalHatred(priest(talent()))).toBe(true);
    expect(hasDigitalHatred(priest(talent("Digital Hatred")))).toBe(true);
    expect(hasDigitalHatred(priest(talent("Цифровая Ненависть")))).toBe(true);
  });
  it("обычная Ненависть — не Цифровая; без актора — false", () => {
    expect(hasDigitalHatred(priest(hatred([ORK])))).toBe(false);
    expect(hasDigitalHatred(null)).toBe(false);
  });
});

describe("digitalHatredDiscount: скидка 1 ⚙ на вредящие Техночуда против Ненавистных", () => {
  const mage = () => priest(talent(), hatred([ORK]));

  it("Талант + harmful + единственная цель — Ненавистная → −1", () => {
    expect(digitalHatredDiscount(mage(), power(true), [foe("ork")])).toBe(1);
  });

  it("«только на Ненавистных»: все цели должны подходить, одна чужая — скидки нет", () => {
    expect(digitalHatredDiscount(mage(), power(true), [foe("ork"), foe("ork")])).toBe(1);
    expect(digitalHatredDiscount(mage(), power(true), [foe("ork"), foe("human")])).toBe(0);
  });

  it("не вредящее Техночудо — скидки нет", () => {
    expect(digitalHatredDiscount(mage(), power(false), [foe("ork")])).toBe(0);
    expect(digitalHatredDiscount(mage(), { system: { cognitionCost: 3 } }, [foe("ork")])).toBe(0);
  });

  it("без Таланта — скидки нет (одной Ненависти мало)", () => {
    expect(digitalHatredDiscount(priest(hatred([ORK])), power(true), [foe("ork")])).toBe(0);
  });

  it("без Ненависти — нечего считать Ненавистным, скидки нет", () => {
    expect(digitalHatredDiscount(priest(talent()), power(true), [foe("ork")])).toBe(0);
  });

  it("без целей — скидки нет (не из чего убедиться, что враги Ненавистные)", () => {
    expect(digitalHatredDiscount(mage(), power(true), [])).toBe(0);
    expect(digitalHatredDiscount(mage(), power(true), undefined)).toBe(0);
  });

  it("«Все!» делает Ненавистной любую цель, но пустые цели по-прежнему не считаются", () => {
    const m = priest(talent(), hatred([allTarget()]));
    expect(digitalHatredDiscount(m, power(true), [foe("human")])).toBe(1);
    expect(digitalHatredDiscount(m, power(true), [])).toBe(0);
  });

  it("цель без актора (токен без документа) не считается Ненавистной", () => {
    const m = priest(talent(), hatred([allTarget()]));
    expect(digitalHatredDiscount(m, power(true), [null])).toBe(0);
  });
});

describe("techActivationCost: цена активации после скидки", () => {
  const mage = () => priest(talent(), hatred([ORK]));

  it("снижает на 1 цену активации", () => {
    expect(techActivationCost(mage(), power(true), [foe("ork")])).toEqual({ cost: 2, discount: 1 });
  });

  it("не уходит ниже 0: у чуда с ценой 0 скидка не делает цену отрицательной", () => {
    const r = techActivationCost(mage(), power(true, { cognitionCost: 0 }), [foe("ork")]);
    expect(r.cost).toBe(0);
    expect(r.discount).toBe(0);
  });

  it("цена 1 → 0, скидка 1", () => {
    expect(techActivationCost(mage(), power(true, { cognitionCost: 1 }), [foe("ork")]))
      .toEqual({ cost: 0, discount: 1 });
  });

  it("Процесс (sustainCost) не меняется: функция возвращает только цену активации", () => {
    const p = power(true, { sustainCost: 2 });
    techActivationCost(mage(), p, [foe("ork")]);
    expect(p.system.sustainCost).toBe(2);
  });

  it("нет скидки — цена как в книге", () => {
    expect(techActivationCost(mage(), power(true), [foe("human")])).toEqual({ cost: 3, discount: 0 });
  });

  it("пустая или нечисловая цена трактуется как 0", () => {
    expect(techActivationCost(mage(), { system: { harmful: true } }, [foe("ork")])).toEqual({ cost: 0, discount: 0 });
  });
});

// ── Сквозная проверка: настоящий Талант и настоящее Техночудо из packs-src ──

describe("Талант и Техночудо из packs-src", () => {
  const docs = allPackDocuments(["talents", "tech-powers"]).map(({ doc }) => doc);
  const talentDoc = docs.find(d => d.name.startsWith("Digital Hatred"));
  const surge = docs.find(d => d.name.startsWith("Luminen Surge"));
  const shield = docs.find(d => d.name.startsWith("Voltagheist Shield"));

  it("Талант несёт запись Конструктора с ключом Возможности и опознаётся даже без имени", () => {
    const entries = talentDoc.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries);
    expect(entries.some(e => e.kind === "capability" && e.capabilityKey === "technomystic.core.digitalHatred")).toBe(true);
    const carrier = { ...talentDoc, name: "ИСПОРЧЕННОЕ ИМЯ", getFlag: () => undefined };
    expect(hasDigitalHatred({ items: [carrier] })).toBe(true);
  });

  it("Люминен Всплеск (вредящее) получает скидку, Вольтагейст Щит (защита) — нет", () => {
    const mage = { items: [{ ...talentDoc, getFlag: () => undefined }, hatred([ORK])] };
    const orcs = [foe("ork")];
    expect(techActivationCost(mage, surge, orcs).discount).toBe(1);
    expect(techActivationCost(mage, shield, orcs).discount).toBe(0);
    expect(techActivationCost(mage, surge, orcs).cost).toBe(surge.system.cognitionCost - 1);
  });
});

// ── Сквозная проверка через activateTechMiracle (лист) ──────────────────────

describe("activateTechMiracle: Цифровая Ненависть списывает на 1 ⚙ меньше", () => {
  beforeEach(resetCaptured);

  const harmfulPower = (extra = {}) => ({
    name: "Тестовая Молния",
    system: {
      miracleType: "imperative", rating: 1, harmful: true, cognitionCost: 3, energyCost: 0,
      testSkill: "techUse", testMod: 0, iron: "", damage: "", weaponProps: [], ...extra
    },
    update: async () => {}
  });

  function makeMage({ cog = 10, items = [talent(), hatred([ORK])] } = {}) {
    const updates = [];
    const actor = {
      id: "m1", name: "Техножрец", items,
      system: {
        cognition: { value: cog, max: 10 }, energy: { value: 10, max: 10 },
        characteristics: { t: { total: 50 }, int: { total: 40, bonus: 4 } },
        skills: { techUse: { total: 40 } }, techFocus: [], techCompBonus: 0, corruptionBonus: 0
      },
      update: async u => { updates.push(u); }
    };
    return { actor, updates };
  }

  it("все цели — Ненавистные: Когниция −2 вместо −3, в карточке видна причина", async () => {
    globalThis.game.user = { targets: [{ actor: foe("ork") }] };
    const { actor, updates } = makeMage();
    captured.dice = [10];
    await activateTechMiracle(actor, harmfulPower());
    expect(updates[0]["system.cognition.value"]).toBe(8);
    expect(captured.chat.at(-1).content).toContain("Цифровая Ненависть");
  });

  it("одна из целей не Ненавистная: полная цена", async () => {
    globalThis.game.user = { targets: [{ actor: foe("ork") }, { actor: foe("human") }] };
    const { actor, updates } = makeMage();
    captured.dice = [10];
    await activateTechMiracle(actor, harmfulPower());
    expect(updates[0]["system.cognition.value"]).toBe(7);
    expect(captured.chat.at(-1).content).not.toContain("Цифровая Ненависть");
  });

  it("без Таланта: полная цена даже против Ненавистных", async () => {
    globalThis.game.user = { targets: [{ actor: foe("ork") }] };
    const { actor, updates } = makeMage({ items: [hatred([ORK])] });
    captured.dice = [10];
    await activateTechMiracle(actor, harmfulPower());
    expect(updates[0]["system.cognition.value"]).toBe(7);
  });

  it("скидка учитывается и в проверке «хватает ли Когниции»: 2 ⚙ при цене 3 − 1", async () => {
    globalThis.game.user = { targets: [{ actor: foe("ork") }] };
    const { actor, updates } = makeMage({ cog: 2 });
    captured.dice = [10];
    await activateTechMiracle(actor, harmfulPower());
    expect(updates[0]["system.cognition.value"]).toBe(0);
  });

  it("Процесс не удешевляется: поддержание остаётся в строке стоимости как есть", async () => {
    globalThis.game.user = { targets: [{ actor: foe("ork") }] };
    const { actor } = makeMage();
    captured.dice = [10];
    await activateTechMiracle(actor, harmfulPower({ sustained: true, sustainCost: 2 }));
    expect(captured.chat.at(-1).content).toContain("Поддержание 2");
  });
});
