import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  activateAdvanceListeners,
  addAdvTalent,
  addAptitude,
  charImpCost,
  recalcAllAdvanceCosts,
  removeAdvTalent,
  removeAptitude,
  removeGroupEntry,
  removePurchasedTalent,
  renameGroupEntry,
  setAptitudes,
  setGroupEntryField,
  skillCumCost
} from "../../module/sheets/tabs/advance.mjs";

/** Обновление по плоскому пути: Foundry меняет документ на месте, тесты — тоже. */
function applyPath(target, path, value) {
  const keys = path.split(".");
  let cur = target;
  for (const key of keys.slice(0, -1)) cur = (cur[key] ??= {});
  cur[keys.at(-1)] = value;
}

function talent({ id = "tal-1", name = "Меткий стрелок", tier = 1,
                  aptitudes = [], purchased = true, cost = 0 } = {}) {
  const t = {
    id, name,
    type: "talent",
    system: { tier, aptitudes, purchased, cost },
    deleted: false,
    delete: async () => { t.deleted = true; }
  };
  return t;
}

function actor({ aptitudes = [], characteristics = {}, skills = {},
                 groupSkills = {}, advanceTalents = [], items = [] } = {}) {
  const list = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  const a = {
    system: { aptitudes, characteristics, skills, groupSkills, advanceTalents },
    items: list,
    updates: [],
    itemUpdates: [],
    update: async data => {
      a.updates.push(data);
      for (const [path, value] of Object.entries(data)) applyPath(a, path, value);
      return data;
    },
    updateEmbeddedDocuments: async (_type, docs) => { a.itemUpdates.push(...docs); return docs; }
  };
  return a;
}

beforeEach(resetCaptured);

describe("накопительные цены продвижения", () => {
  it("charImpCost складывает ступени и стартует с выданного архетипом уровня", () => {
    const a = actor({ aptitudes: ["ws", "offence"] });

    expect(charImpCost(a, "ws", "trained")).toBe(850);           // 100+250+500, Дружественная
    expect(charImpCost(a, "ws", "trained", "simple")).toBe(750); // первая ступень выдана
    expect(charImpCost(a, "ws", "none")).toBe(0);
  });

  it("charImpCost без склонностей считает по Враждебной колонке", () => {
    expect(charImpCost(actor(), "ws", "trained")).toBe(2250);    // 500+750+1000
  });

  it("charImpCost берёт выданный уровень с листа, когда он не передан", () => {
    const a = actor({
      aptitudes: ["ws", "offence"],
      characteristics: { ws: { grantedImp: "simple" } }
    });

    expect(charImpCost(a, "ws", "trained")).toBe(750);
  });

  it("skillCumCost считает от Характеристики записи и от потолка выданного ранга", () => {
    const a   = actor({ aptitudes: ["int", "knowledge"] });
    const def = { char: "int", apt2: "knowledge", label: "Учёные знания" };

    expect(skillCumCost(a, def, "trained", null, "untrained")).toBe(300);  // 100+200
    expect(skillCumCost(a, def, "trained", null, "knows")).toBe(200);
    expect(skillCumCost(a, def, "trained", "wp", "untrained")).toBe(550);  // 200+350, Нейтральная
  });

  it("skillCumCost: alwaysAlly перебивает отсутствие склонностей", () => {
    const a = actor();

    expect(skillCumCost(a, { char: "int", apt2: "knowledge", alwaysAlly: true },
      "knows", null, "untrained")).toBe(100);
    expect(skillCumCost(a, { char: "int", apt2: "knowledge" },
      "knows", null, "untrained")).toBe(300);
  });
});

