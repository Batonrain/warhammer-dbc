// test/sheets/get-data.test.mjs
//
// Сборка контекста шаблона: сенсоры шапки, таблица характеристик, раса и
// происхождение, Пути Аэльдари, снятый шлем и вкладка Одержимости.
//
// Проверяется то, что видит игрок в окне листа: проценты и уровни полос,
// подписи, состав выпадающих списков и кумулятивность градаций Пути. Ни одна
// проверка не зависит от Foundry — только от actor.system и данных книг.

import { describe, it, expect } from "vitest";
import { sheetOf } from "../support/foundry-stub.mjs";
import { WarhammerCharacterSheet } from "../../module/sheets/actor-sheet.mjs";
import { characterContext } from "../../module/sheets/character-context.mjs";

/** Характеристика в формате листа. */
const char = (total, extra = {}) => ({ total, bonus: Math.floor(total / 10), ...extra });

function ctxOf({ items = [], ...system } = {}) {
  const sheet = sheetOf(WarhammerCharacterSheet, {
    items, characteristics: {}, skills: {}, groupSkills: {}, ...system
  });
  sheet.actor.items.contents = sheet.actor.items;
  return characterContext(sheet.actor);
}

/** Подсистема выключена в настройках игры — на время одной проверки. */
function withFeatureOff(key, fn) {
  const real = game.settings.get;
  game.settings.get = (_ns, k) => (k === key ? false : undefined);
  try { return fn(); } finally { game.settings.get = real; }
}

describe("сенсоры когитатора", () => {
  it("нагрузка: процент, уровень и перегруз", () => {
    const ctx = ctxOf({ encumbrance: { max: 80, current: 60 } });
    expect(ctx.encumbrancePct).toBe(75);
    expect(ctx.encumbranceLevel).toBe("heavy");
    expect(ctx.encumbranceOver).toBe(false);
  });

  it("нагрузка: эффективный вес важнее текущего, полоса не уходит за 100%", () => {
    const ctx = ctxOf({ encumbrance: { max: 100, current: 10, effectiveCurrent: 120 } });
    expect(ctx.encumbrancePct).toBe(100);
    expect(ctx.encumbranceOver).toBe(true);
    expect(ctx.encumbranceLevel).toBe("over");
  });

  it("Порча считается от своего лимита, а не от сотни", () => {
    expect(ctxOf({ corruption: { value: 40 } }).corruptionPct).toBe(40);
    const ctx = ctxOf({ corruption: { value: 40, limit: 50 } });
    expect(ctx.corruptionPct).toBe(80);
    expect(ctx.corruptionLevel).toBe("over");
  });

  it("Безумие: 45 — тревожно, 70 — критично", () => {
    expect(ctxOf({ insanity: { value: 45 } }).insanityLevel).toBe("heavy");
    expect(ctxOf({ insanity: { value: 70 } }).insanityLevel).toBe("over");
  });

  it("нагрузка: T.b + S.b показывается перед строкой Ношение/Подъём/Толкание", () => {
    const ctx = ctxOf({ characteristics: { t: char(40), s: char(35) } });
    expect(ctx.encumbranceIndexSum).toBe(7);   // 4 + 3
  });
});

