// module/rules/patron-lock.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «Не может потерять покровительство <Бога>» — субрасы Зверолюда (корбук,
//  глава I: Слаангор — Слаанеш, Пестигор — Нургл, Кхорнгор — Кхорн,
//  Тзаангор — Тзинч).
//
//  То же самое действует у ЭЛИТНЫХ АРХЕТИПОВ с оговоркой «Не может потерять
//  покровительство» (Шумовой Десантник, Чумной, Берсерк Кхорна, Колдун Рубрики,
//  Воин Ноты, Ворон, Виткис, Чумной Монах…): замок набран записью Конструктора
//  kind:"capability" patron.locked.<бог> на предмете архетипа — тот же флаг,
//  тот же preUpdateActor (test/rules/patron-lock-elite.test.mjs).
//
//  Покровительство в системе одно поле — system.patronGod (constants/
//  patronage.mjs). Замок — возможность patron.locked.<бог> от записи
//  Конструктора на субрасе; читают её:
//    • preUpdateActor (warhammer-dbc.mjs) — любая попытка сменить
//      Покровителя на другого возвращается к закреплённому;
//    • applySubrace (apps/races.mjs) — при получении субрасы Покровитель
//      выставляется сам, если был другим или пустым.
//  Без Foundry: только имена и решение.
// ════════════════════════════════════════════════════════════════════════════

export const PATRON_LOCK_PREFIX = "patron.locked.";
export const PATRON_LOCK_GODS = ["khorne", "nurgle", "slaanesh", "tzeentch"];

/**
 * Текст предупреждения, когда смена Покровителя откатилась. `sources` — подписи
 * правил-источников замка (субраса или Элитный архетип), см. flags.mjs::
 * ruleFlagLabels; пусто — нейтральный текст.
 */
export function patronLockMessage(actorName, sources = []) {
  const src = (sources ?? []).filter(Boolean);
  return src.length
    ? `${actorName}: покровительство закреплено (${src.join(", ")}) — Покровитель оставлен прежним.`
    : `${actorName}: покровительство Бога не может быть потеряно — Покровитель оставлен прежним.`;
}

/** Закреплённый Бог по набору возможностей актора (Set имён) или "". */
export function lockedPatron(flags) {
  if (!flags?.has) return "";
  return PATRON_LOCK_GODS.find(g => flags.has(PATRON_LOCK_PREFIX + g)) || "";
}

/**
 * Что записать в system.patronGod при попытке сменить его на `next`:
 * закреплённого Бога, если он есть и `next` другой; иначе `next` как есть.
 */
export function enforcedPatron(next, locked) {
  if (!locked) return next;
  return next === locked ? next : locked;
}
