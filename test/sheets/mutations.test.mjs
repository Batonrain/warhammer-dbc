// test/sheets/mutations.test.mjs
//
// Бросок Мутации / Дара Бога (корбук, стр. 440-460) — вторая подсистема,
// которую шаг 5.3 выносит из листа персонажа. Тест написан до выноса и на
// выносе не менялся, кроме точки вызова.
//
// Проверяется то, что решает результат: какой бросок берётся, как ограничен
// сдвиг Бонусом Влияния и какая запись таблицы в итоге ложится на лист.
// Разметка диалога не проверяется — она смотрится руками в Foundry.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, sheetOf, fakeHtml } from "../support/foundry-stub.mjs";
import { rollMutationOrGift } from "../../module/sheets/tabs/mutations.mjs";

/** Еретик с Бонусом Влияния 3 и заданным покровителем. */
function mutant(patronGod = "khorne") {
  return sheetOf(class {}, { patronGod, characteristics: { inf: { bonus: 3 } } }).actor;
}

/** Нажать «Получить» в открытом диалоге с заданными полями. */
const submit = fields => captured.dialog.buttons.ok.callback(fakeHtml(fields));

describe("бросок Мутации / Дара Бога", () => {
  beforeEach(() => resetCaptured());

  it("сдвиг ограничен Бонусом Влияния", async () => {
    captured.dice = [42];
    await rollMutationOrGift(mutant());
    // Просим +5 при Inf.b 3 — сдвиг обрежется до +3, итог 45, а не 47.
    await submit({ "#mg-type": "mutation", "#mg-shift": "5" });

    expect(captured.created).toHaveLength(1);
    expect(captured.created[0].name).toBe("Освежеванный");
    expect(captured.created[0].type).toBe("mutation");
  });

  it("покровитель Неделимый бросает дважды, игрок выбирает бросок", async () => {
    captured.dice = [42, 77];
    await rollMutationOrGift(mutant("undivided"));
    await submit({ "#mg-type": "mutation", "#mg-shift": "0", "#mg-which": "2" });

    expect(captured.created[0].name).toBe("Рука Смерти");
  });

  it("у прочих покровителей бросок один", async () => {
    captured.dice = [42];
    await rollMutationOrGift(mutant("nurgle"));

    expect(captured.rolls).toEqual(["1d100"]);
  });

  it("Дар Бога берётся из таблицы покровителя", async () => {
    captured.dice = [42];
    await rollMutationOrGift(mutant());
    await submit({ "#mg-type": "gift", "#mg-god": "khorne", "#mg-shift": "3" });

    expect(captured.created[0].name).toBe("Ведьмоискатель");
  });

  it("Порча за Провал закрывает сдвиг", async () => {
    captured.dice = [42];
    await rollMutationOrGift(mutant());
    // Сдвиг +3 при отмеченном «от Порчи за Провал» не применяется: 42, а не 45.
    await submit({ "#mg-type": "mutation", "#mg-shift": "3", "#mg-fail": true });

    expect(captured.created[0].name).toBe("Иллюзия Нормальности");
  });

  it("мутация с субмутациями сразу бросает субмутацию и пишет её в предмет", async () => {
    // d100 = 3 → «Животный Гибрид» (таблица субмутаций), d10 = 4 → «Кошка».
    captured.dice = [3, 4];
    await rollMutationOrGift(mutant());
    const done = submit({ "#mg-type": "mutation", "#mg-shift": "0" });

    // Окно субмутации открывается следом за выдачей мутации.
    await new Promise(resolve => setTimeout(resolve, 0));
    await captured.dialog.buttons.ok.callback(fakeHtml({ "#sm-shift": "0" }));
    await done;

    expect(captured.rolls).toEqual(["1d100", "1d10"]);
    expect(captured.updates).toContainEqual(expect.objectContaining({
      "system.submutation.name": "Кошка"
    }));
  });

  it("карточка в чат несёт бросок, сдвиг и итог", async () => {
    captured.dice = [42];
    await rollMutationOrGift(mutant());
    await submit({ "#mg-type": "mutation", "#mg-shift": "3" });

    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("Освежеванный");
    expect(captured.chat[0].content).toContain("+3");
  });
});
