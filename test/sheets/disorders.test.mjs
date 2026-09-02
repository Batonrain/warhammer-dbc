import { describe, it, expect, beforeEach } from "vitest";
import { captured, fakeHtml, fakeForm, resetCaptured } from "../support/foundry-stub.mjs";
import { openFearDialog, openTraumaDialog, rollTrauma, createDisorderItem,
         rollDisorderTest, suppressMental } from "../../module/sheets/tabs/disorders.mjs";
import { createTraumaItem } from "../../module/combat/fear.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

/**
 * fakeHtml + доступ по индексу [0] с querySelectorAll — то, что читает
 * checkedRuleMods (galочки «Правила» реестра правил, module/rules/roll-mods.mjs).
 * ruleModCheckboxes — что должно найтись «отмеченным»; сам селектор здесь не
 * разбирается, это чистая заглушка DOM.
 */
function fakeHtmlWithRuleMods(fields, ruleModCheckboxes = []) {
  const base = fakeHtml(fields);
  base[0] = { querySelectorAll: () => ruleModCheckboxes.map(value => ({ dataset: { value: String(value) } })) };
  return base;
}

/** Как fakeHtmlWithRuleMods, но для радиокнопки переброса ruleRerollsHtml. */
function fakeHtmlWithReroll(fields, rerollOpt = null) {
  const base = fakeHtml(fields);
  base[0] = { querySelector: sel => (sel === ".rule-reroll-opt:checked" ? rerollOpt : null) };
  return base;
}

function actor({ items = [], wp = 40 } = {}) {
  return {
    name: "Подставной",
    id: "actor-stub",
    system: { characteristics: { wp: { total: wp } } },
    items,
    createEmbeddedDocuments: async (type, docs) => {
      captured.created.push(...docs);
      return docs.map(d => ({ ...d, sheet: { render: () => {} } }));
    },
    update: async () => {}
  };
}

beforeEach(resetCaptured);