// pricingModeOverride — per-actor оверрайд системы цены (constants/patronage.mjs),
// не требует game.settings (мировая настройка), поэтому тестируем его отдельно.
describe("режим цены Продвижения — Покровительство/Смешанная (patronage.mjs)", () => {
  function patronActor(overrides = {}) {
    const a = actor(overrides);
    a.system.pricingModeOverride = overrides.pricingModeOverride ?? "patronage";
    a.system.patronGod = overrides.patronGod ?? "slaanesh";
    a.system.patronStereotype = overrides.patronStereotype ?? "slaanesh-dancer";
    return a;
  }

  it("charImpCost считает по стереотипу Покровителя, не по Склонностям", () => {
    // Танцор Клинка (Слаанеш): союзная Ловкость (ag), враждебные Интеллект/Стойкость.
    const a = patronActor();
    expect(charImpCost(a, "ag", "simple")).toBe(100);    // Союзная
    expect(charImpCost(a, "int", "simple")).toBe(500);   // Враждебная
    expect(charImpCost(a, "s", "simple")).toBe(250);     // Нейтральная (не в списке)
  });

  it("skillCumCost считает по Богу Навыка ↔ Покровителю", () => {
    const a = patronActor();
    const dodgeDef = { char: "ag", apt2: "defence", label: "Уклонение" };
    // Dodge — Слаанеш, тот же Бог, что у персонажа → Союзная.
    expect(skillCumCost(a, dodgeDef, "knows", null, "untrained", null, "", "dodge")).toBe(100);
    const athlDef = { char: "s", apt2: "general", label: "Атлетика" };
    // Athletics — Кхорн, враждебен Слаанешу → Враждебная.
    expect(skillCumCost(a, athlDef, "knows", null, "untrained", null, "", "athletics")).toBe(300);
  });

  it("Смешанная система комбинирует Склонности и Покровительство", () => {
    // Склонности дают Союзную (ws/offence — обе есть), Покровительство (Кхорн,
    // Авангард) тоже даёт Союзную для ws → результат Союзная (mixedCat).
    const a = patronActor({
      aptitudes: ["ws", "offence"], pricingModeOverride: "mixed",
      patronGod: "khorne", patronStereotype: "khorne-vanguard"
    });
    expect(charImpCost(a, "ws", "simple")).toBe(100);
  });

  it("recalcAllAdvanceCosts пересчитывает уже купленное при смене режима/Покровителя", async () => {
    const bought = talent({ name: "Lightning Reflexes / Молниеносные Рефлексы", cost: 999 });
    const a = patronActor({
      characteristics: { ag: { improvement: "simple", cost: 999 } },
      items: [bought]
    });

    await recalcAllAdvanceCosts(a);

    expect(a.system.characteristics.ag.cost).toBe(100);            // Танцор Клинка: ag союзная
    // Lightning Reflexes — Бог Слаанеш в библиотеке, тот же, что у персонажа → Союзная (150).
    expect(a.itemUpdates).toEqual([{ _id: "tal-1", "system.cost": 150 }]);
  });

  it("без per-actor оверрайда — прежнее поведение по Склонностям (game.settings недоступен в тестах)", () => {
    const a = actor({ aptitudes: ["ag", "finesse"] });
    a.system.patronGod = "slaanesh";
    a.system.patronStereotype = "slaanesh-dancer";
    // pricingModeOverride не задан → фолбэк на "aptitude" (worldAdvancePricingMode
    // без game.settings) — цена должна идти по Складностям, а не по стереотипу.
    // Per (P) — Нейтральная у стереотипа Танцора Клинка (не союзная и не
    // враждебная), но 0 совпадений склонностей ⇒ Враждебная по Склонностям:
    // если бы диспетчер ошибочно читал стереотип, число было бы другим (250).
    expect(charImpCost(a, "per", "simple")).toBe(500);
  });
});

