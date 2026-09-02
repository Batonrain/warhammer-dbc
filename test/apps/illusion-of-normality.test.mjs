// test/apps/illusion-of-normality.test.mjs
//
// Мутация «Иллюзия Нормальности» (wdbc-zbc0): обнаружение активной иллюзии
// тестом Психонауки (+5 за каждую прочую мутацию мутанта) наблюдателем из
// текущего Foundry-таргета (game.user.targets), и последующая попытка
// наблюдателя, уже заметившего иллюзию, увидеть сквозь неё тестом W+0 —
// не более одной попытки за бой/сцену НА КОНКРЕТНОГО мутанта. Реальные
// module/rules/cooldown.mjs и module/rules/illusion-detection.mjs
// используются как есть — мокаются только актор/предметы/game.user.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import {
  isIllusionOfNormalityItem, illusionOfNormalityHtml,
  attemptNoticeIllusion, attemptSeeThroughIllusion,
  isIllusionMaintained, setIllusionMaintained
} from "../../module/apps/illusion-of-normality.mjs";
import { isRuleUsageUsed, markRuleUsageUsed } from "../../module/rules/cooldown.mjs";
import { noticeFlagKey, seeThroughFlagKey } from "../../module/rules/illusion-detection.mjs";

const CAPABILITY_KEY = "mutation.illusionOfNormality";

function actorWithFlags({ id, name = "Актор", items = [], skills = {}, characteristics = {} } = {}) {
  const store = {};
  return {
    id, name, items,
    system: { skills, characteristics },
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; }
  };
}

function mutationItem({ id, name = "Мутация" } = {}) {
  const store = {};
  return {
    id, type: "mutation", name,
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; }
  };
}
const illusionItem = (id = "illusion-1") =>
  mutationItem({ id, name: "Illusion of Normality / Иллюзия Нормальности" });

function setTarget(actor) { globalThis.game.user.targets = actor ? [{ actor }] : []; }

beforeEach(() => {
  resetCaptured();
  globalThis.game.user = { targets: [] };
});

describe("isIllusionOfNormalityItem", () => {
  it("совпадает по двуязычному имени и типу", () => {
    expect(isIllusionOfNormalityItem(illusionItem())).toBe(true);
  });
  it("другой тип предмета — false", () => {
    expect(isIllusionOfNormalityItem({ type: "trait", name: "Illusion of Normality / Иллюзия Нормальности" })).toBe(false);
  });
  it("другая Мутация — false", () => {
    expect(isIllusionOfNormalityItem(mutationItem({ name: "Boneless / Бескостный" }))).toBe(false);
  });
});

describe("attemptNoticeIllusion", () => {
  it("нет выбранной Foundry-цели — предупреждает, не бросает и не пишет флаг", async () => {
    const item = illusionItem();
    const mutant = actorWithFlags({ id: "mutant-1", items: [item] });
    await attemptNoticeIllusion(item, mutant);
    expect(captured.warnings.length).toBe(1);
    expect(captured.chat).toEqual([]);
  });

  it("бонус +5 за каждую ПРОЧУЮ мутацию мутанта (сама Иллюзия не считается) — успех отмечает наблюдателя", async () => {
    const item = illusionItem();
    // 2 прочие мутации → бонус +10.
    const mutant = actorWithFlags({
      id: "mutant-1",
      items: [item, mutationItem({ id: "m2" }), mutationItem({ id: "m3" })]
    });
    const observer = actorWithFlags({ id: "observer-1", skills: { psyniscience: { total: 30 } } });
    setTarget(observer);
    captured.nextRoll = 40; // порог 30+10=40, бросок 40 — успех (rv <= threshold)

    await attemptNoticeIllusion(item, mutant);

    expect(captured.chat.length).toBe(1);
    expect(isRuleUsageUsed(observer, noticeFlagKey(CAPABILITY_KEY, mutant.id))).toBe(true);
  });

  it("провал теста — карточка уходит, но наблюдатель НЕ помечен заметившим", async () => {
    const item = illusionItem();
    const mutant = actorWithFlags({ id: "mutant-1", items: [item] }); // 0 прочих мутаций → бонус 0
    const observer = actorWithFlags({ id: "observer-1", skills: { psyniscience: { total: 30 } } });
    setTarget(observer);
    captured.nextRoll = 31; // порог 30, бросок 31 — провал

    await attemptNoticeIllusion(item, mutant);

    expect(captured.chat.length).toBe(1);
    expect(isRuleUsageUsed(observer, noticeFlagKey(CAPABILITY_KEY, mutant.id))).toBe(false);
  });

  it("состояние пишется на АКТОРА НАБЛЮДАТЕЛЯ, а не мутанта", async () => {
    const item = illusionItem();
    const mutant = actorWithFlags({ id: "mutant-1", items: [item] });
    const observer = actorWithFlags({ id: "observer-1", skills: { psyniscience: { total: 30 } } });
    setTarget(observer);
    captured.nextRoll = 1;

    await attemptNoticeIllusion(item, mutant);

    expect(isRuleUsageUsed(mutant, noticeFlagKey(CAPABILITY_KEY, mutant.id))).toBe(false);
  });
});

