// test/data/damage-notation-vs-book.test.mjs
//
// Сторож wdbc-yk0e: тип и подвид урона предмета — те, что записаны в
// книжной таблице нотацией «2d10+2 X(Fr)» (буква — тип, скобки — подвид).
//
// Повод: стопка #478-#481 перевела Флак на подвид X(Fr), а подвид не стоял
// ни у одного предмета личного снаряжения — удвоение AP молча не работало.
// При разборе выяснилось хуже: фраг-гранаты, автопушки, ракеты Крак и ещё
// полсотни предметов с книжным X с первого переноса контента лежали как
// impact. Тест на свойство брони это не ловил — он подставлял подвид сам.
//
// Сопоставление: любая половина имени (нормализованная, см. normName) + ТОТ
// ЖЕ бросок урона (без Pen/свойств). Бросок отсекает случайных тёзок из
// чужих таблиц (Клешня Осквернителя 3d10+18 — не Клешня 1d10+2 из основной
// книги). Где и бросок совпал у разных вещей — явный список NAME_COLLISIONS.

import { describe, it, expect } from "vitest";
import { PACK_SCAN_TIMEOUT, allPackDocuments } from "../support/pack-docs.mjs";
import { normDice, nameKeys, bookRows } from "../support/book-weapon-rows.mjs";

/**
 * Пак точнее книги: у предмета стоит подвид, которого в книжной строке нет
 * (убрать — выключить правила подвида: Горение от огнемёта и т.п.). Решение
 * владельца 23.09.2026 (wdbc-w0s5.1): вопрос закрыт, предметы разберёт
 * будущая проходка по источникам — до неё не трогать. Не «разрешено
 * навсегда»: строка уходит отсюда, когда проходка решит предмет.
 */
const DEFERRED_TO_SOURCE_PASS = new Set([
  "Dragon’s Breath Flamer / Огнемёт Драконьего Дыхания",
  "Acid / Кислотная",
  "Gunkbomb / Дряньбомба",
  "Pulse Pistol / Импульсный Пистолет (Тау)",
  "Pulse Rifle / Импульсная Винтовка (Тау)",
  "Sunburst / Солнечная Вспышка",
  "Dragon's Breath Heavy Flamer / Тяжёлый Огнемёт Драконьего Дыхания"
]);

/**
 * Совпали и имя, и бросок, но это разные вещи (wdbc-w0s5.2). Причина — у
 * каждой строки: сторож не должен «чинить» верный предмет под чужую строку.
 */
const NAME_COLLISIONS = new Map([
  // Пак — Нуль Жезл основной книги (стр. 256: 1d10+6 E, Pen 4, Power Field).
  // Книга псайкеров-жаб даёт два режима с тем же броском: «работающий нимб»
  // 1d10+11 E и «втянутый нимб» 1d10+6 I(Cr) — пометка режима в русской
  // половине, после срезания скобок имя совпадает.
  ["Null Rod / Нуль Жезл", "toad-psykers.json"]
]);

/** Книжные строки с тем же именем (любая половина) и тем же броском урона. */
const candidatesFor = (rows, doc) => [...new Set(nameKeys(doc.name).flatMap(k => rows.get(k) ?? []))]
  .filter(r => r.dice === normDice(doc.system?.damage))
  .filter(r => NAME_COLLISIONS.get(doc.name) !== r.book);

