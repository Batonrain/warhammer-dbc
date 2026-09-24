// test/rules/squad-roles.test.mjs
//
// module/rules/squad-roles.mjs (wdbc-sk8s) — вынесено из module/apps/
// mechanics.mjs (было приватно, только для reconcileCohesionForActor),
// понадобилось Adjutant/Voice of God для «моего Командира».

import "../support/foundry-stub.mjs";

import { describe, it, expect, afterEach } from "vitest";
import { squadRoleOf, findMemberSquad, commanderOf, minionCanCauseExtremeDamage } from "../../module/rules/squad-roles.mjs";

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

// Стр. 34, wdbc-x1nz.2.51: «Маловажные NPC... не могут наносить Экстремальный
// Урон, но могут получить эту способность от своих командиров через эффекты
// Командования» — Командное Присутствие, вариант «Экстремальный Урон».
describe("minionCanCauseExtremeDamage", () => {
  function minion({ uuid = "Actor.min1", commandedBy = null } = {}) {
    return {
      type: "minion", uuid,
      getFlag: (scope, key) => (scope === "warhammer-dbc" && key === "commandedBy") ? commandedBy : undefined
    };
  }

  it("не-миньон (персонаж/техника/демон) — гейт вообще не применяется", () => {
    expect(minionCanCauseExtremeDamage({ type: "character", uuid: "Actor.c1" })).toBe(true);
    expect(minionCanCauseExtremeDamage({ type: "vehicle", uuid: "Actor.v1" })).toBe(true);
  });

  it("миньон вне Отряда и без commandedBy — не может", () => {
    globalThis.game.actors = [];
    expect(minionCanCauseExtremeDamage(minion())).toBe(false);
  });

  it("миньон в Отряде с активным Присутствием «extreme» — может", () => {
    const s = { type: "squad", system: {
      posts: {}, members: [{ uuid: "Actor.min1" }],
      presence: { active: true, benefit: "extreme" }
    } };
    globalThis.game.actors = [s];
    expect(minionCanCauseExtremeDamage(minion())).toBe(true);
  });

  it("миньон в Отряде, но Присутствие другое (не extreme) — не может", () => {
    const s = { type: "squad", system: {
      posts: {}, members: [{ uuid: "Actor.min1" }],
      presence: { active: true, benefit: "focus" }
    } };
    globalThis.game.actors = [s];
    expect(minionCanCauseExtremeDamage(minion())).toBe(false);
  });

  it("миньон в Отряде, но Присутствие не активно — не может", () => {
    const s = { type: "squad", system: {
      posts: {}, members: [{ uuid: "Actor.min1" }],
      presence: { active: false, benefit: "extreme" }
    } };
    globalThis.game.actors = [s];
    expect(minionCanCauseExtremeDamage(minion())).toBe(false);
  });

  it("миньон вне Отряда, но «Под моим Присутствием» командира с extreme — может", () => {
    globalThis.game.actors = [];
    const commander = { uuid: "Actor.cmd1",
      system: { command: { presence: { active: true, benefit: "extreme" } } } };
    globalThis.fromUuidSync = uuid => uuid === "Actor.cmd1" ? commander : null;
    expect(minionCanCauseExtremeDamage(minion({ commandedBy: { uuid: "Actor.cmd1", name: "Командир" } }))).toBe(true);
  });

  it("commandedBy указывает на удалённого командира — не падает, не может", () => {
    globalThis.game.actors = [];
    globalThis.fromUuidSync = () => null;
    expect(minionCanCauseExtremeDamage(minion({ commandedBy: { uuid: "Actor.gone", name: "?" } }))).toBe(false);
  });
});

describe("minionCanCauseExtremeDamage: Орда («Контроль Орды» — эффект 1 Присутствия)", () => {
  const horde = (commandedBy = null) => ({
    type: "horde", uuid: "Actor.h1",
    getFlag: (scope, key) => (scope === "warhammer-dbc" && key === "commandedBy") ? commandedBy : undefined
  });

  it("без Присутствия Орда Экстремального Урона не наносит", () => {
    globalThis.game.actors = [];
    expect(minionCanCauseExtremeDamage(horde())).toBe(false);
  });

  it("в Отряде с Присутствием «Экстремальный Урон» — наносит", () => {
    globalThis.game.actors = [{ type: "squad", system: {
      posts: {}, members: [{ uuid: "Actor.h1" }], presence: { active: true, benefit: "extreme" } } }];
    expect(minionCanCauseExtremeDamage(horde())).toBe(true);
  });
});
