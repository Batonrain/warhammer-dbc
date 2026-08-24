// test/constants/mutations-item-data.test.mjs
//
// mutationItemData(name, godKey) — единственный источник Механики выданной
// Мутации/Дара (flags.warhammer-dbc.mechanics живёт только в компендиуме,
// см. [[doombc-submutation-mechanics-gate]]). Раньше функция была синхронной
// и просто отдавала текст из constants/mutations.mjs; теперь она СНАЧАЛА
// ищет документ в собранном паке `warhammer-dbc.mutations` (тот же приём, что
// resolveMechSource в apps/mechanics.mjs — индекс по имени), и только если
// пака нет или совпадения не нашлось — откатывается на прежний текстовый
// запасной путь (тогда предмет создаётся БЕЗ Механики — до сборки пака иначе
// и быть не может).

import "../support/foundry-stub.mjs";

import { describe, it, expect, beforeEach } from "vitest";
import { mutationItemData } from "../../module/constants/mutations.mjs";

/** Подставной пак: index — как getIndex({fields}) реально отдаёт, documents — полные объекты по _id. */
function fakePack(index, documents) {
  return {
    getIndex: async () => index,
    getDocument: async (id) => documents[id] ? { toObject: () => documents[id] } : null
  };
}

beforeEach(() => {
  globalThis.game.packs = undefined;
});

describe("mutationItemData — без собранного пака", () => {
  it("нет game.packs вовсе — запасной путь из constants, без Механики", async () => {
    const data = await mutationItemData("Крылья");
    expect(data.name).toBe("Крылья");
    expect(data.flags).toBeUndefined();
  });

  it("game.packs есть, но нужного пака нет — тот же запасной путь", async () => {
    globalThis.game.packs = new Map();
    const data = await mutationItemData("Крылья");
    expect(data.name).toBe("Крылья");
  });

  it("неизвестное имя — синтетическая запись, как раньше", async () => {
    const data = await mutationItemData("Совсем Другая Мутация");
    expect(data.type).toBe("mutation");
    expect(data.system.benefit).toBe("");
  });
});

describe("mutationItemData — пак собран", () => {
  it("совпадение по имени — приезжает Механика из документа пака", async () => {
    globalThis.game.packs = new Map([["warhammer-dbc.mutations", fakePack(
      [{ _id: "id1", name: "Крылья", system: { god: "" } }],
      { id1: { name: "Крылья", type: "mutation", system: { benefit: "..." },
               flags: { "warhammer-dbc": { mechanics: [{ id: "g1", operator: "AND", entries: [] }] } } } }
    )]]);
    const data = await mutationItemData("Крылья");
    expect(data.flags["warhammer-dbc"].mechanics).toHaveLength(1);
  });

  it("одноимённый Дар у разных Богов — берётся именно свой (godKey сверяется с system.god индекса)", async () => {
    globalThis.game.packs = new Map([["warhammer-dbc.mutations", fakePack(
      [
        { _id: "khorne-id", name: "Инфернальный Оруженосец", system: { god: "khorne" } },
        { _id: "tzeentch-id", name: "Инфернальный Оруженосец", system: { god: "tzeentch" } }
      ],
      {
        "khorne-id":   { name: "Инфернальный Оруженосец", type: "mutation", system: { god: "khorne" },
                          flags: { "warhammer-dbc": { mechanics: [{ id: "khorne-g" }] } } },
        "tzeentch-id": { name: "Инфернальный Оруженосец", type: "mutation", system: { god: "tzeentch" },
                          flags: { "warhammer-dbc": { mechanics: [{ id: "tzeentch-g" }] } } }
      }
    )]]);
    const khorne = await mutationItemData("Инфернальный Оруженосец", "khorne");
    const tzeentch = await mutationItemData("Инфернальный Оруженосец", "tzeentch");
    expect(khorne.flags["warhammer-dbc"].mechanics[0].id).toBe("khorne-g");
    expect(tzeentch.flags["warhammer-dbc"].mechanics[0].id).toBe("tzeentch-g");
  });

  it("пак упал (getIndex бросает) — тихий откат на запасной путь, не падает", async () => {
    globalThis.game.packs = new Map([["warhammer-dbc.mutations",
      { getIndex: async () => { throw new Error("недоступен"); } }]]);
    const data = await mutationItemData("Крылья");
    expect(data.name).toBe("Крылья");
    expect(data.flags).toBeUndefined();
  });
});
