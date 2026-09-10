// test/apps/mutation-scope-vs-book.test.mjs
//
// Область бонуса в записи Конструктора не должна быть ШИРЕ книжной строки.
//
// Заведён при приёме второй партии PR #462 (10.09.2026). Там три записи давали
// бонус шире, чем говорит книга, и одна выдавала Черту, которой в книге у
// персонажа нет вовсе:
//   • Центавр, субмутация 6 — Черта Unnatural S (4) целиком на актора, тогда
//     как книга усиливает только ХВОСТ и только в Захвате/Борьбе. Черта несёт
//     ActiveEffect `s.bonusFx += 4`, то есть постоянный +4 к Бонусу Силы: +4
//     урона любым ударом и вчетверо больший переносимый вес.
//   • Центавр, субмутация 6 — +10 на ВЕСЬ Навык Athletics (книга: только
//     тесты Athletics «для Захвата и приёмов Борьбы»).
//   • Крылья, субмутация 4-5 — +20 на ВЕСЬ Athletics (книга: только тесты
//     Карабканья; для них в системе есть отдельная область "climbing").
//   • Замена Крови, субмутация 6 — +20 на ВСЕ социальные тесты (книга: только
//     против тех, «что вдыхают его запах»).
//
// Общее у всех четырёх: лист молча накидывает бонус там, где книга его не
// даёт, а игрок видит число и считает, что так и надо.

import { describe, it, expect } from "vitest";
import { packDocById } from "../support/pack-doc.mjs";

const MUT = "packs-src/mutations/Общие_мутации";
const entriesOf = doc =>
  (doc.flags["warhammer-dbc"].mechanics ?? []).flatMap(g => g.entries ?? []);

describe("Центавр: хвост усилен только в Борьбе — Конструктор этого не выражает", () => {
  const entries = entriesOf(packDocById(MUT, "y8tSRrNuEXuD3KcP"));

  it("Черта Сверхъест. Сила всему персонажу НЕ выдаётся", () => {
    const grants = entries.filter(e => e.kind === "trait" && /Unnatural S/i.test(e.sourceName ?? ""));
    expect(grants).toEqual([]);
  });

  it("нет записи, дающей бонус на весь Навык Athletics", () => {
    const wide = entries.filter(e =>
      e.kind === "testMod" && e.modScope === "skill" && e.skillKey === "athletics");
    expect(wide).toEqual([]);
  });

  it("несмоделированное названо в notes, а не молча пропущено", () => {
    const notes = packDocById(MUT, "y8tSRrNuEXuD3KcP").system.notes ?? "";
    expect(notes).toContain("Unnatural S");
    expect(notes).toMatch(/Захват|Борьб/);
  });
});

describe("Крылья: Карабканье — своя область, не весь Навык", () => {
  const doc = packDocById(MUT, "PSfNZryIyip09eYj");
  const entries = entriesOf(doc);

  it("бонус Карабканья заведён областью «climbing»", () => {
    const climb = entries.find(e => e.id === "wings-45-climbing");
    expect(climb.modScope).toBe("climbing");
    expect(climb.skillKey).toBe("");
    expect(Number(climb.value)).toBe(20);
  });

  // Приём «вторая запись с отрицательным рейтингом» на Летуне не работает:
  // Конструктор дедуплицирует только Таланты, две записи kind:"trait" на один
  // UUID кладут ДВЕ отдельные Черты, а рейтинг Летуна вообще никем не
  // считается — actorCanFly проверяет только наличие Черты по имени.
  it("дельта-Черта Летуна не выдаётся — на листе не будет второго «Летуна»", () => {
    const flyers = entries.filter(e => e.kind === "trait" && /Flyer|Летун/i.test(e.sourceName ?? ""));
    expect(flyers.length).toBeLessThanOrEqual(1);
    for (const f of flyers) expect(String(f.rating)).not.toMatch(/^-/);
  });

  it("несмоделированное уменьшение названо в notes", () => {
    expect(doc.system.notes ?? "").toMatch(/Крылья Мухи|Flyer/);
  });
});

describe("Замена Крови: запах — условие, которого Конструктор не выражает", () => {
  const doc = packDocById(MUT, "WkKMDdEdcnrcPaKB");

  it("бонус на ВСЕ социальные тесты не выдаётся", () => {
    const wide = entriesOf(doc).filter(e => e.kind === "testMod" && e.modScope === "social");
    expect(wide).toEqual([]);
  });

  it("причина названа в notes", () => {
    expect(doc.system.notes ?? "").toMatch(/запах/i);
  });
});
