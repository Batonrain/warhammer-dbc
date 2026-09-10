// test/apps/demon-mount.test.mjs
//
// module/apps/demon-mount.mjs — демон-скакун «Рыцаря Бога» вселён в уже
// имеющегося скакуна/технику персонажа (wdbc-1rno), третий книжный исход
// общего noTest-ритуала (asMount), рядом с asMinion (module/apps/
// demon-summon.mjs) и asWeapon (module/apps/armiger-weapon.mjs). Фиксированные
// числа книги, не случайная таблица Осквернения — ритуал без теста, книга не
// даёт оснований для рандома.

import "../support/foundry-stub.mjs";
import { captured, resetCaptured } from "../support/foundry-stub.mjs";
import { beforeEach, describe, it, expect } from "vitest";
import { bindDemonMount, defaultBindDemonMountFn } from "../../module/apps/demon-mount.mjs";
import { isPossessed } from "../../module/rules/mount.mjs";

function bestiaryPack(entries) {
  return {
    getIndex: async () => entries,
    getDocument: async id => {
      const e = entries.find(x => x._id === id);
      return e ? { ...e, toObject: () => ({ ...e }) } : null;
    }
  };
}

function fakeWeapon(over = {}) {
  const updates = [];
  return {
    type: "weapon", name: "Рога",
    system: { weaponClass: "melee", damage: "1d10+3", ...over },
    async update(data) { updates.push(data); if (data["system.damage"] !== undefined) this.system.damage = data["system.damage"]; },
    _updates: updates
  };
}

function fakeMount({ type = "character", items = [], structure, wounds } = {}) {
  const updates = [];
  return {
    uuid: "Actor.mount", type, name: "Джаггернаут", items, flags: {},
    system: {
      ...(type === "vehicle" ? { structure: structure ?? { value: 20, max: 20 } } : { wounds: wounds ?? { value: 40, max: 40 } })
    },
    async update(data) { updates.push(data); Object.assign(this, foldUpdate(this, data)); },
    async createEmbeddedDocuments(docType, docs) { this._created = (this._created || []).concat(docs); return docs; },
    _updates: updates
  };
}

// Свернуть плоский "a.b.c": v в actor.a.b.c = v, чтобы проверять итоговое состояние.
function foldUpdate(actor, data) {
  const clone = { flags: actor.flags, system: actor.system };
  for (const [path, value] of Object.entries(data)) {
    const parts = path.split(".");
    let node = clone;
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] = node[parts[i]] ?? {};
      node = node[parts[i]];
    }
    node[parts.at(-1)] = value;
  }
  return clone;
}

function fakeRider() {
  const created = [];
  return {
    uuid: "Actor.rider", name: "Чемпион",
    async createEmbeddedDocuments(docType, docs) { created.push(...docs); return docs; },
    _created: created
  };
}

beforeEach(() => {
  resetCaptured();
  globalThis.game.user = {};
  globalThis.game.users = { activeGM: null };
  globalThis.game.packs = new Map();
  globalThis.fromUuid = async () => null;
});

describe("bindDemonMount — общее", () => {
  it("скакун/техника не найдены — ok:false", async () => {
    globalThis.fromUuid = async () => null;
    const res = await bindDemonMount("Actor.nope", fakeRider(), "Джаггернаут", "khorne");
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("не найдены");
  });

  it("скакун уже одержим — ok:false", async () => {
    const mount = fakeMount();
    mount.flags["warhammer-dbc"] = { mountPossession: { god: "khorne" } };
    globalThis.fromUuid = async () => mount;
    const res = await bindDemonMount("Actor.mount", fakeRider(), "Джаггернаут", "khorne");
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("уже одержим");
  });

  it("успех проставляет flags.warhammer-dbc.mountPossession с именем демона и богом", async () => {
    const mount = fakeMount();
    globalThis.fromUuid = async () => mount;
    const res = await bindDemonMount("Actor.mount", fakeRider(), "Скакун Слаанеш", "slaanesh");
    expect(res.ok).toBe(true);
    expect(res.mountName).toBe("Джаггернаут");
    const set = mount._updates.find(u => u["flags.warhammer-dbc.mountPossession"]);
    expect(set["flags.warhammer-dbc.mountPossession"]).toMatchObject({
      god: "slaanesh", demonName: "Скакун Слаанеш", subdued: true
    });
  });
});

