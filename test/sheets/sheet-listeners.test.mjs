// test/sheets/sheet-listeners.test.mjs
//
// Слушатели листа персонажа, которые шаг 5.3 выносит из activateListeners:
// вкладка РАЗВИТИЕ (характеристики, ранги навыков, ★), вкладка ГЕМУНКУЛ,
// Элитный архетип в шапке, вкладка БОЙ, улучшения на носителе (вкладка
// Снаряжения), Проявление Одержимого и применение расы, Прошлого и легиона.
//
// Тест написан ДО выноса и работает через сам лист: activateListeners навешивает
// обработчики, тест дёргает их и смотрит, что легло в актора. После переезда в
// модули он не меняется ни на строку — совпадение ожиданий до и после и есть
// доказательство, что переезд ничего не поменял.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, listenerHtml } from "../support/foundry-stub.mjs";
import { weaponFor } from "../support/combat-fixtures.mjs";
import { eliteRaceMatch } from "../../module/sheets/elite-picker.mjs";
import { LEGIONS } from "../../module/constants/legions.mjs";

// Динамический импорт: глобали Foundry должны быть на месте раньше листа.
const { WarhammerCharacterSheet } = await import("../../module/sheets/actor-sheet.mjs");

/** Обновление по плоскому пути: Foundry меняет документ на месте, тесты — тоже. */
function applyPath(target, path, value) {
  const keys = path.split(".");
  let cur = target;
  for (const key of keys.slice(0, -1)) cur = (cur[key] ??= {});
  cur[keys.at(-1)] = value;
}

/**
 * Лист с записывающим актором. Конструктор приложения не вызывается, поэтому
 * поля класса (состояние свёрток окна) проставляем сами — в игре их заводит
 * сам класс.
 */
function sheetFor({ items = [], ...system } = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const actor = {
    id: "actor-stub", name: "Подставной", system, items: list, updates: [], deleted: [],
    update: async data => {
      actor.updates.push(data);
      for (const [path, value] of Object.entries(data)) applyPath(actor, path, value);
      return data;
    },
    createEmbeddedDocuments: async (_type, docs) => {
      captured.created.push(...docs);
      return docs.map(d => ({ ...d, sheet: { render: () => {} } }));
    },
    deleteEmbeddedDocuments: async (_type, ids) => {
      actor.deleted.push(...ids);
      return ids;
    }
  };
  const sheet = Object.create(WarhammerCharacterSheet.prototype);
  Object.defineProperty(sheet, "actor",      { value: actor, configurable: true });
  Object.defineProperty(sheet, "isEditable", { value: true,  configurable: true });
  return sheet;
}

/** Навесить слушатели листа и вернуть их по ключу «селектор:событие». */
function wire(sheet, nodes) {
  const html = listenerHtml(nodes);
  Object.defineProperty(sheet, "element", { value: html[0], configurable: true });
  sheet._gearHostCollapse ??= new Set();
  sheet._onRender({}, {});
  return html.handlers;
}

/** Дать отработать промисам обработчика, который ничего не возвращает. */
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const ev = (dataset = {}, value) => ({
  preventDefault: () => {}, stopPropagation: () => {},
  currentTarget: { dataset, value }
});

/** Талант-предмет на листе: ★ переключает «выдан» ↔ «куплен». */
function talentItem({ id = "tal-1", name = "Меткий стрелок", tier = 1,
                      aptitudes = [], granted = true, cost = 0 } = {}) {
  const it = {
    id, name, type: "talent",
    system: { tier, aptitudes, granted, purchased: !granted, cost },
    updates: [],
    async update(data) { it.updates.push(data); Object.assign(it.system, {}); return data; }
  };
  return it;
}

beforeEach(resetCaptured);