describe("attemptSeeThroughIllusion", () => {
  it("наблюдатель ещё не заметил иллюзию — предупреждает, не бросает", async () => {
    const item = illusionItem();
    const mutant = actorWithFlags({ id: "mutant-1", items: [item] });
    const observer = actorWithFlags({ id: "observer-1" });
    setTarget(observer);

    await attemptSeeThroughIllusion(item, mutant);

    expect(captured.warnings.length).toBe(1);
    expect(captured.chat).toEqual([]);
  });

  it("заметивший наблюдатель — тестирует W+0, попытка расходуется даже при провале", async () => {
    const item = illusionItem();
    const mutant = actorWithFlags({ id: "mutant-1", items: [item] });
    const observer = actorWithFlags({ id: "observer-1", characteristics: { wp: { total: 40 } } });
    await markRuleUsageUsed(observer, noticeFlagKey(CAPABILITY_KEY, mutant.id));
    setTarget(observer);
    captured.nextRoll = 90; // выше WP 40 — провал

    await attemptSeeThroughIllusion(item, mutant);

    expect(captured.chat.length).toBe(1);
    expect(isRuleUsageUsed(observer, seeThroughFlagKey(CAPABILITY_KEY, mutant.id))).toBe(true);
  });

  it("попытка уже потрачена в этом бою/сцене на этого мутанта — предупреждает, второй раз не бросает", async () => {
    const item = illusionItem();
    const mutant = actorWithFlags({ id: "mutant-1", items: [item] });
    const observer = actorWithFlags({ id: "observer-1", characteristics: { wp: { total: 40 } } });
    await markRuleUsageUsed(observer, noticeFlagKey(CAPABILITY_KEY, mutant.id));
    await markRuleUsageUsed(observer, seeThroughFlagKey(CAPABILITY_KEY, mutant.id));
    setTarget(observer);

    await attemptSeeThroughIllusion(item, mutant);

    expect(captured.warnings.length).toBe(1);
    expect(captured.chat).toEqual([]);
  });

  it("лимит — НА КОНКРЕТНОГО мутанта: попытка против одного не блокирует попытку против другого", async () => {
    const item = illusionItem();
    const mutantA = actorWithFlags({ id: "mutant-A", items: [item] });
    const mutantB = actorWithFlags({ id: "mutant-B", items: [item] });
    const observer = actorWithFlags({ id: "observer-1", characteristics: { wp: { total: 40 } } });
    await markRuleUsageUsed(observer, noticeFlagKey(CAPABILITY_KEY, mutantA.id));
    await markRuleUsageUsed(observer, seeThroughFlagKey(CAPABILITY_KEY, mutantA.id));
    await markRuleUsageUsed(observer, noticeFlagKey(CAPABILITY_KEY, mutantB.id));
    setTarget(observer);
    captured.nextRoll = 1;

    await attemptSeeThroughIllusion(item, mutantB);

    expect(captured.warnings).toEqual([]);
    expect(captured.chat.length).toBe(1);
  });
});

