// test/combat/vehicle-disembark.test.mjs
//
// wdbc-y33b: Выгрузка пассажиров. Обычно — полудействие без движения.
// Боковые Двери: полное действие + Бег. Штурмовая Рампа: полное действие +
// Бег ИЛИ Натиск.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { showDisembarkDialog } from "../../module/combat/vehicle.mjs";

function vehicle(traitFlags, stations) {
  const updates = [];
  return {
    type: "vehicle", name: "Chimera",
    system: { stations, derived: { traitFlags } },
    update: async data => { updates.push(data); },
    _updates: updates
  };
}

const passenger = (id, name) => ({ id, role: "passenger", uuid: `Actor.${id}`, name, img: "" });

beforeEach(resetCaptured);

describe("Выгрузка: гейт", () => {
  it("нет пассажиров на местах — предупреждение, диалог не открывается", async () => {
    await showDisembarkDialog(vehicle({}, [{ id: "s1", role: "passenger", uuid: "", name: "" }]));
    expect(captured.warnings.at(-1)).toContain("никого нет");
    expect(captured.dialog).toBeFalsy();
  });
});

describe("Выгрузка: без подходящей Черты", () => {
  it("полудействие без движения", async () => {
    const v = vehicle({}, [passenger("s1", "Иванов")]);
    await showDisembarkDialog(v);
    expect(captured.dialog.content).toContain("нет подходящей Черты");
    expect(captured.dialog.content).not.toContain("dis-mode");

    await captured.dialog.buttons.go.callback(fakeHtml({ "#dis-station": "s1" }));

    expect(v._updates[0]["system.stations"]).toEqual([
      expect.objectContaining({ id: "s1", uuid: "", name: "" })
    ]);
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Полудействие: Выгрузка без движения");
  });
});

describe("Выгрузка: Боковые Двери", () => {
  it("полное действие + Бег", async () => {
    const v = vehicle({ sideHatches: true }, [passenger("s1", "Петров")]);
    await showDisembarkDialog(v);
    expect(captured.dialog.content).toContain("Боковые Двери");

    await captured.dialog.buttons.go.callback(fakeHtml({ "#dis-station": "s1" }));
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Полное действие: Выгрузка + Бег.");
  });
});

describe("Выгрузка: Штурмовая Рампа", () => {
  it("предлагает выбор Бег/Натиск, Натиск отражается в карточке", async () => {
    const v = vehicle({ assaultRamp: true }, [passenger("s1", "Сидоров")]);
    await showDisembarkDialog(v);
    expect(captured.dialog.content).toContain("dis-mode");

    await captured.dialog.buttons.go.callback(fakeHtml({ "#dis-station": "s1", "#dis-mode": "charge" }));
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Выгрузка + Натиск из рампы");
  });

  it("Рампа при выборе Бега — тоже полное действие", async () => {
    const v = vehicle({ assaultRamp: true }, [passenger("s1", "Сидоров")]);
    await showDisembarkDialog(v);
    await captured.dialog.buttons.go.callback(fakeHtml({ "#dis-station": "s1", "#dis-mode": "run" }));
    const card = captured.chat.at(-1).content;
    expect(card).toContain("Выгрузка + Бег из рампы");
  });
});
