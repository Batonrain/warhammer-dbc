// test/apps/scene-controls-guard.test.mjs
//
// Панель инструментов без открытой сцены (wdbc-3w94). Ядро Foundry молча
// глотает клик по ВСЕЙ панели, пока canvas.ready === false — это его защита
// (client/applications/ui/scene-controls.mjs:580 и :594, обе обработчика
// начинаются с `if ( !canvas.ready ) return;`). Наш guard эту тишину
// озвучивает и одну кнопку — «Doom BC» — проводит в обход.
//
// Настоящего DOM в стенде нет, поэтому проверяется таблица решений
// sceneControlsClickAction, в которой и живёт всё правило; разводка событий
// вокруг неё (capture-слушатель, класс на панели) остаётся на живую проверку.

import "../support/foundry-stub.mjs";
import { describe, it, expect } from "vitest";
import { sceneControlsClickAction } from "../../module/apps/scene-controls-guard.mjs";

describe("sceneControlsClickAction — клик по панели инструментов", () => {
  it("канвас открыт — не вмешиваемся ни в свою кнопку, ни в чужие", () => {
    expect(sceneControlsClickAction(true, "tokens", true)).toBe("pass");
    expect(sceneControlsClickAction(true, "wh-hub", true)).toBe("pass");
    expect(sceneControlsClickAction(true, "walls", false)).toBe("pass");
  });

  it("канваса нет, кнопка ядра — предупредить вслух, а не молчать", () => {
    for (const c of ["tokens", "walls", "lighting", "measure", undefined])
      expect(sceneControlsClickAction(false, c, true)).toBe("warn");
  });

  it("канваса нет, наша кнопка — открыть меню Doom BC в обход панели", () => {
    expect(sceneControlsClickAction(false, "wh-hub", true)).toBe("hub");
  });

  it("меню ещё не зарегистрировано — тоже предупреждение, а не тишина", () => {
    // getSceneControlButtons мог не успеть отработать (или упасть); молчащая
    // кнопка — ровно тот симптом, из-за которого тикет и завели.
    expect(sceneControlsClickAction(false, "wh-hub", false)).toBe("warn");
  });
});