describe("склонности персонажа", () => {
  it("addAptitude берёт первую незанятую, removeAptitude вырезает по индексу", async () => {
    const a = actor({ aptitudes: ["ws"] });

    await addAptitude(a);
    expect(a.system.aptitudes).toEqual(["ws", "bs"]);

    await removeAptitude(a, 0);
    expect(a.system.aptitudes).toEqual(["bs"]);
  });

  it("список, сохранённый объектом, читается как массив", async () => {
    const a = actor({ aptitudes: { 0: "ws", 1: "bs" } });

    await addAptitude(a);

    expect(a.system.aptitudes).toEqual(["ws", "bs", "s"]);
  });

  it("setAptitudes пересчитывает характеристики, навыки, группы и купленные таланты", async () => {
    const bought = talent({ aptitudes: ["ws", "offence"], cost: 999 });
    const free   = talent({ id: "tal-2", purchased: false, cost: 0 });
    const a = actor({
      characteristics: {
        ws: { improvement: "simple", cost: 999 },
        t:  { improvement: "none",   cost: 999 }
      },
      skills: {
        awareness: { rank: "knows",     cost: 999 },
        dodge:     { rank: "untrained", cost: 999 }
      },
      groupSkills: {
        scholasticLore: [{ specialty: "Тактика", rank: "trained", char: "int", cost: 999 }]
      },
      items: [bought, free]
    });

    await setAptitudes(a, ["ws", "offence", "per", "fieldcraft", "int", "knowledge"]);

    expect(a.updates[0]).toEqual({
      "system.aptitudes": ["ws", "offence", "per", "fieldcraft", "int", "knowledge"]
    });
    expect(a.system.characteristics.ws.cost).toBe(100);
    expect(a.system.characteristics.t.cost).toBe(999);      // улучшения нет — цену не трогаем
    expect(a.system.skills.awareness.cost).toBe(100);
    expect(a.system.skills.dodge.cost).toBe(999);           // ранга нет — цену не трогаем
    expect(a.system.groupSkills.scholasticLore[0].cost).toBe(300);
    expect(a.itemUpdates).toEqual([{ _id: "tal-1", "system.cost": 150 }]);
  });
});

describe("записи Групп Навыков", () => {
  function withEntry(entry = {}) {
    return actor({
      aptitudes: ["int", "knowledge"],
      groupSkills: {
        scholasticLore: [{ specialty: "Тактика", rank: "untrained", char: "int", cost: 0, ...entry }]
      }
    });
  }
  const entryOf = a => a.system.groupSkills.scholasticLore[0];

  it("смена ранга тянет за собой авто-цену, выданный ранг её срезает", async () => {
    const a = withEntry();
    await setGroupEntryField(a, "scholasticLore", 0, "rank", "trained");
    expect(entryOf(a)).toMatchObject({ rank: "trained", cost: 300 });

    const granted = withEntry({ grantedRank: "knows" });
    await setGroupEntryField(granted, "scholasticLore", 0, "rank", "trained");
    expect(entryOf(granted).cost).toBe(200);
  });

  it("ручная цена принимает только целое, Характеристика цену не двигает", async () => {
    const a = withEntry({ rank: "trained", cost: 300 });

    await setGroupEntryField(a, "scholasticLore", 0, "cost", "мусор");
    expect(entryOf(a).cost).toBe(0);

    await setGroupEntryField(a, "scholasticLore", 0, "char", "wp");
    expect(entryOf(a)).toMatchObject({ char: "wp", cost: 0 });
  });

  it("переименование меняет специализацию, удаление вырезает запись", async () => {
    const a = withEntry();

    await renameGroupEntry(a, "scholasticLore", 0, "Астропатия");
    expect(entryOf(a).specialty).toBe("Астропатия");

    await removeGroupEntry(a, "scholasticLore", 0);
    expect(a.system.groupSkills.scholasticLore).toEqual([]);
  });
});

describe("Таланты в Развитии", () => {
  it("addAdvTalent добавляет пустую строку, removeAdvTalent вырезает по индексу", async () => {
    const a = actor({ advanceTalents: [{ name: "Быстрая перезарядка", cost: 300 }] });

    await addAdvTalent(a);
    expect(a.system.advanceTalents).toEqual([
      { name: "Быстрая перезарядка", cost: 300 },
      { name: "", cost: 0 }
    ]);

    await removeAdvTalent(a, 0);
    expect(a.system.advanceTalents).toEqual([{ name: "", cost: 0 }]);
  });

  it("купленный талант удаляется только после подтверждения", async () => {
    const tal = talent();
    const a   = actor({ items: [tal] });

    captured.confirmAnswer = false;
    await removePurchasedTalent(a, "tal-1");
    expect(tal.deleted).toBe(false);

    captured.confirmAnswer = true;
    await removePurchasedTalent(a, "tal-1");
    expect(tal.deleted).toBe(true);
  });
});

