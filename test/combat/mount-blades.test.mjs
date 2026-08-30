// test/combat/mount-blades.test.mjs
//
// wdbc-8nz6: Лезвия (X) / Blades (X) — раз в Ход (больше при высоком ранге
// Навыка управления), проезжая мимо врага, всадник свободным действием бьёт
// его Лезвиями скакуна/байка. DialogV2, тот же приём, что у Заноса/Седла
// (test/combat/mount-roll.test.mjs).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeForm } from "../support/foundry-stub.mjs";
import { showBladesDialog } from "../../module/combat/mount.mjs";

const trait = (name, rating = 0) => ({ type: "trait", name, system: { rating } });

const beast = ({ items = [], size = 1, spd = 8, wounds = 14 } = {}) => ({
  type: "character", uuid: "Actor.beast", items, name: "Скакун",
  system: {
    size, initiative: 3,
    movement: { halfMove: spd },
    wounds: { value: wounds, max: wounds, critical: 0 }
  }
});

function rider({ ag = 40, survival = "trained", bladesUsed = 0, items = [] } = {}) {
  const updates = [];
  return {
    type: "character", uuid: "Actor.rider", items, name: "Всадник",
    system: {
      size: 0, initiative: 5,
      characteristics: { ag: { total: ag } },
      skills: { survival: { rank: survival, total: 10 } },
      groupSkills: { operate: [] },
      mount: { uuid: "Actor.beast", role: "rider", speed: "half", bladesUsed }
    },
    getFlag: () => undefined, setFlag: async () => {},
    update: async data => { updates.push(data); },
    _updates: updates
  };
}

const realFromUuid = globalThis.fromUuid;
const resolveMountAs = doc => { globalThis.fromUuid = async () => doc; };
const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(resetCaptured);
afterEach(() => { globalThis.fromUuid = realFromUuid; });

describe("Лезвия (X): гейты до открытия диалога", () => {
  it("без Черты — предупреждение, диалог не открывается", async () => {
    resolveMountAs(beast());
    await showBladesDialog(rider());
    expect(captured.warnings.at(-1)).toContain("нет Черты Лезвия");
    expect(captured.dialog).toBeFalsy();
  });

  it("Навык ниже Тренированного — предупреждение про ранг", async () => {
    resolveMountAs(beast({ items: [trait("Blades / Лезвия (X)", 3)] }));
    await showBladesDialog(rider({ survival: "knows" }));
    expect(captured.warnings.at(-1)).toContain("Тренированное");
    expect(captured.dialog).toBeFalsy();
  });

  it("лимит на этот Ход исчерпан (Тренированное = 1 раз) — предупреждение", async () => {
    resolveMountAs(beast({ items: [trait("Blades / Лезвия (X)", 3)] }));
    await showBladesDialog(rider({ survival: "trained", bladesUsed: 1 }));
    expect(captured.warnings.at(-1)).toContain("уже использованы 1 из 1");
    expect(captured.dialog).toBeFalsy();
  });
});

describe("Лезвия (X): успешный тест", () => {
  it("Успех — карточка несёт профиль урона, кнопки Уклонения и Применения, счётчик растёт", async () => {
    resolveMountAs(beast({ items: [trait("Blades / Лезвия (X)", 5)] }));
    const r = rider({ ag: 40, survival: "trained", bladesUsed: 0 });
    const promise = showBladesDialog(r);
    await flush();
    expect(captured.dialog).toBeTruthy();
    expect(captured.dialog.content).toContain("test-kind");

    captured.nextRoll = 10; // Порог = 40(Survival untrained? нет — control.value) −10, гарантированный успех
    await captured.press("roll", fakeForm());
    await promise;

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Успех");
    expect(card).toContain("профиль <b>5</b> R");
    expect(card).toContain("wh-dodge-btn");
    expect(card).toContain('data-damage="5"');
    expect(card).toContain('data-damage-type="rending"');
    expect(r._updates.at(-1)).toEqual({ "system.mount.bladesUsed": 1 });
  });

  it("Провал — без кнопки применения урона, счётчик всё равно растёт (действие потрачено)", async () => {
    resolveMountAs(beast({ items: [trait("Blades / Лезвия (X)", 5)] }));
    const r = rider({ ag: 40, survival: "trained", bladesUsed: 0 });
    const promise = showBladesDialog(r);
    await flush();

    captured.nextRoll = 99; // гарантированный провал
    await captured.press("roll", fakeForm());
    await promise;

    const card = captured.chat.at(-1).content;
    expect(card).toContain("Провал");
    expect(card).not.toContain("wh-apply-dmg-btn");
    expect(r._updates.at(-1)).toEqual({ "system.mount.bladesUsed": 1 });
  });
});
