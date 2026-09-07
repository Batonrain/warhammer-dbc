// tools/button-height-floor.mjs
// ════════════════════════════════════════════════════════════════════════
//  ПОЛ ВЫСОТЫ КНОПКИ (wdbc-5zgq).
//
//  Ядро Foundry держит для <button> пол:
//
//    styles/base/common.css — :where(.warhammer-dbc, #wh-hud, …) button
//                             { height: auto; min-height: var(--button-size); }
//
//  где --button-size = 2em ≈ 28px. Любая заданная нами высота НИЖЕ 28px без
//  явного `min-height: 0` (или своего меньшего min-height) не применяется
//  вовсе: кнопка рисуется 28px и раздвигает строку. Внешне это выглядит как
//  «кнопка чуть крупнее соседних» и живёт годами, пока кто-нибудь не замерит.
//
//  Здесь — замер. Правило считается нарушением, если ВСЕ три верны:
//    1. селектор упоминает класс, который в шаблонах стоит на <button>;
//    2. правило задаёт height меньше 28px;
//    3. ни оно само, ни соседнее правило на тот же элемент (сопоставление по
//       последнему классу селектора) не задаёт min-height — соседнее снимает
//       пол не хуже, так сделано у .adv-cat: высоту задаёт
//       `.warhammer-dbc .adv-cat`, а `min-height: 0` — `button.adv-cat`.
//
//  Ложные срабатывания всё равно возможны: пол может сниматься правилом с
//  ДРУГИМ, более общим селектором (так сделан весь лист Орды — один
//  `.wh-horde .hbtn { min-height: 0 }` на все его кнопки). Такие случаи
//  разбираются глазами, а число служит храповиком: вниз можно, вверх нельзя.
//
//    node tools/button-height-floor.mjs           — список нарушителей
// ════════════════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Пол ядра: --button-size = 2em при шрифте 14px. */
export const BUTTON_FLOOR_PX = 28;

function walk(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out);
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

/**
 * Классы кнопок из шаблонов и их соседи по элементу.
 *
 * Соседи нужны потому, что пол часто снимают ОДИН раз общим классом на все
 * кнопки листа — так сделан весь лист Орды: `.wh-horde .hbtn { min-height: 0 }`
 * снимает его и для `.horde-char-roll`, у которой своего min-height нет и не
 * нужно. Без учёта соседства такие кнопки числились бы нарушителями.
 *
 * @returns {{classes:Set<string>, neighbours:Map<string,Set<string>>}}
 */
export function buttonClasses() {
  const classes = new Set();
  const neighbours = new Map();
  for (const file of walk(path.join(ROOT, "templates"), ".hbs")) {
    const html = fs.readFileSync(file, "utf8");
    for (const m of html.matchAll(/<button\b([^>]*)>/g)) {
      for (const c of m[1].matchAll(/class="([^"]*)"/g)) {
        const own = c[1].split(/\s+/).filter(cls => cls && !cls.includes("{"));
        for (const cls of own) {
          classes.add(cls);
          const set = neighbours.get(cls) ?? new Set();
          for (const other of own) if (other !== cls) set.add(other);
          neighbours.set(cls, set);
        }
      }
    }
  }
  return { classes, neighbours };
}

/** Правила верхнего уровня: селектор + тело, без @-блоков. */
function rules(css) {
  const out = [];
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (!selector || selector.startsWith("@")) continue;
    out.push({ selector, body: m[2] });
  }
  return out;
}

const declared = (body, prop) => new RegExp(`(^|;|\\s)${prop}\\s*:`).test(body);

/** Последний класс селектора — тот элемент, к которому правило и применяется. */
function lastClass(selector) {
  const all = selector.match(/\.([A-Za-z_-][\w-]*)/g);
  return all ? all[all.length - 1].slice(1) : "";
}

/** Высота в пикселях, если она задана числом в px; иначе null. */
function heightPx(body) {
  const m = body.match(/(^|;|\s)height\s*:\s*([\d.]+)px/);
  return m ? Number(m[2]) : null;
}

/**
 * Правила, задающие кнопке высоту ниже пола ядра и не снимающие пол.
 * @returns {{file:string, selector:string, height:number}[]}
 */
export function findFloorOffenders() {
  const { classes, neighbours } = buttonClasses();
  const cssFiles = walk(path.join(ROOT, "styles"), ".css");
  const parsed = cssFiles.map(file => ({ file, all: rules(fs.readFileSync(file, "utf8")) }));

  // Классы, для которых пол снят хоть где-нибудь. Собирается по ВСЕМ файлам
  // сразу: правило, снимающее пол, часто лежит не там же, где высота (так у
  // `.adv-cat` — высоту задаёт `.warhammer-dbc .adv-cat`, а `min-height: 0`
  // приезжает от `button.adv-cat`). Сопоставление по ПОСЛЕДНЕМУ классу
  // селектора: он и есть сам элемент, к которому правило применяется.
  const lifted = new Set(
    parsed.flatMap(({ all }) => all
      .filter(r => declared(r.body, "min-height"))
      .flatMap(r => r.selector.split(",").map(lastClass)))
      .filter(Boolean));

  /** Снят ли пол у этого класса — сам по себе или общим правилом на соседа. */
  const floorLifted = (cls) =>
    lifted.has(cls) || [...(neighbours.get(cls) ?? [])].some(n => lifted.has(n));

  const offenders = [];
  for (const { file, all } of parsed) {
    for (const { selector, body } of all) {
      const h = heightPx(body);
      if (h == null || h >= BUTTON_FLOOR_PX) continue;
      if (declared(body, "min-height")) continue;
      if (selector.split(",").every(part => floorLifted(lastClass(part)))) continue;
      // Правило применяется к ПОСЛЕДНЕМУ классу селектора, и именно он должен
      // оказаться кнопкой. Иначе сюда попадали бы правила на внутренности
      // кнопки — например `.horde-char-roll .hi { height: 12px }` задаёт размер
      // значку внутри, а пол ядра к <i> не относится вовсе.
      if (!selector.split(",").some(part => classes.has(lastClass(part)))) continue;
      offenders.push({ file: path.relative(ROOT, file).replace(/\\/g, "/"), selector, height: h });
    }
  }
  return offenders;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const list = findFloorOffenders();
  for (const o of list) console.log(`${o.height}px  ${o.selector}   ${o.file}`);
  console.log(`\nвсего: ${list.length}`);
}
