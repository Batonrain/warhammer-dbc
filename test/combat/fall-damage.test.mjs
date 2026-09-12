// test/combat/fall-damage.test.mjs
//
// Падение (стр. 30) — _resolveFallDamage через showFallDialog: потолок
// высоты 25м (стенд-ин терминальной скорости), и Breeze/Бриз (wdbc-1rno),
// снимающий этот потолок — обоюдоострый пункт книги (без потолка урон с
// большой высоты становится БОЛЬШЕ, не меньше).

import "../support/foundry-stub.mjs";
import { captured, resetCaptured, fakeHtml } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { showFallDialog } from "../../module/combat/movement-actions.mjs";
import { registerRuleSource, clearRuleSources, getRuleSources } from "../../module/rules/sources.mjs";

function actor() {
  return { name: "Подставной", system: { characteristics: { ag: { bonus: 3 } } }, items: [] };
}

function grantBreeze(bearer) {
  clearRuleSources();
  registerRuleSource("test", a => a === bearer
    ? [{ id: "test.breeze", when: {}, effects: [{ kind: "grantFlag", target: "mutation.breeze" }] }]
    : []);
}

beforeEach(resetCaptured);

describe("Падение — потолок терминальной скорости", () => {
  it("высота 40м, обычный персонаж — урон считается с потолком 25", async () => {
    const a = actor();
    showFallDialog(a);
    captured.dice = [4]; // 1d10 → 4
    await captured.dialog.buttons.roll.callback(
      fakeHtml({ "#fl-h": "40", "#fl-tuck": false, "#fl-vol": false }));

    const card = captured.chat.at(-1).content;
    expect(card).toContain("1d10+25: <b>29</b>"); // 4+25
    expect(card).toContain("ограничено терминальной скоростью 25");
  });

  it("высота 10м (ниже потолка) — потолок ни на что не влияет, заметки нет", async () => {
    const a = actor();
    showFallDialog(a);
    captured.dice = [4];
    await captured.dialog.buttons.roll.callback(
      fakeHtml({ "#fl-h": "10", "#fl-tuck": false, "#fl-vol": false }));

    const card = captured.chat.at(-1).content;
    expect(card).toContain("1d10+10: <b>14</b>");
    expect(card).not.toContain("терминальной скоростью");
  });

  describe("Breeze/Бриз (wdbc-1rno) — терминальная скорость не ограничена", () => {
    const saved = getRuleSources();
    afterEach(() => {
      clearRuleSources();
      for (const [key, fn] of saved) registerRuleSource(key, fn);
    });

    it("высота 40м, носитель Бриза — потолок снят, урон СЧИТАЕТСЯ БОЛЬШЕ, не меньше", async () => {
      const a = actor();
      grantBreeze(a);
      showFallDialog(a);
      captured.dice = [4];
      await captured.dialog.buttons.roll.callback(
        fakeHtml({ "#fl-h": "40", "#fl-tuck": false, "#fl-vol": false }));

      const card = captured.chat.at(-1).content;
      expect(card).toContain("1d10+40: <b>44</b>"); // 4+40, без потолка
      expect(card).toContain("терминальная скорость не ограничена");
      expect(card).not.toContain("ограничено терминальной скоростью 25");
    });

    it("высота 10м, носитель Бриза — ниже потолка, разницы нет, заметки нет", async () => {
      const a = actor();
      grantBreeze(a);
      showFallDialog(a);
      captured.dice = [4];
      await captured.dialog.buttons.roll.callback(
        fakeHtml({ "#fl-h": "10", "#fl-tuck": false, "#fl-vol": false }));

      const card = captured.chat.at(-1).content;
      expect(card).toContain("1d10+10: <b>14</b>");
      expect(card).not.toContain("терминальн");
    });
  });
});
