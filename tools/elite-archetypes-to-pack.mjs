// tools/elite-archetypes-to-pack.mjs
// ════════════════════════════════════════════════════════════════════════
//  Элитные архетипы из констант в компендиум packs-src/elite-archetypes.
//
//  До сих пор они жили только в module/constants/elite-archetypes.mjs и
//  раскладывались по библиотекам Черт и Талантов: сам архетип как сущность
//  нигде не лежал, и ни открыть его, ни поправить в игре было нельзя.
//
//  Трейты и Дополнительные Таланты в документ НЕ копируются — они уже есть в
//  паках `traits` и `talents`, в папке «Элитные архетипы». Здесь только имена
//  списком: одно и то же не должно править́ся в двух местах.
//
//  id документа выводится из имени хешем, а не берётся случайным: повторный
//  прогон обязан дать тот же файл, иначе круговорот сборки показывал бы правку
//  на пустом месте (тот же приём — в races-to-pack.mjs).
//
//  Запуск:  node tools/elite-archetypes-to-pack.mjs [--write]
// ════════════════════════════════════════════════════════════════════════

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { ELITE_ARCHETYPES } from "../module/constants/elite-archetypes.mjs";
import { packFileName } from "./pack-file-name.mjs";

const ROOT   = "packs-src/elite-archetypes";
const NS     = "warhammer-dbc";
const IMG    = "icons/svg/upgrade.svg";
const SOURCE = "DoomBC — Основная книга";

/** id из имени: 16 символов, устойчиво между прогонами. */
const idOf = (name) => createHash("sha1").update(`elite:${name}`).digest("base64")
  .replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);

/** Ключ архетипа — латиницей, для ссылок из кода и требований. */
const keyOf = (name) => createHash("sha1").update(`elitekey:${name}`).digest("hex").slice(0, 8);

/** Папка компендиума = раса, к которой архетип привязан. */
function folderDoc(label) {
  const id = idOf(`folder:${label}`);
  return {
    name: label, type: "Item", _id: id, sorting: "a", color: null,
    flags: {}, folder: null, sort: 0,
    _stats: { systemId: NS, systemVersion: "0.1.0" },
    _key: `!folders!${id}`
  };
}

export function eliteDocs() {
  const out = [];
  const folders = new Map();

  for (const arch of ELITE_ARCHETYPES) {
    // Папка — по первой расе из требования: у книги там перечень («Друкхари,
    // Развалина, Сслит»), и папка на каждое сочетание раздробила бы библиотеку
    // на девять почти пустых. Полный перечень остаётся в самом документе.
    const folderLabel = String(arch.race || "Прочие").split(",")[0].trim() || "Прочие";
    if (!folders.has(folderLabel)) folders.set(folderLabel, folderDoc(folderLabel));
    const folder = folders.get(folderLabel);
    const id = idOf(arch.name);

    // Цена стоит в самом требовании книги хвостом «2000 xp» — вынимаем её в
    // своё поле: по нему считается покупка и удвоение за каждый следующий
    // Элитный архетип. В тексте требований она остаётся как есть.
    const costMatch = String(arch.req || "").match(/(\d[\d\s]*)\s*xp/i);
    const cost = costMatch ? parseInt(costMatch[1].replace(/\s+/g, ""), 10) || 0 : 0;

    const doc = {
      name: arch.name, type: "eliteArchetype", img: IMG,
      system: {
        key: keyOf(arch.name),
        cost,
        requirements: { primary: [], secondary: [] },
        race: arch.race || "", god: arch.god || "",
        req: arch.req || "", charBonus: arch.charBonus || "",
        freeTalents: arch.freeTalents || "", gear: arch.gear || "",
        traits:  [...(arch.traits  || [])],
        talents: [...(arch.talents || [])],
        description: "", notes: "", bookSource: SOURCE
      },
      _id: id, effects: [], folder: folder._id, sort: 0,
      ownership: { default: 0 },
      flags: {},
      _stats: { compendiumSource: null, duplicateSource: null, exportSource: null,
                coreVersion: "14.365", systemId: NS, systemVersion: "0.1.0",
                createdTime: null, modifiedTime: null, lastModifiedBy: null },
      _key: `!items!${id}`
    };

    out.push({ path: join(ROOT, folderLabel.replace(/\s+/g, "_"), packFileName(arch.name, id)), doc });
  }

  // Папки идут первыми: распаковщик кладёт их в «_Folder.json» рядом с файлами.
  return [
    ...[...folders.values()].map(f => ({ path: join(ROOT, f.name.replace(/\s+/g, "_"), "_Folder.json"), doc: f })),
    ...out
  ];
}

export function run({ write = false } = {}) {
  const all = eliteDocs();
  if (write) {
    for (const { path, doc } of all) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(doc, null, 2) + "\n");
    }
  }
  const archetypes = all.filter(d => d.doc.type === "eliteArchetype").length;
  return { archetypes, folders: all.length - archetypes };
}

if (process.argv[1]?.endsWith("elite-archetypes-to-pack.mjs")) {
  const res = run({ write: process.argv.includes("--write") });
  console.log(`Элитных архетипов: ${res.archetypes}, папок: ${res.folders}`);
}
