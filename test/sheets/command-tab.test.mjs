// test/sheets/command-tab.test.mjs
//
// Панель «Под моим Присутствием»: командование теми, кто в Отряд не сведён.
// Главное отличие от листа Отряда — у сброда нет ни Слаженности, ни Риска:
// порог теста чистый Command(F), потолка Успехов нет.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { commandContext, addFollower, removeFollower, setFollowerNote,
         rollCommand, rallyHorde, toggleDetailPick, clearCommands,
         FOLLOWER_TYPES, COMMANDED_BY_FLAG } from "../../module/sheets/tabs/command.mjs";

/** Командир: Command(F) и блок Команд, как в схеме существа. */
function commander({ command = 45, followers = [], cmd = {} } = {}) {
  const updates = [];
  return {
    uuid: "Actor.boss", name: "Сержант", type: "character", updates,
    system: {
      skills: { command: { total: command } },
      followers,
      command: {
        presence:      { active: false, benefit: "extreme" },
        shortCommand:  { active: false, key: "inspire", successes: 0, note: "" },
        detailCommand: { active: false, successes: 0, picks: [] },
        ...cmd
      }
    },
    async update(data) {
      updates.push(data);
      for (const [path, value] of Object.entries(data)) {
        const keys = path.replace(/^system\./, "").split(".");
        let node = this.system;
        while (keys.length > 1) node = node[keys.shift()];
        node[keys[0]] = value;
      }
    }
  };
}

/** Подчинённый любого типа — с ручками для флага обратной метки. */
function follower({ name = "Боец", type = "character", uuid = `Actor.${name}`,
                    flags = {}, system = {} } = {}) {
  return {
    uuid, name, type, img: "img.png", flags,
    system: { characteristics: { wp: { total: 30 } }, ...system },
    getFlag: (_ns, key) => flags[key],
    async setFlag(_ns, key, value) { flags[key] = value; },
    async unsetFlag(_ns, key) { delete flags[key]; },
    async update(data) {
      for (const [path, value] of Object.entries(data)) {
        const keys = path.replace(/^system\./, "").split(".");
        let node = this.system;
        while (keys.length > 1) node = (node[keys[0]] ??= {}, node[keys.shift()]);
        node[keys[0]] = value;
      }
    }
  };
}

/** Заглушка разрешения uuid: панель ходит и через fromUuid, и через Sync. */
function registerActors(...actors) {
  const byUuid = Object.fromEntries(actors.map(a => [a.uuid, a]));
  globalThis.fromUuid = async uuid => byUuid[uuid] ?? null;
  globalThis.fromUuidSync = uuid => byUuid[uuid] ?? null;
}

beforeEach(() => {
  resetCaptured();
  globalThis.fromUuid = async () => null;
  globalThis.fromUuidSync = () => null;
  globalThis.canvas = {};
});

describe("состав под Присутствием", () => {
  it("берёт акторов любого допустимого типа, включая Орду и миньона", async () => {
    for (const type of FOLLOWER_TYPES) {
      const boss = commander();
      expect(await addFollower(boss, follower({ type, uuid: `Actor.${type}` }))).toBe(true);
      expect(boss.system.followers).toHaveLength(1);
    }
  });

  it("недопустимый тип не берётся", async () => {
    const boss = commander();
    expect(await addFollower(boss, follower({ type: "ship" }))).toBe(false);
    expect(boss.system.followers).toHaveLength(0);
  });

  it("сам себе командиром не записывается", async () => {
    const boss = commander();
    expect(await addFollower(boss, { ...follower(), uuid: boss.uuid })).toBe(false);
  });

  it("повтор не заводится", async () => {
    const boss = commander();
    const grunt = follower();
    await addFollower(boss, grunt);
    expect(await addFollower(boss, grunt)).toBe(false);
    expect(boss.system.followers).toHaveLength(1);
  });

  it("на подчинённом остаётся обратная метка со ссылкой на командира", async () => {
    const boss = commander();
    const grunt = follower();
    await addFollower(boss, grunt);
    expect(grunt.flags[COMMANDED_BY_FLAG]).toMatchObject({ uuid: "Actor.boss", name: "Сержант" });
  });

  it("вывод из-под Присутствия снимает метку", async () => {
    const boss = commander();
    const grunt = follower();
    registerActors(grunt);
    await addFollower(boss, grunt);
    await removeFollower(boss, 0);
    expect(boss.system.followers).toHaveLength(0);
    expect(grunt.flags[COMMANDED_BY_FLAG]).toBeUndefined();
  });

  it("чужую метку не снимает — подчинённого мог перехватить другой командир", async () => {
    const boss = commander();
    const grunt = follower({ flags: { [COMMANDED_BY_FLAG]: { uuid: "Actor.other", name: "Другой" } } });
    registerActors(grunt);
    boss.system.followers = [{ uuid: grunt.uuid, name: grunt.name, type: "character", note: "" }];
    await removeFollower(boss, 0);
    expect(grunt.flags[COMMANDED_BY_FLAG]).toMatchObject({ uuid: "Actor.other" });
  });

  it("заметка правится по месту", async () => {
    const boss = commander();
    await addFollower(boss, follower());
    await setFollowerNote(boss, 0, "держит левый фланг");
    expect(boss.system.followers[0].note).toBe("держит левый фланг");
  });
});

