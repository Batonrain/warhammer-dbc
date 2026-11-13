// test/combat/radiant-presence.test.mjs
//
// Блистательное Присутствие (wdbc-051qb): обвязка над сценой и подключение
// к диалогам Морали — галочка ставится сама по видимости, остаётся
// редактируемой; «В Самое Пекло» по-прежнему только руками.

import "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import {
  radiantPresenceSeenBy, radiantPresenceHint, resolveCardRadiantPresence
} from "../../module/combat/radiant-presence.mjs";
import { openFearDialog } from "../../module/sheets/tabs/disorders.mjs";
import { intimidateDialog } from "../../module/combat/intimidate.mjs";
import { fieldExecutionDialog } from "../../module/combat/field-execution.mjs";

const RADIANT = { type: "talent", name: "Radiant Presence / Блистательное Присутствие", system: {} };
const JAWS = { type: "talent", name: "Into the Jaws of Hell / В Самое Пекло", system: {} };

function actor(id, items = []) {
  return {
    id, uuid: `Actor.${id}`, name: id, type: "character", items, getFlag: () => undefined,
    system: {
      skills: { intimidate: { total: 40 } },
      characteristics: { wp: { total: 40 }, inf: { total: 0 }, fel: { total: 40 } },
      fate: { value: 0 }
    }
  };
}

const token = (a, x, { disposition = 1, rotation = 0, angle = 360, hidden = false } = {}) => ({
  actor: a,
  document: { id: `tok-${a.id}`, x, y: 0, width: 1, height: 1, elevation: 0, disposition, rotation, hidden, sight: { range: 0, angle } }
});

let savedCanvas, savedActors, savedPrompt;
beforeEach(() => {
  resetCaptured();
  savedCanvas = globalThis.canvas;
  savedActors = globalThis.game.actors;
  savedPrompt = foundry.applications.api.DialogV2.prompt;
  foundry.applications.api.DialogV2.prompt = async config => { captured.dialog = config; return null; };
});
afterEach(() => {
  globalThis.canvas = savedCanvas;
  globalThis.game.actors = savedActors;
  globalThis.game.user.targets = undefined;
  foundry.applications.api.DialogV2.prompt = savedPrompt;
});

function scene(tokens, actors = tokens.map(t => t.actor)) {
  globalThis.canvas = { tokens: { placeables: tokens }, scene: { grid: { size: 100, distance: 1 } } };
  globalThis.game.actors = actors;
}

describe("radiantPresenceSeenBy — сцена", () => {
  it("союзный носитель рядом — виден, имя в списке", () => {
    const holder = actor("Лидер", [RADIANT]);
    const me = actor("Боец");
    scene([token(holder, 300), token(me, 0)]);
    expect(radiantPresenceSeenBy(me)).toEqual({ seen: true, holders: ["Лидер"] });
  });

  it("носитель за пределами видимости — не виден", () => {
    const holder = actor("Лидер", [RADIANT]);
    const me = actor("Боец");
    scene([token(holder, 100 * 60), token(me, 0)]);
    expect(radiantPresenceSeenBy(me).seen).toBe(false);
  });

  it("носитель — источник теста — не считается", () => {
    const holder = actor("Лидер", [RADIANT]);
    const me = actor("Боец");
    scene([token(holder, 300), token(me, 0)]);
    expect(radiantPresenceSeenBy(me, { sourceActor: holder }).seen).toBe(false);
  });

  it("сам носитель себе не союзник", () => {
    const holder = actor("Лидер", [RADIANT]);
    scene([token(holder, 0)]);
    expect(radiantPresenceSeenBy(holder).seen).toBe(false);
  });

  it("у цели нет токена на сцене или цели нет — не виден", () => {
    const holder = actor("Лидер", [RADIANT]);
    scene([token(holder, 300)]);
    expect(radiantPresenceSeenBy(actor("Боец")).seen).toBe(false);
    expect(radiantPresenceSeenBy(null).seen).toBe(false);
  });

  it("без canvas — не виден, без падения", () => {
    globalThis.canvas = {};
    expect(radiantPresenceSeenBy(actor("Боец")).seen).toBe(false);
  });

  it("токен цели берётся из getActiveTokens, если он есть у актора", () => {
    const holder = actor("Лидер", [RADIANT]);
    const me = actor("Боец");
    const myTok = token(me, 0);
    me.getActiveTokens = () => [myTok.document];
    scene([token(holder, 300)]);
    expect(radiantPresenceSeenBy(me).seen).toBe(true);
  });
});