describe("Рыцарь Кхорна — +8 AP стрелковым, доп. кубик Тарана/рукопашной", () => {
  it("mountPossession получает apRanged:8 и ramExtraDie:true", async () => {
    const mount = fakeMount();
    globalThis.fromUuid = async () => mount;
    await bindDemonMount("Actor.mount", fakeRider(), "Джаггернаут", "khorne");
    const set = mount._updates.find(u => u["flags.warhammer-dbc.mountPossession"]);
    expect(set["flags.warhammer-dbc.mountPossession"].apRanged).toBe(8);
    expect(set["flags.warhammer-dbc.mountPossession"].ramExtraDie).toBe(true);
  });

  it("оружие ближнего боя скакуна получает доп. кубик урона", async () => {
    const weapon = fakeWeapon({ weaponClass: "melee", damage: "1d10+3" });
    const mount = fakeMount({ items: [weapon] });
    globalThis.fromUuid = async () => mount;
    await bindDemonMount("Actor.mount", fakeRider(), "Джаггернаут", "khorne");
    expect(weapon.system.damage).toBe("2d10+3");
  });

  it("стрелковое оружие скакуна НЕ трогается", async () => {
    const weapon = fakeWeapon({ weaponClass: "ranged", damage: "1d10+3" });
    const mount = fakeMount({ items: [weapon] });
    globalThis.fromUuid = async () => mount;
    await bindDemonMount("Actor.mount", fakeRider(), "Джаггернаут", "khorne");
    expect(weapon.system.damage).toBe("1d10+3");
  });
});

describe("Рыцарь Нургла — +7 Ран/Структуры, авто-Трудный Ландшафт", () => {
  it("живой скакун — +7 к Ранам (max и value)", async () => {
    const mount = fakeMount({ type: "character", wounds: { value: 30, max: 30 } });
    globalThis.fromUuid = async () => mount;
    await bindDemonMount("Actor.mount", fakeRider(), "Паланкин Нургла", "nurgle");
    expect(mount.system.wounds.value).toBe(37);
    expect(mount.system.wounds.max).toBe(37);
  });

  it("техника — +7 к Структуре (max и value), не к Ранам", async () => {
    const mount = fakeMount({ type: "vehicle", structure: { value: 12, max: 12 } });
    globalThis.fromUuid = async () => mount;
    await bindDemonMount("Actor.mount", fakeRider(), "Паланкин Нургла", "nurgle");
    expect(mount.system.structure.value).toBe(19);
    expect(mount.system.structure.max).toBe(19);
  });

  it("mountPossession получает autoTerrain:true", async () => {
    const mount = fakeMount();
    globalThis.fromUuid = async () => mount;
    await bindDemonMount("Actor.mount", fakeRider(), "Паланкин Нургла", "nurgle");
    const set = mount._updates.find(u => u["flags.warhammer-dbc.mountPossession"]);
    expect(set["flags.warhammer-dbc.mountPossession"].autoTerrain).toBe(true);
  });
});

describe("Рыцарь Тзинча — щит-купол 1-50 скакуну И всаднику", () => {
  it("оба получают предмет-forcefield rating 50, без перегрузки", async () => {
    const mount = fakeMount();
    const rider = fakeRider();
    globalThis.fromUuid = async () => mount;
    await bindDemonMount("Actor.mount", rider, "Диск Тзинча", "tzeentch");

    expect(mount._created).toHaveLength(1);
    expect(mount._created[0].type).toBe("forcefield");
    expect(mount._created[0].system.ratingMax).toBe(50);
    expect(mount._created[0].system.overloadThreshold).toBe(0);

    expect(rider._created).toHaveLength(1);
    expect(rider._created[0].type).toBe("forcefield");
    expect(rider._created[0].system.ratingMax).toBe(50);
    expect(rider._created[0].system.overloadThreshold).toBe(0);
  });

  it("без переданного riderActor — скакуну щит всё равно достаётся", async () => {
    const mount = fakeMount();
    globalThis.fromUuid = async () => mount;
    const res = await bindDemonMount("Actor.mount", null, "Диск Тзинча", "tzeentch");
    expect(res.ok).toBe(true);
    expect(mount._created).toHaveLength(1);
  });
});

