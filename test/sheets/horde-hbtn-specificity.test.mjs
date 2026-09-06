// test/sheets/horde-hbtn-specificity.test.mjs
//
// Лист Орды задаёт всем маленьким кнопкам общий размер правилом с ДВУМЯ
// классами:
//
//   .wh-horde .hbtn { width: 26px; height: 24px; padding: 0; }
//
// Отдельные кнопки этот размер переопределяют — и вот тут повторяется одна и
// та же опечатка: правило пишут с ОДНИМ классом (`.horde-roll-btn { … }`).
// Вес (0,1,0) против (0,2,0) — общий размер побеждает всегда, порядок строк в
// файле роли не играет, и заданные автором числа не применяются НИКОГДА.
// Внешне это выглядит как «кнопка чуть крупнее соседних» и живёт годами, пока
// кто-нибудь не замерит (wdbc-gwpu: кубик атаки 26x24 вместо 22x22; кнопки
// психологических тестов — 26px в ширину вместо `width: auto` под текст).
//
// Тест статический и работает от разметки: собирает из horde-sheet.hbs классы,
// которые стоят на одном элементе с `hbtn`, и требует, чтобы каждое правило,
// переопределяющее для них размерные свойства, было написано минимум с двумя
// классами. Проверять сам итоговый размер здесь нечем — движка CSS в тестах
// нет; проверяется ровно причина, из-за которой размер не доезжает.

import { describe, it, expect } from "vitest";
import fs   from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CSS  = path.join(ROOT, "styles", "sheets", "horde-sheet.css");
const HBS  = path.join(ROOT, "templates", "actor", "horde-sheet.hbs");

// Свойства, которые общее правило `.wh-horde .hbtn` задаёт само, — только их
// переопределение и проигрывает по весу. Цвет/фон в общем правиле тоже есть,
// но их частные правила пишут через !important, и это отдельная история.
const SIZE_PROPS = ["width", "height", "padding"];

// Ядро Foundry держит для <button> пол min-height: var(--button-size) = 2em
// (28px при 14px шрифта), и любая высота ниже него без явного min-height: 0 не
// применяется вовсе. Общее правило снимает этот пол один раз за все кнопки
// листа — если оттуда пропадёт min-height, все заданные высоты ниже 28px
// молча перестанут действовать. Замерено живьём (wdbc-gwpu): .horde-char-roll
// с height: 20px выходил 20x28, а .horde-roll-btn со своим min-height: 0 —
// ровно 22x22.
const FLOOR_PROP = "min-height";

/** Классы, стоящие в разметке на одном элементе с `hbtn`. */
function companionClasses(html) {
  const found = new Set();
  for (const m of html.matchAll(/class="([^"]*)"/g)) {
    const classes = m[1].split(/\s+/).filter(Boolean);
    if (!classes.includes("hbtn")) continue;
    for (const c of classes) if (c !== "hbtn") found.add(c);
  }
  return found;
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

/** Сколько классов в самой лёгкой части селектора (через запятую). */
function minClassCount(selector) {
  return Math.min(...selector.split(",").map(p => (p.match(/\.[A-Za-z_-][\w-]*/g) || []).length));
}

describe("лист Орды: частные размеры кнопок не должны проигрывать общему .wh-horde .hbtn", () => {
  const css  = fs.readFileSync(CSS, "utf8");
  const html = fs.readFileSync(HBS, "utf8");

  it("разметка вообще пользуется классом hbtn с довесками", () => {
    // Страховка от «тест зелёный, потому что ничего не нашёл»: если кнопки
    // переименуют, тест должен упасть здесь, а не тихо перестать проверять.
    const companions = companionClasses(html);
    expect(companions.size).toBeGreaterThan(0);
    expect(companions.has("horde-roll-btn")).toBe(true);
  });

  it("общее правило действительно задаёт размер двумя классами", () => {
    const base = rules(css).find(r => r.selector === ".wh-horde .hbtn");
    expect(base, "правило .wh-horde .hbtn пропало — тест потерял предмет проверки").toBeTruthy();
    expect(minClassCount(base.selector)).toBe(2);
    for (const prop of [...SIZE_PROPS, FLOOR_PROP]) {
      expect(new RegExp(`(^|;|\\s)${prop}\\s*:`).test(base.body), `.wh-horde .hbtn задаёт ${prop}`).toBe(true);
    }
  });

  it("нет правил с одним классом, переопределяющих размер кнопки", () => {
    const companions = companionClasses(html);
    const offenders  = [];

    for (const { selector, body } of rules(css)) {
      if (minClassCount(selector) >= 2) continue;
      const cls = (selector.match(/\.([A-Za-z_-][\w-]*)/) || [])[1];
      if (!cls || !companions.has(cls)) continue;
      const props = SIZE_PROPS.filter(p => new RegExp(`(^|;|\\s)${p}\\s*:`).test(body));
      if (props.length) offenders.push(`${selector} — задаёт ${props.join(", ")}, но весит меньше .wh-horde .hbtn`);
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
