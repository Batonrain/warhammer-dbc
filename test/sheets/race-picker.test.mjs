// test/sheets/race-picker.test.mjs
//
// Пикер расы (module/sheets/race-picker.mjs): содержимое DialogV2 строится
// синхронно ДО первого await (см. advance-tab.test.mjs, тот же приём) —
// поэтому вызов без await и синхронная проверка captured.dialog.content
// достаточны, ре-рендер самого диалога тестам не нужен.
//
// Раунд правок 1 (wdbc-n1k), находка 1: пикер потерял фильтр отключённых
// подсистем, который был у старого <select> (context.raceGroups). Правило
// то же, что в character-context.mjs: раса выключенной подсистемы («Книга
// Эльдар») из выбора убирается, кроме уже стоящей у актора.

import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { openRacePicker } from "../../module/sheets/race-picker.mjs";

/** Подсистема выключена в настройках игры — на время одной проверки. */
function withFeatureOff(key, fn) {
  const real = game.settings.get;
  game.settings.get = (_ns, k) => (k === key ? false : undefined);
  try { return fn(); } finally { game.settings.get = real; }
}

describe("openRacePicker: фильтр отключённых подсистем", () => {
  it("выключенная «Книга Эльдар» убирает свои расы из выбора", () => {
    withFeatureOff("aeldariBook", () => {
      resetCaptured();
      openRacePicker({ system: { race: "human" } });
      expect(captured.dialog.content).not.toContain('data-key="azuriane"');
    });
  });

  it("но не убирает расу, уже стоящую у актора — выключатель обратим", () => {
    withFeatureOff("aeldariBook", () => {
      resetCaptured();
      openRacePicker({ system: { race: "azuriane" } });
      expect(captured.dialog.content).toContain('data-key="azuriane"');
    });
  });

  it("включённая подсистема — раса на общих основаниях", () => {
    resetCaptured();
    openRacePicker({ system: { race: "human" } });
    expect(captured.dialog.content).toContain('data-key="azuriane"');
  });
});