// Подставной jQuery: настоящего в тестах нет, а меню строится именно им.
function fakeJq() {
  const clicks = {};
  const jq = arg => {
    if (typeof arg === "string" && arg.trim().startsWith("<")) {
      const node = {
        css: () => node,
        remove: () => {},
        find: selector => ({ on: (_event, fn) => { clicks[selector] = fn; } })
      };
      return node;
    }
    return { remove: () => {}, off: () => {}, one: () => {}, append: () => {} };
  };
  jq.clicks = clicks;
  return jq;
}

describe("activateAdvanceListeners", () => {
  function wire(a, { elements = {}, addGroupSkill = () => {}, jq } = {}) {
    const handlers = {};
    const html = {
      find: selector => ({
        click:  fn => { handlers[`${selector}:click`]  = fn; },
        change: fn => { handlers[`${selector}:change`] = fn; },
        on: (event, fn) => { handlers[`${selector}:${event}`] = fn; },
        each: fn => (elements[selector] || []).forEach((el, i) => fn(i, el))
      })
    };
    activateAdvanceListeners(html, a, { addGroupSkill, jq });
    return handlers;
  }

  const ev = (dataset = {}, value) => ({
    preventDefault: () => {},
    stopPropagation: () => {},
    clientX: 10, clientY: 20,
    currentTarget: { dataset, value }
  });

  it("кнопки и поля правят склонности, группы и Таланты в Развитии", async () => {
    const a = actor({
      aptitudes: ["ws"],
      groupSkills: { scholasticLore: [{ specialty: "Тактика", rank: "untrained", char: "int", cost: 0 }] },
      advanceTalents: [{ name: "Старое", cost: 10 }]
    });
    const picked = [];
    const handlers = wire(a, {
      addGroupSkill: group => picked.push(group),
      elements: {
        ".apt-char-select": [{ value: "int" }, { value: "knowledge" }],
        ".advtal-input": [
          { dataset: { index: "0", field: "name" }, value: "Пилот" },
          { dataset: { index: "0", field: "cost" }, value: "300" }
        ]
      }
    });

    handlers[".add-group-skill:click"](ev({ group: "scholasticLore" }));
    await handlers[".group-skill-rank-select:change"](ev({ group: "scholasticLore", index: "0" }, "knows"));
    await handlers[".group-skill-char-select:change"](ev({ group: "scholasticLore", index: "0" }, "wp"));
    await handlers[".apt-char-add-btn:click"](ev());
    await handlers[".apt-char-select:change"](ev());
    // Ручная цена ставится последней: смена склонностей переписала бы её сама.
    await handlers[".group-skill-cost-input:change"](ev({ group: "scholasticLore", index: "0" }, "42"));
    await handlers[".advtal-add-btn:click"](ev());
    await handlers[".advtal-input:change"](ev());

    expect(picked).toEqual(["scholasticLore"]);
    expect(a.system.groupSkills.scholasticLore[0]).toMatchObject({ char: "wp", cost: 42 });
    expect(a.system.aptitudes).toEqual(["int", "knowledge"]);
    expect(a.system.advanceTalents).toEqual([{ name: "Пилот", cost: 300 }]);
  });

  it("ПКМ по записи Группы Навыков даёт переименование и удаление", async () => {
    const a = actor({
      groupSkills: { scholasticLore: [{ specialty: "Тактика", rank: "untrained", cost: 0 }] }
    });
    const jq = fakeJq();
    const handlers = wire(a, { jq });

    handlers[".group-skill-entry-row:contextmenu"](ev({ group: "scholasticLore", index: "0" }));

    jq.clicks[".wh-ctx-rename"]({ stopPropagation: () => {} });
    expect(captured.dialog.title).toBe("Переименовать специализацию");

    jq.clicks[".wh-ctx-delete"]({ stopPropagation: () => {} });
    await Promise.resolve();
    expect(a.system.groupSkills.scholasticLore).toEqual([]);
  });
});
