// test/data/removed-duplicate-items.test.mjs
//
// Решения владельца 02.10.2026: «Сцепной Щит» (wdbc-lvzu) и «Броня Сверкающие
// Копья» (wdbc-nlzc) — повреждённые дубли Lock Shield и Shining Spear Armour,
// удалены из packs-src. Сторож держит два условия:
//  1) удалённых _id нет ни в одном документе пака и ни в одном модуле — то есть
//     ни одна ссылка (UUID, id в списках выдачи) не повисла в пустоте;
//  2) оригиналы на месте, иначе перенацеливать было бы не на что.

import "../support/foundry-stub.mjs";

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

import { allPacksFiles, allPackDocuments, packFileText, PACK_SCAN_TIMEOUT } from "../support/pack-docs.mjs";

const MODULE_DIR = path.resolve(import.meta.dirname, "../../module");

const REMOVED = [
  { id: "IqFIOaRUQ7P50tvL", pack: "weapons", name: "Сцепной Щит",           keeper: "AWHl6lL6Ry663xFG", keeperName: "Lock Shield / Оцепительный Щит" },
  { id: "FArWRkuer5PrVxJi", pack: "armor",   name: "Броня Сверкающие Копья", keeper: "DKVeCixs9WxEiv1J", keeperName: "Shining Spear Armour / Броня Сияющего Копья" }
];

function moduleFiles(dir = MODULE_DIR) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return moduleFiles(full);
    return /\.(mjs|js|hbs|json)$/.test(e.name) ? [full] : [];
  });
}

describe("удалённые дубли: ссылок на них не осталось", () => {
  for (const r of REMOVED) {
    it(`${r.name}: в паке «${r.pack}» документа нет`, () => {
      const docs = allPackDocuments(r.pack);
      expect(docs.filter(({ doc }) => doc._id === r.id)).toEqual([]);
      expect(docs.filter(({ doc }) => doc.name === r.name)).toEqual([]);
    }, PACK_SCAN_TIMEOUT);

    it(`${r.name}: _id ${r.id} не встречается ни в одном файле packs-src`, () => {
      const hits = allPacksFiles({ includeFolders: true })
        .filter(f => packFileText(f).includes(r.id));
      expect(hits).toEqual([]);
    }, PACK_SCAN_TIMEOUT);

    it(`${r.name}: _id ${r.id} не встречается в module/`, () => {
      const hits = moduleFiles().filter(f => fs.readFileSync(f, "utf8").includes(r.id));
      expect(hits).toEqual([]);
    });

    it(`${r.name}: оригинал «${r.keeperName}» на месте`, () => {
      const keeper = allPackDocuments(r.pack).find(({ doc }) => doc._id === r.keeper);
      expect(keeper?.doc.name).toBe(r.keeperName);
    }, PACK_SCAN_TIMEOUT);
  }
});
