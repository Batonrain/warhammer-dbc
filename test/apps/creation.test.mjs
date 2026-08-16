import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { splitTopLevel } from "../../module/helpers/utils.mjs";
import { grantCreationSkills, grantCultureSkills, grantCreationGear,
         resolveCreation, creationCharSum, rollCharSet, applyCreation,
         showCreationWizard } from "../../module/apps/creation.mjs";
import * as racesModule from "../../module/apps/races.mjs";

/** Обновление по плоскому пути: Foundry меняет документ на месте, тесты — тоже. */
function applyPath(target, path, value) {
  const keys = path.split(".");
  let cur = target;
  for (const key of keys.slice(0, -1)) cur = (cur[key] ??= {});
  cur[keys.at(-1)] = value;
}

function actor({ skills = {}, groupSkills = {}, characteristics = {},
                 wounds = { max: 0, value: 0 } } = {}) {
  const a = {
    name: "Подставной",
    system: { skills, groupSkills, characteristics, wounds },
    items: [],
    flags: {},
    updates: [],
    created: [],
    update: async data => {
      a.updates.push(data);
      for (const [path, value] of Object.entries(data)) applyPath(a, path, value);
      return data;
    },
    createEmbeddedDocuments: async (_type, docs) => { a.created.push(...docs); return docs; },
    setFlag: async (scope, key, value) => { (a.flags[scope] ??= {})[key] = value; }
  };
  return a;
}

/** Черты, таланты, органы и тема остаются на листе — сюда приходят колбэками. */
function sheetDeps() {
  const calls = { traits: [], talents: [], astartes: 0, theme: 0 };
  return {
    calls,
    createTraits: async (list, source) => { calls.traits.push({ list, source }); return (list || []).length; },
    applyStartingTalents: async (raw, source) => { calls.talents.push({ raw, source }); return (raw || []).length; },
    grantAstartesImplants: async () => { calls.astartes++; return 3; },
    applyTheme: () => { calls.theme++; }
  };
}

/** Диалог выбора резолвится не сам: даём промису дойти до `new Dialog`. */
const tick = () => new Promise(r => setTimeout(r, 0));

/** Ответ на диалог выбора: значения по индексу строки. */
function answerDialog(values) {
  const selects = values.map((value, i) => ({ dataset: { i: String(i) }, value }));
  captured.dialog.buttons.ok.callback(fakeHtml({}, { "select[data-i]": selects }));
}

/**
 * Доводит создание до конца: по пути оно спрашивает про навыки-выборы, а без
 * игрока диалог висит вечно. Отвечаем «ничего не выбрано» на каждый.
 */
async function settle(promise) {
  let done = false;
  promise.then(() => { done = true; }, () => { done = true; });
  for (let i = 0; i < 20 && !done; i++) {
    await tick();
    if (!done && captured.dialog?.buttons?.ok) {
      const dlg = captured.dialog; captured.dialog = null;
      dlg.buttons.ok.callback(fakeHtml({}, { "select[data-i]": [] }));
    }
  }
  return promise;
}

beforeEach(resetCaptured);

describe("splitTopLevel", () => {
  it("режет по запятым верхнего уровня, скобки не трогает", () => {
    expect(splitTopLevel("Awareness, Trade (Armourer, Weaponsmith), Dodge"))
      .toEqual(["Awareness", "Trade (Armourer, Weaponsmith)", "Dodge"]);
  });

  it("пустые куски выбрасывает", () => {
    expect(splitTopLevel("Dodge, , Parry")).toEqual(["Dodge", "Parry"]);
  });
});

