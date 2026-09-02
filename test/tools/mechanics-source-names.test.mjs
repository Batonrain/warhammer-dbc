// test/tools/mechanics-source-names.test.mjs
//
// Записи Конструктора (flags.warhammer-dbc.mechanics[].entries[]) кэшируют имя
// источника (sourceName) рядом со ссылкой (sourceUuid) — рантайм всегда решает
// по uuid (resolveMechSource в module/apps/mechanics.mjs), sourceName нужен
// только для показа в UI без похода в компендиум. Переименование источника
// (напр. Hulking → Size(+1), Gene-Splice → Гено-Сплайс, коммит c87b1c21) не
// трогает ссылки автоматически — sourceName молча остаётся старым текстом,
// пока кто-то не откроет именно этот документ в Конструкторе руками. Проверка
// идёт по ВСЕМ пакам-библиотекам (не только Расам, где уже была своя проверка
// в races-to-pack.test.mjs), потому что цитировать Черту/Талант/Умение по
// sourceUuid может документ любой категории — Архетип, Элитный архетип,
// Происхождение и так далее.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { LIBRARY_PACKS, abs } from "../../tools/packs.mjs";

const SOURCE_UUID_RE = /^Compendium\.warhammer-dbc\.([a-zA-Z0-9_-]+)\.(?:Item\.|Actor\.)?([a-zA-Z0-9]{16})$/;

/** Все JSON-документы пака: путь (для отчёта) + разобранное содержимое. */
function packFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (e.isDirectory() || !e.name.endsWith(".json") || e.name.startsWith("_")) continue;
    const file = path.join(e.parentPath ?? e.path, e.name);
    out.push({ file, doc: JSON.parse(fs.readFileSync(file, "utf8")) });
  }
  return out;
}

// id → актуальное имя документа, по каждому паку отдельно (лениво, раз на пак).
const nameIndex = new Map();
function namesOf(pack) {
  if (!nameIndex.has(pack)) {
    const idx = new Map();
    for (const { doc } of packFiles(abs(`packs-src/${pack}`))) idx.set(doc._id, doc.name);
    nameIndex.set(pack, idx);
  }
  return nameIndex.get(pack);
}

/**
 * Все ссылки sourceUuid/sourceName Механики по всем пакам-библиотекам, плюс
 * тот же паттерн у kind:"integralAttack"/"equipment" — там пара полей
 * называется equipSourceUuid/equipSourceName (module/apps/mechanics.mjs,
 * buildIntegralAttackData), но подвержена ровно той же болезни (переименовали
 * предмет-источник — sourceName в записи Механики молча устарел), а отдельной
 * проверки под неё раньше не было. Нормализуем оба вида ссылок в одну форму
 * {uuid, name}, чтобы обе проверки ниже работали над обоими полями разом.
 */
function allMechanicsRefs() {
  const refs = [];
  for (const pack of LIBRARY_PACKS) {
    for (const { file, doc } of packFiles(abs(pack.src))) {
      const mechanics = doc.flags?.["warhammer-dbc"]?.mechanics;
      if (!Array.isArray(mechanics)) continue;
      for (const group of mechanics) {
        for (const entry of group.entries ?? []) {
          if (entry.sourceUuid) refs.push({ file, docName: doc.name, uuid: entry.sourceUuid, name: entry.sourceName });
          if (entry.equipSourceUuid) refs.push({ file, docName: doc.name, uuid: entry.equipSourceUuid, name: entry.equipSourceName });
        }
      }
    }
  }
  return refs;
}

describe("sourceName Механики не отстаёт от переименований источника", () => {
  const refs = allMechanicsRefs();

  it("ссылки вообще находятся (проверка не выродилась в пустышку)", () => {
    expect(refs.length).toBeGreaterThan(1000);
  });

  it("каждый sourceUuid/equipSourceUuid резолвится в документ своего пака", () => {
    const broken = [];
    for (const { file, docName, uuid } of refs) {
      const m = uuid.match(SOURCE_UUID_RE);
      if (!m) { broken.push(`${file} (${docName}): нераспознанный формат sourceUuid "${uuid}"`); continue; }
      const [, pack, id] = m;
      if (!namesOf(pack).has(id))
        broken.push(`${file} (${docName}): ${uuid} не найден в packs-src/${pack}`);
    }
    expect(broken).toEqual([]);
  });

  it("sourceName/equipSourceName совпадает с текущим именем документа-источника", () => {
    const stale = [];
    for (const { file, docName, uuid, name } of refs) {
      const m = uuid.match(SOURCE_UUID_RE);
      if (!m) continue; // формат — предыдущая проверка
      const [, pack, id] = m;
      const currentName = namesOf(pack).get(id);
      if (currentName === undefined) continue; // отсутствие — предыдущая проверка
      if (name !== currentName)
        stale.push(`${file} (${docName}): sourceName="${name}" ≠ актуальное "${currentName}" (${uuid})`);
    }
    expect(stale).toEqual([]);
  });
});
