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

  it("стойка рукопашной подписана для свёрнутого заголовка", () => {
    expect(ctxOf({ meleeStance: "aggressive" }).combatStanceLabel).toBe("Агрессивная");
    expect(ctxOf({}).combatStanceLabel).toBe("Стандартная");
  });
});

describe("раса и подраса", () => {
  it("подрасы берутся у текущей расы", () => {
    const ctx = ctxOf({ race: "azuriane" });
    expect(ctx.hasSubraces).toBe(true);
    expect(ctx.availableSubraces.map(s => s.key)).toContain("eldanar");
    expect(ctxOf({ race: "ynnari" }).hasSubraces).toBe(false);
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

  it("фигура на вкладке ТЕЛО: по умолчанию мужская", () => {
    expect(ctxOf({}).bodyTypes.find(b => b.selected).key).toBe("male");
    expect(ctxOf({ bodyType: "female" }).bodyTypes.find(b => b.selected).key).toBe("female");
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

describe("лист собирает контекст целиком", () => {
  it("вкладки, характеристики и состояние окна попадают в один контекст", () => {
    const sheet = sheetOf(WarhammerCharacterSheet, { characteristics: {}, skills: {}, groupSkills: {} });
    sheet.actor.items.contents = sheet.actor.items;
    sheet._combatCollapse = { stance: true, tech: false };
    sheet._gearCollapse = { weapon: true };

    const ctx = sheet.getData();
    expect(ctx.skillsCol1.length).toBeGreaterThan(0);      // из buildGetData
    expect(ctx.chars.length).toBeGreaterThan(0);           // из сборки характеристик
    expect(ctx.combatStanceCollapsed).toBe(true);          // состояние окна, не актора
    expect(ctx.gearCollapse).toEqual({ weapon: true });
  });
});