describe("Рыцарь Слаанеш — только пометка одержимости (+20 управление — отдельная запись на Мутации)", () => {
  it("не добавляет числовых полей сверх общего mountPossession", async () => {
    const mount = fakeMount();
    globalThis.fromUuid = async () => mount;
    await bindDemonMount("Actor.mount", fakeRider(), "Скакун Слаанеш", "slaanesh");
    const set = mount._updates.find(u => u["flags.warhammer-dbc.mountPossession"]);
    expect(Object.keys(set["flags.warhammer-dbc.mountPossession"]).sort())
      .toEqual(["binding", "demonInf", "demonName", "demonWb", "god", "pre", "properties", "subdued"]);
  });
});

// Пометка одержимости должна быть в ТОМ виде, который система читает:
// rules/mount.mjs::isPossessed смотрит именно demonWb, и от него зависят
// строка одержимости в панели «ВЕРХОМ» и «скакун ходит в Инициативу
// всадника». Без demonWb ритуал вселения был незаметен для листа, а у
// Слаанеш (нет своей ветки бонусов) не давал вообще ничего.
describe("вселение помечает скакуна одержимым так, как это читает система", () => {
  for (const god of ["khorne", "nurgle", "slaanesh", "tzeentch"]) {
    it(`${god}: isPossessed(скакун) === true после вселения`, async () => {
      const mount = fakeMount();
      globalThis.fromUuid = async () => mount;
      await bindDemonMount("Actor.mount", fakeRider(), "Скакун", god);
      const set = mount._updates.find(u => u["flags.warhammer-dbc.mountPossession"]);
      const flags = { "warhammer-dbc": { mountPossession: set["flags.warhammer-dbc.mountPossession"] } };
      expect(isPossessed({ flags })).toBe(true);
    });
  }
});

describe("маршрутизация вызова (defaultBindDemonMountFn)", () => {
  it("ГМ — вызывает напрямую", async () => {
    globalThis.game.user = { isGM: true };
    const mount = fakeMount();
    globalThis.fromUuid = async () => mount;
    await defaultBindDemonMountFn("Actor.mount", fakeRider(), "Джаггернаут", "khorne");
    expect(mount._updates.length).toBeGreaterThan(0);
    expect(captured.warnings).toEqual([]);
  });

  it("не ГМ, есть активный ГМ — шлёт сокет-релей", async () => {
    globalThis.game.user = { isGM: false, id: "user-1" };
    globalThis.game.users.activeGM = { id: "gm-1" };
    const emitted = [];
    globalThis.game.socket = { emit: (channel, data) => emitted.push({ channel, data }) };

    await defaultBindDemonMountFn("Actor.mount", { uuid: "Actor.rider" }, "Джаггернаут", "khorne");

    expect(emitted).toEqual([{
      channel: "system.warhammer-dbc",
      data: { action: "bindDemonMount", userId: "user-1", mountUuid: "Actor.mount", riderUuid: "Actor.rider", demonName: "Джаггернаут", god: "khorne" }
    }]);
  });

  it("не ГМ, нет активного ГМа — предупреждает, не бросает и не шлёт сокет", async () => {
    globalThis.game.user = { isGM: false, id: "user-1" };
    globalThis.game.users.activeGM = null;
    const emitted = [];
    globalThis.game.socket = { emit: (channel, data) => emitted.push({ channel, data }) };

    await defaultBindDemonMountFn("Actor.mount", fakeRider(), "Джаггернаут", "khorne");

    expect(emitted).toEqual([]);
    expect(captured.warnings.some(w => /активного Мастера/.test(w))).toBe(true);
  });

  it("пустые mountUuid/demonName — ничего не делает", async () => {
    globalThis.game.user = { isGM: true };
    await defaultBindDemonMountFn("", fakeRider(), "", "khorne");
    expect(captured.warnings).toEqual([]);
  });
});