describe("Стойка/База на вкладке БОЙ", () => {
  it("список из constants/combat.mjs, отмечена текущая (по умолчанию — Стандартная)", () => {
    const ctx = ctxOf({});
    expect(ctx.combatStanceOptions.find(s => s.key === "standard").active).toBe(true);
    expect(ctx.combatStanceOptions.filter(s => s.active)).toHaveLength(1);
    expect(ctx.combatBaseOptions.find(b => b.key === "standard").active).toBe(true);
  });

  it("невалидное/непустое значение на акторе тоже отмечается активным", () => {
    const ctx = ctxOf({ meleeStance: "aggressive", meleeBase: "charge" });
    expect(ctx.combatStanceOptions.find(s => s.key === "aggressive").active).toBe(true);
    expect(ctx.combatStanceOptions.filter(s => s.active)).toHaveLength(1);
    expect(ctx.combatBaseOptions.find(b => b.key === "charge").active).toBe(true);
  });

  it("Опыт: доля потраченного, у пустого листа — ноль", () => {
    expect(ctxOf({ experience: { total: 1000, spent: 250 } }).xpPct).toBe(25);
    expect(ctxOf({ experience: { total: 0, spent: 0 } }).xpPct).toBe(0);
  });

  it("Судьба: пипсы по максимуму, зажжены по текущему", () => {
    expect(ctxOf({ fate: { value: 2, max: 3 } }).fatePips)
      .toEqual([{ on: true }, { on: true }, { on: false }]);
    // Больше десяти пипсов в шапку не влезает.
    expect(ctxOf({ fate: { value: 12, max: 12 } }).fatePips).toHaveLength(10);
  });

  it("Усталость: шкала и её уровень", () => {
    const ctx = ctxOf({ fatigue: { value: 3, max: 4 } });
    expect(ctx.fatiguePct).toBe(75);
    expect(ctx.fatigueLevel).toBe("heavy");
    expect(ctxOf({ fatigue: { value: 4, max: 4 } }).fatigueLevel).toBe("over");
  });
});

describe("характеристики", () => {
  it("значения актора попадают в строку таблицы", () => {
    const ctx = ctxOf({
      characteristics: { ws: char(45, { base: 30, advance: 15, cost: 250, improvement: "trained" }) },
      charDamage: { ws: 4 }
    });
    const ws = ctx.chars.find(c => c.key === "ws");
    expect(ws).toMatchObject({ base: 30, advance: 15, total: 45, bonus: 4, cost: 250, charDamage: 4 });
  });

  it("у Хаосита Влияние называется Бесчестием", () => {
    const inf = k => ctxOf(k).chars.find(c => c.key === "inf");
    expect(inf({ alignment: "heretic" }).label).toBe("Бесчестие");
    expect(inf({}).label).toBe("Влияние");
  });

  it("улучшение, выданное архетипом, помечено звёздочкой", () => {
    const ctx = ctxOf({ characteristics: { s: char(40, { grantedImp: "trained" }) } });
    const s = ctx.chars.find(c => c.key === "s");
    expect(s.isGranted).toBe(true);
    expect(ctx.chars.find(c => c.key === "t").isGranted).toBe(false);
  });

  it("склонности удешевляют характеристику: две совпали — Дружественная", () => {
    const cat = apts => ctxOf({ aptitudes: apts }).chars.find(c => c.key === "ws").aptCat;
    expect(cat(["ws", "offence"])).toBe("ally");
    expect(cat(["ws"])).toBe("neutral");
    expect(cat([])).toBe("enemy");
  });
});

describe("показатели листа", () => {
  it("порог Усталости — T.b + W.b, и он же максимум по умолчанию", () => {
    const ctx = ctxOf({ characteristics: { t: char(45), wp: char(38) } });
    expect(ctx.fatigueThreshold).toBe(7);
    expect(ctx.fatigueMax).toBe(7);
    // Явно заданный максимум порогом не перебивается.
    expect(ctxOf({ characteristics: { t: char(45), wp: char(38) }, fatigue: { max: 3 } }).fatigueMax).toBe(3);
  });

  it("Судьба называется по расе и мировоззрению", () => {
    expect(ctxOf({}).fateLabel).toBe("Очки Судьбы");
    expect(ctxOf({ race: "drukhari" }).fateLabel).toBe("Очки Боли");
    expect(ctxOf({ alignment: "heretic" }).fateLabel).toBe("Очки Бесчестья");
  });

  it("без брони поглощение нулевое по всем зонам", () => {
    expect(ctxOf({}).absorption).toMatchObject({ head: 0, body: 0, toughnessBonus: 0 });
  });

  it("доп. ОБ от модификаций брони: только ненулевые типы", () => {
    const ctx = ctxOf({ absorption: { vsType: { energy: 2, impact: 0, rending: 1 } } });
    expect(ctx.armorVsTypeStr).toBe("Энерг. +2 · Реж. +1");
    expect(ctxOf({}).armorVsTypeStr).toBe("");
  });

});

