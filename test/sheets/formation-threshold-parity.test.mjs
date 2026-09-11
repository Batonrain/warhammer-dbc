// test/sheets/formation-threshold-parity.test.mjs
//
// wdbc-6ys: диалог приказа/ключевого события Формирования показывал Порог по
// формуле base+pen+mod (собственный расчёт диалога), а реальный бросок в
// _resolveOrder/_resolveKeyEvent катился против baseThreshold + ruleMods.total
// из _formationTestMods() — окно и карточка боевого лога могли показать РАЗНЫЕ
// числа (командир с Усталостью: в окне «Порог 45», в карточке «Порог 35»).
//
// Тест не пересчитывает саму механику модификаторов реестра (это дело
// module/rules/roll-mods.mjs и его собственных тестов) — collectTestMods
// подставлена фиксированной, чтобы здесь проверялось только одно: число,
// которое живой пересчёт диалога пишет в «Итоговый порог», должно СОВПАДАТЬ с
// числом, которое попадает в Порог карточки после «Бросок!».

import { describe, it, expect, beforeEach, vi } from "vitest";
import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";

// Фиксированный «Черты/Усталость» модификатор реестра — как будто у ролящего
// есть эффект, дающий -10 к любому тесту. Число подобрано так, чтобы старая
// (диалоговая) формула base+pen+mod и новая base+pen+mod+ruleMods.total давали
// заведомо разные числа — иначе регрессия осталась бы незамеченной.
// vi.mock хоистится над импортами, поэтому formation-sheet.mjs увидит уже
// подменённый module/rules/roll-mods.mjs.
vi.mock("../../module/rules/roll-mods.mjs", () => ({
  collectTestMods: () => ({
    total: -10,
    parts: ["Усталость -10"],
    list: [{ label: "Усталость", value: -10 }]
  })
}));

import { WarhammerFormationSheet } from "../../module/sheets/formation-sheet.mjs";

function formationActor(over = {}) {
  return {
    name: "217-й Кадийский", uuid: "Actor.fm1", isOwner: true, img: "fm.png",
    system: {
      posts: {}, attached: [], troopType: "infantry", size: "company",
      status: {}, order: {},
      derived: { skillValue: 33, penalty: -5 },
      ...over
    },
    update: async () => {}
  };
}

function sheetLike(actor, extra = {}) {
  return Object.assign(Object.create(WarhammerFormationSheet.prototype),
    { actor, isEditable: true, tabGroups: { primary: "unit" } }, extra);
}

/** Узел окна, стрингующий запись в textContent — как настоящий DOM. */
function textNode() {
  let text = "";
  return { get textContent() { return text; }, set textContent(v) { text = String(v); } };
}

/** Поле ввода, у которого рендер вешает addEventListener("input", ...). */
function inputNode(value) {
  return { value, addEventListener: () => {} };
}

/** Порог, напечатанный в карточке чата (строка «... → Порог <b>N</b>»). */
function thresholdInCard() {
  const m = (captured.chat.at(-1)?.content ?? "").match(/Порог <b>(-?\d+)<\/b>/);
  return m ? Number(m[1]) : null;
}

beforeEach(resetCaptured);

describe("wdbc-6ys: Порог в диалоге приказа = Порог в броске", () => {
  it("превью «Итоговый порог» и Порог из карточки — одно и то же число", async () => {
    const sheet = sheetLike(formationActor());
    const p = sheet._executeOrder("charge"); // test: {skill: intimidate, char: wp, mod: 0}, air: true

    // Живой пересчёт: база 33 (Выучка войск, командира нет) + Истощение -5 +
    // ручной модификатор 0 + модификатор реестра -10 (замоканный) = 18.
    const total = textNode();
    captured.rerender(fakeForm({
      "#fm-variant": inputNode("0"),
      "#fm-base": inputNode("33"),
      "#fm-mod": inputNode("0"),
      "#fm-total": total
    }));
    expect(total.textContent).toBe("18");

    // Старая формула (base+pen+mod без ruleMods) дала бы здесь 28 — заметно
    // другое число, чем показанное превью. Кнопка должна кидать ровно против
    // того, что показано.
    await captured.press("roll", fakeForm({ "#fm-base": "33", "#fm-mod": "0" }));
    await p;

    expect(thresholdInCard()).toBe(Number(total.textContent));
    expect(thresholdInCard()).toBe(18);
  });
});

describe("wdbc-6ys: Порог в диалоге ключевого события = Порог в броске", () => {
  it("превью «Итоговый порог» и Порог из карточки — одно и то же число", async () => {
    const sheet = sheetLike(formationActor());
    const p = sheet._keyEventRoll("voxWar"); // test: {skill: techUse, char: int, mod: -20}

    // База 33 (Выучка войск) + мод варианта -20 = 13; ключевые события не
    // знают Истощения. Итог: 13 + ручной 0 + реестр -10 = 3.
    const total = textNode();
    captured.rerender(fakeForm({
      "#fm-variant": inputNode("0"),
      "#fm-base": inputNode("13"),
      "#fm-mod": inputNode("0"),
      "#fm-total": total
    }));
    expect(total.textContent).toBe("3");

    await captured.press("roll", fakeForm({ "#fm-base": "13", "#fm-mod": "0" }));
    await p;

    expect(thresholdInCard()).toBe(Number(total.textContent));
    expect(thresholdInCard()).toBe(3);
  });
});
