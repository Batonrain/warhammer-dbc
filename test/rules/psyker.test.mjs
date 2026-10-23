import { describe, it, expect } from "vitest";
import { psyRatingFromTalents, wasPsykerBefore, tzeentchMarkBindUpdate } from "../../module/rules/psyker.mjs";

const talent = (name, rating) => ({ type: "talent", name, system: { rating } });

describe("psyRatingFromTalents", () => {
  it("null без Таланта — NPC/бестиарий держат ручное значение", () => {
    expect(psyRatingFromTalents([])).toBeNull();
    expect(psyRatingFromTalents([{ type: "trait", name: "Psy Rating / Пси-Рейтинг", system: { rating: 5 } }]))
      .toBeNull();
  });

  it("новая модель — один предмет с Рейтингом", () => {
    expect(psyRatingFromTalents([talent("Psy Rating / Пси-Рейтинг", 3)])).toBe(3);
  });

  it("старая модель — несколько предметов без Рейтинга, каждый +1", () => {
    expect(psyRatingFromTalents([
      talent("Psy Rating / Пси-Рейтинг", 0),
      talent("Psy Rating / Пси-Рейтинг", 0),
      talent("Psy Rating / Пси-Рейтинг", 0)
    ])).toBe(3);
  });

  it("смешанная модель — старые копии и новый рейтинг складываются", () => {
    expect(psyRatingFromTalents([
      talent("Psy Rating / Пси-Рейтинг", 0),
      talent("Psy Rating / Пси-Рейтинг", 2)
    ])).toBe(3);
  });

  it("не путает с другими Талантами", () => {
    expect(psyRatingFromTalents([talent("Sure Strike / Точный удар", 1)])).toBeNull();
  });
});

// ── Метка Тзинча: «связанный, если персонаж не был псайкером до этого» (task-0469-bc1b) ──
// Метка выдаёт Трейт Psyker сама, поэтому «был ли псайкером» считается только
// по предметам НЕ от этой Метки (flags.warhammer-dbc.grantedByItem).

const MARK = { id: "mark1", name: "Mark of Tzeentch / Метка Тзинча", type: "trait" };
const psykerTrait = (id = "t1", grantedByItem) => ({
  id, type: "trait", name: "Psyker / Псайкер",
  flags: grantedByItem ? { "warhammer-dbc": { grantedByItem } } : {}
});
const actorOf = ({ isPsyker = false, cls = "unbound", items = [], psyker = true } = {}) => ({
  system: { isPsyker, ...(psyker ? { psyker: { class: cls } } : {}) },
  items
});

describe("wasPsykerBefore — псайкер до этой Метки", () => {
  it("пустой актор — не был", () => {
    expect(wasPsykerBefore(actorOf(), MARK)).toBe(false);
  });

  it("стоит «Пси-Пробуждение» (system.isPsyker) — был", () => {
    expect(wasPsykerBefore(actorOf({ isPsyker: true }), MARK)).toBe(true);
  });

  it("Трейт Psyker из другого источника — был", () => {
    expect(wasPsykerBefore(actorOf({ items: [psykerTrait("t1")] }), MARK)).toBe(true);
    // выдан другим предметом (например Расой), а не Меткой
    expect(wasPsykerBefore(actorOf({ items: [psykerTrait("t1", "race9")] }), MARK)).toBe(true);
  });

  it("Трейт Psyker, выданный самой Меткой, — не считается", () => {
    expect(wasPsykerBefore(actorOf({ items: [psykerTrait("t1", MARK.id)] }), MARK)).toBe(false);
  });

  it("Трейт Psyker и от Метки, и от другого источника — был", () => {
    expect(wasPsykerBefore(actorOf({ items: [psykerTrait("t1", MARK.id), psykerTrait("t2")] }), MARK)).toBe(true);
  });

  it("другие предметы с похожим именем и Таланты — не считаются", () => {
    const items = [
      { id: "x1", type: "trait", name: "Chaos Psyker / Псайкер Хаоса" },
      { id: "x2", type: "talent", name: "Psyker / Псайкер" },
      { id: "x3", type: "trait", name: "Unnatural Willpower (+2)" }
    ];
    expect(wasPsykerBefore(actorOf({ items }), MARK)).toBe(false);
  });
});

describe("tzeentchMarkBindUpdate — Связанным становится только новый псайкер", () => {
  it("не был псайкером и класс не «bound» — ставит «bound»", () => {
    expect(tzeentchMarkBindUpdate(actorOf({ cls: "unbound", items: [psykerTrait("t1", MARK.id)] }), MARK))
      .toEqual({ "system.psyker.class": "bound" });
  });

  it("не был псайкером, класс уже «bound» — писать нечего (null)", () => {
    expect(tzeentchMarkBindUpdate(actorOf({ cls: "bound" }), MARK)).toBeNull();
  });

  it("уже был псайкером (флаг) — класс не трогаем: Несвязанный остаётся Несвязанным", () => {
    expect(tzeentchMarkBindUpdate(actorOf({ isPsyker: true, cls: "unbound" }), MARK)).toBeNull();
  });

  it("уже был псайкером (Трейт из другого источника) — класс не трогаем", () => {
    expect(tzeentchMarkBindUpdate(actorOf({ cls: "unbound", items: [psykerTrait("t1")] }), MARK)).toBeNull();
  });

  it("у актора нет блока psyker (не существо-псайкер по схеме) — null", () => {
    expect(tzeentchMarkBindUpdate(actorOf({ psyker: false }), MARK)).toBeNull();
  });
});