describe("mental disorders", () => {
  it("openFearDialog передаёт параметры формы в бросок Страха", async () => {
    captured.nextRoll = 90;
    openFearDialog(actor({ wp: 40 }));

    await captured.dialog.buttons.roll.callback(fakeHtml({
      "#fear-rating": "3",
      "#fear-type": "normal",
      "#fear-infamy": "5",
      "#fear-mod": "-5",
      "#fear-prop-demon": true
    }));

    expect(captured.rolls).toEqual(["1d100", "1d100"]);
    expect(captured.chat[0].content).toContain("Страх 3 | W: <b>40</b> -25 → Порог: <b>15</b>");
    expect(captured.chat[0].content).toContain("Свойства: <b>Демон</b>");
    expect(captured.chat[0].flags["warhammer-dbc"].fearTest).toMatchObject({
      actorId: "actor-stub",
      ratingKey: "3",
      type: "normal",
      infamy: 5,
      mod: -5,
      properties: { demon: true }
    });
  });

  it("openFearDialog складывает отмеченные галочки правил с ручным модификатором", async () => {
    captured.nextRoll = 90;
    openFearDialog(actor({ wp: 40 }));

    await captured.dialog.buttons.roll.callback(fakeHtmlWithRuleMods({
      "#fear-rating": "3", "#fear-type": "normal", "#fear-infamy": "0", "#fear-mod": "-5",
      "#fear-prop-demon": false
    }, [-20, 5]));   // Каталептический Узел -20 (Уничтожители) + случайные +5

    // W 40, ratingMod(normal, "3") -20 + mod = -5(ручной) + (-20+5)(галочки) = -20 → всего -40.
    expect(captured.chat[0].content).toContain("W: <b>40</b> -40 → Порог: <b>0</b>");
  });

  // wdbc-zepq: раньше openFearDialog звал только ruleRollModsHtml — перебросы
  // из реестра правил (Lord of the Exodites и т.п.) в диалоге не показывались
  // и не применялись вовсе, даже если у актора было активное правило.
  it("openFearDialog: доступный переброс области morale реально бросает 2 кубика", async () => {
    const saved = getRuleSources();
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "x", label: "Аура Владыки", effects: [{ kind: "rollMode", target: "morale", mode: "keepBest", rolls: 2 }] }
    ]);
    try {
      openFearDialog(actor({ wp: 40 }));
      expect(captured.dialog.content).toContain("rule-reroll");
      expect(captured.dialog.content).toContain("Аура Владыки");

      captured.dice = [90, 10];
      await captured.dialog.buttons.roll.callback(fakeHtmlWithReroll({
        "#fear-rating": "1", "#fear-type": "normal", "#fear-infamy": "0", "#fear-mod": "0"
      }, { dataset: { idx: "0", mode: "keepBest", rolls: "2" } }));

      expect(captured.rolls.filter(r => r === "1d100")).toHaveLength(2);
    } finally {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    }
  });

  it("rollTrauma запускает тест Ментальной Травмы", async () => {
    captured.nextRoll = 90;
    await rollTrauma(actor({ wp: 40 }));

    expect(captured.rolls).toEqual(["1d100", "1d100"]);
    expect(captured.chat[0].content).toContain("Ментальная Травма");
    expect(captured.chat[0].content).toContain("Провал");
  });

  // Раньше при пустом ruleRollModsHtml (нет предметов с testMod) диалог вовсе
  // пропускался — кроме галочек правил тесту нечего было настраивать. Теперь
  // есть ещё Вид теста/Сложность/Кубик, поэтому диалог открывается всегда.
  it("openTraumaDialog без доступных правил всё равно открывает диалог", async () => {
    captured.nextRoll = 90;
    openTraumaDialog(actor({ wp: 40 }));

    expect(captured.dialog).toBeTruthy();
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#trauma-mod": "0" }));

    expect(captured.chat[0].content).toContain("Ментальная Травма");
  });

  // Актор с настоящей записью testMod (char:wp) — Каталептический Узел
  // Уничтожителей, как на самом деле выглядит в паке. Диалог обязан
  // появиться (есть из чего выбирать), а отмеченная галочка — попасть в mod.
  it("openTraumaDialog с записью testMod показывает диалог и учитывает галочку", async () => {
    const susceptor = actor({
      wp: 40,
      items: [{
        name: "6. Каталептический Узел / Catalepsean Node",
        flags: { "warhammer-dbc": { mechanics: [{ id: "g1", operator: "AND", entries: [{
          id: "e1", kind: "testMod", modScope: "char", modValueMode: "flat", rerollChar: "wp",
          value: -20, label: "Каталептический Узел: против ментальных потрясений"
        }] }] } }
      }]
    });
    captured.nextRoll = 90;
    openTraumaDialog(susceptor);
    expect(captured.dialog).toBeTruthy();

    await captured.dialog.buttons.roll.callback(fakeHtmlWithRuleMods({ "#trauma-mod": "0" }, [-20]));

    // W 40, mod -20 → порог 20, бросок 90 → провал (совпадает с sub-строкой W-20).
    expect(captured.chat[0].content).toContain("тест W-20");
  });

  it("createDisorderItem создаёт расстройство из записи библиотеки", async () => {
    const item = await createDisorderItem(actor(), {
      name: "Фобия",
      desc: "Описание",
      testMod: -10
    });

    expect(item).toMatchObject({
      name: "Фобия",
      type: "mentalDisorder",
      system: { description: "Описание", testChar: "wp", testMod: -10 }
    });
    expect(captured.created).toHaveLength(1);
  });

  it("createDisorderItem не создаёт дубль по имени", async () => {
    const item = await createDisorderItem(actor({
      items: [{ name: "Фобия", type: "mentalDisorder" }]
    }), { name: "Фобия", desc: "Описание", testMod: -10 });

    expect(item).toBeNull();
    expect(captured.created).toEqual([]);
  });

  // rollDisorderTest теперь открывает DialogV2 (Вид теста/Сложность/Кубик,
  // как у остальных раскатанных тестов) — раньше катился сразу по клику.
  it("rollDisorderTest считает порог как W + testMod", async () => {
    captured.nextRoll = 35;
    const promise = rollDisorderTest(actor({ wp: 40 }), {
      name: "Фобия",
      system: { testChar: "wp", testMod: -10, description: "Описание" }
    });
    await captured.press("roll", fakeForm());
    await promise;

    expect(captured.chat[0].content).toContain("Порог: <b>30</b>");
    expect(captured.chat[0].content).toContain("Провал");
  });

  it("rollDisorderTest: Сложность входит в Порог", async () => {
    captured.nextRoll = 25;
    const promise = rollDisorderTest(actor({ wp: 40 }), {
      name: "Фобия", system: { testChar: "wp", testMod: -10, description: "" }
    });
    await captured.press("roll", fakeForm({ "#test-difficulty": "-20" }));
    await promise;

    // 40 - 10 - 20 = 10
    expect(captured.chat[0].content).toContain("Порог: <b>10</b>");
  });

  it("rollDisorderTest: натуральный бросок 1-5 — Критический Успех", async () => {
    captured.nextRoll = 4;
    const promise = rollDisorderTest(actor({ wp: 40 }), {
      name: "Фобия", system: { testChar: "wp", testMod: 0, description: "" }
    });
    await captured.press("roll", fakeForm());
    await promise;

    expect(captured.chat[0].content).toContain("Критический Успех");
  });
});

