// test/sheets/attack-dialog-profile-kind.test.mjs
//
// СТОРОЖ: список Профилей в окне атаки не предлагает профиль ДРУГОГО вида
// (wdbc-bs0q, блокер ревью 06.09.2026).
//
// Вид теста — рукопашная это атака или стрельба — фиксируется на входе в окно
// (attack-dialog.mjs: isMelee и charKey объявлены const, от них зависит около
// восьмидесяти мест расчёта). Бросок же пересчитывает вид ЗАНОВО, по
// выбранному профилю (combat/attack.mjs::_executeAttackRoll). Пока список
// профилей показывал оба вида сразу, игрок мог открыть окно выстрела и ткнуть
// в нём «Ударить оружием»: окно считало порог по BS, а бросок ту же атаку —
// рукопашной. Одно действие, два разных правила.
//
// Проверяется через НАСТОЯЩЕЕ открытие окна, а не через buildSelection: дыра
// была именно в том, что попадает в разметку, и тест на внутренней функции
// пережил бы зелёным возврат старой разметки.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { showAttackDialog } from "../../module/sheets/attack-dialog.mjs";

/** Разметка открытого окна — то, что видит игрок. */
const content = () => captured.dialog?.content ?? "";

// Блок «Профиль» — единственное место разметки с именем радиогруппы
// "atk-profile", поэтому его наличие проверяется прямо по этой строке.

function shooter(items = []) {
  const a = actorFor({ items, fatigue: { value: 0 }, aiming: "none" });
  a.update = async () => {};
  return a;
}

describe("список Профилей не смешивает рукопашное со стрельбой (wdbc-bs0q)", () => {
  beforeEach(() => resetCaptured());

  it("окно ВЫСТРЕЛА из надетой винтовки не предлагает «Ударить оружием»", async () => {
    const gun = weaponFor({ weaponClass: "basic", equipped: true }, { name: "Лазган" });
    showAttackDialog(shooter([gun]), gun, {});
    expect(content()).not.toContain("Ударить оружием");
  });

  it("…и блока «Профиль» у такой винтовки нет вовсе — выбирать не из чего", async () => {
    // До правки выводимый рукопашный профиль давал вторую опцию, и блок
    // появлялся у КАЖДОГО надетого ствола. Это и была видимая часть дыры.
    const gun = weaponFor({ weaponClass: "basic", equipped: true }, { name: "Лазган" });
    showAttackDialog(shooter([gun]), gun, {});
    expect(content()).not.toContain("atk-profile");
  });

  it("окно УДАРА В УПОР не предлагает вернуться к стрелковому «Основному»", async () => {
    // Зеркальный случай: из рукопашного окна нельзя переключиться в стрельбу,
    // иначе окно посчитает по WS, а бросок уедет в стрелковую ветку.
    const gun = weaponFor({ weaponClass: "basic", equipped: true }, { name: "Лазган" });
    showAttackDialog(shooter([gun]), gun, { forceMelee: true, profileIdx: 0 });
    expect(content()).not.toContain("atk-profile");
  });

  it("у рукопашного оружия свои профили остались на месте — регресс", async () => {
    const blade = weaponFor({
      weaponClass: "melee", damage: "1d10+2",
      profiles: [{ label: "Обратный хват", damage: "1d10+1", melee: true }]
    }, { name: "Меч" });
    showAttackDialog(shooter([blade]), blade, {});
    expect(content()).toContain("atk-profile");
    expect(content()).toContain("Обратный хват");
  });

  it("у стрелкового свои СТРЕЛКОВЫЕ профили остались на месте — регресс", async () => {
    // Фильтр отсекает по виду, а не по признаку «выводимый»: авторский профиль
    // стрельбы обязан остаться в окне выстрела.
    const gun = weaponFor({
      weaponClass: "basic", equipped: true,
      profiles: [{ label: "Перегрузка", damage: "2d10" }]
    }, { name: "Лазган" });
    showAttackDialog(shooter([gun]), gun, {});
    expect(content()).toContain("Перегрузка");
    expect(content()).not.toContain("Ударить оружием");
  });
});
