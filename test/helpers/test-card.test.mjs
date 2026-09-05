// Общий сборщик карточки теста (wdbc-kuun).
//
// Проверяется то, ради чего он заводился: одна разметка на все подсистемы и
// отсутствие «пустых мест» — скобок без содержимого, строки броска без броска,
// блока исхода без исхода. Раньше каждая из 232 карточек решала это сама, и
// решала по-разному.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { testCardHtml, thresholdLine, outcomeHtml } from "../../module/helpers/test-card.mjs";

describe("thresholdLine: строка Порога", () => {
  it("база, слагаемые и итог", () => {
    expect(thresholdLine({ label: "Ag", base: 35, parts: ["😓 Усталость -10", "стойка +10"], threshold: 35 }))
      .toBe('<div class="roll-threshold">Ag: <b>35</b> (😓 Усталость -10, стойка +10) → Порог: <b>35</b></div>');
  });

  it("без слагаемых скобок нет вовсе", () => {
    // Пустые скобки в карточке читаются как потерянные данные.
    expect(thresholdLine({ label: "Ag", base: 35, parts: [], threshold: 35 }))
      .toBe('<div class="roll-threshold">Ag: <b>35</b> → Порог: <b>35</b></div>');
  });

  it("пустые подписи отбрасываются, а не рисуются запятыми", () => {
    expect(thresholdLine({ label: "W", base: 40, parts: ["", null, "😓 Усталость -10"], threshold: 30 }))
      .toContain("(😓 Усталость -10)");
  });

  it("без базы — только итог: у некоторых тестов базы нет", () => {
    expect(thresholdLine({ threshold: 45 }))
      .toBe('<div class="roll-threshold">Порог: <b>45</b></div>');
  });
});

describe("testCardHtml: порядок и пропуски", () => {
  const card = (over = {}) => testCardHtml({
    icon: "<i></i>", title: "Уклонение — Герой",
    threshold: thresholdLine({ label: "Ag", base: 35, parts: [], threshold: 35 }),
    rv: 24, outcome: outcomeHtml(true, "Успех"), ...over
  });

  it("строки идут в общем порядке: шапка, Порог, бросок, исход", () => {
    const html = card();
    const order = ["roll-header", "roll-threshold", "roll-dice", "roll-outcome"];
    const positions = order.map(cls => html.indexOf(cls));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions.every(p => p >= 0)).toBe(true);
  });

  it("без броска строки броска нет", () => {
    expect(card({ rv: null })).not.toContain("roll-dice");
  });

  it("без исхода блока исхода нет", () => {
    expect(card({ outcome: "" })).not.toContain("roll-outcome");
  });

  it("свои строки встают между Порогом и броском", () => {
    const html = card({ lines: ['<div class="roll-threshold">Свойства: Демон</div>'] });
    expect(html.indexOf("Свойства")).toBeGreaterThan(html.indexOf("Ag:"));
    expect(html.indexOf("Свойства")).toBeLessThan(html.indexOf("roll-dice"));
  });

  it("свои блоки идут после исхода — там живут кнопки", () => {
    const html = card({ sections: ['<button class="wh-fear-reroll-btn"></button>'] });
    expect(html.indexOf("wh-fear-reroll-btn")).toBeGreaterThan(html.indexOf("roll-outcome"));
  });

  it("uuid актора попадает в корень — его читают обработчики кнопок", () => {
    expect(card({ actorUuid: "Actor.abc" })).toContain('data-actor-uuid="Actor.abc"');
    expect(card()).not.toContain("data-actor-uuid");
  });

  it("пустые куски не оставляют дыр в разметке", () => {
    const html = testCardHtml({ title: "Пусто" });
    expect(html).toBe('<div class="wh-roll-result"><div class="roll-header">Пусто</div></div>');
  });
});

describe("outcomeHtml", () => {
  it("успех и провал различаются классом, а не текстом", () => {
    expect(outcomeHtml(true, "Успех")).toBe('<span class="roll-success">Успех</span>');
    expect(outcomeHtml(false, "Провал")).toBe('<span class="roll-failure">Провал</span>');
  });
});