describe("раса и подраса", () => {
  it("подрасы берутся у текущей расы", () => {
    const ctx = ctxOf({ race: "azuriane" });
    expect(ctx.hasSubraces).toBe(true);
    expect(ctx.availableSubraces.map(s => s.key)).toContain("eldanar");
    expect(ctxOf({ race: "ynnari" }).hasSubraces).toBe(false);
  });

  // Слот субрасы теперь стоит всегда — как у расы, — поэтому шаблону нужна
  // причина, по которой выбирать нечего: без неё пустой слот звал бы открыть
  // пикер, который тут же ответил бы отказом.
  it("подсказка объясняет, почему субрасу выбрать нельзя", () => {
    expect(ctxOf({ race: "azuriane" }).subraceHint).toBe("");
    expect(ctxOf({ race: "" }).subraceHint).toMatch(/сначала выберите расу/i);
    expect(ctxOf({ race: "astartes" }).subraceHint).toMatch(/субрас нет/i);
  });

  // У Астартес субрас не бывает вовсе — их место занимают Легион и Орден,
  // поэтому слот не показывается совсем, а не стоит с вечным «Субрас нет».
  it("у Астартес слота субрасы нет, у прочих он остаётся", () => {
    expect(ctxOf({ race: "astartes" }).showSubrace).toBe(false);
    expect(ctxOf({ race: "ynnari" }).showSubrace).toBe(true);
    expect(ctxOf({ race: "" }).showSubrace).toBe(true);
  });

  it("выключенная «Книга Эльдар» убирает свои расы из списка", () => {
    const aeldari = ctx => ctx.raceGroups.find(g => g.label === "Аэльдари");
    expect(aeldari(ctxOf({ race: "human" })).races.length).toBeGreaterThan(1);
    withFeatureOff("aeldariBook", () => {
      expect(aeldari(ctxOf({ race: "human" }))).toBeUndefined();
      // Кроме расы, уже стоящей у этого актора: выключатель обратим.
      expect(aeldari(ctxOf({ race: "azuriane" })).races.map(r => r.key)).toEqual(["azuriane"]);
    });
  });

  it("Фактор Прибыли даёт бонус десятками", () => {
    expect(ctxOf({ aspirations: { profitFactor: 45 } }).profitFactorBonus).toBe(4);
  });

  it("Иннари: прошлая раса и её список", () => {
    const ctx = ctxOf({ race: "ynnari", ynnariPast: "drukhari" });
    expect(ctx.isAeldari).toBe(true);
    expect(ctx.isYnnari).toBe(true);
    expect(ctx.ynnariPastLabel).toBe("Друкхари");
    expect(ctx.ynnariPastOptions.map(o => o.key)).toContain("azuriane");
  });

  it("Арлекин: прошлая раса и выбранная Маска", () => {
    const ctx = ctxOf({ race: "harlequin", harlequinPast: "azuriane", harlequinMasque: "endlessSong" });
    expect(ctx.isHarlequin).toBe(true);
    expect(ctx.harlequinPastLabel).toBe("Азуриане");
    expect(ctx.selectedMasque).toBeTruthy();
    expect(ctx.masqueOptions).toContain("endlessSong");
  });

  // Происхождение выбирается по тому, кем персонаж БЫЛ: у Иннари и Арлекина с
  // прошлым Друкхари это Кабал/Культ/Ковен, а не Мир-Корабль.
  it("прошлое Друкхари убирает Мир-Корабль у Иннари и Арлекина", () => {
    for (const system of [{ race: "ynnari", ynnariPast: "drukhari" },
                          { race: "harlequin", harlequinPast: "drukhari" }]) {
      const ctx = ctxOf(system);
      expect(ctx.isDrukhari).toBe(true);
      expect(ctx.showWorldOrigin).toBe(false);
    }
  });

  it("прошлое Азуриан оставляет Мир-Корабль на месте", () => {
    const ctx = ctxOf({ race: "harlequin", harlequinPast: "azuriane" });
    expect(ctx.isDrukhari).toBe(false);
    expect(ctx.showWorldOrigin).toBe(true);
  });

  it("Корсарская Банда доступна и Друкхари — список банд общий", () => {
    const ctx = ctxOf({ race: "drukhari", band: "novaBlades" });
    expect(ctx.isDrukhari).toBe(true);
    expect(ctx.selectedBand?.label).toBe("Нова-Клинки");
  });

  it("фигура на вкладке ТЕЛО: по умолчанию мужская", () => {
    expect(ctxOf({}).bodyTypes.find(b => b.selected).key).toBe("male");
    expect(ctxOf({ bodyType: "female" }).bodyTypes.find(b => b.selected).key).toBe("female");
  });
});

