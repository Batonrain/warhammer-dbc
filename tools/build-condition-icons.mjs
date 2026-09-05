// tools/build-condition-icons.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Генерирует статические SVG-файлы иконок Состояний (assets/conditions/
//  <key>.svg) из module/constants/conditions.mjs — единственного источника
//  истины по телу/цвету глифа (тот же body, что рисует тег на листе,
//  sheets/sheet-helpers.mjs::CONDITIONS_DEF).
//
//  Зачем: Foundry v14 валидирует поле img создаваемого ActiveEffect как
//  FilePathField — требует настоящий путь к файлу с расширением, data:
//  URI не проходит (wdbc-ahtb.1). apps/token-conditions.mjs::statusIconUri
//  раньше строил data:image/svg+xml,... на лету — actor.toggleStatusEffect
//  падал с ошибкой валидации, иконка Состояния никогда не появлялась на
//  токене ни для одного из 27 Состояний.
//
//  Файлы — сгенерированный артефакт, коммитятся в репозиторий (как и
//  packs/, собранные из packs-src/): перегенерировать после правки body/
//  color в constants/conditions.mjs через `node tools/build-condition-
//  icons.mjs`. test/tools/condition-icons-sync.test.mjs ловит расхождение,
//  если кто-то поправил constants/conditions.mjs и забыл перегенерировать.
// ════════════════════════════════════════════════════════════════════════════

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { CONDITIONS } from "../module/constants/conditions.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CONDITIONS_ICON_DIR = join(__dirname, "..", "assets", "conditions");

/** Готовый SVG-документ иконки Состояния — currentColor заменён на её собственный цвет (самостоятельный <img>, класса листа тут нет). */
export function conditionIconSvg(key) {
  const c = CONDITIONS[key];
  if (!c) return null;
  const body = c.body.replaceAll(/currentColor/g, c.color);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${body}</svg>\n`;
}

/** Путь ассета для движка (то, что кладётся в поле img ActiveEffect). */
export function conditionIconAssetPath(key) {
  return `systems/warhammer-dbc/assets/conditions/${key}.svg`;
}

/** Пишет по одному .svg на каждое Состояние — возвращает число записанных файлов. */
export function generateConditionIcons() {
  if (!existsSync(CONDITIONS_ICON_DIR)) mkdirSync(CONDITIONS_ICON_DIR, { recursive: true });
  let count = 0;
  for (const key of Object.keys(CONDITIONS)) {
    const svg = conditionIconSvg(key);
    writeFileSync(join(CONDITIONS_ICON_DIR, `${key}.svg`), svg, "utf8");
    count++;
  }
  return count;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const count = generateConditionIcons();
  console.log(`Иконки Состояний: записано ${count} файлов в ${CONDITIONS_ICON_DIR}`);
}
