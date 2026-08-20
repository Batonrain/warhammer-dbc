// test/tools/elite-archetypes-pack.test.mjs
//
// Элитные архетипы как библиотека компендиума (корбук стр. 114-164).
//
// До сих пор они жили только в константах: сам архетип нигде не лежал
// документом, и ни открыть его в игре, ни поправить было нельзя — правились
// лишь его Черты и Таланты, разложенные по чужим библиотекам.
//
// Проверяется то, что легко разъезжается: полнота переноса, устойчивость id
// (иначе круговорот сборки показывал бы правку на пустом месте) и объявление
// пака в system.json вместе с местом в дереве папок.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { ELITE_ARCHETYPES } from "../../module/constants/elite-archetypes.mjs";
import { eliteDocs } from "../../tools/elite-archetypes-to-pack.mjs";
import { packFileName } from "../../tools/pack-file-name.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const system = JSON.parse(fs.readFileSync(path.join(root, "system.json"), "utf8"));
const template = JSON.parse(fs.readFileSync(path.join(root, "template.json"), "utf8"));

const docsOnly = list => list.filter(d => d.doc.type === "eliteArchetype");

describe("перенос Элитных архетипов в компендиум", () => {
  it("переносятся все до одного", () => {
    expect(docsOnly(eliteDocs())).toHaveLength(ELITE_ARCHETYPES.length);
  });

  it("документ несёт требования, бонусы и снаряжение как есть", () => {
    const src = ELITE_ARCHETYPES[0];
    const { doc } = docsOnly(eliteDocs()).find(d => d.doc.name === src.name);

    expect(doc.system.race).toBe(src.race);
    expect(doc.system.req).toBe(src.req);
    expect(doc.system.charBonus).toBe(src.charBonus);
    expect(doc.system.freeTalents).toBe(src.freeTalents);
  });

  // Сами Черты и Таланты лежат в библиотеках `traits` и `talents`; здесь только
  // имена, иначе одно и то же правилось бы в двух местах.
  it("Трейты и Таланты — именами, а не копиями", () => {
    const src = ELITE_ARCHETYPES.find(a => a.traits?.length && a.talents?.length);
    const { doc } = docsOnly(eliteDocs()).find(d => d.doc.name === src.name);

    expect(doc.system.traits).toEqual(src.traits.map(t => t[0]));
    expect(doc.system.talents).toEqual(src.talents.map(t => t[0]));
    expect(doc.system.traits.every(t => typeof t === "string")).toBe(true);
  });

  // Повторный прогон обязан дать те же файлы: id выводится из имени хешем, а не
  // берётся случайным — иначе круговорот сборки видел бы правку на ровном месте.
  it("id устойчивы между прогонами", () => {
    const a = docsOnly(eliteDocs()).map(d => `${d.doc.name}:${d.doc._id}`);
    const b = docsOnly(eliteDocs()).map(d => `${d.doc.name}:${d.doc._id}`);
    expect(a).toEqual(b);
    expect(new Set(a.map(x => x.split(":")[1])).size).toBe(a.length);
  });

  it("имена файлов — тем же правилом, что у распаковщика", () => {
    const wrong = docsOnly(eliteDocs())
      .filter(({ path: p, doc }) => path.basename(p) !== packFileName(doc.name, doc._id));
    expect(wrong).toEqual([]);
  });

  it("папки собраны по первой расе, а не по перечню", () => {
    const folders = [...new Set(eliteDocs()
      .filter(d => d.doc.type === "Item")
      .map(d => d.doc.name))];
    // «Друкхари, Развалина, Сслит» не должно становиться отдельной папкой.
    expect(folders.every(f => !f.includes(","))).toBe(true);
    expect(folders).toContain("Друкхари");
  });
});

describe("объявление библиотеки", () => {
  it("тип предмета объявлен", () => {
    expect(template.Item.types).toContain("eliteArchetype");
  });

  it("пак объявлен рядом с обычными Архетипами", () => {
    const pack = system.packs.find(p => p.name === "elite-archetypes");
    expect(pack).toBeTruthy();
    expect(pack.type).toBe("Item");
    expect(pack.path).toBe("packs/elite-archetypes");
  });

  it("пак стоит в дереве папок — иначе его не найти в игре", () => {
    const has = nodes => (nodes || []).some(n =>
      (n.packs || []).includes("elite-archetypes") || has(n.folders));
    expect(has(system.packFolders)).toBe(true);
  });
});
