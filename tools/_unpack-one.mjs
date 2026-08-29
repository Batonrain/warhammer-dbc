// tools/_unpack-one.mjs — закоммичен и активно используется, не одноразовый.
// Точечно снимает правки одного пака из LevelDB в packs-src, не трогая остальные.
// Запуск: node tools/_unpack-one.mjs <имя пака>

import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { existsSync } from "node:fs";
import { NAME_LIMIT, safe } from "./pack-file-name.mjs";
import { LIBRARY_PACKS, abs, isPacksBusy, reportBusy } from "./packs.mjs";
import { join } from "node:path";

const name = process.argv[2];
const p = LIBRARY_PACKS.find(x => x.name === name);
if (!p) {
  console.error(`Пак не найден: ${name}`);
  process.exit(1);
}

const transformFolderName = (doc) => (doc.name ? safe(doc.name) : doc._id);
const transformName = (doc, { documentType, folder }) => {
  if (documentType === "Folder") return null;
  const stem = doc.name ? `${safe(doc.name).slice(0, NAME_LIMIT)}_${doc._id}` : doc._id;
  return folder ? join(folder, `${stem}.json`) : `${stem}.json`;
};

if (!existsSync(abs(p.dir, "CURRENT"))) {
  console.error(`В ${p.dir} нет базы LevelDB`);
  process.exit(1);
}

try {
  await extractPack(abs(p.dir), abs(p.src), {
    folders: true, clean: true, omitVolatile: true, transformFolderName, transformName
  });
  console.log(`извлечён ${p.name} → ${p.src}`);
} catch (e) {
  if (isPacksBusy(e)) { reportBusy(e, "снять"); process.exit(1); }
  throw e;
}
