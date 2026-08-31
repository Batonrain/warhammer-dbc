// test/rules/squad-roles.test.mjs
//
// module/rules/squad-roles.mjs (wdbc-sk8s) — вынесено из module/apps/
// mechanics.mjs (было приватно, только для reconcileCohesionForActor),
// понадобилось Adjutant/Voice of God для «моего Командира».

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { squadRoleOf, findMemberSquad, commanderOf } from "../../module/rules/squad-roles.mjs";

function squad({ leader, commander, coordinator, members = [] } = {}) {
  return {
    type: "squad",
    system: {
      posts: {
        leader: leader ? { uuid: leader } : {},
        commander: commander ? { uuid: commander } : {},
        coordinator: coordinator ? { uuid: coordinator } : {}
      },
      members: members.map(uuid => ({ uuid }))
    }
  };
}

afterEach(() => { delete globalThis.game.actors; delete globalThis.fromUuidSync; });

describe("squadRoleOf", () => {
  it("пост важнее простого членства", () => {
    const s = squad({ commander: "Actor.cmd1", members: ["Actor.cmd1"] });
    expect(squadRoleOf(s, "Actor.cmd1")).toBe("commander");
  });
  it("обычный член без поста — subordinate", () => {
    const s = squad({ commander: "Actor.cmd1", members: ["Actor.m1"] });
    expect(squadRoleOf(s, "Actor.m1")).toBe("subordinate");
  });
  it("не состоит вовсе — null", () => {
    const s = squad({ commander: "Actor.cmd1" });
    expect(squadRoleOf(s, "Actor.stranger")).toBeNull();
  });
  it("без squad/uuid — null", () => {
    expect(squadRoleOf(null, "Actor.x")).toBeNull();
    expect(squadRoleOf(squad(), null)).toBeNull();
  });
});

describe("findMemberSquad", () => {
  it("находит первый Отряд, где актор состоит", () => {
    const s1 = squad({ members: ["Actor.other"] });
    const s2 = squad({ members: ["Actor.m1"] });
    globalThis.game.actors = [s1, s2, { type: "character" }];
    expect(findMemberSquad("Actor.m1")).toBe(s2);
  });
  it("не найден — null", () => {
    globalThis.game.actors = [squad({ members: ["Actor.other"] })];
    expect(findMemberSquad("Actor.m1")).toBeNull();
  });
});

describe("commanderOf", () => {
  it("резолвит Командира Отряда, в котором состоит актор", () => {
    const cmdActor = { uuid: "Actor.cmd1", name: "Командир" };
    const me = { uuid: "Actor.m1", name: "Я" };
    const s = squad({ commander: "Actor.cmd1", members: ["Actor.m1"] });
    globalThis.game.actors = [s];
    globalThis.fromUuidSync = uuid => uuid === "Actor.cmd1" ? cmdActor : null;
    expect(commanderOf(me)).toBe(cmdActor);
  });

  it("резолвит Токен → .actor, если пост ссылается на Токен", () => {
    const cmdActor = { uuid: "Actor.cmd1", name: "Командир" };
    const me = { uuid: "Actor.m1" };
    const s = squad({ commander: "Scene.s.Token.t", members: ["Actor.m1"] });
    globalThis.game.actors = [s];
    globalThis.fromUuidSync = uuid => uuid === "Scene.s.Token.t" ? { actor: cmdActor } : null;
    expect(commanderOf(me)).toBe(cmdActor);
  });

  it("нет Отряда/поста Командира — null", () => {
    globalThis.game.actors = [];
    expect(commanderOf({ uuid: "Actor.m1" })).toBeNull();
  });

  it("Командир — сам актор (нет смысла быть своим Командиром) — null", () => {
    const me = { uuid: "Actor.cmd1" };
    const s = squad({ commander: "Actor.cmd1", members: ["Actor.cmd1"] });
    globalThis.game.actors = [s];
    expect(commanderOf(me)).toBeNull();
  });
});
