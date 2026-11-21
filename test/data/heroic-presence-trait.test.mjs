// test/data/heroic-presence-trait.test.mjs
//
// Sahara 585-venerable: Талант Дредноута «Venerable / Почтенный» (Книга Машин,
// стр. 58) «даёт трейт Heroic Presence», а самого Трейта машин (стр. 9) в паке
// vehicle-traits не было — ГМу нечего было повесить на Дредноут.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

function packDocs(pack) {
  const dir = path.join(root, "packs-src", pack);
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(f =>
    f.isDirectory() ? walk(path.join(d, f.name))
      : (f.name.endsWith(".json") && f.name !== "_Folder.json" ? [path.join(d, f.name)] : []));
  return walk(dir).map(file => JSON.parse(fs.readFileSync(file, "utf8")));
}

describe("Трейт машин Heroic Presence", () => {
  it("лежит в паке Трейтов машин с текстом книги и честной пометкой", () => {
    const doc = packDocs("vehicle-traits").find(d => d.name === "Heroic Presence / Героическое Присутствие");
    expect(doc?.type).toBe("vehicleTrait");
    expect(doc._id).toMatch(/^[A-Za-z0-9]{16}$/);
    expect(doc.system.description).toMatch(/Храбрость, Сплочение и Прикрытие на 3 успеха/);
    expect(doc.system.notes.trim()).not.toBe("");
  });

  it("Venerable больше не говорит, что Трейта нет в компендиуме", () => {
    const venerable = packDocs("talents").find(d => d.name === "Venerable / Почтенный");
    expect(venerable.system.notes).not.toMatch(/Heroic Presence в компендиуме нет/);
  });
});