describe("лист навешивает слушатели вкладок", () => {
  it("после activateListeners обработчики есть у всех вынесенных подсистем", () => {
    const handlers = wire(sheetFor({ characteristics: {}, skills: {}, groupSkills: {} }));

    for (const key of [
      ".char-input:change", ".char-improvement-select:change",
      ".skill-rank-select:change", ".grant-toggle[data-talent]:click",  // РАЗВИТИЕ
      ".haem-advance-btn:click", ".haem-toggle-btn:click",              // ГЕМУНКУЛ
      ".elite-pick-btn:click", ".elite-add-btn:click",                  // шапка
      ".stance-radio:change", ".technique-btn:click",                   // БОЙ
      ".weapon-attack-roll:click", ".pain-absorb-btn:click",
      ".apt-char-add-btn:click", ".fatigue-add-btn:click"               // уже вынесенные
    ]) expect(handlers, key).toHaveProperty(key);
  });
});

describe("вкладка РАЗВИТИЕ: характеристики и навыки", () => {

  it("уровень улучшения пишется вместе с накопительной ценой", async () => {
    const sheet = sheetFor({ aptitudes: ["ws", "offence"], characteristics: { ws: {} } });
    const handlers = wire(sheet);

    await handlers[".char-improvement-select:change"](ev({ char: "ws" }, "trained"));

    expect(sheet.actor.updates[0]).toEqual({
      "system.characteristics.ws.improvement": "trained",
      "system.characteristics.ws.cost": 850                 // 100+250+500, Дружественная
    });
  });

  it("★ фиксирует уровень характеристики как выданный и снимает его цену", async () => {
    const sheet = sheetFor({
      aptitudes: ["ws", "offence"],
      characteristics: { ws: { improvement: "trained", grantedImp: "none", cost: 850 } }
    });
    const handlers = wire(sheet);

    await handlers[".grant-toggle[data-char]:click"](ev({ char: "ws" }));
    expect(sheet.actor.updates[0]).toEqual({
      "system.characteristics.ws.grantedImp": "trained",
      "system.characteristics.ws.cost": 0
    });

    // Повторное нажатие снимает ★ — за уровень снова платят.
    await handlers[".grant-toggle[data-char]:click"](ev({ char: "ws" }));
    expect(sheet.actor.updates[1]).toEqual({
      "system.characteristics.ws.grantedImp": "none",
      "system.characteristics.ws.cost": 850
    });
  });

  it("★ без выбранного уровня ничего не пишет, а объясняет порядок", async () => {
    const sheet = sheetFor({ characteristics: { ws: {} }, skills: { medicae: {} } });
    const handlers = wire(sheet);

    await handlers[".grant-toggle[data-char]:click"](ev({ char: "ws" }));
    await handlers[".grant-toggle[data-skill]:click"](ev({ skill: "medicae" }));

    expect(sheet.actor.updates).toEqual([]);
    expect(captured.warnings).toHaveLength(2);
  });

  it("★ у навыка помечает его ранг выданным", async () => {
    const sheet = sheetFor({
      aptitudes: ["int", "knowledge"],
      skills: { medicae: { rank: "knows", cost: 100 } }
    });
    const handlers = wire(sheet);

    await handlers[".grant-toggle[data-skill]:click"](ev({ skill: "medicae" }));

    expect(sheet.actor.updates[0]).toEqual({
      "system.skills.medicae.grantedRank": "knows",
      "system.skills.medicae.cost": 0
    });
  });

  it("★ у таланта возвращает цену по склонностям", async () => {
    const talent = talentItem({ aptitudes: ["ws", "offence"], granted: true });
    const sheet  = sheetFor({ aptitudes: ["ws", "offence"], items: [talent] });
    const handlers = wire(sheet);

    await handlers[".grant-toggle[data-talent]:click"](ev({ talent: "tal-1" }));

    expect(talent.updates[0]).toEqual({
      "system.granted": false, "system.purchased": true, "system.cost": 150
    });
  });

  it("★ у записи Группы Навыков считает цену от её Характеристики", async () => {
    const sheet = sheetFor({
      aptitudes: ["int", "knowledge"],
      groupSkills: { scholasticLore: [{ specialty: "Тактика", rank: "trained", char: "int", cost: 300 }] }
    });
    const handlers = wire(sheet);

    await handlers[".grant-toggle[data-group]:click"](ev({ group: "scholasticLore", index: "0" }));

    expect(sheet.actor.updates[0]).toEqual({
      "system.groupSkills.scholasticLore": [
        { specialty: "Тактика", rank: "trained", char: "int", cost: 0, grantedRank: "trained" }
      ]
    });
  });

  it("ранг навыка пишет накопительную цену выше выданного архетипом", async () => {
    const sheet = sheetFor({
      aptitudes: ["int", "knowledge"],
      skills: { medicae: { rank: "knows", grantedRank: "knows", cost: 0 } }
    });
    const handlers = wire(sheet);

    await handlers[".skill-rank-select:change"](ev({ skill: "medicae" }, "trained"));

    expect(sheet.actor.updates[0]).toEqual({
      "system.skills.medicae.rank": "trained",
      "system.skills.medicae.cost": 350                     // одна ступень: первая выдана
    });
  });

  it("поля характеристики и цен пишут число как есть", async () => {
    const sheet = sheetFor({ characteristics: { ws: {} }, skills: { medicae: {} } });
    const handlers = wire(sheet);

    await handlers[".char-input:change"](ev({ char: "ws", field: "base" }, "35"));
    await handlers[".char-cost-input:change"](ev({ char: "ws" }, "500"));
    await handlers[".skill-cost-input:change"](ev({ skill: "medicae" }, "мусор"));

    expect(sheet.actor.updates).toEqual([
      { "system.characteristics.ws.base": 35 },
      { "system.characteristics.ws.cost": 500 },
      { "system.skills.medicae.cost": 0 }
    ]);
  });
});

