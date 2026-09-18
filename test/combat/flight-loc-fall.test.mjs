// test/combat/flight-loc-fall.test.mjs
//
// «Потеря управления» (стр. 30) отдаёт ВЫСОТУ падения по таблице (высота
// полёта × тип движения предыдущего Хода), а сам урон считается обычной
// формулой Падения (1d10+высота, потолок терминальной скорости, Группирование)
// — раньше таблица трактовалась как готовый урон напрямую, без броска и без
// Группирования. wdbc-x1nz.2.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { showFlightDialog } from "../../module/combat/movement-actions.mjs";

function actor() {
  return {
    name: "Подставной",
    items: [{ type: "trait", name: "Flyer (2×A.b)", system: {} }],
    system: { characteristics: { ag: { total: 40 } }, movement: { altitude: "landed" } },
    update: async () => {},
    getActiveTokens: () => [{ elevation: 0, update: async function (d) { Object.assign(this, d); } }]
  };
}

beforeEach(resetCaptured);

/** Открывает Полёт → жмёт «Потеря управления» → возвращает диалог высоты падения. */
function openLocDialog(a, alt) {
  showFlightDialog(a);
  captured.dialog.buttons.loc.callback(fakeHtml({ "#fly-alt": alt }));
  return captured.dialog; // перезаписан _showFlightLocDialog
}

describe("Потеря управления → маршрутизация через обычное Падение (стр. 30)", () => {
  it("Низкая, Полное движение — высота 15, идёт бросок 1d10+15, не готовый «Урон: 15»", async () => {
    const a = actor();
    const locDialog = openLocDialog(a, "low");
    captured.dice = [4]; // 1d10 = 4, без Группирования
    await locDialog.buttons.ok.callback(fakeHtml({ "#loc-move": "full", "#loc-tuck": false }));

    const html = captured.chat.at(-1).content;
    expect(html).toContain("Высота <b>15</b>м");
    expect(html).toContain("1d10+15: <b>19</b>"); // 4 + 15
    expect(html).toContain("<b>19</b> I");
  });

  it("Группирование учитывается (успехов ≤ высоты — обычное вычитание)", async () => {
    const a = actor();
    const locDialog = openLocDialog(a, "low");
    captured.dice = [4, 35]; // 1d10=4; Acrobatics 35≤40 → 1 ст. успеха, высота 15 (не «больше»)
    await locDialog.buttons.ok.callback(fakeHtml({ "#loc-move": "full", "#loc-tuck": true }));

    const html = captured.chat.at(-1).content;
    expect(html).toContain("Группирование");
    expect(html).toContain("<b>18</b> I"); // 19 − 1
  });

  it("Приземная, Неподвижен — высота 0 (не 0 урона напрямую, но формула даёт 1d10+0)", async () => {
    const a = actor();
    const locDialog = openLocDialog(a, "ground");
    captured.dice = [6];
    await locDialog.buttons.ok.callback(fakeHtml({ "#loc-move": "none", "#loc-tuck": false }));

    const html = captured.chat.at(-1).content;
    expect(html).toContain("Высота <b>0</b>м");
    expect(html).toContain("<b>6</b> I");
  });

  it("Высокая — всегда высота 25 независимо от типа движения", async () => {
    const a = actor();
    const locDialog = openLocDialog(a, "high");
    captured.dice = [3];
    await locDialog.buttons.ok.callback(fakeHtml({ "#loc-move": "none", "#loc-tuck": false }));

    const html = captured.chat.at(-1).content;
    expect(html).toContain("Высота <b>25</b>м");
  });
});