describe("radiantPresenceHint", () => {
  it("без видимости — только объяснение, что «слышит» ставится руками", () => {
    const t = radiantPresenceHint({ seen: false, holders: [] });
    expect(t).toContain("слышит");
    expect(t).not.toContain("Проставлено");
  });
  it("с видимостью — называет носителя", () => {
    expect(radiantPresenceHint({ seen: true, holders: ["Лидер"] })).toContain("Проставлено по видимости: Лидер");
  });
});

describe("resolveCardRadiantPresence — галочка карточки Подавления", () => {
  const me = () => actor("Боец");

  it("прочерк (стол не трогал) + носитель виден — +10", () => {
    const h = actor("Лидер", [RADIANT]), m = me();
    scene([token(h, 300), token(m, 0)]);
    expect(resolveCardRadiantPresence({ indeterminate: true, checked: false }, m, null)).toBe(true);
  });

  it("прочерк + носителя не видно — нет", () => {
    const h = actor("Лидер", [RADIANT]), m = me();
    scene([token(h, 100 * 60), token(m, 0)]);
    expect(resolveCardRadiantPresence({ indeterminate: true, checked: false }, m, null)).toBe(false);
  });

  it("стол снял галочку (не прочерк, не отмечена) — видимость не навязывается", () => {
    const h = actor("Лидер", [RADIANT]), m = me();
    scene([token(h, 300), token(m, 0)]);
    expect(resolveCardRadiantPresence({ indeterminate: false, checked: false }, m, null)).toBe(false);
  });

  it("стол отметил вручную («слышит») без видимости — +10", () => {
    const h = actor("Лидер", [RADIANT]), m = me();
    scene([token(h, 100 * 60), token(m, 0)]);
    expect(resolveCardRadiantPresence({ indeterminate: false, checked: true }, m, null)).toBe(true);
  });

  it("стрелок — носитель Таланта: его Присутствие не считается", () => {
    const shooter = actor("Лидер", [RADIANT]), m = me();
    scene([token(shooter, 300), token(m, 0)]);
    expect(resolveCardRadiantPresence({ indeterminate: true, checked: false }, m, shooter)).toBe(false);
  });

  it("карточки без галочки — нет", () => {
    expect(resolveCardRadiantPresence(null, me(), null)).toBe(false);
  });
});

describe("диалог Теста Страха — галочка по видимости", () => {
  it("носитель виден — галочка отмечена сама, подсказка называет его; Пекло не отмечено", () => {
    const h = actor("Лидер", [RADIANT, JAWS]), m = actor("Боец");
    scene([token(h, 300), token(m, 0)]);
    openFearDialog(m);
    expect(captured.dialog.content).toContain('id="fear-prop-radiant" type="checkbox" checked');
    expect(captured.dialog.content).toContain("Проставлено по видимости: Лидер");
    expect(captured.dialog.content).toContain('id="fear-prop-jaws" type="checkbox"/>');
  });

  it("носитель не виден — галочка снята, но доступна для ручной отметки", () => {
    const h = actor("Лидер", [RADIANT]), m = actor("Боец");
    scene([token(h, 100 * 60), token(m, 0)]);
    openFearDialog(m);
    expect(captured.dialog.content).toContain('id="fear-prop-radiant" type="checkbox"/>');
    expect(captured.dialog.content).not.toContain("Проставлено");
  });

  it("источник Страха — сам носитель: его Присутствие не считается", () => {
    const h = actor("Лидер", [RADIANT]), m = actor("Боец");
    scene([token(h, 300), token(m, 0)]);
    globalThis.game.user.targets = new Set([{ actor: h, document: { disposition: 1 } }]);
    openFearDialog(m);
    expect(captured.dialog.content).toContain('id="fear-prop-radiant" type="checkbox"/>');
  });

  it("в мире нет носителей — галочки нет вовсе", () => {
    const m = actor("Боец");
    scene([token(m, 0)]);
    openFearDialog(m);
    expect(captured.dialog.content).not.toContain("fear-prop-radiant");
  });
});

