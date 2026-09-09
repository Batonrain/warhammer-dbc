// module/migrations/legion-geneseed-size-fix.mjs
// ════════════════════════════════════════════════════════════════════════
//  wdbc-nesq: Геносемя XX Альфа-Легиона и капитула «Железные Змеи» (XIII,
//  Ультрамарины) до PR #421 несло system.effects.sizeMod:1 в module/
//  constants/legions.mjs — книжное «...(всё ещё в пределах Размера 1)» было
//  прочитано как «+1 к Размеру». Константа исправлена (см. test/data/
//  legion-geneseed-size-vs-book.test.mjs), но правка константы НЕ трогает
//  уже созданные Черты «Геносемя: <легион>» — module/apps/races.mjs::
//  applyLegion копирует sizeMod ОДИН РАЗ, в момент создания предмета, а не
//  читает константу заново при каждом рендере. У персонажей, которым
//  Геносемя уже применили ДО #421, sizeMod:1 остаётся лежать на самой Черте.
//
//  Сверяется с ТЕКУЩИМИ LEGIONS по имени («<num> <name>» легиона или
//  капитула — тот же effName, что строит applyLegion), а не с двумя
//  захардкоженными названиями — так любая будущая такая же правка
//  константы (сжатый пересказ книги принят за числовой эффект) чинится этим
//  же проходом сама, без новой миграции под неё.
// ════════════════════════════════════════════════════════════════════════

import { LEGIONS } from "../constants/legions.mjs";

const PREFIX = "Геносемя: ";

/** effName («<num> <name>» легиона/капитула) → текущий правильный sizeMod. */
export function currentSizeModByEffName(legions = LEGIONS) {
  const map = new Map();
  for (const legion of legions) {
    map.set(`${legion.num} ${legion.name}`, Number(legion.effects?.sizeMod) || 0);
    for (const chapter of legion.chapters || []) {
      map.set(`${legion.num} ${chapter.name}`, Number(chapter.effects?.sizeMod) || 0);
    }
  }
  return map;
}

/**
 * Эта Черта — «Геносемя: <легион/капитул>» источника «Легион», чей
 * сохранённый sizeMod разошёлся с текущей константой? Возвращает
 * {correct, stored} при расхождении, иначе null (в т.ч. когда effName
 * константам сейчас неизвестен — переименование легиона решает не эта
 * миграция).
 */
export function geneSeedSizeMismatch(item, sizeModByEffName = currentSizeModByEffName()) {
  if (!item || item.type !== "trait") return null;
  if (item.system?.source !== "Легион") return null;
  const name = String(item.name || "");
  if (!name.startsWith(PREFIX)) return null;
  const effName = name.slice(PREFIX.length);
  if (!sizeModByEffName.has(effName)) return null;
  const correct = sizeModByEffName.get(effName);
  const stored = Number(item.system?.effects?.sizeMod) || 0;
  return stored !== correct ? { correct, stored } : null;
}

/** Правит расхождения у Черт «Геносемя» всех акторов мира. */
export async function migrateLegionGeneSeedSize() {
  if (!game.user?.isGM) { ui.notifications?.warn("Правка Размера Геносемени: только для ГМа."); return; }
  const sizeModByEffName = currentSizeModByEffName();
  let fixed = 0;

  try {
    for (const actor of game.actors) {
      for (const item of actor.items) {
        const mismatch = geneSeedSizeMismatch(item, sizeModByEffName);
        if (!mismatch) continue;
        await item.update({ "system.effects.sizeMod": mismatch.correct });
        fixed++;
      }
    }
  } catch (e) { console.error("Warhammer DBC | Размер Геносемени легиона:", e); }

  const msg = `Размер Геносемени легиона выправлен у Черт: ${fixed}.`;
  console.log("Warhammer DBC |", msg);
  if (fixed) ui.notifications?.info("Warhammer DBC: " + msg);
  return { fixed };
}
