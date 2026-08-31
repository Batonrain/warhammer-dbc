// test/sheets/disorders-fear-dialog.test.mjs
//
// Диалог теста Страха (wdbc-lfho): поле Infamy раньше открывалось с дефолтом
// 0, молча отключая авто-успех «Infamy ≥ X» у персонажа, у которого Очки
// Бесчестия реально накоплены — предзаполняем из актора, поле остаётся
// редактируемым руками.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { openFearDialog } from "../../module/sheets/tabs/disorders.mjs";

function makeActor({ fate = 0 } = {}) {
  return { type: "character", name: "Подставной", items: [],
    system: { characteristics: { wp: { total: 40 } }, fate: { value: fate } } };
}

beforeEach(resetCaptured);

describe("openFearDialog: поле Infamy предзаполнено из актора", () => {
  it("Infamy 0 по умолчанию у персонажа без Очков Бесчестия", () => {
    openFearDialog(makeActor({ fate: 0 }));
    expect(captured.dialog.content).toContain('id="fear-infamy" type="number" value="0"');
  });

  it("накопленные Очки Бесчестия подставляются, а не 0", () => {
    openFearDialog(makeActor({ fate: 3 }));
    expect(captured.dialog.content).toContain('id="fear-infamy" type="number" value="3"');
  });
});
