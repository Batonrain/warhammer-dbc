// test/apps/soul-seer.test.mjs
import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { describe, it, expect, beforeEach } from "vitest";
import { useSoulSeer } from "../../module/apps/soul-seer.mjs";

function makeActor(name, type = "character") {
  return { name, type, uuid: `Actor.${name}` };
}
function tokenOf(actor, x, y) {
  return { id: actor.name, hidden: false, actor, x, y, width: 1, height: 1 };
}
function sceneOf(tokens) {
  const grid = { size: 100, distance: 1, type: 0 };
  const parent = { tokens: Object.assign(tokens.slice(), { contents: tokens }), grid };
  for (const t of tokens) t.parent = parent;
  return parent;
}

beforeEach(resetCaptured);

describe("useSoulSeer", () => {
  it("нет токена — предупреждает", async () => {
    const actor = makeActor("Носитель");
    const item = { name: "Душевидец" };
    await useSoulSeer(actor, item, null);
    expect(captured.warnings.at(-1)).toContain("нет токена");
  });

  it("видит человека/технику/демона в радиусе 10м, не видит вне радиуса и не в трёх категориях", async () => {
    const caster = makeActor("Кастер");
    const near = makeActor("Прохожий", "character");
    const vehicle = makeActor("Сервочереп", "vehicle");
    const daemon = makeActor("Кровопускатель", "daemon");
    const squad = makeActor("Отряд", "squad");
    const far = makeActor("Далеко", "character");

    const casterToken = tokenOf(caster, 0, 0);
    const nearToken = tokenOf(near, 0, 0);
    const vehicleToken = tokenOf(vehicle, 1, 0);
    const daemonToken = tokenOf(daemon, 2, 0);
    const squadToken = tokenOf(squad, 3, 0);
    const farToken = tokenOf(far, 1000, 1000);
    sceneOf([casterToken, nearToken, vehicleToken, daemonToken, squadToken, farToken]);

    const item = { name: "Душевидец" };
    await useSoulSeer(caster, item, casterToken);

    const content = captured.chat.at(-1).content;
    expect(content).toContain("Прохожий");
    expect(content).toContain("человек");
    expect(content).toContain("Сервочереп");
    expect(content).toContain("дух машины");
    expect(content).toContain("Кровопускатель");
    expect(content).toContain("демон");
    expect(content).not.toContain("Отряд");
    expect(content).not.toContain("Далеко");
  });

  it("никого в радиусе — честная строка", async () => {
    const caster = makeActor("Кастер");
    const casterToken = tokenOf(caster, 0, 0);
    sceneOf([casterToken]);
    const item = { name: "Душевидец" };
    await useSoulSeer(caster, item, casterToken);
    expect(captured.chat.at(-1).content).toContain("душ не видно");
  });
});