describe("выдача стартовых навыков", () => {
  it("«+10» даёт ранг Обученный бесплатно", async () => {
    const a = actor();
    await grantCreationSkills(a, { race: { skills: "Awareness +10" } });
    expect(a.system.skills.awareness).toMatchObject({
      grantedRank: "trained", rank: "trained", cost: 0
    });
  });

  it("уже купленный ранг не понижается", async () => {
    const a = actor({ skills: { awareness: { rank: "expert", cost: 550 } } });
    await grantCreationSkills(a, { race: { skills: "Awareness" } });
    expect(a.system.skills.awareness.rank).toBe("expert");
    expect(a.system.skills.awareness.grantedRank).toBe("knows");
  });

  it("специализации через запятую становятся отдельными записями", async () => {
    const a = actor();
    await grantCreationSkills(a, { arch: { skills: "Trade (Armourer, Weaponsmith)" } });
    expect(a.system.groupSkills.trade.map(e => e.specialty)).toEqual(["Бронник", "Оружейник"]);
    expect(a.system.groupSkills.trade.every(e => e.cost === 0)).toBe(true);
  });

  it("«Warp, Daemons and Psykers» — одна специализация, запятая внутри имени", async () => {
    const a = actor();
    await grantCreationSkills(a, { race: { skills: "Forbidden Lore (Warp, Daemons and Psykers)" } });
    expect(a.system.groupSkills.forbiddenLore.map(e => e.specialty))
      .toEqual(["Варп, Демоны и Псайкеры"]);
  });

  it("«(War, любое 1)» даёт названную специализацию и один свободный слот", async () => {
    const a = actor();
    await grantCreationSkills(a, { race: { skills: "Common Lore (War, любое 1) +10" } });
    const arr = a.system.groupSkills.commonLore;
    expect(arr.map(e => e.specialty)).toEqual(["Война", "— выбери —"]);
    expect(arr.find(e => e.wildSlot)).toMatchObject({ rank: "trained", grantedRank: "trained" });
  });

  it("повторный прогон Мастера не удваивает свободные слоты", async () => {
    const a = actor();
    const src = { race: { skills: "Common Lore (любое 2)" } };
    await grantCreationSkills(a, src);
    await grantCreationSkills(a, src);
    expect(a.system.groupSkills.commonLore.filter(e => e.wildSlot)).toHaveLength(2);
  });

  it("выбранная игроком специализация переживает повторный прогон", async () => {
    const a = actor();
    await grantCreationSkills(a, { race: { skills: "Common Lore (любое 1)" } });
    a.system.groupSkills.commonLore[0].specialty = "Империум";
    a.system.groupSkills.commonLore[0].wild = false;
    await grantCreationSkills(a, { race: { skills: "Common Lore (любое 1)" } });
    expect(a.system.groupSkills.commonLore.map(e => e.specialty)).toEqual(["Империум"]);
  });

  it("нераспознанная запись не теряется молча — ГМ получает предупреждение", async () => {
    const a = actor();
    await grantCreationSkills(a, { race: { skills: "Ловля бабочек" } });
    expect(captured.warnings.join(" ")).toContain("Ловля бабочек");
  });

  it("«или» спрашивает игрока и выдаёт только выбранное", async () => {
    const a = actor();
    const done = grantCreationSkills(a, { arch: { skills: "Awareness или Dodge" } });
    await tick();
    answerDialog(["Dodge"]);
    await done;
    expect(a.system.skills.dodge?.grantedRank).toBe("knows");
    expect(a.system.skills.awareness).toBeUndefined();
  });

  it("выбор внутри скобок — одна специализация из трёх, а не все три", async () => {
    const a = actor();
    const done = grantCreationSkills(a, { arch: { skills: "For. Lore (Archeotech/Xenos/Warp)" } });
    await tick();
    expect(captured.dialog.content).toContain("Ксеносы");
    answerDialog(["For. Lore (Xenos)"]);
    await done;
    expect(a.system.groupSkills.forbiddenLore.map(e => e.specialty)).toEqual(["Ксеносы"]);
  });
});

describe("навыки культуры легиона", () => {
  it("без культуры не трогает актора", async () => {
    const a = actor();
    expect(await grantCultureSkills(a, null)).toBe(0);
    expect(a.updates).toHaveLength(0);
  });

  it("список культуры выдаётся тем же разбором, что и навыки создания", async () => {
    const a = actor();
    await grantCultureSkills(a, { grantSkills: ["Intimidate +10", "Common Lore (Chaos)"] });
    expect(a.system.skills.intimidate.grantedRank).toBe("trained");
    expect(a.system.groupSkills.commonLore.map(e => e.specialty)).toEqual(["Хаос"]);
  });
});

