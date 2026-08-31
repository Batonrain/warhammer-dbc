import { describe, it, expect, beforeEach } from "vitest";
import { captured, fakeHtml, resetCaptured } from "../support/foundry-stub.mjs";
import { painChange, openPainSoulBurnDialog, absorbPainDamage } from "../../module/sheets/tabs/pain.mjs";

function makeActor(options = {}) {
  const updates = [];
  const actor = {
    name: "Подставной",
    updates,
    system: {
      fate: { value: options.pain ?? 0, max: options.painMax ?? 0 },
      wounds: {
        value: options.wounds ?? 0,
        max: options.woundsMax ?? 10,
        critical: options.critical ?? 0,
        firstAidUsed: options.firstAidUsed ?? true
      }
    },
    update: async data => {
      updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const parts = path.split(".");
        let target = actor;
        for (const part of parts.slice(0, -1)) {
          target[part] ??= {};
          target = target[part];
        }
        target[parts.at(-1)] = value;
      }
      return data;
    }
  };
  return actor;
}

beforeEach(resetCaptured);

describe("pain points", () => {
  it("painChange увеличивает Боль в пределах максимума и пишет сообщение", async () => {
    const actor = makeActor({ pain: 1, painMax: 3 });
    await painChange(actor, +1, "absorb");

    expect(actor.updates[0]).toEqual({ "system.fate.value": 2 });
    expect(captured.chat[0].content).toContain("Текущая Боль: <b>2</b> / 3");
  });

  it("openPainSoulBurnDialog сжигает Боль и остаток урона пишет в Раны", async () => {
    const actor = makeActor({ pain: 2, painMax: 4, wounds: 3, critical: 0 });
    openPainSoulBurnDialog(actor);

    await captured.dialog.buttons.go.callback(fakeHtml({ "#pain-sb-dmg": "8" }));

    expect(actor.updates[0]).toMatchObject({
      "system.fate.value": 0,
      "system.wounds.value": 1,
      "system.wounds.critical": 0,
      "system.wounds.firstAidUsed": false
    });
    expect(captured.chat[0].content).toContain("Выжжено Боли: <b>2</b>");
    expect(captured.chat[0].content).toContain("В Раны: <b>2</b>");
  });

  it("openPainSoulBurnDialog переносит переполнение урона в критические раны", async () => {
    const actor = makeActor({ pain: 0, painMax: 4, wounds: 1, critical: 2 });
    openPainSoulBurnDialog(actor);

    await captured.dialog.buttons.go.callback(fakeHtml({ "#pain-sb-dmg": "4" }));

    expect(actor.updates[0]).toMatchObject({
      "system.fate.value": 0,
      "system.wounds.value": 0,
      "system.wounds.critical": 5,
      "system.wounds.firstAidUsed": false
    });
  });

  it("absorbPainDamage: та же арифметика по прямому вызову кнопки из карточки (wdbc-7as8)", async () => {
    const actor = makeActor({ pain: 2, painMax: 4, wounds: 3, critical: 0 });
    await absorbPainDamage(actor, 8);

    expect(actor.updates[0]).toMatchObject({
      "system.fate.value": 0,
      "system.wounds.value": 1
    });
    expect(captured.chat[0].content).toContain("Выжжено Боли: <b>2</b>");
  });

  it("openPainSoulBurnDialog принимает число из карточки как значение по умолчанию", async () => {
    const actor = makeActor({ pain: 2, painMax: 4 });
    openPainSoulBurnDialog(actor, 6);

    expect(captured.dialog.content).toContain('value="6"');
  });
});
