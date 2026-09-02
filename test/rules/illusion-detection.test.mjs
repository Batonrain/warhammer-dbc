// test/rules/illusion-detection.test.mjs
//
// module/rules/illusion-detection.mjs (wdbc-zbc0) — чистая формула бонуса
// теста Психонауки и билдеры составных ключей флагов «заметил»/«потратил
// попытку увидеть сквозь», переиспользуемые apps/illusion-of-normality.mjs.

import { describe, it, expect } from "vitest";
import { psyniscienceNoticeBonus, noticeFlagKey, seeThroughFlagKey }
  from "../../module/rules/illusion-detection.mjs";

describe("psyniscienceNoticeBonus", () => {
  it("нет прочих мутаций — бонуса нет", () => {
    expect(psyniscienceNoticeBonus(0)).toBe(0);
  });

  it("+5 за КАЖДУЮ прочую мутацию", () => {
    expect(psyniscienceNoticeBonus(1)).toBe(5);
    expect(psyniscienceNoticeBonus(4)).toBe(20);
  });

  it("отрицательное/нечисловое значение — не уходит в минус", () => {
    expect(psyniscienceNoticeBonus(-3)).toBe(0);
    expect(psyniscienceNoticeBonus(undefined)).toBe(0);
    expect(psyniscienceNoticeBonus(NaN)).toBe(0);
  });
});

describe("noticeFlagKey / seeThroughFlagKey", () => {
  it("составляют разные ключи для одной пары наблюдатель↔мутант", () => {
    const notice = noticeFlagKey("mutation.illusionOfNormality", "actor-1");
    const seeThrough = seeThroughFlagKey("mutation.illusionOfNormality", "actor-1");
    expect(notice).not.toBe(seeThrough);
  });

  it("ключ зависит от id мутанта — разные цели не делят состояние", () => {
    const a = noticeFlagKey("mutation.illusionOfNormality", "actor-1");
    const b = noticeFlagKey("mutation.illusionOfNormality", "actor-2");
    expect(a).not.toBe(b);
  });

  it("ключ зависит от capabilityKey — второй потребитель (Icon of Blasphemy) не пересечётся", () => {
    const a = noticeFlagKey("mutation.illusionOfNormality", "actor-1");
    const b = noticeFlagKey("mutation.iconOfBlasphemy", "actor-1");
    expect(a).not.toBe(b);
  });
});