describe("стартовое снаряжение", () => {
  // Компендиумы в тестах не открыты: проверяем разбор строки и карту в чат,
  // а не поиск предметов.
  beforeEach(() => { game.packs = { get: () => null }; });

  it("постит ГМу список того, что выдать вручную", async () => {
    const a = actor();
    await grantCreationGear(a, { arch: { name: "Тактик", gear: "Болт-пистолет, Цепной меч" } });
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Болт-пистолет");
    expect(html).toContain("Цепной меч");
  });

  it("Астартес получает приписку про Системы силовой брони", async () => {
    const a = actor();
    await grantCreationGear(a, { race: { label: "Астартес" }, isAstartes: true });
    expect(captured.chat.at(-1).content).toContain("Системы силовой брони");
  });

  it("«A или B» спрашивает игрока и в список идёт выбранное", async () => {
    const a = actor();
    const done = grantCreationGear(a, { arch: { gear: "Болтер или Плазма-пистолет" } });
    await tick();
    answerDialog(["Плазма-пистолет"]);
    await done;
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Плазма-пистолет");
    expect(html).not.toContain("Болтер");
  });
});

describe("резолв выбора мастера", () => {
  it("Прошлое Иннари подмешивает бывшую расу", () => {
    const { past, pastKey } = resolveCreation({ raceKey: "ynnari", ynnariPast: "azuriane" });
    expect(pastKey).toBe("azuriane");
    expect(past?.chars).toBeTruthy();
  });

  it("Прошлое чужой расы игнорируется", () => {
    expect(resolveCreation({ raceKey: "human", ynnariPast: "azuriane" }).past).toBeNull();
  });
});

describe("база характеристик до броска", () => {
  it("складывает расу и бонус архетипа", () => {
    const { race, arch, sub } = resolveCreation({ raceKey: "human", archKey: "renegade" });
    const sum = creationCharSum({ race, arch, sub });
    expect(sum.bs).toBe(30);   // 25 у Человека + 5 Ренегата
    expect(sum.ws).toBe(27);
  });
});

describe("набор бросков «Генерации»", () => {
  it("девять значений по убыванию, сумма сходится", () => {
    const set = rollCharSet(0);
    expect(set.vals).toHaveLength(9);
    expect([...set.vals].sort((x, y) => y - x)).toEqual(set.vals);
    expect(set.sum).toBe(set.vals.reduce((s, v) => s + v, 0));
    expect(Math.min(...set.vals)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...set.vals)).toBeLessThanOrEqual(20);
  });

  it("бонусные броски расы отбрасывают младшие, а не добавляют характеристики", () => {
    expect(rollCharSet(3).vals).toHaveLength(9);
  });
});

