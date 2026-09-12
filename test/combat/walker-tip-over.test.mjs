// test/combat/walker-tip-over.test.mjs
//
// wdbc-6wzt, п.2 книжного правила Ходовой «Шагоход»: «Вместо сбивания с ног —
// Опрокидывается». Полный текст исхода — VEHICLE_STATUS_EFFECTS в
// constants/vehicle.mjs: «<Размер>d10 урона в приземлившуюся сторону (АР вдвое
// ниже, окр.▲). С уступа +1 урон за каждые ½ м. Экипаж T+0 или Оглушение на
// 1 Раунд. Встаёт за полное действие».
//
// До этой правки Опрокидывание было в системе только текстом справочника и
// четырёх Крит. Эффектов Ходовой — ни одной строки кода, которая бы его
// разыгрывала.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { resolveTipOver, standUpFromTipOver, showTipOverDialog } from "../../module/combat/walker.mjs";
import { TIP_OVER_LABEL } from "../../module/rules/walker.mjs";

function walkerVehicle({ size = 4, armour = { front: 30, side: 20, rear: 15 },
                         structure = { value: 30, max: 30, critical: 0 },
                         damageStates = [], chassis = "walker" } = {}) {
  const v = {
    type: "vehicle", name: "«Ярость Терры»", uuid: "Actor.walker", items: [],
    system: {
      chassis: { type: chassis, spd: 6 }, size, operate: 40, armour, structure,
      stations: [{ id: "s1", role: "pilot", uuid: "Actor.pilot", name: "Гвидо" }],
      damageStates, derived: {}
    },
    _updates: [],
    update: async data => {
      v._updates.push(data);
      // Применяем к системе, чтобы следующий шаг видел свежее состояние — как
      // делает настоящий Foundry (документ мутируется синхронно).
      for (const [path, value] of Object.entries(data)) {
        const keys = path.replace(/^system\./, "").split(".");
        let cur = v.system;
        for (const k of keys.slice(0, -1)) cur = (cur[k] ??= {});
        cur[keys.at(-1)] = value;
      }
    }
  };
  return v;
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.combat = undefined;
});

describe("resolveTipOver: урон падения", () => {
  it("бросает <Размер>d10 и режет АР приземлившейся стороны вдвое (окр. ▲)", async () => {
    const v = walkerVehicle({ size: 4, armour: { front: 30, side: 15, rear: 10 } });
    captured.nextRoll = 26;                        // 4d10 → 26

    await resolveTipOver(v, { side: "side" });

    expect(captured.rolls).toEqual(["4d10"]);
    const card = captured.chat.at(-1).content;
    // АР борта 15 → вдвое, окр. вверх = 8; 26 − 8 = 18 в Структуру.
    expect(card).toContain("вдвое <b>8</b>");
    expect(card).toContain("В Структуру: <b>18</b>");
    expect(v.system.structure.value).toBe(12);
  });

  it("падение с уступа добавляет +1 за каждые полметра", async () => {
    const v = walkerVehicle({ size: 4, armour: { front: 0, side: 0, rear: 0 } });
    captured.nextRoll = 10;

    await resolveTipOver(v, { side: "side", ledgeMetres: 3 });

    // 10 + 6 (3 м = шесть половин) = 16, брони нет.
    expect(captured.chat.at(-1).content).toContain("В Структуру: <b>16</b>");
  });

  it("толстая броня гасит падение целиком — Структура не трогается", async () => {
    const v = walkerVehicle({ size: 1, armour: { front: 40, side: 40, rear: 40 } });
    captured.nextRoll = 5;

    await resolveTipOver(v, { side: "front" });

    expect(captured.chat.at(-1).content).toContain("поглощён бронёй");
    expect(v.system.structure.value).toBe(30);
  });

  it("сторона падения выбирается — Лоб держит лучше Кормы", async () => {
    captured.nextRoll = 20;
    const front = walkerVehicle({ size: 2 });
    await resolveTipOver(front, { side: "front" });    // АР 30 → 15
    const rear = walkerVehicle({ size: 2 });
    captured.nextRoll = 20;
    await resolveTipOver(rear, { side: "rear" });      // АР 15 → 8

    expect(front.system.structure.value).toBe(25);     // 20 − 15 = 5
    expect(rear.system.structure.value).toBe(18);      // 20 − 8  = 12
  });
});

describe("resolveTipOver: состояние машины", () => {
  it("ставит состояние «Опрокидывание» книжным текстом и кнопку «Встать»", async () => {
    const v = walkerVehicle();
    captured.nextRoll = 10;

    await resolveTipOver(v, { side: "side" });

    const state = v.system.damageStates.at(-1);
    expect(state.label).toBe(TIP_OVER_LABEL);
    expect(state.note).toContain("Экипаж T+0");
    expect(captured.chat.at(-1).content).toContain("wh-walker-standup-btn");
    expect(captured.chat.at(-1).content).toContain('data-vehicle-uuid="Actor.walker"');
  });

  it("повторное Опрокидывание не задваивает состояние", async () => {
    const v = walkerVehicle();
    captured.nextRoll = 10;
    await resolveTipOver(v, { side: "side" });
    await resolveTipOver(v, { side: "side" });

    expect(v.system.damageStates.filter(s => s.label === TIP_OVER_LABEL)).toHaveLength(1);
  });

  it("напоминает про тест Стойкости экипажа поимённо", async () => {
    const v = walkerVehicle();
    captured.nextRoll = 10;
    await resolveTipOver(v, { side: "side" });
    expect(captured.chat.at(-1).content).toContain("тест T+0 или Оглушён");
    expect(captured.chat.at(-1).content).toContain("Гвидо");
  });
});

describe("showTipOverDialog: кому этот исход вообще положен", () => {
  it("Шагоходу — окно с формулой урона по его Размеру", async () => {
    await showTipOverDialog(walkerVehicle({ size: 5 }));
    expect(captured.dialog.content).toContain("5d10");
    expect(captured.dialog.content).toContain("вдвое ниже");
  });

  it("прочей технике — отказ: её толчок сбивает по общим правилам", async () => {
    await showTipOverDialog(walkerVehicle({ chassis: "tracked" }));
    expect(captured.dialog).toBe(null);
    expect(captured.warnings.at(-1)).toContain("Шагоход");
  });
});

describe("standUpFromTipOver", () => {
  it("снимает состояние и говорит цену подъёма", async () => {
    const v = walkerVehicle({ damageStates: [{ id: "x", label: TIP_OVER_LABEL, note: "" }] });

    await standUpFromTipOver(v);

    expect(v.system.damageStates).toEqual([]);
    expect(captured.chat.at(-1).content).toContain("поднимается на ноги");
    expect(captured.chat.at(-1).content).toContain("Leap Up");
  });

  it("не Опрокинута — ничего не пишет в актора", async () => {
    const v = walkerVehicle();
    await standUpFromTipOver(v);
    expect(v._updates).toEqual([]);
    expect(captured.chat).toEqual([]);
  });

  it("прочие состояния при подъёме не теряются", async () => {
    const v = walkerVehicle({ damageStates: [
      { id: "f", label: "Пожар", note: "" },
      { id: "x", label: TIP_OVER_LABEL, note: "" }
    ] });

    await standUpFromTipOver(v);

    expect(v.system.damageStates.map(s => s.label)).toEqual(["Пожар"]);
  });
});