// Регресс: гайд по имплантам Геносемени на вкладке ТЕЛО пропал вместе
// со старой системой органов (снята целиком в Derbius#28), а новая система
// (органы предметами-имплантами через Конструктор Черты) вкладку не питает —
// список эффектов, о котором писал игрок, был именно этим гайдом. Собирает
// его buildGetData, а не characterContext, поэтому берём контекст целиком,
// как и для склейки Талантов/Черт выше.
describe("Геносемя: гайд по имплантам на вкладке ТЕЛО", () => {
  const organ = (name, effect) => ({
    id: `org-${name}`, type: "implant", name, system: { category: "astartes", effect, description: "" }
  });

  async function abilitiesCtx(items) {
    const sheet = sheetOf(WarhammerCharacterSheet, {
      race: "astartes", items, characteristics: {}, skills: {}, groupSkills: {}
    });
    sheet.actor.items.contents = sheet.actor.items;
    return sheet._prepareContext({});
  }

  it("органы Астартес на листе собираются в гайд по имени (числовой порядок)", async () => {
    const ctx = await abilitiesCtx([
      organ("2. Оссмодула / Ossmodula", "Костная масса и плотность скелета."),
      organ("1. Второе Сердце / Second Heart", "Второе сердце, дублирующее кровоток.")
    ]);
    expect(ctx.geneSeedOrgans.map(o => o.name)).toEqual([
      "1. Второе Сердце / Second Heart",
      "2. Оссмодула / Ossmodula"
    ]);
    expect(ctx.geneSeedOrgans[0].effect).toBe("Второе сердце, дублирующее кровоток.");
  });

  it("чужие импланты (Механикус, бионика) в гайд Геносемени не попадают", async () => {
    const ctx = await abilitiesCtx([
      organ("1. Второе Сердце / Second Heart", "…"),
      { id: "impl-motive", type: "implant", name: "Мотивный Банк", system: { category: "mechanicus", effect: "…" } }
    ]);
    expect(ctx.geneSeedOrgans).toHaveLength(1);
  });

  it("без выданных органов гайд пуст, а не роняет сборку контекста", async () => {
    expect((await abilitiesCtx([])).geneSeedOrgans).toEqual([]);
  });
});

describe("Пути Аэльдари", () => {
  const paths = rows => ctxOf({ race: "azuriane", paths: rows }).charPaths;

  it("градации кумулятивны: показаны все достигнутые", () => {
    const [row] = paths([{ key: "warlock", grade: "master" }]);
    expect(row.label).toBe("Путь Варлока");
    expect(row.gradesShown.map(g => g.gradeLabel)).toEqual(["Новичок", "Следующий", "Мастер"]);
  });

  it("Unnatural суммируется по достигнутым градациям", () => {
    // У Варлока авто-бонус есть у «Следующего» и у «Заблудившегося».
    expect(paths([{ key: "warlock", grade: "next" }])[0].autoLabel).toBe("Unnatural WP (+2)");
    expect(paths([{ key: "warlock", grade: "lost" }])[0].autoLabel).toBe("Unnatural WP (+4)");
  });

  it("лимит Порчи не суммируется, а берётся максимумом", () => {
    expect(paths([{ key: "damnation", grade: "next" }])[0].autoLabel).toBe("+25 к лимиту Порчи");
  });

  it("пустая строка Пути не ломает вкладку", () => {
    const [row] = paths([{ key: "", grade: "" }]);
    expect(row.gradesShown).toEqual([]);
    expect(row.autoLabel).toBe("");
  });

  it("Пути читаются и словарём Foundry, не только массивом", () => {
    const rows = ctxOf({ race: "azuriane", paths: { 0: { key: "warlock", grade: "next" } } }).charPaths;
    expect(rows).toHaveLength(1);
    expect(rows[0].idx).toBe(0);
  });
});