describe("что панель показывает про подчинённых", () => {
  it("у Орды помечает, что Команды до неё не доходят", () => {
    const horde = follower({ name: "Толпа", type: "horde",
      system: { magnitude: { value: 30, start: 40 }, psychDamage: 4 } });
    registerActors(horde);
    const boss = commander({ followers: [{ uuid: horde.uuid, name: "Толпа", type: "horde", note: "" }] });
    const ctx = commandContext(boss);
    expect(ctx.followers[0]).toMatchObject({ isHorde: true, psychDamage: 4 });
    expect(ctx.followers[0].reach.commands).toBe(false);
    expect(ctx.commandedHordes).toHaveLength(1);
  });

  it("предупреждает, когда выбранное преимущество до Орды не доходит", () => {
    const horde = follower({ name: "Толпа", type: "horde", system: { magnitude: { value: 30 } } });
    registerActors(horde);
    const boss = commander({
      followers: [{ uuid: horde.uuid, name: "Толпа", type: "horde", note: "" }],
      cmd: { presence: { active: false, benefit: "focus" } }
    });
    expect(commandContext(boss).followers[0].reach.presenceApplies).toBe(false);
  });

  it("до персонажа доходит всё", () => {
    const grunt = follower();
    registerActors(grunt);
    const boss = commander({ followers: [{ uuid: grunt.uuid, name: "Боец", type: "character", note: "" }] });
    const row = commandContext(boss).followers[0];
    expect(row.reach).toMatchObject({ commands: true, presenceApplies: true });
  });

  it("недоступный актор не роняет панель", () => {
    const boss = commander({ followers: [{ uuid: "Actor.нет", name: "Пропал", type: "character", note: "" }] });
    expect(commandContext(boss).followers[0].missing).toBe(true);
  });
});

describe("броски Команд без Отряда", () => {
  it("порог — чистый Command(F) плюс модификатор, без Слаженности", async () => {
    const boss = commander({ command: 45 });
    captured.nextRoll = 30;
    const res = await rollCommand(boss, "presence", { mod: 10 });
    expect(res.threshold).toBe(55);
  });

  it("Успехи не режутся потолком — Риска у сброда нет", async () => {
    const boss = commander({ command: 70 });
    captured.nextRoll = 5;                       // 7 Успехов
    expect((await rollCommand(boss, "short", { shortKey: "personal" })).successes).toBe(7);
  });

  it("успешное Присутствие включается и запоминает преимущество", async () => {
    const boss = commander();
    captured.nextRoll = 10;
    await rollCommand(boss, "presence", { benefit: "morale" });
    expect(boss.system.command.presence).toMatchObject({ active: true, benefit: "morale" });
  });

  it("провал ничего не включает", async () => {
    const boss = commander({ command: 20 });
    captured.nextRoll = 95;
    await rollCommand(boss, "presence");
    expect(boss.system.command.presence.active).toBe(false);
  });

  it("Короткая Команда даёт и преимущества Присутствия", async () => {
    const boss = commander();
    captured.nextRoll = 10;
    await rollCommand(boss, "short", { shortKey: "inspire" });
    expect(boss.system.command.presence.active).toBe(true);
    expect(boss.system.command.shortCommand.active).toBe(true);
  });

  it("карточка называет тех, до кого Команда не дошла", async () => {
    const horde = follower({ name: "Толпа", type: "horde", system: { magnitude: { value: 30 } } });
    registerActors(horde);
    const boss = commander({ followers: [{ uuid: horde.uuid, name: "Толпа", type: "horde", note: "" }] });
    captured.nextRoll = 10;
    await rollCommand(boss, "short");
    expect(captured.chat.map(c => c.content).join("")).toContain("Не получают");
  });

  it("карточка объясняет, почему нет Слаженности", async () => {
    captured.nextRoll = 10;
    await rollCommand(commander(), "presence");
    expect(captured.chat.map(c => c.content).join("")).toContain("не сведена в Отряд");
  });
});

