// module/rules/illusion-detection.mjs
//
// Мутация «Illusion of Normality / Иллюзия Нормальности» (wdbc-zbc0): «раз за
// бой/сцену» из книги — это ЛИШЬ лимит повторной попытки псайкера УВИДЕТЬ
// СКВОЗЬ уже замеченную иллюзию. Отдельно есть первый шаг — наблюдатель ещё
// должен ЗАМЕТИТЬ активную иллюзию тестом Психонауки (книжное «Пси-чутьё») с
// бонусом +5 за каждую прочую мутацию персонажа. Оба состояния («заметил» /
// «потратил попытку увидеть сквозь») — знание САМОГО НАБЛЮДАТЕЛЯ про
// конкретного мутанта, не свойство мутанта, поэтому хранятся флагом на
// акторе наблюдателя (см. module/apps/illusion-of-normality.mjs) составным
// ключом на пару наблюдатель↔мутант — существующие isRuleUsageUsed/
// markRuleUsageUsed (module/rules/cooldown.mjs, scope "scene") уже дают всё
// нужное хранилище, нового тут не заводим.
//
// Вынесено в отдельный файл ради переиспользования: у «Icon of Blasphemy /
// Икона Богохульства» (capabilities.mjs::mutation.iconOfBlasphemy) — ТОТ ЖЕ
// паттерн слово в слово («засекшие пси-чутьём/ноосканированием — W+0...»), но
// не реализована в рамках этого тикета (отдельная content-запись, вне
// wdbc-zbc0) — сможет взять готовые noticeFlagKey/seeThroughFlagKey/
// psyniscienceNoticeBonus без передела, когда до неё дойдёт очередь.

/** Бонус к порогу теста Психонауки за КАЖДУЮ прочую активную мутацию персонажа. */
export function psyniscienceNoticeBonus(otherActiveMutationCount) {
  return 5 * Math.max(0, Number(otherActiveMutationCount) || 0);
}

/** Составной ключ флага «наблюдатель заметил иллюзию ИМЕННО этого мутанта». */
export function noticeFlagKey(capabilityKey, targetActorId) {
  return `${capabilityKey}.notice.${targetActorId}`;
}

/** Составной ключ флага «наблюдатель потратил попытку увидеть сквозь ИМЕННО этого мутанта». */
export function seeThroughFlagKey(capabilityKey, targetActorId) {
  return `${capabilityKey}.seeThrough.${targetActorId}`;
}
