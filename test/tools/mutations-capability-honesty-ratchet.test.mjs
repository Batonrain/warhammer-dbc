// test/tools/mutations-capability-honesty-ratchet.test.mjs
//
// wdbc-1rno (храповик, второй слой поверх mechanics-or-honest-notes-ratchet):
// та проверка засчитывает запись «покрытой», если у неё есть ЛЮБАЯ
// flags.warhammer-dbc.mechanics — включая kind:"capability" с ПУСТЫМ reader
// в module/constants/capabilities.mjs (Конструктор-заглушка, объявленная
// данными, но без единого читателя в коде, см. шапку capabilities.mjs).
// Честная переоценка 01.09.2026 показала: 176/183 «есть Mechanics» —
// это не «работает». Этот тест закрепляет ДРУГОЙ, более строгий инвариант:
// сколько записей Мутаций/Даров несут ТОЛЬКО пустые capability-заглушки
// (ни одного реального kind, ни одной capability с непустым reader).
//
// Число — числовой долг (toBeLessThanOrEqual, может только уменьшаться):
// каждая точечная миграция стаба в реальную запись (testMod/trait/skill/
// aura/... или дописанный reader существующей capability) двигает его вниз;
// откат/новый пустой стаб без разбора — тест ломается.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const PACKS_SRC = path.join(ROOT, "packs-src");
const MUTATIONS_DIR = path.join(PACKS_SRC, "mutations");

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith(".json") && e.name !== "_Folder.json") out.push(p);
  }
  return out;
}

/** Реестр { capabilityKey: reader } из module/constants/capabilities.mjs — текстовый парсинг
 *  (тот же приём, что в других разведочных скриптах этой сессии): импортировать сам
 *  модуль сюда нельзя без живого game.* окружения у некоторых соседних констант,
 *  а нам нужны только label/reader строки объекта CAPABILITIES. */
function readCapabilityReaders() {
  const src = fs.readFileSync(path.join(ROOT, "module/constants/capabilities.mjs"), "utf8");
  const keyRe = /"([a-zA-Z][a-zA-Z0-9_.]*)":\s*\{\s*\n\s*label:/g;
  const readers = {};
  let m;
  while ((m = keyRe.exec(src))) {
    const key = m[1];
    const start = keyRe.lastIndex;
    const end = src.indexOf("\n  },", start);
    const block = src.slice(start, end);
    const rm = block.match(/reader:\s*"((?:[^"\\]|\\.)*)"/);
    // reader отсутствует строкой (напр. многострочный шаблон) — считаем непустым:
    // это не голая заглушка, а что-то нестандартное, разбирать вручную не тут.
    readers[key] = rm ? rm[1] : "(non-string-reader)";
  }
  return readers;
}

function isStubOnlyDoc(doc, readers) {
  const mech = doc.flags?.["warhammer-dbc"]?.mechanics;
  if (!Array.isArray(mech) || !mech.length) return false; // нет Mechanics вовсе — другая категория (долг ratchet'а honest-notes)
  for (const grp of mech) {
    for (const entry of (grp.entries || [])) {
      if (entry.kind !== "capability") return false; // любой другой kind — уже реальная механика
      const reader = readers[entry.capabilityKey];
      if (reader !== "" ) return false; // неизвестный ключ ИЛИ известный, но с читателем — не голый стаб
    }
  }
  return true;
}

describe("храповик: capability-заглушки в Мутациях/Дарах не растут молча (wdbc-1rno)", () => {
  it("реестр capabilities.mjs реально распарсен (защита от пустого regex)", () => {
    const readers = readCapabilityReaders();
    expect(Object.keys(readers).length).toBeGreaterThan(1000);
  });

  it("Мутации/Дары: не больше 130 записей несут ТОЛЬКО пустую capability-заглушку", () => {
    const readers = readCapabilityReaders();
    const files = walk(MUTATIONS_DIR);
    expect(files.length).toBeGreaterThan(0);
    const stubOnly = files.filter(f => isStubOnlyDoc(JSON.parse(fs.readFileSync(f, "utf8")), readers));
    // Базовая линия зафиксирована 01.09.2026 после честной переоценки wdbc-1rno,
    // относительно origin/main (не устаревшей локальной main — та отставала
    // на 18 коммитов на момент этой сессии, некоторые из них добавили ещё
    // мутации/дары): 132 голых заглушки ПОСЛЕ четырёх точечных миграций этой
    // сессии (Hermaphrodite → testMod skillKey:charm; Countenance of Slaanesh
    // → testMod modScope:social; Countenance of Tzeentch → два testMod
    // deceive/scrutiny; Immortal Beauty → kind:"trait" Regeneration(1) под
    // when.woundTier:["heavy","dying"] — старая пометка «гейт не поддержан
    // entry.when» была устаревшей, wdbc-wyr3 давно закрыт). Верхний ярус
    // («+30 с единоверцами»/«против союзников») у Countenance-* сознательно
    // не смоделирован — адресован конкретной цели, распознавания цели нет.
    // Снижать порог явно — отдельной правкой по мере миграции остальных
    // стабов, не двигать вверх без разбора в bd wdbc-1rno.
    // 01.09.2026 (продолжение): Boneless/Бескостный → доп. AND-группа
    // kind:"characteristic" (+10 Ag) — book-текст сверен напрямую
    // (packs-src/books/core.json, «18 | Бескостный»: «Персонаж получает
    // +10 к A» — безусловная строка, отдельная от условного абзаца про
    // форму без опоры/аморфную гору плоти). Capability-заглушка остаётся
    // на нетронутом остатке (½ I(Cr) Dmg до Поглощения/иммунитет к
    // переломам/опциональный Quadruped).
    // Gift of Tongues/Дар Языков -> доп. AND-группа kind:"testMod"
    // (modScope:social, +20) - book-текст «+20 на все тесты социального
    // взаимодействия» без сужения на тип теста (провокация - лишь цель по
    // тексту, не мех. условие). Capability остаётся на понимании речи/языка
    // жестов/ответе оскорблениями.
    expect(stubOnly.length).toBeLessThanOrEqual(130);
  });
});
