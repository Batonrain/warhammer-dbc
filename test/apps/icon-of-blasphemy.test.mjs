// test/apps/icon-of-blasphemy.test.mjs
//
// Мутация «Icon of Blasphemy» (wdbc-zbc0): раз за бой/сцену на самом
// мутанте (не на наблюдателе, в отличие от Illusion of Normality). Группа
// каждой цели определяется автоматически (module/rules/icon-of-blasphemy.mjs
// ::classifyWitness — Лоялист/не-Лоялист, Пси-чутьё/Ноосфера по Черте
// Psyker или Боевым Латам Скитарии), поэтому диалога тут больше нет и
// activateIconOfBlasphemy тестируется целиком, не только гейты.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import {
  isIconOfBlasphemyItem, iconOfBlasphemyButtonHtml,
  activateIconOfBlasphemy, resolveIconOfBlasphemy
} from "../../module/apps/icon-of-blasphemy.mjs";
import { isRuleUsageUsed } from "../../module/rules/cooldown.mjs";

const FLAG = "warhammer-dbc";

function actorWithFlags({ id, name = "Актор", alignment = "loyalist", items = [], wp = 40 } = {}) {
  const store = {};
  const actor = {
    id, name, items,
    system: { alignment, characteristics: { wp: { total: wp } }, inRage: false },
    getFlag: (scope, key) => store[`${scope}.${key}`],
    setFlag: async (scope, key, value) => { store[`${scope}.${key}`] = value; },
    update: async data => {
      captured.updates.push(data);
      if ("system.inRage" in data) actor.system.inRage = data["system.inRage"];
    }
  };
  return actor;
}

const psykerTrait = { type: "trait", name: "Psyker / Псайкер" };
const skitarii = { type: "implant", name: "Skitarii War Plate / Боевые Латы Скитарии",
  flags: { "warhammer-dbc": { installed: true, disabled: false } } };

const iconItem = (id = "icon-1") => ({ id, type: "mutation", name: "Icon of Blasphemy / Икона Богохульства" });

function setTargets(actors) { globalThis.game.user.targets = actors.map(actor => ({ actor })); }

beforeEach(() => {
  resetCaptured();
  globalThis.game.user = { targets: [] };
});

describe("isIconOfBlasphemyItem", () => {
  it("совпадает по имени и типу", () => {
    expect(isIconOfBlasphemyItem(iconItem())).toBe(true);
  });
});

describe("activateIconOfBlasphemy — гейты", () => {
  it("уже проявлена в этом бою/сцене — предупреждает, не бросает", async () => {
    const item = iconItem();
    const mutant = actorWithFlags({ id: "mutant-1" });
    await mutant.setFlag(FLAG, "usageLimits.iconOfBlasphemy", { scope: "scene", used: true });
    setTargets([actorWithFlags({ id: "witness-1" })]);

    await activateIconOfBlasphemy(item, mutant);

    expect(captured.warnings.length).toBe(1);
    expect(captured.chat).toEqual([]);
  });

  it("нет выбранных целей — предупреждает, не бросает", async () => {
    const item = iconItem();
    const mutant = actorWithFlags({ id: "mutant-1" });
    setTargets([]);

    await activateIconOfBlasphemy(item, mutant);

    expect(captured.warnings.length).toBe(1);
    expect(captured.chat).toEqual([]);
  });
});

describe("activateIconOfBlasphemy — целиком, без диалога (автоклассификация)", () => {
  it("Лоялист без Псайкера/Скитарии — группа visual, провал включает Ярость, кулдаун расходуется", async () => {
    const item = iconItem();
    const mutant = actorWithFlags({ id: "mutant-1" });
    const witness = actorWithFlags({ id: "witness-1", alignment: "loyalist", wp: 40 });
    setTargets([witness]);
    captured.nextRoll = 90; // провал

    await activateIconOfBlasphemy(item, mutant);

    expect(witness.system.inRage).toBe(true);
    expect(captured.chat.length).toBe(1);
    expect(isRuleUsageUsed(mutant, "iconOfBlasphemy")).toBe(true);
  });

  it("Лоялист-Псайкер — группа psychic, провал НЕ включает Ярость", async () => {
    const item = iconItem();
    const mutant = actorWithFlags({ id: "mutant-1" });
    const psyker = actorWithFlags({ id: "psyker-1", alignment: "loyalist", items: [psykerTrait], wp: 40 });
    setTargets([psyker]);
    captured.nextRoll = 90; // провал

    await activateIconOfBlasphemy(item, mutant);

    expect(psyker.system.inRage).toBe(false);
    expect(captured.updates).toEqual([]);
  });

  it("не-Лоялист среди целей — не бросает за него, не действует", async () => {
    const item = iconItem();
    const mutant = actorWithFlags({ id: "mutant-1" });
    const heretic = actorWithFlags({ id: "heretic-1", alignment: "heretic" });
    setTargets([heretic]);

    await activateIconOfBlasphemy(item, mutant);

    expect(captured.rolls).toEqual([]); // ни одного броска
    expect(captured.chat.length).toBe(1); // карточка всё равно есть — строкой «не действует»
  });
});

describe("resolveIconOfBlasphemy", () => {
  it("группа «видел» — успех НЕ включает Ярость", async () => {
    const mutant = actorWithFlags({ id: "mutant-1" });
    const witness = actorWithFlags({ id: "witness-1", wp: 40 });
    captured.nextRoll = 10; // успех

    await resolveIconOfBlasphemy(mutant, [witness]);

    expect(witness.system.inRage).toBe(false);
  });

  it("Боевые Латы Скитарии дают ту же группу psychic, что и Псайкер", async () => {
    const mutant = actorWithFlags({ id: "mutant-1" });
    const techGuard = actorWithFlags({ id: "tech-1", alignment: "loyalist", items: [skitarii], wp: 40 });
    captured.nextRoll = 90; // провал

    await resolveIconOfBlasphemy(mutant, [techGuard]);

    expect(techGuard.system.inRage).toBe(false); // не Ярость, а принуждение (флейвор)
  });

  it("несколько целей разом — каждая тестируется своим броском независимо", async () => {
    const mutant = actorWithFlags({ id: "mutant-1" });
    const failsVisual = actorWithFlags({ id: "w1", alignment: "loyalist", wp: 40 });
    const passesPsychic = actorWithFlags({ id: "w2", alignment: "loyalist", items: [psykerTrait], wp: 40 });
    captured.dice = [90, 10]; // первый бросок (visual) — провал, второй (psychic) — успех

    await resolveIconOfBlasphemy(mutant, [failsVisual, passesPsychic]);

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