describe("вкладка ГЕМУНКУЛ", () => {

  it("кнопка трейта берёт его и снимает повторным нажатием", async () => {
    const sheet = sheetFor({ haemonculus: { stage: 4, flesh: [] } });
    const handlers = wire(sheet);

    await handlers[".haem-toggle-btn:click"](ev({ kind: "flesh", key: "bite" }));
    expect(sheet.actor.updates[0]).toEqual({ "system.haemonculus.flesh": [{ key: "bite", ranks: 1 }] });

    await handlers[".haem-toggle-btn:click"](ev({ kind: "flesh", key: "bite" }));
    expect(sheet.actor.updates[1]).toEqual({ "system.haemonculus.flesh": [] });
  });

  it("кнопки рейтинга двигают взятый трейт, но не ниже единицы", async () => {
    const sheet = sheetFor({ haemonculus: { stage: 4, flesh: [{ key: "bite", ranks: 1 }] } });
    const handlers = wire(sheet);

    await handlers[".haem-rank-btn:click"](ev({ kind: "flesh", key: "bite", delta: "1" }));
    expect(sheet.actor.system.haemonculus.flesh[0].ranks).toBe(2);

    await handlers[".haem-rank-btn:click"](ev({ kind: "flesh", key: "bite", delta: "-1" }));
    await handlers[".haem-rank-btn:click"](ev({ kind: "flesh", key: "bite", delta: "-1" }));
    expect(sheet.actor.system.haemonculus.flesh[0].ranks).toBe(1);
  });

  it("ступень поднимается после подтверждения и откатывается без него", async () => {
    const sheet = sheetFor({ haemonculus: { stage: 2 } });
    const handlers = wire(sheet);

    await handlers[".haem-advance-btn:click"](ev());
    expect(sheet.actor.system.haemonculus.stage).toBe(3);

    captured.confirmAnswer = false;
    await handlers[".haem-advance-btn:click"](ev());
    expect(sheet.actor.system.haemonculus.stage).toBe(3);   // отказ — ступень на месте

    await handlers[".haem-descend-btn:click"](ev());        // откат без вопросов
    expect(sheet.actor.system.haemonculus.stage).toBe(2);
  });
});

