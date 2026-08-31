// tools/_pack-one.mjs — закоммичен и активно используется, не одноразовый.
// Точечно пересобирает ОДИН пак из packs-src в LevelDB, не трогая остальные
// (полный packs:build пересобрал бы всё разом — небезопасно, когда другие
// паки новее .pack-stamp по причине, не связанной с текущей правкой).
// Запуск: node tools/_pack-one.mjs <имя пака>

import { compilePack } from "@foundryvtt/foundryvtt-cli";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { LIBRARY_PACKS, abs, isPacksBusy, reportBusy } from "./packs.mjs";

const name = process.argv[2];
const p = LIBRARY_PACKS.find(x => x.name === name);
if (!p) {
  console.error(`Пак не найден: ${name}`);
  process.exit(1);
}
if (!existsSync(abs(p.src))) {
  console.error(`нет исходника ${p.src} — пак ${p.name} остался бы пустым`);
  process.exit(1);
}

try {
  rmSync(abs(p.dir), { recursive: true, force: true });
  mkdirSync(abs(p.dir), { recursive: true });
  let docs = 0;
  await compilePack(abs(p.src), abs(p.dir), { recursive: true, transformEntry: () => { docs++; } });
  if (!docs) {
    console.error(`пак ${p.name} собрался бы пустым: в ${p.src} нет документов`);
    process.exit(1);
  }
  console.log(`собран ${p.name}: документов — ${docs}`);
} catch (e) {
  if (isPacksBusy(e)) { reportBusy(e, "собрать"); process.exit(1); }
  throw e;
}
