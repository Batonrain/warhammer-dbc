// test/combat/march-track-bonus.test.mjs
//
// showMarchDialog должен ставить/снимать флаг marchTrackBonus на самом
// марширующем/бегущем акторе — его читает НАБЛЮДАТЕЛЬ через ctx.targetActor
// (rules/situational.mjs::marchTrackBonus). wdbc-x1nz.2, стр. 29.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { showMarchDialog } from "../../module/combat/movement-actions.mjs";

function jq(value) {
  return { find: () => ({ val: () => value }) };
}

function actor() {
  const flags = {};
  return {
    id: "a1", name: "Гвардеец", items: [],
    system: { characteristics: { t: { total: 40 } }, fatigue: { value: 0, max: 0 } },
    getFlag: (_s, k) => flags[k],
    setFlag: async (_s, k, v) => { flags[k] = v; return v; },
    unsetFlag: async (_s, k) => { delete flags[k]; },
    update: async () => {}
  };
}

beforeEach(resetCaptured);

describe("showMarchDialog — marchTrackBonus (стр. 29)", () => {
  it("Ускоренный марш: клик «Тест часа» ставит marchTrackBonus 10", async () => {
    const a = actor();
    showMarchDialog(a, "accelerated");
    await captured.dialog.buttons.test.callback(jq(40));
    expect(a.getFlag("warhammer-dbc", "marchTrackBonus")).toBe(10);
  });

  it("Бег: marchTrackBonus 30", async () => {
    const a = actor();
    showMarchDialog(a, "run");
    await captured.dialog.buttons.test.callback(jq(40));
    expect(a.getFlag("warhammer-dbc", "marchTrackBonus")).toBe(30);
  });

  it("«Закончить марш» снимает marchTrackBonus", async () => {
    const a = actor();
    showMarchDialog(a, "accelerated");
    await captured.dialog.buttons.test.callback(jq(40));
    expect(a.getFlag("warhammer-dbc", "marchTrackBonus")).toBe(10);

    showMarchDialog(a, "accelerated");
    await captured.dialog.buttons.stop.callback();
    expect(a.getFlag("warhammer-dbc", "marchTrackBonus")).toBeUndefined();
  });
});