describe("происхождение Аэльдари", () => {
  it("Мир-Корабль и Банда — у аэльдари, кроме Друкхари", () => {
    const ctx = ctxOf({ race: "azuriane", world: "alaitoc" });
    expect(ctx.showWorldOrigin).toBe(true);
    expect(ctx.selectedWorld).toBeTruthy();
    expect(ctxOf({ race: "drukhari" }).showWorldOrigin).toBe(false);
  });

  it("у Друкхари вместо этого — фракция и район", () => {
    const ctx = ctxOf({ race: "drukhari", drukhariFaction: "kab_bagrovoy_slezy" });
    expect(ctx.isDrukhari).toBe(true);
    expect(ctx.selectedDrukhariFaction).toBeTruthy();
    expect(ctx.drukhariDistrictOptions).toBeTruthy();
  });
});

describe("снятый шлем", () => {
  const helmetMod = (name, installedOn = "armor-1") =>
    ({ id: name, type: "armorMod", name, system: { modGroup: "helmet", installedOn } });

  it("галочки нет, пока снаряжение не даёт ОБ на голову", () => {
    expect(ctxOf({ gearHeadAP: 0 }).helmetless).toBeNull();
  });

  it("системы шлема перечислены, вокс-линк остаётся рабочим", () => {
    const ctx = ctxOf({
      gearHeadAP: 5, helmetOff: true,
      items: [helmetMod("Авточувства"), helmetMod("Вокс-линк"), helmetMod("Не установлен", null)]
    });
    expect(ctx.helmetless.on).toBe(true);
    expect(ctx.helmetless.headAP).toBe(5);
    expect(ctx.helmetless.disabled).toEqual(["Авточувства"]);
    expect(ctx.helmetless.kept).toEqual(["Вокс-линк"]);
  });

  it("выключенное правило убирает галочку даже со шлемом", () => {
    withFeatureOff("helmetless", () => {
      expect(ctxOf({ gearHeadAP: 5 }).helmetless).toBeNull();
    });
  });
});

describe("Одержимый", () => {
  const gift = name => ({ id: name, type: "talent", name: `Дар: ${name}`,
    system: {}, effects: { contents: [] } });

  function possessed({ items = [], ...over } = {}) {
    return ctxOf({
      items,
      alignment: "heretic", possessed: true,
      corruption: { value: 60 },
      characteristics: { inf: char(45) },
      possession: { demon: "bloodletter", symbiosis: 4, demonWounds: { max: 25 } },
      ...over
    });
  }

  it("вкладка появляется только у одержимого Хаосита", () => {
    expect(possessed().possessed).toBe(true);
    expect(possessed({ alignment: "" }).possessed).toBe(false);
    expect(possessed({ possessed: false }).possessed).toBe(false);
  });

  it("Симбиоз ограничен младшим из Порчи и Влияния", () => {
    const p = possessed().possession;
    expect(p.sym).toBe(4);
    expect(p.symLimit).toBe(3);              // min(60, 45) ÷ 15
    expect(p.symPips[3]).toEqual({ on: true, over: true });
    expect(p.symPips[2]).toEqual({ on: true, over: false });
  });

  it("бонусы Симбиоза и профиль хоста", () => {
    const p = possessed().possession;
    expect(p.socialBonus).toBe(40);          // Симбиоз ×10
    expect(p.hostWBonus).toBe(20);           // Симбиоз ×5
    expect(p.controlHours).toBe(8);          // 10 − Ранения демона ÷ 10
    expect(p.naturalArmour).toBe(6);         // Бонус Порчи
    expect(p.regen).toBe(3);                 // половина Бонуса Порчи, окр. ▲
  });

  it("Дары: надетые подсвечены, перебор лимита виден", () => {
    const names = ["Панцирь", "Крылья", "Пасть", "Клинок", "Варп-Пламя", "Паук"];
    const p = possessed({ items: names.map(gift) }).possession;
    expect(p.activeGiftCount).toBe(6);
    expect(p.giftLimit).toBe(5);             // профиль Проявления при Cor 60
    expect(p.giftsOver).toBe(true);
    const armour = p.giftGroups.find(g => g.group === "Защита").gifts;
    expect(armour.find(g => g.name === "Панцирь").active).toBe(true);
    expect(armour.find(g => g.name === "Аура Хаоса").active).toBe(false);
  });

  it("Таланты архетипа — только Неделимого и бога вселённого демона", () => {
    const p = possessed().possession;
    const gods = new Set(p.talents.map(t => t.god));
    expect(gods).toEqual(new Set(["Неделимый", p.meta.godLabel]));
    expect(p.talents.some(t => t.god === p.meta.godLabel)).toBe(true);
  });
});

