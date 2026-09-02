// test/apps/icon-of-blasphemy.test.mjs
//
// Мутация «Icon of Blasphemy» (wdbc-zbc0): раз за бой/сцену на самом
// мутанте (не на наблюдателе, в отличие от Illusion of Normality) — гейты
// (кулдаун/нет целей) тестируются через activateIconOfBlasphemy напрямую,
// а сам диалог выбора групп (DialogV2) — НЕТ, тем же приёмом, что
// useHandOfDeath/promptWeaponAndHand (apps/hand-of-death.mjs, см. его
// тестовый файл): стаб DialogV2 не умеет form.elements, только querySelector.
// Ядро (тест W+0 на уже РЕШЁННЫЕ группы) вынесено в resolveIconOfBlasphemy
// именно ради тестируемости без диалога — его и проверяем.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import {
  isIconOfBlasphemyItem, iconOfBlasphemyButtonHtml,
  activateIconOfBlasphemy, resolveIconOfBlasphemy
} from "../../module/apps/icon-of-blasphemy.mjs";
import { isRuleUsageUsed } from "../../module/rules/cooldown.mjs";

const FLAG = "warhammer-dbc";

function actorWithFlags({ id, name = "Актор", wp = 40 } = {}) {
  const store = {};
  const actor = {
    id, name,
    system: { characteristics: { wp: { total: wp } }, inRage: false },
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; },
    update: async data => {
      captured.updates.push(data);
      if ("system.inRage" in data) actor.system.inRage = data["system.inRage"];
    }
  };
  return actor;
}

const iconItem = (id = "icon-1") => ({ id, type: "mutation", name: "Icon of Blasphemy / Икона Богохульства" });

beforeEach(() => {
  resetCaptured();
  globalThis.game.user = { targets: [] };
});

describe("isIconOfBlasphemyItem", () => {
  it("совпадает по имени и типу", () => {
    expect(isIconOfBlasphemyItem(iconItem())).toBe(true);
  });
});

describe("activateIconOfBlasphemy — гейты (без диалога)", () => {
  it("уже проявлена в этом бою/сцене — предупреждает, не бросает", async () => {
    const item = iconItem();
    const mutant = actorWithFlags({ id: "mutant-1" });
    await mutant.setFlag(FLAG, "usageLimits.iconOfBlasphemy", { scope: "scene", used: true });
    globalThis.game.user.targets = [{ actor: actorWithFlags({ id: "witness-1" }) }];

    await activateIconOfBlasphemy(item, mutant);

    expect(captured.warnings.length).toBe(1);
    expect(captured.chat).toEqual([]);
  });

  it("нет выбранных целей — предупреждает, не бросает", async () => {
    const item = iconItem();
    const mutant = actorWithFlags({ id: "mutant-1" });
    globalThis.game.user.targets = [];

    await activateIconOfBlasphemy(item, mutant);

    expect(captured.warnings.length).toBe(1);
    expect(captured.chat).toEqual([]);
  });
});

describe("resolveIconOfBlasphemy", () => {
  it("группа «видел» — провал W+0 включает Ярость (system.inRage)", async () => {
    const mutant = actorWithFlags({ id: "mutant-1" });
    const witness = actorWithFlags({ id: "witness-1", wp: 40 });
    captured.nextRoll = 90; // выше WP 40 — провал

    await resolveIconOfBlasphemy(mutant, [{ actor: witness, psychic: false }]);

    expect(witness.system.inRage).toBe(true);
    expect(captured.chat.length).toBe(1);
  });

  it("группа «видел» — успех НЕ включает Ярость", async () => {
    const mutant = actorWithFlags({ id: "mutant-1" });
    const witness = actorWithFlags({ id: "witness-1", wp: 40 });
    captured.nextRoll = 10; // ниже WP 40 — успех

    await resolveIconOfBlasphemy(mutant, [{ actor: witness, psychic: false }]);

    expect(witness.system.inRage).toBe(false);
  });

  it("группа «засёк Пси-чутьём/Ноосферой» — провал НЕ включает Ярость (только флейвор в карточке)", async () => {
    const mutant = actorWithFlags({ id: "mutant-1" });
    const psyker = actorWithFlags({ id: "psyker-1", wp: 40 });
    captured.nextRoll = 90; // провал

    await resolveIconOfBlasphemy(mutant, [{ actor: psyker, psychic: true }]);

    expect(psyker.system.inRage).toBe(false);
    expect(captured.updates).toEqual([]);
    expect(captured.chat.length).toBe(1);
  });

  it("несколько целей разом — каждая тестируется своим броском независимо", async () => {
    const mutant = actorWithFlags({ id: "mutant-1" });
    const failsVisual = actorWithFlags({ id: "w1", wp: 40 });
    const passesPsychic = actorWithFlags({ id: "w2", wp: 40 });
    captured.dice = [90, 10]; // первый бросок (визуальный) — провал, второй (пси) — успех

    await resolveIconOfBlasphemy(mutant, [
      { actor: failsVisual, psychic: false },
      { actor: passesPsychic, psychic: true }
    ]);

    expect(failsVisual.system.inRage).toBe(true);
    expect(passesPsychic.system.inRage).toBe(false);
    expect(captured.chat.length).toBe(1); // одна сводная карточка на всю активацию
  });
});

describe("iconOfBlasphemyButtonHtml", () => {
  it("не «Икона Богохульства» или нет актора — пусто", () => {
    expect(iconOfBlasphemyButtonHtml({ type: "mutation", name: "Прочее" }, actorWithFlags({ id: "a" }))).toBe("");
    expect(iconOfBlasphemyButtonHtml(iconItem(), null)).toBe("");
  });

  it("кулдаун свободен — кнопка активна", () => {
    const html = iconOfBlasphemyButtonHtml(iconItem(), actorWithFlags({ id: "mutant-1" }));
    expect(html).toContain("icon-of-blasphemy-btn");
    expect(html).not.toContain("disabled");
  });

  it("кулдаун потрачен — кнопка задизейблена", async () => {
    const item = iconItem();
    const mutant = actorWithFlags({ id: "mutant-1" });
    await mutant.setFlag(FLAG, "usageLimits.iconOfBlasphemy", { scope: "scene", used: true });
    const html = iconOfBlasphemyButtonHtml(item, mutant);
    expect(html).toContain("disabled");
  });
});