describe("след Ментальной Травмы", () => {
  const row = { text: "Кошмары: −10 на тесты Воли до конца сессии." };

  it("провал заводит запись с полным текстом и W+0", async () => {
    const a = actor();
    await createTraumaItem(a, row);

    expect(captured.created).toHaveLength(1);
    expect(captured.created[0]).toMatchObject({
      type: "mentalTrauma",
      system: { description: row.text, testChar: "wp", testMod: 0 }
    });
  });

  // Одна и та же строка таблицы выпадает не раз за кампанию, и плодить
  // одинаковые записи незачем — подавлять их всё равно пришлось бы по одной.
  it("повтор той же строки записи не плодит", async () => {
    const a = actor({ items: [{ type: "mentalTrauma", system: { description: row.text } }] });
    const made = await createTraumaItem(a, row);

    expect(made).toBeNull();
    expect(captured.created).toHaveLength(0);
  });

  it("длинный текст режется в подпись, но целиком лежит в описании", async () => {
    const long = { text: "Очень длинная строка таблицы Травмы, которая никак не поместится в подпись предмета на листе." };
    await createTraumaItem(actor(), long);

    const made = captured.created[0];
    expect(made.name.length).toBeLessThanOrEqual(60);
    expect(made.name.endsWith("…")).toBe(true);
    expect(made.system.description).toBe(long.text);
  });

  it("пустая строка записи не заводит", async () => {
    expect(await createTraumaItem(actor(), { text: "  " })).toBeNull();
    expect(captured.created).toHaveLength(0);
  });
});

describe("подавление", () => {
  const trauma = (id, name) => ({
    id, name, type: "mentalTrauma",
    system: { description: "текст", testChar: "wp", testMod: 0 }
  });

  // Одна запись — без выбора «какую», но rollDisorderTest всё равно открывает
  // свой DialogV2 (Вид теста/Сложность/Кубик) перед броском.
  it("единственную запись тестирует сразу, без выбора «какую»", async () => {
    captured.nextRoll = 10;
    const a = actor({ items: [trauma("t1", "Кошмары")], wp: 40 });
    a.items.filter = Array.prototype.filter.bind(a.items);
    const promise = suppressMental(a, "mentalTrauma");
    await captured.press("roll", fakeForm());
    await promise;

    expect(captured.chat[0].content).toContain("Кошмары");
  });

  it("подавлять нечего — ни диалога, ни броска", async () => {
    const a = actor({ items: [] });
    a.items.filter = Array.prototype.filter.bind(a.items);
    await suppressMental(a, "mentalTrauma");

    expect(captured.dialog).toBeFalsy();
    expect(captured.chat).toHaveLength(0);
  });
});