describe("Элитный архетип в шапке", () => {

  it("дополнительные архетипы добавляются, правятся и удаляются", async () => {
    const sheet = sheetFor({ eliteArchetypesExtra: [] });
    const handlers = wire(sheet);

    await handlers[".elite-add-btn:click"](ev());
    expect(sheet.actor.system.eliteArchetypesExtra).toEqual([""]);

    await handlers[".elite-extra-input:change"](ev({ index: "0" }, "Инквизитор"));
    expect(sheet.actor.system.eliteArchetypesExtra).toEqual(["Инквизитор"]);

    await handlers[".elite-extra-remove:click"](ev({ index: "0" }));
    expect(sheet.actor.system.eliteArchetypesExtra).toEqual([]);
  });

  it("пикер записывает выбранный архетип в основное поле", async () => {
    const sheet = sheetFor({ race: "human", eliteArchetype: "" });
    const handlers = wire(sheet);

    handlers[".elite-pick-btn:click"](ev());
    expect(captured.dialog.title).toBe("Элитный архетип");

    const picker = listenerHtml();
    captured.dialog.render(picker);
    await picker.handlers[".ep-item:click"](ev({ name: "Инквизитор" }));

    expect(sheet.actor.updates[0]).toEqual({ "system.eliteArchetype": "Инквизитор" });
  });

  it("подбор по расе: метка книги покрывает субрасы Друкхари", () => {
    const match = (system, entry) => eliteRaceMatch(sheetFor(system).actor, entry);
    const wrack = { race: "drukhari", subrace: "wrack" };

    expect(match(wrack, { race: "Любая" })).toBe(true);
    // Субраса ищется и в поле расы, и в поле субрасы: метка «Друкхари» по книге
    // покрывает Развалин и Мандрагор, как бы они ни были записаны на листе.
    expect(match({ race: "wrack" },   { race: "Друкхари" })).toBe(true);
    expect(match(wrack,               { race: "Развалина" })).toBe(true);
    expect(match(wrack,               { race: "Космодесантник" })).toBe(false);
  });
});

describe("вкладка ЭФФЕКТЫ: Страх, Расстройства, Болезни", () => {

  /** Предмет-строка вкладки: тест смотрит, удалили его или переключили. */
  const rowItem = ({ id = "it-1", type = "disorder", active = false } = {}) => {
    const it = {
      id, type, name: "Строка", system: { active }, updates: [], deleted: false,
      sheet: { render: () => {} },
      async delete() { it.deleted = true; },
      async update(data) { it.updates.push(data); return data; }
    };
    return it;
  };

  it("кнопка Страха открывает свой тест", () => {
    const handlers = wire(sheetFor({ characteristics: { wp: { total: 40 } } }));

    handlers[".fear-roll:click"](ev());

    expect(captured.dialog.title).toBe("😱 Тест Страха");
  });

  it("бросок Порчи идёт как тест Воли", () => {
    const handlers = wire(sheetFor({ characteristics: { wp: { total: 40 } } }));

    handlers[".corruption-roll:click"](ev());

    expect(captured.dialog.window.title).toBe("Проверка: Воля (Порча)");   // DialogV2
  });

  it("строка расстройства удаляется крестиком", async () => {
    const row = rowItem();
    const handlers = wire(sheetFor({ items: [row] }));

    await handlers[".disorder-remove-btn:click"](ev({ itemId: "it-1" }));

    expect(row.deleted).toBe(true);
  });

  it("болезнь заводится, переключается и удаляется", async () => {
    const row = rowItem({ type: "disease" });
    const sheet = sheetFor({ items: [row] });
    const handlers = wire(sheet);

    await handlers[".disease-add-btn:click"](ev());
    expect(captured.created).toEqual([
      { name: "Новая болезнь", type: "disease", system: { diseaseType: "warp" } }
    ]);

    await handlers[".disease-active-toggle:click"](ev({ itemId: "it-1" }));
    expect(row.updates[0]).toEqual({ "system.active": true });

    await handlers[".disease-remove-btn:click"](ev({ itemId: "it-1" }));
    expect(row.deleted).toBe(true);
  });
});

