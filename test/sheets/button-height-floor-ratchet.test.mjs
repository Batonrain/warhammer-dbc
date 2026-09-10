// test/sheets/button-height-floor-ratchet.test.mjs
//
// ХРАПОВИК ПОЛА ВЫСОТЫ КНОПКИ (wdbc-5zgq).
//
// Ядро Foundry держит для <button> пол `min-height: var(--button-size)` ≈ 28px
// (styles/base/common.css). Любая заданная нами высота НИЖЕ 28px без явного
// `min-height: 0` не применяется вовсе: кнопка рисуется 28px и раздвигает
// строку. Внешне это выглядит как «кнопка чуть крупнее задуманного», ничего
// не ломает и потому живёт годами — ровно так и накопилось полсотни случаев.
//
// ПОЧЕМУ ХРАПОВИК, А НЕ ПОЧИНКА ОПТОМ. Снять пол разом (`button { min-height:
// 0 }`) — значит поменять высоту полусотни кнопок на всех листах сразу,
// вслепую: часть из них выглядит нормально ИМЕННО из-за пола и после снятия
// станет вдвое ниже задуманного. Правильный порядок — пройти листами и на
// каждом посмотреть глазами, а этот тест держит фронт: новых случаев не
// прибавляется, старые уходят по мере прохода.
//
// Приём взят у test/sheets/horde-hbtn-specificity.test.mjs — там тем же
// статическим способом закрыт один лист Орды. Здесь то же самое по всем
// styles/**/*.css сразу.

import { describe, it, expect } from "vitest";
import { findFloorOffenders, buttonClasses, BUTTON_FLOOR_PX }
  from "../../tools/button-height-floor.mjs";

/**
 * Текущий долг. Двигать ТОЛЬКО вниз и только вместе с реальной правкой CSS,
 * проверенной глазами на своём листе: `min-height: 0` не «чинит» кнопку, а
 * даёт ей ту высоту, которую автор задал, — и эту высоту надо увидеть.
 */
const DEBT = 47;

describe("маленькие кнопки листа не должны упираться в пол ядра", () => {
  it("замер вообще работает — иначе тест зелен от пустоты", () => {
    const { classes } = buttonClasses();
    expect(classes.size).toBeGreaterThan(100);
    expect(BUTTON_FLOOR_PX).toBe(28);
  });

  it("число кнопок, чья высота не применяется, не растёт", () => {
    const offenders = findFloorOffenders();
    const list = offenders.map(o => `  ${o.height}px  ${o.selector}  (${o.file})`).join("\n");
    expect(offenders.length, `упираются в пол ядра:\n${list}`).toBeLessThanOrEqual(DEBT);
  });

  it("уже пройденные листы назад не откатываются", () => {
    // Именные случаи, починенные раньше (wdbc-gwpu): весь лист Орды одним
    // общим правилом и три кнопки «Развития». Если они вернутся в список,
    // общее число может остаться прежним за счёт чужой починки — и откат
    // проедет молча.
    const offenders = findFloorOffenders().map(o => o.selector).join("\n");
    for (const cls of ["horde-roll-btn", "horde-char-roll", "adv-cat",
                       "adv-cost-reset", "advtal-cost-reset"]) {
      expect(offenders, `${cls} снова упирается в пол`).not.toContain(cls);
    }
  });
});