describe("одинаковые Таланты и Черты на листе", () => {
  let n = 0;
  const talent = (name, system = {}) =>
    ({ id: `tal${++n}`, type: "talent", name, system: { tier: 1, aptitudes: [], ...system } });
  const trait = (name, system = {}) => ({ id: `tr${++n}`, type: "trait", name, system });

  // Списки способностей собирает buildGetData, а не characterContext, поэтому
  // берём весь контекст листа целиком.
  async function abilitiesCtx(items) {
    const sheet = sheetOf(WarhammerCharacterSheet, {
      items, characteristics: {}, skills: {}, groupSkills: {}
    });
    sheet.actor.items.contents = sheet.actor.items;
    return sheet._prepareContext({});
  }

  it("две Черты Nimble (5) — одна строка с рейтингом (10)", async () => {
    const ctx = await abilitiesCtx([
      trait("Nimble / Проворный", { hasRating: true, rating: 5 }),
      trait("Nimble / Проворный", { hasRating: true, rating: 5 })
    ]);
    expect(ctx.traits).toHaveLength(1);
    expect(ctx.traits[0].name).toBe("Nimble / Проворный");
    expect(ctx.traits[0].ratingDisplay).toBe("(10)");
  });

  it("три Сопротивления — один Талант со списком специализаций", async () => {
    const ctx = await abilitiesCtx([
      talent("Resistance / Сопротивление", { specialization: "Poison" }),
      talent("Resistance / Сопротивление", { specialization: "Cold" }),
      talent("Resistance / Сопротивление", { specialization: "Heat" })
    ]);
    expect(ctx.abilityTalents).toHaveLength(1);
    expect(ctx.abilityTalents[0].name).toBe("Resistance / Сопротивление (Poison, Cold, Heat)");
    expect(ctx.abilityTalents[0].specialization).toBe("Poison, Cold, Heat");
  });

  it("во вкладке «Развитие» каждая специализация — своя строка со своей ценой", async () => {
    const ctx = await abilitiesCtx([
      talent("Resistance / Сопротивление", { specialization: "Cold", cost: 200, purchased: true }),
      talent("Resistance / Сопротивление", { specialization: "Heat", cost: 300, purchased: true })
    ]);
    expect(ctx.purchasedTalents.map(p => [p.name, p.cost])).toEqual([
      ["Resistance / Сопротивление (Cold)", 200],
      ["Resistance / Сопротивление (Heat)", 300]
    ]);
  });

  it("склейка не роняет Талант из его группы по типам", async () => {
    const ctx = await abilitiesCtx([
      talent("Nerves of Steel / Стальные Нервы"),
      talent("Nerves of Steel / Стальные Нервы")
    ]);
    const shown = ctx.abilityTalentGroups.flatMap(g => g.items);
    expect(shown).toHaveLength(1);
    expect(shown[0].name).toBe("Nerves of Steel / Стальные Нервы");
  });
});

describe("лист собирает контекст целиком", () => {
  it("вкладки, характеристики и состояние окна попадают в один контекст", async () => {
    const sheet = sheetOf(WarhammerCharacterSheet, { characteristics: {}, skills: {}, groupSkills: {} });
    sheet.actor.items.contents = sheet.actor.items;
    sheet._combatCollapse = { tech: true };
    sheet._gearCollapse = { weapon: true };

    const ctx = await sheet._prepareContext({});
    expect(ctx.skillsCol1.length).toBeGreaterThan(0);      // из buildGetData
    expect(ctx.chars.length).toBeGreaterThan(0);           // из сборки характеристик
    expect(ctx.combatTechCollapsed).toBe(true);            // состояние окна, не актора
    expect(ctx.gearCollapse).toEqual({ weapon: true });
  });
});
