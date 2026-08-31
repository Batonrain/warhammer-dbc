// test/combat/movement-actions-fatigue.test.mjs
//
// Карабканье/Прыжок/Плавание (wdbc-lfho): пороги брали Athletics/Acrobatics
// и «Доп. мод», но не Усталость — игрок должен был вычислить и вписать её
// сам. Тест дороги, которой штраф теперь доезжает до порога сам и виден в
// карточке результата.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { _resolveClimb, _resolveJump, _resolveSwim } from "../../module/combat/movement-actions.mjs";

function makeActor({ fatigue = 0 } = {}) {
  return { name: "Подставной", items: [], system: { fatigue: { value: fatigue, max: 0 } } };
}

beforeEach(resetCaptured);

describe("_resolveClimb: Усталость в пороге (Athletics — S)", () => {
  it("не уставший — порог без штрафа", async () => {
    await _resolveClimb(makeActor({ fatigue: 0 }), "simple", 40, 30, 0, 8);
    expect(captured.chat.at(-1).content).toContain("Порог <b>40</b>");
  });

  it("уставший — порог падает на 10 и это видно", async () => {
    await _resolveClimb(makeActor({ fatigue: 1 }), "simple", 40, 30, 0, 8);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Порог <b>30</b>");
    expect(html).toContain("😓 Усталость");
  });

  it("отвесный склон: штраф Усталости приложен к ОБОИМ порогам (Athletics и Acrobatics)", async () => {
    await _resolveClimb(makeActor({ fatigue: 1 }), "sheer", 40, 30, 0, 8);
    const html = captured.chat.at(-1).content;
    // Athletics−10(30) −10 факт.Усталости = 20; Acrobatics 30 −10 = 20.
    expect(html).toContain("Athletics−10 <b>20</b>");
    expect(html).toContain("Acrobatics <b>20</b>");
  });
});

describe("_resolveJump: Усталость в пороге (Acrobatics — Ag)", () => {
  it("уставший — штраф применён и виден", async () => {
    await _resolveJump(makeActor({ fatigue: 1 }), "hplace", 40, 0, 0, 4);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Порог <b>30</b>");
    expect(html).toContain("😓 Усталость");
  });
});

describe("_resolveSwim: Усталость в пороге (Athletics — S)", () => {
  it("уставший — штраф применён и виден (не кумулятивный тест)", async () => {
    await _resolveSwim(makeActor({ fatigue: 1 }), 40, false, false, 0, 6);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Порог <b>30</b>");
    expect(html).toContain("😓 Усталость");
  });

  it("складывается со штрафом тяжёлого снаряжения", async () => {
    await _resolveSwim(makeActor({ fatigue: 1 }), 40, true, false, 0, 6);
    const html = captured.chat.at(-1).content;
    expect(html).toContain("Порог <b>0</b>"); // 40 − 30 (тяж.) − 10 (Усталость)
  });
});
