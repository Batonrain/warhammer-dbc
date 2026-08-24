// test/sheets/mutations.test.mjs
//
// Бросок Мутации / Дара Бога (корбук, стр. 440-460) — вторая подсистема,
// которую шаг 5.3 выносит из листа персонажа. Тест написан до выноса и на
// выносе не менялся, кроме точки вызова.
//
// Диалог больше не принимает ручной сдвиг: он сам перебирает диапазон
// ± Inf.b и показывает все достижимые записи таблицы списком — mutationPool()
// вынесена отдельно ровно ради этого расчёта и проверяется здесь без
// Foundry. Выбор из списка симулируется через скрытые поля #mg-pick-name /
// #mg-pick-god, которые в диалоге ставит клик по строке (см. mutations.mjs).
// Разметка диалога не проверяется — она смотрится руками в Foundry.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, sheetOf, fakeHtml } from "../support/foundry-stub.mjs";
import { rollMutationOrGift, mutationPool } from "../../module/sheets/tabs/mutations.mjs";

/** Еретик с Бонусом Влияния 3 и заданным покровителем. */
function mutant(patronGod = "khorne") {
  return sheetOf(class {}, { patronGod, characteristics: { inf: { bonus: 3 } } }).actor;
}

/** Нажать «Получить» в открытом диалоге с заданными полями. */
const submit = fields => captured.dialog.buttons.ok.callback(fakeHtml(fields));

describe("пул достижимых результатов (mutationPool)", () => {
  it("сдвиг ограничен Бонусом Влияния", () => {
    // Бросок 42, Inf.b 3 — достижимы записи под 39..45, но не под 38 или 46.
    const names = mutationPool("mutation", "", 42, null, 3, false).map(x => x.name);
    expect(names).toContain("Освежеванный");   // 45 = 42+3
    expect(names).not.toContain("Безголовый"); // 46 = 42+4, за пределами сдвига
  });

  it("Порча за Провал закрывает и сдвиг, и второй бросок Неделимого", () => {
    const pool = mutationPool("mutation", "", 42, 77, 3, true);
    expect(pool.map(x => x.name)).toEqual(["Иллюзия Нормальности"]); // ровно 41-42, без сдвига и без 77
  });

  it("покровитель Неделимый — достижимы записи под обоими бросками", () => {
    const names = mutationPool("mutation", "", 42, 77, 0, false).map(x => x.name);
    expect(names).toContain("Иллюзия Нормальности"); // 42
    expect(names).toContain("Рука Смерти");           // 77
  });

  it("Дар Бога берётся из таблицы покровителя, второй бросок не участвует", () => {
    const names = mutationPool("gift", "khorne", 42, 77, 3, false).map(x => x.name);
    expect(names).toContain("Ведьмоискатель"); // 45 = 42+3, диапазон Кхорна 44-47
  });
});

describe("бросок Мутации / Дара Бога", () => {
  beforeEach(() => resetCaptured());

  it("выбор строки из списка выдаёт именно её", async () => {
    captured.dice = [42];
    await rollMutationOrGift(mutant());
    await submit({ "#mg-type": "mutation", "#mg-pick-name": "Освежеванный" });

    expect(captured.created).toHaveLength(1);
    expect(captured.created[0].name).toBe("Освежеванный");
    expect(captured.created[0].type).toBe("mutation");
  });

  it("покровитель Неделимый бросает дважды, игрок выбирает бросок", async () => {
    captured.dice = [42, 77];
    await rollMutationOrGift(mutant("undivided"));
    await submit({ "#mg-type": "mutation", "#mg-pick-name": "Рука Смерти" });

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
    await submit({ "#mg-type": "gift", "#mg-god": "khorne", "#mg-pick-name": "Ведьмоискатель", "#mg-pick-god": "khorne" });

    expect(captured.created[0].name).toBe("Ведьмоискатель");
  });

  it("ничего не выбрано в списке — уходит бросок без сдвига", async () => {
    captured.dice = [42];
    await rollMutationOrGift(mutant());
    await submit({ "#mg-type": "mutation" });

    expect(captured.created[0].name).toBe("Иллюзия Нормальности"); // mutationByRoll(42), значение по умолчанию
  });

  it("мутация с субмутациями сразу бросает субмутацию и пишет её в предмет", async () => {
    // d100 = 3 → «Животный Гибрид» (таблица субмутаций), d10 = 4 → «Кошка».
    captured.dice = [3, 4];
    await rollMutationOrGift(mutant());
    const done = submit({ "#mg-type": "mutation", "#mg-pick-name": "Животный Гибрид" });

    // Окно субмутации открывается следом за выдачей мутации.
    await new Promise(resolve => setTimeout(resolve, 0));
    await captured.dialog.buttons.ok.callback(fakeHtml({ "#sm-shift": "0" }));
    await done;

    expect(captured.rolls).toEqual(["1d100", "1d10"]);
    expect(captured.updates).toContainEqual(expect.objectContaining({
      "system.submutation.name": "Кошка"
    }));
  });

  it("карточка в чат несёт оба броска и итог", async () => {
    captured.dice = [42];
    await rollMutationOrGift(mutant());
    await submit({ "#mg-type": "mutation", "#mg-pick-name": "Освежеванный" });

    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("Освежеванный");
    expect(captured.chat[0].content).toContain("42");
  });
});
