import { describe, it, expect, beforeEach } from "vitest";
import { captured, fakeHtml, resetCaptured } from "../support/foundry-stub.mjs";
import { openFearDialog, rollTrauma, createDisorderItem,
         rollDisorderTest } from "../../module/sheets/tabs/disorders.mjs";

function actor({ items = [], wp = 40 } = {}) {
  return {
    name: "Подставной",
    id: "actor-stub",
    system: { characteristics: { wp: { total: wp } } },
    items,
    createEmbeddedDocuments: async (type, docs) => {
      captured.created.push(...docs);
      return docs.map(d => ({ ...d, sheet: { render: () => {} } }));
    }
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

  it("rollTrauma запускает тест Ментальной Травмы", async () => {
    captured.nextRoll = 90;
    await rollTrauma(actor({ wp: 40 }));

    expect(captured.rolls).toEqual(["1d100", "1d100"]);
    expect(captured.chat[0].content).toContain("Ментальная Травма");
    expect(captured.chat[0].content).toContain("Провал");
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

  it("rollDisorderTest считает порог как W + testMod", async () => {
    captured.nextRoll = 35;
    await rollDisorderTest(actor({ wp: 40 }), {
      name: "Фобия",
      system: { testChar: "wp", testMod: -10, description: "Описание" }
    });

    expect(captured.chat[0].content).toContain("Порог: <b>30</b>");
    expect(captured.chat[0].content).toContain("Провал");
  });
});