describe("диалог Запугивания и Полевой Казни — галочка на стороне цели", () => {
  it("Запугивание: носитель виден цели — отмечено; Пекло только руками", async () => {
    const h = actor("Лидер", [RADIANT, JAWS]), target = actor("Цель"), attacker = actor("Нападающий");
    scene([token(h, 300), token(target, 0), token(attacker, 600, { disposition: -1 })]);
    await intimidateDialog(attacker, target);
    expect(captured.dialog.content).toContain('id="intim-radiant" type="checkbox" checked');
    expect(captured.dialog.content).toContain("Проставлено по видимости: Лидер");
    expect(captured.dialog.content).toContain('id="intim-jaws" type="checkbox"/>');
  });

  it("Запугивание: носитель не виден цели — снято", async () => {
    const h = actor("Лидер", [RADIANT]), target = actor("Цель"), attacker = actor("Нападающий");
    scene([token(h, 100 * 60), token(target, 0), token(attacker, 600, { disposition: -1 })]);
    await intimidateDialog(attacker, target);
    expect(captured.dialog.content).toContain('id="intim-radiant" type="checkbox"/>');
  });

  it("Запугивание: нападающий сам носитель — его Присутствие не считается", async () => {
    const attacker = actor("Лидер", [RADIANT]), target = actor("Цель");
    scene([token(attacker, 300), token(target, 0)]);
    await intimidateDialog(attacker, target);
    expect(captured.dialog.content).toContain('id="intim-radiant" type="checkbox"/>');
  });

  it("Полевая Казнь: носитель виден цели — отмечено; Пекло только руками", async () => {
    const h = actor("Лидер", [RADIANT, JAWS]), target = actor("Цель"), executioner = actor("Казнящий");
    scene([token(h, 300), token(target, 0), token(executioner, 600, { disposition: -1 })]);
    await fieldExecutionDialog(executioner, target);
    expect(captured.dialog.content).toContain('id="fex-radiant" type="checkbox" checked');
    expect(captured.dialog.content).toContain('id="fex-jaws" type="checkbox"/>');
  });

  it("Полевая Казнь: носитель не виден — снято", async () => {
    const h = actor("Лидер", [RADIANT]), target = actor("Цель"), executioner = actor("Казнящий");
    scene([token(h, 100 * 60), token(target, 0), token(executioner, 600, { disposition: -1 })]);
    await fieldExecutionDialog(executioner, target);
    expect(captured.dialog.content).toContain('id="fex-radiant" type="checkbox"/>');
  });

  it("галочка остаётся редактируемой: ручная отметка и снятие читаются из формы как раньше", async () => {
    const h = actor("Лидер", [RADIANT]), target = actor("Цель"), attacker = actor("Нападающий");
    scene([token(h, 300), token(target, 0)]);
    let picked = null;
    foundry.applications.api.DialogV2.prompt = async config => {
      captured.dialog = config;
      const boxes = { "#intim-radiant": { checked: false }, "#intim-jaws": { checked: true } };
      const form = { querySelector: sel => boxes[sel] ?? { value: "0" } };
      picked = config.ok.callback(null, { form });
      return null;
    };
    await intimidateDialog(attacker, target);
    expect(captured.dialog.content).toContain('id="intim-radiant" type="checkbox" checked');
    expect(picked).toMatchObject({ radiantPresence: false, intoTheJawsOfHell: true });
  });
});