describe("Стремления (три жёстких слота)", () => {

  it("выбор из списка и «Своё» пишутся в свой слот", async () => {
    const sheet = sheetFor({ aspirations: [] });
    const handlers = wire(sheet);

    await handlers[".aspir-select:change"](ev({ index: "1" }, "shame-1"));
    expect(sheet.actor.system.aspirations).toEqual([{ id: "" }, { id: "shame-1" }, { id: "" }]);

    await handlers[".aspir-select:change"](ev({ index: "2" }, "__custom__"));
    expect(sheet.actor.system.aspirations[2]).toEqual({ custom: true, name: "", mods: "", desc: "" });
  });

  it("крестик чистит слот, не сдвигая остальные", async () => {
    const sheet = sheetFor({ aspirations: [{ id: "pride-1" }, { id: "shame-1" }, { id: "motive-1" }] });
    const handlers = wire(sheet);

    await handlers[".aspir-remove:click"](ev({ index: "0" }));

    expect(sheet.actor.system.aspirations).toEqual([{ id: "" }, { id: "shame-1" }, { id: "motive-1" }]);
  });

  it("поля своего Стремления дописываются к слоту", async () => {
    const sheet = sheetFor({ aspirations: [{ custom: true, name: "", mods: "" }] });
    const handlers = wire(sheet);

    await handlers[".aspir-custom-name, .aspir-custom-mods:change"]({
      preventDefault: () => {}, stopPropagation: () => {},
      currentTarget: { dataset: { index: "0" }, value: "Месть", classList: { contains: () => true } }
    });

    expect(sheet.actor.system.aspirations[0]).toEqual({ custom: true, name: "Месть", mods: "" });
  });
});

describe("Пути Аэльдари", () => {

  it("Путь добавляется и убирается по индексу", async () => {
    const sheet = sheetFor({ paths: [{ key: "warlock", grade: "novice" }] });
    const handlers = wire(sheet);

    await handlers[".path-add-btn:click"](ev());
    expect(sheet.actor.system.paths).toEqual([
      { key: "warlock", grade: "novice" }, { key: "", grade: "" }
    ]);

    await handlers[".path-remove:click"](ev({ index: "0" }));
    expect(sheet.actor.system.paths).toEqual([{ key: "", grade: "" }]);
  });

  it("смена Пути сбрасывает градацию на первую доступную", async () => {
    const sheet = sheetFor({ paths: [{ key: "", grade: "" }] });
    const handlers = wire(sheet, {
      ".path-sel":   [{ dataset: { index: "0" }, value: "warlock" }],
      ".path-grade": [{ dataset: { index: "0" }, value: "" }]
    });

    await handlers[".path-sel, .path-grade:change"](ev());

    expect(sheet.actor.system.paths).toEqual([{ key: "warlock", grade: "novice" }]);
  });
});

describe("вкладка БОЙ", () => {

  const fighter = (extra = {}) => ({
    characteristics: { ws: { total: 45, bonus: 4 }, bs: { total: 40, bonus: 4 }, s: { total: 40, bonus: 4 } },
    fatigue: { value: 0 },
    ...extra
  });

  it("переключатель стойки пишет её в актора", async () => {
    const sheet = sheetFor(fighter());
    const handlers = wire(sheet);

    await handlers[".stance-radio:change"](ev({}, "aggressive"));

    expect(sheet.actor.updates[0]).toEqual({ "system.meleeStance": "aggressive" });
  });

  it("состязательный приём открывает свой диалог, а не окно атаки", () => {
    const handlers = wire(sheetFor(fighter()));

    handlers[".technique-btn:click"](ev({ technique: "knockdown" }));

    expect(captured.dialog.title).toBe("Повалить");
  });

  it("приём с надетым рукопашным оружием открывает окно атаки", async () => {
    const blade = weaponFor({ weaponClass: "melee", equipped: true, damage: "1d10+3" },
      { id: "w-1", name: "Цепной меч" });
    blade.type = "weapon";                                   // приём ищет надетое среди оружия
    const handlers = wire(sheetFor(fighter({ items: [blade] })));

    handlers[".technique-btn:click"](ev({ technique: "sweep" }));
    await flush();                                           // окно атаки собирается асинхронно

    expect(captured.dialog.window.title).toBe("Атака: Цепной меч");
  });

  it("приём без оружия сразу бросает и сообщает в чат", async () => {
    const handlers = wire(sheetFor(fighter()));

    await handlers[".technique-btn:click"](ev({ technique: "sweep" }));

    expect(captured.dialog).toBe(null);
    expect(captured.chat.at(-1).content).toContain("Широкий Взмах");
  });

  it("кнопка атаки у оружия ближнего боя открывает окно сразу", () => {
    const blade = weaponFor({ weaponClass: "melee", equipped: true }, { id: "w-1", name: "Цепной меч" });
    const handlers = wire(sheetFor(fighter({ items: [blade] })));

    handlers[".weapon-attack-roll:click"](ev({ itemId: "w-1" }));

    expect(captured.dialog.window.title).toBe("Атака: Цепной меч");
  });

  it("кнопка лечения открывает диалог Первой Помощи", () => {
    const handlers = wire(sheetFor(fighter({ wounds: { value: 5, max: 12 } })));

    handlers[".wounds-heal-btn:click"](ev());

    expect(captured.dialog.window.title).toBe("Лечение");
  });

  it("Очки Боли впитываются и тратятся в пределах пула", async () => {
    const sheet = sheetFor(fighter({ fate: { value: 0, max: 2 } }));
    const handlers = wire(sheet);

    await handlers[".pain-absorb-btn:click"](ev());
    expect(sheet.actor.system.fate.value).toBe(1);

    await handlers[".pain-spend-btn:click"](ev());
    await handlers[".pain-spend-btn:click"](ev());           // пусто — трата не проходит
    expect(sheet.actor.system.fate.value).toBe(0);
    expect(sheet.actor.updates).toHaveLength(2);
  });
});

