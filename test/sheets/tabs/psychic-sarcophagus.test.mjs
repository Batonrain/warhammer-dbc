// test/sheets/tabs/psychic-sarcophagus.test.mjs
//
// wdbc-drn: sarcophagus.noPsychicPowers — пилот Саркофага Дредноута не может
// манифестировать и поддерживать психосилы, пока на его Дредноуте не стоит
// Матрица Осирис (стр. 58).

import "../../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captured, resetCaptured, listenerHtml } from "../../support/foundry-stub.mjs";
import { showManifestDialog, sarcophagusBlocksPsychicPowers,
         activatePsychicListeners } from "../../../module/sheets/tabs/psychic.mjs";
import { clearRuleSources, registerRuleSource, getRuleSources } from "../../../module/rules/sources.mjs";

function makeActor(uuid = "Actor.pilot") {
  const items = [];
  items.get = id => items.find(i => i.id === id) ?? null;
  return {
    uuid, id: "pilot1", name: "Пилот",
    items,
    system: { psyker: { currentRating: 3 }, characteristics: {} }
  };
}

const dread = (items = []) => ({
  type: "vehicle", uuid: "Actor.dread1",
  system: { vehicleClass: "Дредноут", stations: [{ role: "pilot", uuid: "Actor.pilot" }] },
  items
});

beforeEach(resetCaptured);

describe("sarcophagus.noPsychicPowers: манифестация/поддержание блокируются (wdbc-drn)", () => {
  const saved = getRuleSources();
  afterEach(() => {
    clearRuleSources();
    for (const [key, fn] of saved) registerRuleSource(key, fn);
    delete globalThis.game.actors;
  });

  function grant() {
    clearRuleSources();
    registerRuleSource("test", () => [
      { id: "test.rule", when: {}, effects: [{ kind: "grantFlag", target: "sarcophagus.noPsychicPowers" }] }
    ]);
  }

  it("без возможности — блока нет", () => {
    clearRuleSources();
    expect(sarcophagusBlocksPsychicPowers(makeActor())).toBe(false);
  });

  it("с возможностью, но без своего Дредноута в мире — блок есть", () => {
    grant();
    globalThis.game.actors = [];
    expect(sarcophagusBlocksPsychicPowers(makeActor())).toBe(true);
  });

  it("Дредноут без Матрицы Осирис — блок остаётся", () => {
    grant();
    globalThis.game.actors = [dread([])];
    expect(sarcophagusBlocksPsychicPowers(makeActor())).toBe(true);
  });

  it("Дредноут с Матрицей Осирис — блок снят", () => {
    grant();
    globalThis.game.actors = [dread([{ type: "vehicleGear", name: "Матрица Осирис / Osiris Matrix" }])];
    expect(sarcophagusBlocksPsychicPowers(makeActor())).toBe(false);
  });

  it("showManifestDialog: заблокирован — окно не открывается, есть предупреждение", () => {
    grant();
    globalThis.game.actors = [];
    showManifestDialog(makeActor(), { name: "Пирокинез", system: {} });

    expect(captured.dialog).toBeNull();
    expect(captured.warnings.some(w => w.includes("Матрица Осирис"))).toBe(true);
  });

  it("showManifestDialog: с Матрицей — окно открывается как обычно", () => {
    grant();
    globalThis.game.actors = [dread([{ type: "vehicleGear", name: "Матрица Осирис / Osiris Matrix" }])];
    showManifestDialog(makeActor(), { name: "Пирокинез", system: {} });

    expect(captured.dialog).not.toBeNull();
  });

  it("чекбокс поддержания: заблокирован — включение отменяется, галочка возвращается", async () => {
    grant();
    globalThis.game.actors = [];
    const item = { id: "p1", system: { isSustained: false }, update: async data => Object.assign(item.system, {
      isSustained: data["system.isSustained"]
    }) };
    const actor = makeActor();
    actor.items = { get: id => (id === "p1" ? item : null) };

    const html = listenerHtml();
    activatePsychicListeners(html, actor, {});
    const ev = { currentTarget: { dataset: { itemId: "p1" }, checked: true } };
    await html.handlers[".psy-sustain-cb:change"](ev);

    expect(ev.currentTarget.checked).toBe(false);
    expect(item.system.isSustained).toBe(false);
    expect(captured.warnings.some(w => w.includes("Матрица Осирис"))).toBe(true);
  });

  it("чекбокс поддержания: выключение всегда разрешено, даже под блоком", async () => {
    grant();
    globalThis.game.actors = [];
    const item = {
      id: "p1", system: { isSustained: true }, effects: { contents: [] },
      update: async data => Object.assign(item.system, { isSustained: data["system.isSustained"] })
    };
    const actor = makeActor();
    actor.items = { get: id => (id === "p1" ? item : null) };

    const html = listenerHtml();
    activatePsychicListeners(html, actor, {});
    const ev = { currentTarget: { dataset: { itemId: "p1" }, checked: false } };
    await html.handlers[".psy-sustain-cb:change"](ev);

    expect(item.system.isSustained).toBe(false);
  });
});