describe("применение создания", () => {
  it("характеристики пишутся только в пустые поля, вместе с раскидкой", async () => {
    const a = actor({ characteristics: { ws: { base: 0 }, bs: { base: 40 } } });
    await settle(applyCreation(a, { raceKey: "human", archKey: "renegade",
      charRolls: { ws: 12 } }, sheetDeps()));
    expect(a.system.characteristics.ws.base).toBe(39);   // 25 расы + 2 архетипа + 12 броска
    expect(a.system.characteristics.bs.base).toBe(40);   // уже заполнено — не трогаем
  });

  it("готовые Раны не перебрасываются", async () => {
    const a = actor({ wounds: { max: 12, value: 12 } });
    await settle(applyCreation(a, { raceKey: "human", archKey: "renegade" }, sheetDeps()));
    expect(a.system.wounds.max).toBe(12);
  });

  it("пустые Раны берутся из формулы архетипа", async () => {
    const a = actor();
    captured.nextRoll = 13;
    await settle(applyCreation(a, { raceKey: "human", archKey: "renegade" }, sheetDeps()));
    expect(captured.rolls).toContain("10+1d5");
    expect(a.system.wounds).toMatchObject({ max: 13, value: 13 });
  });

  it("Астартес: геносемя сохраняется, органы выдаёт лист", async () => {
    const a = actor();
    const d = sheetDeps();
    await settle(applyCreation(a, { raceKey: "astartes", archKey: "sorcerer",
      geneSeed: { legion: "I", chapter: "vengeance",
                  cultureLegion: "I", cultureChapter: "vengeance" } }, d));
    expect(a.system.geneSeed.legion).toBe("I");
    expect(d.calls.astartes).toBe(1);
    expect(a.system.isPsyker).toBe(true);                        // Чародей
    expect(d.calls.talents.at(-1).raw).toContain("Hatred (Fallen)");   // культура ордена
  });

  // Раунд правок 2: race.talents из библиотеки — строка, а не массив. Без
  // splitTopLevel девять талантов Астартес склеятся в один несуществующий
  // элемент (длина станет не 9); а если splitTopLevel заменить на наивный
  // split(","), скобочный талант «Resistance (Cold, Heat, Poisons)» развалится
  // на куски. Без архетипа/культуры/субрасы в списке — только таланты расы.
  it("таланты расы приходят раздельными элементами, скобочный не рвётся по запятым внутри", async () => {
    const a = actor();
    const d = sheetDeps();
    await settle(applyCreation(a, { raceKey: "astartes" }, d));
    const raw = d.calls.talents.at(-1).raw;
    expect(raw).toHaveLength(9);
    expect(raw).toContain("Resistance (Cold, Heat, Poisons)");
  });

  it("Азуриан — псайкер и без архетипа", async () => {
    const a = actor();
    await settle(applyCreation(a, { raceKey: "azuriane" }, sheetDeps()));
    expect(a.system.isPsyker).toBe(true);
  });

  it("ставит флаг завершённой настройки и перекрашивает лист", async () => {
    const a = actor();
    const d = sheetDeps();
    await settle(applyCreation(a, { raceKey: "human", alignment: "heretic" }, d));
    expect(a.flags["warhammer-dbc"].setupDone).toBe(true);
    expect(a.system.alignment).toBe("heretic");
    expect(d.calls.theme).toBe(1);
  });
});

// Прошлое Иннари/Арлекина — та же выдача, что раса и субраса (applyRace под
// своим тегом), а не отдельная ветка: раунд правок 1 нашёл, что переход
// resolveCreation на библиотеку молча обнулил Черты Прошлого (past.traits
// у библиотеки просто нет поля) — здесь фиксируется правильный вызов.
describe("Прошлое Иннари/Арлекина выдаётся тем же путём, что раса", () => {
  let applyRaceSpy;
  beforeEach(() => { applyRaceSpy = vi.spyOn(racesModule, "applyRace"); });
  afterEach(() => { applyRaceSpy.mockRestore(); });

  it("с выбранным Прошлым зовёт applyRace с тегом racePast и mirror:false", async () => {
    const a = actor();
    await settle(applyCreation(a, { raceKey: "ynnari", ynnariPast: "azuriane" }, sheetDeps()));
    expect(applyRaceSpy).toHaveBeenCalledWith(a, "azuriane", { tag: "racePast", mirror: false });
  });

  it("без выбранного Прошлого выдачу для него не зовёт", async () => {
    const a = actor();
    await settle(applyCreation(a, { raceKey: "ynnari" }, sheetDeps()));
    expect(applyRaceSpy.mock.calls.some(call => call[2]?.tag === "racePast")).toBe(false);
  });
});

describe("окно мастера", () => {
  it("кнопка «Создать» применяет выбор из формы", async () => {
    const a = actor();
    showCreationWizard(a, sheetDeps());
    expect(captured.dialog.title).toBe("Мастер создания персонажа");
    const form = fakeHtml({ "#wiz-race": "human", "#wiz-subrace": "",
                            "#wiz-align": "renegade", "#wiz-arch": "pirate" });
    await settle(captured.dialog.buttons.apply.callback(form));
    expect(a.system.race).toBe("human");
    expect(a.system.archetype).toBe("pirate");
    expect(a.system.alignment).toBe("renegade");
  });
});