describe("Снаряжение: улучшения на носителе", () => {

  /** Улучшение: update пишет по плоскому пути, как настоящий документ, — иначе
   *  синхронизация эффектов читала бы состояние ДО правки. */
  function modItem({ id = "mod-1", disabled = true, ...system } = {}) {
    const it = {
      id, name: "Улучшение", type: "armorMod",
      system: { installedOn: "", active: false, activatable: true, ...system },
      updates: [], effectUpdates: [], effects: { contents: [{ id: "fx-1", disabled }] },
      async update(data) {
        it.updates.push(data);
        for (const [path, value] of Object.entries(data)) applyPath(it, path, value);
        return data;
      },
      async updateEmbeddedDocuments(_type, docs) { it.effectUpdates.push(...docs); return docs; }
    };
    return it;
  }

  it("установка на носителя включает эффекты улучшения", async () => {
    const mod = modItem({ activatable: false });
    const handlers = wire(sheetFor({ items: [mod] }));

    await handlers[".gear-mod-install:change"](ev({ itemId: "mod-1" }, "host-1"));

    expect(mod.system.installedOn).toBe("host-1");
    expect(mod.effectUpdates).toEqual([{ _id: "fx-1", disabled: false }]);
  });

  it("снятие с носителя гасит и включаемую систему, и её эффекты", async () => {
    const mod = modItem({ installedOn: "host-1", active: true, disabled: false });
    const handlers = wire(sheetFor({ items: [mod] }));

    await handlers[".gear-mod-uninstall:click"](ev({ itemId: "mod-1" }));

    expect(mod.updates[0]).toEqual({ "system.installedOn": "", "system.active": false });
    expect(mod.effectUpdates).toEqual([{ _id: "fx-1", disabled: true }]);
  });

  it("ВКЛ/выкл включаемой системы переключает её эффекты", async () => {
    const mod = modItem({ installedOn: "host-1" });
    const handlers = wire(sheetFor({ items: [mod] }));

    await handlers[".armormod-active-toggle:click"](ev({ itemId: "mod-1" }));

    expect(mod.system.active).toBe(true);
    expect(mod.effectUpdates).toEqual([{ _id: "fx-1", disabled: false }]);
  });

  it("цена психосилы и техночуда пишется числом", async () => {
    const power = {
      id: "psy-1", type: "psychicPower", name: "Сила", system: { cost: 0 }, updates: [],
      async update(data) { power.updates.push(data); return data; }
    };
    const handlers = wire(sheetFor({ items: [power] }));

    await handlers[".psy-cost-input, .tech-cost-input:change"](ev({ itemId: "psy-1" }, "400"));

    expect(power.updates[0]).toEqual({ "system.cost": 400 });
  });
});

