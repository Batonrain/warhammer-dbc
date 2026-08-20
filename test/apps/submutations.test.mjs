// test/apps/submutations.test.mjs
//
// Бросок субмутации (корбук, стр. 440) и запись результата в предмет-мутацию.
// Проверяется то, что решает результат: что записалось в мутацию, как ограничен
// сдвиг ⅓Inf.b, что делает выбор строки своего Бога и таблица без бросков.
// Разметка окна не проверяется — она смотрится руками в Foundry.

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeHtml, stubDocument } from "../support/foundry-stub.mjs";
import { rollSubmutation, submutationContext, pickSubmutation,
         clearSubmutation } from "../../module/apps/submutations.mjs";
import { MUTATION_LIBRARY } from "../../module/constants/mutations.mjs";

/** Предмет-мутация с таблицей субмутаций из библиотеки книги. */
function mutationItem(name = "Животный Гибрид") {
  const lib = MUTATION_LIBRARY.find(i => i.name === name);
  return stubDocument({ name, type: "mutation", system: structuredClone(lib.system) });
}

/** Владелец: Бонус Влияния и покровитель. */
const owner = (infBonus = 6, patronGod = "") =>
  ({ name: "Еретик", system: { patronGod, characteristics: { inf: { bonus: infBonus } } } });

/**
 * Нажать кнопку открытого окна. Окно открывается ПОСЛЕ броска, поэтому сперва
 * даём отработать очереди задач — иначе окна ещё нет.
 */
async function press(action, fields = {}) {
  await new Promise(resolve => setTimeout(resolve, 0));
  return captured.dialog.buttons[action].callback(fakeHtml(fields));
}

/** Значение, записанное в мутацию. */
const written = (item) => item.system.submutation;

describe("бросок субмутации", () => {
  beforeEach(() => resetCaptured());

  it("записывает выпавшую строку в мутацию", async () => {
    captured.dice = [4];
    const item = mutationItem();
    const done = rollSubmutation(item, { actor: owner(0) });
    await press("ok", { "#sm-shift": "0" });
    await done;

    expect(captured.rolls).toEqual(["1d10"]);
    expect(written(item)).toMatchObject({ name: "Кошка", label: "4", roll: 4, shift: 0, total: 4 });
  });

  it("сдвиг ограничен ⅓Inf.b (окр.▼)", async () => {
    captured.dice = [4];
    const item = mutationItem();
    // Inf.b 6 → предел сдвига 2. Просим +5, ждём +2: 4 → 6, «Змея».
    const done = rollSubmutation(item, { actor: owner(6) });
    await press("ok", { "#sm-shift": "5" });
    await done;

    expect(written(item)).toMatchObject({ name: "Змея", shift: 2, total: 6 });
  });

  it("мутация от Порчи за Провал сдвига не даёт", async () => {
    captured.dice = [4];
    const item = mutationItem();
    const done = rollSubmutation(item, { actor: owner(9), fromFailure: true });
    await press("ok", { "#sm-shift": "3", "#sm-fail": true });
    await done;

    expect(written(item)).toMatchObject({ name: "Кошка", shift: 0, total: 4 });
  });

  it("Неделимый бросает дважды и выбирает бросок", async () => {
    captured.dice = [4, 9];
    const item = mutationItem();
    const done = rollSubmutation(item, { actor: owner(0, "undivided") });
    await press("ok", { "#sm-which": "2", "#sm-shift": "0" });
    await done;

    expect(captured.rolls).toEqual(["1d10", "1d10"]);
    expect(written(item)).toMatchObject({ name: "Птица", roll: 9 });
  });

  it("у прочих покровителей бросок один", async () => {
    captured.dice = [4];
    const item = mutationItem();
    const done = rollSubmutation(item, { actor: owner(0, "khorne") });
    await press("ok", { "#sm-shift": "0" });
    await done;

    expect(captured.rolls).toEqual(["1d10"]);
  });

  it("строку своего Бога можно взять вместо выпавшей", async () => {
    captured.dice = [4];
    const item = mutationItem();
    const done = rollSubmutation(item, { actor: owner(0, "khorne") });
    await press("ok", { "#sm-mine": true });
    await done;

    // Взята без броска: «Бык» — строка Кхорна, бросок в запись не идёт.
    expect(written(item)).toMatchObject({ name: "Бык", god: "khorne", roll: 0, total: 0 });
  });

  it("таблица без бросков определяется покровителем без окна", async () => {
    const item = mutationItem("Стальное Сердце");
    await rollSubmutation(item, { actor: owner(0, "nurgle") });

    expect(captured.rolls).toEqual([]);
    expect(captured.dialog).toBeNull();
    expect(written(item)).toMatchObject({ name: "Нургл", god: "nurgle" });
  });

  it("та же таблица без покровителя спрашивает ГМа", async () => {
    const item = mutationItem("Стальное Сердце");
    const done = rollSubmutation(item, { actor: owner(0) });
    await press("ok", { "#sm-pick": "Кхорн" });
    await done;

    expect(written(item)).toMatchObject({ name: "Кхорн", god: "khorne" });
  });

  it("карточка в чат несёт бросок и строку", async () => {
    captured.dice = [8];
    const item = mutationItem();
    const done = rollSubmutation(item, { actor: owner(0) });
    await press("ok", { "#sm-shift": "0" });
    await done;

    expect(captured.chat).toHaveLength(1);
    expect(captured.chat[0].content).toContain("Бык");
    expect(captured.chat[0].content).toContain("Животный Гибрид");
  });

  it("мутация без таблицы предупреждает, а не бросает", async () => {
    const item = stubDocument({ name: "Циклоп", type: "mutation", system: { benefit: "Один глаз." } });
    await rollSubmutation(item, { actor: owner(0) });

    expect(captured.rolls).toEqual([]);
    expect(captured.warnings.join(" ")).toContain("Циклоп");
  });
});

describe("субмутация на листе мутации", () => {
  beforeEach(() => resetCaptured());

  it("выбор строки вручную и её снятие", async () => {
    const item = mutationItem();
    await pickSubmutation(item, "3");
    expect(written(item)).toMatchObject({ name: "Крыса", label: "3", roll: 0 });

    await clearSubmutation(item);
    expect(written(item).name).toBe("");
  });

  it("контекст листа перечисляет строки и помечает закрытые", () => {
    const item = mutationItem();
    item.actor = owner(6, "slaanesh");
    const ctx = submutationContext(item);

    expect(ctx.rollable).toBe(true);
    expect(ctx.shiftLimit).toBe(2);
    expect(ctx.entries).toHaveLength(10);
    // «Бык» (8) — строка Кхорна, извечного соперника Слаанеш: закрыта.
    // «Змея» (6) — Нургл, Слаанеш ему не соперник: открыта, хоть и чужая.
    expect(ctx.entries.find(e => e.key === "8").blocked).toBe(true);
    expect(ctx.entries.find(e => e.key === "6").blocked).toBe(false);
  });

  it("у мутации без таблицы блока нет", () => {
    const item = stubDocument({ name: "Циклоп", type: "mutation", system: { benefit: "Один глаз." } });
    expect(submutationContext(item)).toBeNull();
  });
});