describe("postTestCard: не только карточки персонажа", () => {
  it("speaker переопределяется — системные уведомления говорит «Система»", async () => {
    resetCaptured();
    const { postTestCard } = await import("../../module/helpers/test-card.mjs");
    await postTestCard(null, { title: "Зона размещена" }, { speaker: { alias: "Система" }, sound: false });
    expect(captured.chat.at(-1).speaker).toEqual({ alias: "Система" });
  });

  it("whisper проставляется только когда задан", async () => {
    resetCaptured();
    const { postTestCard } = await import("../../module/helpers/test-card.mjs");
    await postTestCard(null, { title: "Личное" }, { whisper: ["u1"], sound: false });
    expect(captured.chat.at(-1).whisper).toEqual(["u1"]);
    await postTestCard(null, { title: "Общее" }, { sound: false });
    expect(captured.chat.at(-1)).not.toHaveProperty("whisper");
  });

  // Проверяется НЕ результат, а факт вызова: заглушка делает applyRollMode
  // тождественной, поэтому «whisper дошёл» было бы зелёным и тогда, когда
  // настоящий Foundry обнулил бы адресатов (ChatMessage.applyMode:
  // `if (mode === "public") whisper.length = 0;`) и записка ГМу ушла бы
  // всему столу.
  it("адресная карточка НЕ проходит через режим броска", async () => {
    resetCaptured();
    const { postTestCard } = await import("../../module/helpers/test-card.mjs");
    const real = ChatMessage.applyRollMode;
    let called = 0;
    ChatMessage.applyRollMode = (d, m) => { called += 1; return real(d, m); };
    try {
      await postTestCard(null, { title: "Личное" }, { whisper: ["u1"], sound: false });
      expect(called).toBe(0);
      await postTestCard(null, { title: "Общее" }, { sound: false });
      expect(called).toBe(1);
    } finally {
      ChatMessage.applyRollMode = real;
    }
  });
});

describe("classes: своя вёрстка подсистемы не теряется", () => {
  it("доп. классы встают рядом с wh-roll-result", () => {
    expect(testCardHtml({ title: "Отряд", classes: "sq-chat cmd-free-chat" }))
      .toContain('<div class="wh-roll-result sq-chat cmd-free-chat">');
  });

  it("без них корень остаётся прежним", () => {
    expect(testCardHtml({ title: "Обычная" })).toContain('<div class="wh-roll-result">');
  });
});

describe("prelude: блок перед шапкой", () => {
  it("встаёт выше заголовка — там живёт «Приём: …» и чип Орды", () => {
    const html = testCardHtml({ prelude: '<div class="roll-technique-block">Приём</div>', title: "Метнуть" });
    expect(html.indexOf("roll-technique-block")).toBeLessThan(html.indexOf("roll-header"));
  });

  it("пустая шапка не рисуется вовсе — иначе пустая полоса сверху", () => {
    expect(testCardHtml({ prelude: "<div>Только предисловие</div>" })).not.toContain("roll-header");
  });

  it("шапка с одной иконкой без заголовка рисуется", () => {
    expect(testCardHtml({ icon: "<i></i>" })).toContain("roll-header");
  });
});

// Храповик на класс исхода (wdbc-ncnp): провал Ритуала Осквернения был
// написан как roll-fail — такого класса в styles/ нет вовсе, и единственный
// провал во всей системе оставался неподсвеченным. Опечатка в имени класса
// не ловится ничем: разметка валидна, тест на текст проходит, а цвета нет.
describe("классы исхода не расходятся с вёрсткой", () => {
  it("во всём module/ нет класса roll-fail — только roll-failure", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const guilty = [];
    const walk = dir => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) { walk(path); continue; }
        if (!name.endsWith(".mjs")) continue;
        if (/class="[^"]*\broll-fail\b(?!ure)/.test(readFileSync(path, "utf8"))) guilty.push(path);
      }
    };
    walk("module");
    expect(guilty, "заменить на roll-failure — roll-fail в стилях не существует").toEqual([]);
  });
});