describe("illusionOfNormalityHtml", () => {
  it("не «Иллюзия Нормальности» или нет актора — пусто", () => {
    expect(illusionOfNormalityHtml(mutationItem({ name: "Boneless / Бескостный" }), actorWithFlags({ id: "a" }))).toBe("");
    expect(illusionOfNormalityHtml(illusionItem(), null)).toBe("");
  });

  it("цель не выбрана — подсказка выбрать таргет, кнопки всё равно на месте", () => {
    const html = illusionOfNormalityHtml(illusionItem(), actorWithFlags({ id: "mutant-1" }));
    expect(html).toContain("Foundry-цель не выбрана");
    expect(html).toContain("illusion-notice-btn");
    expect(html).toContain("illusion-see-through-btn");
  });

  it("цель выбрана, ещё не заметила", () => {
    const mutant = actorWithFlags({ id: "mutant-1" });
    const observer = actorWithFlags({ id: "observer-1", name: "Комиссар" });
    setTarget(observer);
    const html = illusionOfNormalityHtml(illusionItem(), mutant);
    expect(html).toContain("Комиссар");
    expect(html).toContain("ещё не заметил");
  });

  it("цель уже заметила — статус меняется, показывает доступность попытки", async () => {
    const item = illusionItem();
    const mutant = actorWithFlags({ id: "mutant-1" });
    const observer = actorWithFlags({ id: "observer-1", name: "Комиссар" });
    await markRuleUsageUsed(observer, noticeFlagKey(CAPABILITY_KEY, mutant.id));
    setTarget(observer);
    const html = illusionOfNormalityHtml(item, mutant);
    expect(html).toContain("заметил(а) иллюзию");
    expect(html).toContain("попытка увидеть сквозь доступна");
  });

  it("иллюзия не поддерживается — кнопок обнаружения нет, только тумблер и статус", async () => {
    const item = illusionItem();
    const mutant = actorWithFlags({ id: "mutant-1" });
    const observer = actorWithFlags({ id: "observer-1" });
    setTarget(observer);
    await setIllusionMaintained(item, false);
    const html = illusionOfNormalityHtml(item, mutant);
    expect(html).toContain("illusion-maintain-toggle");
    expect(html).toContain("не поддерживается");
    expect(html).not.toContain("illusion-notice-btn");
  });
});

describe("isIllusionMaintained / setIllusionMaintained", () => {
  it("по умолчанию (флага ещё нет) иллюзия поддерживается", () => {
    expect(isIllusionMaintained(illusionItem())).toBe(true);
  });

  it("setIllusionMaintained(false) — дальше isIllusionMaintained тоже false", async () => {
    const item = illusionItem();
    await setIllusionMaintained(item, false);
    expect(isIllusionMaintained(item)).toBe(false);
  });

  it("setIllusionMaintained(true) после false — снова поддерживается", async () => {
    const item = illusionItem();
    await setIllusionMaintained(item, false);
    await setIllusionMaintained(item, true);
    expect(isIllusionMaintained(item)).toBe(true);
  });

  it("не «Иллюзия Нормальности» — тумблер не пишется", async () => {
    const item = mutationItem({ name: "Прочее" });
    await setIllusionMaintained(item, false);
    expect(item.getFlag("warhammer-dbc", "illusionMaintained")).toBeUndefined();
  });
});

describe("attemptNoticeIllusion — иллюзия не поддерживается", () => {
  it("предупреждает и не бросает, даже если цель выбрана", async () => {
    const item = illusionItem();
    const mutant = actorWithFlags({ id: "mutant-1", items: [item] });
    const observer = actorWithFlags({ id: "observer-1" });
    setTarget(observer);
    await setIllusionMaintained(item, false);

    await attemptNoticeIllusion(item, mutant);

    expect(captured.warnings.length).toBe(1);
    expect(captured.chat).toEqual([]);
  });
});
