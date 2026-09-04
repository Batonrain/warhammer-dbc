// test/apps/surgeon-plan.test.mjs
//
// planBothSidesInstall() — план кнопки «⚭ Обе стороны» в Хирургеоне
// (module/apps/surgeon-plan.mjs, wdbc-7yeh). Чистая функция, никакого
// Foundry — намеренно НЕ импортирует ../support/foundry-stub.mjs, чтобы
// доказать: логика «кого установить на обе стороны» не завязана на игру,
// только на данные из select.

import { describe, it, expect } from "vitest";
import { planBothSidesInstall } from "../../module/apps/surgeon-plan.mjs";

describe("planBothSidesInstall", () => {
  it("lib: — создать ДВЕ новые копии, обе стороны новые", () => {
    const plan = planBothSidesInstall("lib", "Compendium.warhammer-dbc.implants.Item.xyz", []);
    expect(plan).toEqual({ installExisting: [], cloneSourceId: null, createFromLibCount: 2 });
  });

  it("own: одна неустановленная копия на акторе — вторую клонировать", () => {
    const owned = [{ id: "i1", name: "Bionic Leg (Repulsor)" }];
    const plan = planBothSidesInstall("own", "i1", owned);
    expect(plan).toEqual({ installExisting: ["i1"], cloneSourceId: "i1", createFromLibCount: 0 });
  });

  it("own: уже ДВЕ неустановленные копии того же протеза — обе просто доустановить, без клонирования", () => {
    const owned = [
      { id: "i1", name: "Bionic Leg (Repulsor)" },
      { id: "i2", name: "Bionic Leg (Repulsor)" },
    ];
    const plan = planBothSidesInstall("own", "i1", owned);
    expect(plan).toEqual({ installExisting: ["i1", "i2"], cloneSourceId: null, createFromLibCount: 0 });
  });

  it("own: вторая неустановленная копия — ДРУГОЕ имя, не подходит для клонирования по совпадению", () => {
    const owned = [
      { id: "i1", name: "Bionic Leg (Repulsor)" },
      { id: "i2", name: "Bionic Leg (Arachnid)" },
    ];
    const plan = planBothSidesInstall("own", "i1", owned);
    expect(plan).toEqual({ installExisting: ["i1"], cloneSourceId: "i1", createFromLibCount: 0 });
  });

  it("own: ref не найден среди ownedInSystem — план пуст (null), рассинхрон с select ничего не ломает", () => {
    expect(planBothSidesInstall("own", "missing", [{ id: "i1", name: "X" }])).toBeNull();
  });

  it("неизвестный src — null", () => {
    expect(planBothSidesInstall("weird", "ref", [])).toBeNull();
  });

  it("own: ownedInSystem по умолчанию пуст — не падает", () => {
    expect(planBothSidesInstall("own", "i1")).toBeNull();
  });
});