// wdbc-his: три находки ревью по вселению.
describe("снимок «как было» и правильная база Структуры", () => {
  it("Нургл + байк с Чертой «Коляска»: +7 к ХРАНИМОЙ Структуре, а не к пересчитанной", async () => {
    const mount = fakeMount({ type: "vehicle", structure: { value: 15, max: 15 } });
    // rules/vehicle.mjs каждый пересчёт прибавляет Коляску прямо в рабочую
    // копию: хранимое 10, в памяти 15. Читая память, мы записали бы 22.
    mount._source = { system: { structure: { value: 10, max: 10 } } };
    globalThis.fromUuid = async () => mount;

    await bindDemonMount("Actor.mount", fakeRider(), "Паланкин Нургла", "nurgle");

    expect(mount.system.structure.max).toBe(17);   // 10 + 7, не 15 + 7
  });

  it("без Черты «Коляска» (хранимое = пересчитанному) результат прежний", async () => {
    const mount = fakeMount({ type: "vehicle", structure: { value: 12, max: 12 } });
    mount._source = { system: { structure: { value: 12, max: 12 } } };
    globalThis.fromUuid = async () => mount;
    await bindDemonMount("Actor.mount", fakeRider(), "Паланкин Нургла", "nurgle");
    expect(mount.system.structure.max).toBe(19);
  });

  it("снимок несёт исходный урон оружия — откат по нему, а не вычитанием кубика", async () => {
    const weapon = fakeWeapon({ weaponClass: "melee", damage: "1d10+3" });
    const mount = fakeMount({ items: [weapon] });
    globalThis.fromUuid = async () => mount;

    await bindDemonMount("Actor.mount", fakeRider(), "Джаггернаут", "khorne");

    const set = mount._updates.find(u => u["flags.warhammer-dbc.mountPossession"]);
    expect(set["flags.warhammer-dbc.mountPossession"].pre.damage).toEqual({ [weapon.id]: "1d10+3" });
    expect(weapon.system.damage).toBe("2d10+3");
  });

  it("снимок несёт исходный максимум Ран живого скакуна", async () => {
    const mount = fakeMount({ type: "character", wounds: { value: 30, max: 30 } });
    globalThis.fromUuid = async () => mount;
    await bindDemonMount("Actor.mount", fakeRider(), "Паланкин Нургла", "nurgle");
    const set = mount._updates.find(u => u["flags.warhammer-dbc.mountPossession"]);
    expect(set["flags.warhammer-dbc.mountPossession"].pre.woundsMax).toBe(30);
  });
});

describe("маршрутизация возвращает результат вызывающему", () => {
  it("ГМ: результат bindDemonMount доходит до карточки ритуала", async () => {
    globalThis.game.user = { isGM: true };
    const mount = fakeMount();
    globalThis.fromUuid = async () => mount;
    const res = await defaultBindDemonMountFn("Actor.mount", fakeRider(), "Джаггернаут", "khorne");
    expect(res).toMatchObject({ ok: true, mountName: "Джаггернаут" });
  });

  it("ГМ, скакун уже одержим: карточка узнаёт про отказ, а не печатает успех", async () => {
    globalThis.game.user = { isGM: true };
    const mount = fakeMount();
    mount.flags["warhammer-dbc"] = { mountPossession: { god: "khorne" } };
    globalThis.fromUuid = async () => mount;
    const res = await defaultBindDemonMountFn("Actor.mount", fakeRider(), "Джаггернаут", "khorne");
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("уже одержим");
  });

  it("нет активного Мастера — тоже отказ, а не молчаливое undefined", async () => {
    globalThis.game.user = { isGM: false };
    globalThis.game.users = { activeGM: null };
    const res = await defaultBindDemonMountFn("Actor.mount", fakeRider(), "Джаггернаут", "khorne");
    expect(res.ok).toBe(false);
  });
});
