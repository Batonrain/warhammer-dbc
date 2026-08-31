// test/combat/vehicle-void-shield-repair.test.mjs
//
// wdbc-y33b: ремонт Пустотного Щита — ещё не схлопнувшийся: Tech-Use+20,
// схлопнувшийся: Tech-Use−10, оба варианта +2 Структуры щита за Успех (до 20).

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { showVoidShieldRepairDialog } from "../../module/combat/vehicle.mjs";

function vehicle(shields) {
  const updates = [];
  return {
    type: "vehicle", name: "Land Raider",
    system: { voidShields: shields },
    update: async data => { updates.push(data); },
    _updates: updates
  };
}

beforeEach(() => {
  resetCaptured();
  captured.dice = [10];
});

describe("Ремонт Пустотного Щита: гейт", () => {
  it("нет Щитов вовсе — предупреждение, диалог не открывается", async () => {
    await showVoidShieldRepairDialog(vehicle([]));
    expect(captured.warnings.at(-1)).toContain("нет Пустотных Щитов");
    expect(captured.dialog).toBeFalsy();
  });
});

describe("Ремонт Пустотного Щита: ещё не схлопнувшийся (Tech-Use+20, полудействие)", () => {
  it("Успех восстанавливает +2 за степень, порог = скилл+20", async () => {
    const v = vehicle([12, 20]);
    await showVoidShieldRepairDialog(v);
    expect(captured.dialog.content).toContain("ещё не схлопнувшийся");

    // skill 40, mod +20 → порог 60; rv=10 → deg=(60-10)/10+1=6 → +12, 12+12=20 (клип).
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#vsr-shield": "0", "#vsr-skill": "40", "#vsr-mod": "0" }));

    expect(v._updates).toEqual([{ "system.voidShields": [20, 20] }]);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("полудействие");
    expect(card).toContain("Успех");
  });
});

describe("Ремонт Пустотного Щита: схлопнувшийся (Tech-Use−10, полное действие)", () => {
  it("Порог = скилл−10, восстанавливает щит с 0", async () => {
    const v = vehicle([0]);
    await showVoidShieldRepairDialog(v);
    expect(captured.dialog.content).toContain("схлопнувшийся");

    // skill 50, mod −10 → порог 40; rv=10 → deg=(40-10)/10+1=4 → +8.
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#vsr-shield": "0", "#vsr-skill": "50", "#vsr-mod": "0" }));

    expect(v._updates).toEqual([{ "system.voidShields": [8] }]);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("полное действие");
  });

  it("Провал — щит не восстановлен, actor.update не вызывается", async () => {
    captured.dice = [99];
    const v = vehicle([0]);
    await showVoidShieldRepairDialog(v);
    await captured.dialog.buttons.roll.callback(fakeHtml({ "#vsr-shield": "0", "#vsr-skill": "20", "#vsr-mod": "0" }));

    expect(v._updates).toEqual([]);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Провал");
  });
});