describe("эффекты Детальной Команды", () => {
  it("покупаются, пока хватает Успехов", async () => {
    const boss = commander({ cmd: { detailCommand: { active: true, successes: 3, picks: [] } } });
    await toggleDetailPick(boss, "bravery");           // стоит 1
    await toggleDetailPick(boss, "rally");             // стоит 2
    expect(boss.system.command.detailCommand.picks).toEqual(["bravery", "rally"]);
  });

  it("сверх накопленного не покупаются", async () => {
    const boss = commander({ cmd: { detailCommand: { active: true, successes: 2, picks: [] } } });
    await toggleDetailPick(boss, "cover");             // стоит 3
    expect(boss.system.command.detailCommand.picks).toEqual([]);
  });

  it("повторный клик снимает выбор и возвращает Успехи", async () => {
    const boss = commander({ cmd: { detailCommand: { active: true, successes: 3, picks: ["rally"] } } });
    await toggleDetailPick(boss, "rally");
    expect(boss.system.command.detailCommand.picks).toEqual([]);
  });

  it("сброс гасит всё отданное", async () => {
    const boss = commander({ cmd: {
      presence: { active: true, benefit: "extreme" },
      detailCommand: { active: true, successes: 4, picks: ["rally"] }
    } });
    await clearCommands(boss);
    expect(boss.system.command.presence.active).toBe(false);
    expect(boss.system.command.detailCommand.picks).toEqual([]);
  });
});

describe("речь к Орде", () => {
  it("успех возвращает Магнитуду из психологического урона", async () => {
    const horde = follower({ name: "Толпа", type: "horde",
      system: { magnitude: { value: 30, start: 40 }, psychDamage: 6 } });
    registerActors(horde);
    captured.nextRoll = 10;                            // 4 Успеха при пороге 45
    const res = await rallyHorde(commander(), horde.uuid);
    expect(res.healed).toBe(4);
    expect(horde.system.magnitude.value).toBe(34);
    expect(horde.system.psychDamage).toBe(2);
  });

  it("лечит только психологический урон, не обычные потери", async () => {
    const horde = follower({ name: "Толпа", type: "horde",
      system: { magnitude: { value: 10, start: 40 }, psychDamage: 1 } });
    registerActors(horde);
    captured.nextRoll = 10;
    const res = await rallyHorde(commander(), horde.uuid);
    expect(res.healed).toBe(1);
    expect(horde.system.magnitude.value).toBe(11);
  });

  it("провал не возвращает ничего", async () => {
    const horde = follower({ name: "Толпа", type: "horde",
      system: { magnitude: { value: 30, start: 40 }, psychDamage: 6 } });
    registerActors(horde);
    captured.nextRoll = 99;
    expect((await rallyHorde(commander(), horde.uuid)).healed).toBe(0);
    expect(horde.system.magnitude.value).toBe(30);
  });

  it("по не-Орде речь не катится", async () => {
    const grunt = follower();
    registerActors(grunt);
    await rallyHorde(commander(), grunt.uuid);
    expect(captured.chat).toEqual([]);
  });
});
