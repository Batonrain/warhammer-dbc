// test/combat/attack-fanatic-token-names.test.mjs
//
// Две кнопки «Перехват» одного имени: attack.mjs отдаёт карточке имя токена
// каждого кандидата, а карточка различает одноимённых по нему или по номеру.

import { describe, it, expect, beforeEach } from "vitest";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { actorFor, weaponFor } from "../support/combat-fixtures.mjs";
import { _executeAttackRoll } from "../../module/combat/attack.mjs";

const fanaticActor = (uuid, name) => ({
  uuid, name, id: uuid, system: {}, getFlag: () => undefined,
  items: [{ type: "trait", name: "Fanatic", system: {}, flags: {} }]
});
const tokenOf = (id, x, actor, name = actor?.name) => ({
  id, name, actor, document: { id, uuid: `Scene.s.Token.${id}`, name, x, y: 0, width: 1, height: 1, actorLink: false }
});
const labels = html => [...html.matchAll(/<button[^>]*class="wh-fanatic-redirect-btn"[\s\S]*?<\/button>/g)]
  .map(m => m[0].replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());

beforeEach(() => resetCaptured());

async function attackWith(tokenNames) {
  const defender = actorFor({});
  defender.uuid = "Actor.def";
  const targetToken = tokenOf("tgt", 0, defender, "Цель");
  const fanatics = tokenNames.map((name, i) =>
    tokenOf(`f${i}`, 0, fanaticActor(`Scene.s.Token.f${i}.Actor.base`, "Культист"), name));
  globalThis.canvas = { grid: { size: 100 }, scene: { grid: { distance: 1 }, tokens: [] }, tokens: { placeables: [targetToken, ...fanatics] } };
  globalThis.game.user = { ...globalThis.game.user, targets: new Set([targetToken]) };
  const weapon = weaponFor({ weaponClass: "melee", weaponType: "sword", damage: "1d10+5" });
  const actor = actorFor({ items: [weapon] });
  captured.dice = [5, 5, 5, 5, 5, 5, 5];
  await _executeAttackRoll(actor, weapon, "ws", 80, "single", null, {});
  return captured.chat.at(-1)?.content ?? "";
}

describe("карточка атаки: одноимённые Фанатики рядом с целью", () => {
  it("имена токенов разные — в подписи имя токена", async () => {
    const html = await attackWith(["Страж у двери", "Страж у окна"]);
    expect(labels(html)).toEqual(["Перехват: Культист (Страж у двери)", "Перехват: Культист (Страж у окна)"]);
  });

  it("имена токенов совпали — номера", async () => {
    const html = await attackWith(["Культист", "Культист"]);
    expect(labels(html)).toEqual(["Перехват: Культист #1", "Перехват: Культист #2"]);
  });
});