describe("Одержимость: Проявление", () => {

  const possessed = () => ({
    possession: { demon: "katart", manifested: false }, corruption: { value: 30 }
  });

  it("Провал теста Cor+20 добавляет Порчу, но форму всё равно включает", async () => {
    const sheet = sheetFor(possessed());
    const handlers = wire(sheet);
    captured.nextRoll = 90;                                  // 90 > 30+20 — Провал

    await handlers[".poss-manifest-btn:click"](ev());

    expect(sheet.actor.system.possession.manifested).toBe(true);
    expect(sheet.actor.system.corruption.value).toBe(31);
    expect(captured.chat.at(-1).flavor).toContain("Провал");
  });

  it("успех Порчу не трогает, а заключение демона не бросает тест", async () => {
    const sheet = sheetFor(possessed());
    const handlers = wire(sheet);
    captured.nextRoll = 40;                                  // 40 ≤ 50 — Успех

    await handlers[".poss-manifest-btn:click"](ev());
    expect(sheet.actor.system.corruption.value).toBe(30);

    await handlers[".poss-manifest-btn:click"](ev());        // обратно в смертную форму
    expect(sheet.actor.system.possession.manifested).toBe(false);
    expect(captured.chat.at(-1).content).toContain("смертная форма");
  });
});

describe("Применение расы, Прошлого и легиона", () => {

  const traitNames = () => captured.created.filter(d => d.type === "trait").map(d => d.name);

  it("расовые бонусы идут только в пустые характеристики", async () => {
    const sheet = sheetFor({ characteristics: { ws: { base: 45 }, bs: {} } });
    const handlers = wire(sheet);

    await handlers[".gene-apply-btn:click"](ev());

    const upd = sheet.actor.updates[0];
    expect(upd["system.characteristics.ws.base"]).toBeUndefined();   // занято — не трогаем
    expect(upd["system.characteristics.bs.base"]).toBe(30);
  });

  it("Иннари получает Черты Иннари поверх бонусов Прошлого", async () => {
    const handlers = wire(sheetFor({ characteristics: {}, ynnariPast: "aeldari" }));

    await handlers[".ynnari-apply-btn:click"](ev());

    expect(traitNames().length).toBeGreaterThan(0);
  });

  it("легион пересоздаёт свои Черты, убирая прежние", async () => {
    const legion = LEGIONS.find(l => !l.curseChoices?.length);
    const old = { id: "old-1", type: "trait", name: "Геносемя: прежний", system: { source: "Легион" } };
    const sheet = sheetFor({ characteristics: {}, items: [old], geneSeed: { legion: legion.id } });
    const handlers = wire(sheet);

    await handlers[".legion-apply-btn:click"](ev());

    expect(sheet.actor.deleted).toEqual(["old-1"]);
    expect(traitNames().some(n => n.startsWith("Геносемя: "))).toBe(true);
    expect(traitNames().some(n => n.startsWith("Культура: "))).toBe(true);
  });

  it("проклятье с вариантами спрашивает, и «Без проклятья» создаёт две Черты", async () => {
    const legion = LEGIONS.find(l => l.curseChoices?.length);
    const sheet = sheetFor({ characteristics: {}, geneSeed: { legion: legion.id } });
    const handlers = wire(sheet);

    await handlers[".legion-apply-btn:click"](ev());
    expect(captured.dialog.buttons.c0.label).toBe(legion.curseChoices[0].name);

    await captured.dialog.buttons.none.callback();
    expect(traitNames().filter(n => n.startsWith("Проклятье: "))).toEqual([]);
    expect(traitNames()).toHaveLength(2);                   // Геносемя + Культура
  });

  it("смена расы обнуляет субрасу — иначе на листе осталась бы чужая", async () => {
    const sheet = sheetFor({ race: "drukhari", subrace: "wrack" });
    const handlers = wire(sheet);

    await handlers[".race-select:change"](ev({}, "human"));

    expect(sheet.actor.updates[0]).toEqual({ "system.race": "human", "system.subrace": "" });
  });

  it("без выбранного легиона кнопка объясняет порядок и ничего не создаёт", async () => {
    const sheet = sheetFor({ characteristics: {}, geneSeed: {} });
    const handlers = wire(sheet);

    await handlers[".legion-apply-btn:click"](ev());

    expect(captured.created).toEqual([]);
    expect(captured.warnings).toHaveLength(1);
  });
});
