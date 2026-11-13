// test/apps/psyber-link.test.mjs
//
// dbc-114 / 55-15 (13.11.2026): Трейт «Псайбер» — кнопка «Связать с хозяином»
// (apps/psyber-link.mjs). Окно DialogV2 в юнит-тесте не открыть — проверяются
// чистые части выбора хозяина и данные самой Черты в паке.

import "../support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { psyberMasterCandidates, mastersOf } from "../../module/apps/psyber-link.mjs";

const actor = (id, name, type = "character", extra = {}) => ({ id, name, type, uuid: `Actor.${id}`, system: extra, getFlag: () => undefined });

describe("кого можно назвать хозяином", () => {
  const psyber = actor("p", "Серво-череп", "minion");
  it("без самого псайбера, только персонажи/миньоны/демоны; псайкеры первыми", () => {
    const list = psyberMasterCandidates([
      psyber, actor("a", "Борис"), actor("b", "Анна", "character", { isPsyker: true }),
      actor("c", "Конь", "vehicle"), actor("d", "Демон", "daemon")
    ], psyber);
    expect(list.map(a => a.name)).toEqual(["Анна", "Борис", "Демон"]);
  });
  it("пустой мир — пустой список", () => {
    expect(psyberMasterCandidates([], psyber)).toEqual([]);
    expect(psyberMasterCandidates(null, psyber)).toEqual([]);
  });
});

describe("кто сейчас хозяин", () => {
  const psyber = actor("p", "Псайбер", "minion");
  const holder = (id, uuid) => ({ ...actor(id, id), getFlag: (_s, k) => (k === "psychicVessel" && uuid ? { uuid, name: "x" } : undefined) });
  it("хозяева — те, у кого носитель указывает на этого псайбера", () => {
    const m = mastersOf([holder("a", "Actor.p"), holder("b", "Actor.other"), holder("c", null)], psyber);
    expect(m.map(a => a.id)).toEqual(["a"]);
  });
});

describe("Черта в паке несёт кнопку связи", () => {
  it("запись kind:script вызывает linkPsyberToMaster", () => {
    const dir = path.resolve("packs-src/traits");
    const f = fs.readdirSync(dir).find(x => x.startsWith("Psyber___"));
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const e = j.flags["warhammer-dbc"].mechanics.flatMap(g => g.entries).find(x => x.kind === "script");
    expect(e).toBeTruthy();
    expect(e.code).toContain("linkPsyberToMaster(actor)");
  });
});
