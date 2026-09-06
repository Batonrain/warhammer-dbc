// test/combat/movement-terrain.test.mjs
//
// wdbc-r5o7.4: Ослеплён считает «весь незнакомый ландшафт Трудным +0» (тест
// нужен даже вне настоящей зоны) и получает «−20 против настоящего Трудного
// Ландшафта» (доп. штраф ТОЛЬКО когда токен и так уже в зоне). Проверяется
// через showDifficultTerrainDialog — effectiveTerrainInfo не экспортирована.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { showDifficultTerrainDialog } from "../../module/combat/movement-terrain.mjs";
import { DIFFICULT_TERRAIN_TYPE } from "../../module/regions/difficult-terrain.mjs";

function actorFor(overrides = {}) {
  return {
    name: "Подставной",
    items: [],
    system: { characteristics: { ag: { total: 35 } }, ...overrides },
    getActiveTokens: () => []
  };
}

/** Токен без регионов вовсе — «чистая земля». */
function cleanTokenDoc() {
  return { regions: null };
}

/** Токен в настоящей зоне Трудного Ландшафта (−10, метка «Грязь»). */
function terrainTokenDoc(mod = -10, label = "Грязь") {
  return {
    regions: new Set([{
      behaviors: [{
        type: DIFFICULT_TERRAIN_TYPE, disabled: false,
        system: { extraMod: 0, activeProps: [{ key: "mud", mod, label }] }
      }]
    }])
  };
}

beforeEach(resetCaptured);

async function rollTerrain(agVal = 35, mod = "0") {
  await captured.dialog.buttons.roll.callback(fakeHtml({ "#tr-ag": agVal, "#tr-mod": mod }));
}

describe("Ослеплён — Трудный Ландшафт вне настоящей зоны (wdbc-r5o7.4)", () => {
  it("чистая земля, не Ослеплён — диалог не нужен (кнопка не появилась бы), но сам вызов не падает при mod 0", async () => {
    const actor = actorFor();
    await showDifficultTerrainDialog(actor, cleanTokenDoc());
    expect(captured.dialog.content).toContain("+0");
    expect(captured.dialog.content).not.toContain("Ослеплён");
  });

  it("Ослеплён на чистой земле — тест A+0, без доп. штрафа, метка «Ослеплён» без числа", async () => {
    const actor = actorFor({ conditions: { blinded: true } });
    await showDifficultTerrainDialog(actor, cleanTokenDoc());

    expect(captured.dialog.content).toContain("+0");
    expect(captured.dialog.content).toContain("Ослеплён");
    expect(captured.dialog.content).not.toContain("Ослеплён (−20)");
    // Подсказка не врёт про «SPD уже уменьшена зоной» — зоны физически нет.
    expect(captured.dialog.content).toContain("даже когда сама зона не размечена");
  });

  it("Ослеплён В настоящем Трудном Ландшафте — доп. −20 поверх штрафа зоны", async () => {
    const actor = actorFor({ conditions: { blinded: true } });
    await showDifficultTerrainDialog(actor, terrainTokenDoc(-10, "Грязь"));

    // −10 (зона) + −20 (Ослеплён против настоящего Трудного Ландшафта) = −30
    expect(captured.dialog.content).toContain("-30");
    expect(captured.dialog.content).toContain("Ослеплён (−20)");
    expect(captured.dialog.content).toContain("Грязь");
    expect(captured.dialog.content).toContain("SPD уже уменьшена вдвое зоной");
  });

  it("не Ослеплён, настоящая зона — штраф только от зоны, без Ослепления", async () => {
    const actor = actorFor();
    await showDifficultTerrainDialog(actor, terrainTokenDoc(-10, "Грязь"));

    expect(captured.dialog.content).toContain("-10");
    expect(captured.dialog.content).not.toContain("Ослеплён");
  });

  it("Потеря ОБОИХ глаз — тот же эффект, что явный blinded (производное, wdbc-r5o7.4)", async () => {
    const actor = actorFor({ conditions: { lostEyesCount: 2 } });
    await showDifficultTerrainDialog(actor, cleanTokenDoc());
    expect(captured.dialog.content).toContain("Ослеплён");
  });

  it("Потеря ОДНОГО глаза — не считается Ослеплением для ландшафта", async () => {
    const actor = actorFor({ conditions: { lostEyesCount: 1 } });
    await showDifficultTerrainDialog(actor, cleanTokenDoc());
    expect(captured.dialog.content).not.toContain("Ослеплён");
  });

  it("реальный тест: Ослеплён на чистой земле, порог Ag+0 доходит до карточки чата", async () => {
    const actor = actorFor({ conditions: { blinded: true } });
    await showDifficultTerrainDialog(actor, cleanTokenDoc());
    await rollTerrain(35, "0");

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Порог: <b>35</b>");
  });

  it("реальный тест: Ослеплён в настоящей зоне — порог падает на 30 (10 зона + 20 Ослепление)", async () => {
    const actor = actorFor({ conditions: { blinded: true } });
    await showDifficultTerrainDialog(actor, terrainTokenDoc(-10, "Грязь"));
    await rollTerrain(35, "0");

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Порог: <b>5</b>"); // 35 − 30
  });
});