describe("тип и подвид урона — как в книжной таблице (wdbc-yk0e)", () => {
  it("предметы с тем же именем и броском урона, что книжная строка, несут её тип и подвид", () => {
    const rows = bookRows();
    const wrong = [];
    let checked = 0;
    for (const pack of ["weapons", "vehicle-weapons", "psychic-powers"]) {
      for (const { doc } of allPackDocuments(pack)) {
        const s = doc.system ?? {};
        if (!s.damageType || !s.damage) continue;
        const cand = candidatesFor(rows, doc);
        if (!cand.length) continue;
        checked++;
        const ok = cand.some(r => r.type === s.damageType && r.sub === (s.damageSubtype || ""));
        if (!ok && !DEFERRED_TO_SOURCE_PASS.has(doc.name)) {
          wrong.push(`${pack} | ${doc.name}: ${s.damageType}/${s.damageSubtype || "-"}, книга «${cand[0].raw}» (${cand[0].book})`);
        }
      }
    }
    // Сторож не пустой: сопоставление реально находит предметы.
    // Покрытие (wdbc-w0s5.2): ~870 из ~1090 предметов с уроном; остальное —
    // психосилы (урон в тексте силы, не в таблице), естественное/интегральное
    // оружие с формулой («1d10+X», «+S.b») и атаки существ из статблоков.
    expect(checked).toBeGreaterThan(800);
    expect(wrong).toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  it("отложенные до проходки ещё действительно расходятся с книгой — иначе строка лишняя", () => {
    const rows = bookRows();
    const stale = [];
    for (const pack of ["weapons", "psychic-powers"]) {
      for (const { doc } of allPackDocuments(pack)) {
        if (!DEFERRED_TO_SOURCE_PASS.has(doc.name)) continue;
        const s = doc.system ?? {};
        const cand = candidatesFor(rows, doc);
        if (cand.some(r => r.type === s.damageType && r.sub === (s.damageSubtype || ""))) stale.push(doc.name);
      }
    }
    expect(stale).toEqual([]);
  }, PACK_SCAN_TIMEOUT);

  it("список коллизий не устарел: исключённая строка книги у предмета действительно есть", () => {
    const rows = bookRows();
    for (const [name, book] of NAME_COLLISIONS) {
      const doc = allPackDocuments("weapons").map(d => d.doc).find(d => d.name === name);
      expect(doc, `нет предмета «${name}»`).toBeTruthy();
      const raw = [...new Set(nameKeys(doc.name).flatMap(k => rows.get(k) ?? []))]
        .filter(r => r.dice === normDice(doc.system?.damage) && r.book === book);
      expect(raw.length, `коллизия «${name}» с ${book} больше не воспроизводится — строку можно убрать`).toBeGreaterThan(0);
    }
  }, PACK_SCAN_TIMEOUT);

  // wdbc-wdq0r: режимы оружия (system.profiles — «Крюк», «Посох» и т.п.) раньше
  // не сверялись вовсе: «Крюк» Алебарды лежал 2d10+1 Pen 0 при книжном
  // 2d10+2, у Ветряной Глефы не было книжного «Посоха». Группа книги —
  // строка оружия со всеми её режимами; берётся та, чей режим совпал с
  // основным профилем предмета (по имени и броску).
  it("режимы оружия: тип/подвид — по книге, книжный режим не потерян", () => {
    const rows = bookRows();
    const problems = [];
    let groupsChecked = 0;
    for (const pack of ["weapons", "vehicle-weapons"]) {
      for (const { doc } of allPackDocuments(pack)) {
        const s = doc.system ?? {};
        if (!s.damage || !s.damageType) continue;
        const groups = [...new Set(candidatesFor(rows, doc).map(r => r.group))];
        if (!groups.length) continue;
        const profiles = Array.isArray(s.profiles) ? s.profiles : [];
        const ownDice = [normDice(s.damage), ...profiles.map(pr => normDice(pr.damage))];
        const issuesOf = group => {
          const issues = [];
          for (const pr of profiles) {
            const modes = group.modes.filter(m => m.dice.includes(normDice(pr.damage)));
            if (!modes.length) { issues.push(`режим «${pr.label}» ${pr.damage} — в книге нет такого броска`); continue; }
            if (!modes.some(m => m.type === pr.damageType && m.sub === (pr.damageSubtype || "")))
              issues.push(`режим «${pr.label}»: ${pr.damageType}/${pr.damageSubtype || "-"}, книга «${modes[0].raw}»`);
          }
          if (group.modes.length > 1) {
            for (const m of group.modes) {
              if (!m.dice.some(d => ownDice.includes(d))) issues.push(`нет книжного режима «${m.raw}»`);
            }
          }
          return issues;
        };
        const best = groups.map(issuesOf).sort((a, b) => a.length - b.length)[0];
        groupsChecked++;
        if (best.length) problems.push(`${pack} | ${doc.name}: ${best.join("; ")}`);
      }
    }
    expect(groupsChecked).toBeGreaterThan(800);
    expect(problems).toEqual([]);
  }, PACK_SCAN_TIMEOUT);
});
