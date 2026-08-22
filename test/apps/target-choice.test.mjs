// test/apps/target-choice.test.mjs
//
// Пикер цели Таланта (Hatred/Peer/Good Reputation) для строк выбора Родного
// мира и Предсказания (choices[].type "target") — раньше игрок вписывал
// текст, и targetMatches() (rules/talent-targets.mjs) ничего не находил по
// произвольной строке: талант формально есть, но никогда не срабатывает.
// Проверяем сборку структурной цели из вида+значения — то, что реально
// уходит в system.targets созданного Таланта.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import { buildTarget, raceValueOptions, featureValueOptions, patronValueOptions, targetChoiceLabel }
  from "../../module/apps/target-choice.mjs";
import { PATRON_ANY, TARGET_FEATURES } from "../../module/rules/talent-targets.mjs";

describe("target-choice: сборка цели вид+значение", () => {
  it("«Все!» не требует значения", () => {
    const t = buildTarget("all", "");
    expect(t.kind).toBe("all");
  });

  it("раса собирается по ключу с подписью из каталога", () => {
    const opts = raceValueOptions();
    const human = opts.find(o => o.key === "human");
    expect(human).toBeTruthy();
    const t = buildTarget("race", "human");
    expect(t.kind).toBe("race");
    expect(t.value).toBe("human");
    expect(t.name).toBe(human.label);
  });

  it("субраса — та же цель-раса (одно поле сравнения targetMatches)", () => {
    const t = buildTarget("race", "pariah");
    expect(t.kind).toBe("race");
    expect(t.value).toBe("pariah");
  });

  it("признак собирается только по известному ключу каталога", () => {
    const known = Object.keys(TARGET_FEATURES)[0];
    const t = buildTarget("feature", known);
    expect(t.kind).toBe("feature");
    expect(t.value).toBe(known);
    // Незнакомый ключ целью не становится (featureTarget возвращает null).
    expect(buildTarget("feature", "не-существует")).toBeNull();
  });

  it("покровитель включает «любой» первым пунктом", () => {
    const opts = patronValueOptions();
    expect(opts[0].key).toBe(PATRON_ANY);
    const t = buildTarget("patron", "khorne");
    expect(t.kind).toBe("patron");
    expect(t.value).toBe("khorne");
  });

  it("неизвестный вид (напр. «фракция» — она приходит документом, не отсюда) даёт null", () => {
    expect(buildTarget("faction", "whatever")).toBeNull();
  });

  it("targetChoiceLabel — пустая строка для null, иначе подпись цели", () => {
    expect(targetChoiceLabel(null)).toBe("");
    expect(targetChoiceLabel(buildTarget("all", ""))).toBeTruthy();
  });
});
