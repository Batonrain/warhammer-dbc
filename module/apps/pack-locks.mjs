// module/apps/pack-locks.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Замки компендиумов системы. Держит их одна настройка мира —
//  «Разблокировать библиотеки для правки» (warhammer-dbc.mjs). Ключ настройки
//  остался прежним (protectCompendiumEdits, «защищать правки»), чтобы у живых
//  миров не сбросился выбор, а смысл перевернулся: включена — библиотеки
//  открыты, выключена — закрыты.
//
//  Приводить состояние нужно в обе стороны и при каждом запуске: configure
//  пишет в game.settings, то есть однажды снятый замок переживает перезапуск.
//  Пока направление было одно, выключение настройки паки обратно не закрывало.
// ════════════════════════════════════════════════════════════════════════════

const SYSTEM = "warhammer-dbc";

/**
 * Ставит библиотекам системы замок `locked`. Возвращает число паков, которым
 * замок реально сменили: уже стоящие как надо не трогаются — иначе каждый
 * запуск мира писал бы в настройки впустую и сообщал ГМу о смене, которой нет.
 */
export async function setSystemPackLocks(locked) {
  let n = 0;
  for (const pack of game.packs) {
    if (pack.metadata.packageName !== SYSTEM) continue;
    if (pack.locked === locked) continue;
    try { await pack.configure({ locked }); n++; }
    catch (e) {
      console.error(`Warhammer DBC | Не удалось ${locked ? "за" : "раз"}блокировать '${pack.collection}':`, e);
    }
  }
  if (n) {
    const what = locked ? "заблокировано" : "разблокировано для редактирования";
    console.log(`Warhammer DBC | Компендиумов ${what}: ${n}.`);
    ui.notifications?.info(`Warhammer DBC: компендиумов ${what} — ${n}.`);
  }
  return n;
}

/**
 * Названия паков системы с пустым индексом. Пак объявлен в system.json, но
 * база под него не собрана — Foundry заводит пустую сама, и в игре это
 * выглядит как компендиум без содержимого, неотличимый от забытого контента.
 * Так пропали «Расы»: заметили случайно и не сразу.
 *
 * Принимает список паков, а не читает game.packs, — чтобы считалось без
 * запуска Foundry и проверялось тестом.
 */
export function emptySystemPacks(packs = []) {
  return [...packs]
    .filter(p => p?.metadata?.packageName === SYSTEM && (p.index?.size ?? 0) === 0)
    .map(p => p.metadata.label || p.collection);
}

/**
 * Говорит ГМу о пустых паках системы. Молчит, когда всё на месте. Чинится это
 * не в игре, а пересборкой компендиумов, поэтому в тексте сразу команда.
 */
export function warnEmptySystemPacks(packs = []) {
  const empty = emptySystemPacks(packs);
  if (!empty.length) return empty;
  const list = empty.join(", ");
  console.error(`Warhammer DBC | Пустые компендиумы системы: ${list}. Соберите паки: npm run packs:build`);
  ui.notifications?.error(
    `Warhammer DBC: пустые компендиумы — ${list}. База под них не собрана (npm run packs:build).`,
    { permanent: true });
  return empty;
}
