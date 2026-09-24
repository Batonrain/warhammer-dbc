// module/rules/maggot-parasite.mjs
// ════════════════════════════════════════════════════════════════════════
//  Maggot Parasite/Опарыш-Паразит (Нургл, wdbc-1rno/wdbc-ux8a): «Сознание и
//  душа персонажа заключаются в паразитическом опарыше... Паразит сохраняет
//  все его Характеристики, кроме S, T и A, которые опускаются до 10, и Раны,
//  которые опускаются до 7... Он автоматически контролирует своё бывшее
//  тело. Если его тело умирает, он может за свободное действие выскочить из
//  него... и провести атаку Паразитом против персонажа в пределах 3м.
//  Успешно захватив новое тело... он зарывается вглубь... Если он покидает
//  живой хост, тот умирает через 7 ч.»
//
//  Реализована ЧАСТЬ находки (по решению пользователя, wdbc-ux8a):
//   1. S/T/A→10, Раны.max→7 — одноразовый снимок при превращении, ОДИН И
//      ТОТ ЖЕ патч для исходного тела и для каждого нового захваченного
//      (module/apps/maggot-parasite.mjs::becomeParasiteHost).
//   3. Захват нового тела — полная миграция «какой Actor — чей лист»
//      (game.user.character + module/apps/actor-control.mjs — тот же
//      relay-приём Foundry-владения, что уже даёт Volunteer Actor).
//   5. «Покинул живой хост — умирает через 7ч» — worldTime-таймер, тот же
//      такт, что Cast Out of Death/хирургия мононити Volunteer Actor.
//
//  НЕ реализованы (отложено пользователем):
//   - Размер(−2) грантится КАК У Servoskull — прямой Mechanics-энтри kind:
//     "trait" НА САМОМ предмете Опарыша (packs-src, без единой строки
//     кода) — держатель Гранта переносится вместе с предметом при захвате
//     (createEmbeddedDocuments/deleteEmbeddedDocuments), а не кодом здесь.
//   - «Смертоносное Природное Оружие (Cor.b)» и атака Паразитом самим —
//     нет в системе канала «рейтинг природного оружия = живой Cor.b
//     носителя» (пользователь выбрал именно живой пересчёт, не снимок) —
//     новый движковый крюк, не построен в этом заходе.
//   - «Не может быть выцелен Избирательной атакой» — не проверено, есть ли
//     точка гейта для запрета Избирательной атаки по цели.
//
//  Чистый модуль: ни одного обращения к Foundry, всё приходит аргументами.
// ════════════════════════════════════════════════════════════════════════

export const MAGGOT_PARASITE_CAPABILITY = "gift.nurgle.maggotParasite";

export const HOST_CHAR_VALUE = 10;
export const HOST_WOUNDS_MAX = 7;

/** Патч actor.update() — превращает ЛЮБОЕ тело (исходное или захваченное) в носителя Опарыша. */
export function parasiteHostUpdate() {
  return {
    "system.characteristics.s.value": HOST_CHAR_VALUE,
    "system.characteristics.t.value": HOST_CHAR_VALUE,
    "system.characteristics.ag.value": HOST_CHAR_VALUE,
    "system.wounds.max": HOST_WOUNDS_MAX
  };
}

const HOUR = 3600;
export const ABANDONED_HOST_DEATH_DURATION = 7 * HOUR;
export const ABANDONED_HOST_DEATH_FLAG = "maggotParasiteAbandonedDeadline";

/** Дедлайн смерти покинутого живого хоста — 7 игровых часов от момента ухода Опарыша. */
export function scheduleAbandonedHostDeath(worldTime) {
  return Number(worldTime) + ABANDONED_HOST_DEATH_DURATION;
}

/** Прошли ли уже 7ч с момента ухода. */
export function isAbandonedHostDeathReady(deadline, worldTime) {
  return deadline != null && Number(worldTime) >= Number(deadline);
}
