// module/rules/warp-touched.mjs
// ════════════════════════════════════════════════════════════════════════
//  Warp-Touched / Затронутый Варпом (корбук, «95 | Затронутый Варпом»;
//  wdbc-1rno.26) — чистая часть двух субмутаций. Субмутация 8
//  «Вспыльчивость» — соседний rules/quick-to-anger.mjs. Субмутации 2-3, 4-5,
//  6, 9 — события за столом (ложь, правда, кража, брезгливость), решение
//  владельца 02.10.2026: остаются текстом, ГМ решает сам. 7 «Одиночество» в
//  эту задачу не входит.
//
//  1 «Страх Ярости»: «Персонаж считает всех врагов в Ярости имеющими рейтинг
//    Страха 3 и не может игнорировать этот Страх». Тест Страха в системе
//    запускается вручную (sheets/tabs/disorders.mjs::openFearDialog) —
//    рейтинг подставляется из выделенного источника, сюда добавлено: враг в
//    Ярости — не ниже 3 (свой Страх 4 мутация не понижает: она прибавляет
//    источник Страха, а не отнимает его). Союзник (по диспозиции токенов) —
//    не враг; без токенов отношение неизвестно, и выделенный игроком
//    источник угрозы считается врагом. «Не может игнорировать»: решение
//    владельца 02.10.2026 — снимается всё, что книга зовёт игнорированием
//    Страха (память сцены стр. 53, автоуспех по Infamy/своему Страху,
//    Стальное Сердце). Диалог ставит тесту свойство unignorable, отмену
//    считает одно место — rules/fear-ignore.mjs.
//
// 10 «Недоверие к Лечению»: «После получения любого лечения, кроме как от
//    себя, персонаж получает штраф −10 на все тесты, кроме тестов Т на 1
//    час». Метка-момент на акторе (flags.warhammer-dbc.healMistrustUntil,
//    worldTime + 3600) — ставит её combat/warp-touched.mjs в местах, где
//    известен лечащий; штраф отдаёт источник реестра правил
//    «warpTouchedHealMistrust» (rules/sources.mjs) — тот же приём «правило от
//    времени мира», что Зависимость (rules/addiction.mjs). Без галочки
//    (auto): это состояние персонажа, не выбор игрока.
//
//  Этот файл импортируется из rules/sources.mjs — поэтому сам он не
//  импортирует ничего (hasRuleFlag отсюда замкнул бы круг, см. AGENTS.md,
//  wdbc-795h).
// ════════════════════════════════════════════════════════════════════════

export const RAGE_FEAR_CAPABILITY = "mutation.warpTouched.rageFear";
export const HEAL_MISTRUST_CAPABILITY = "mutation.warpTouched.healMistrust";

/** Рейтинг Страха, которым персонаж наделяет врага в Ярости. */
export const RAGE_FEAR_RATING = 3;

/** Флаг на акторе: до какого worldTime действует штраф «Недоверия». */
export const HEAL_MISTRUST_FLAG = "healMistrustUntil";
/** «На 1 час». */
export const HEAL_MISTRUST_SECONDS = 3600;
const HEAL_MISTRUST_PENALTY = -10;
const HEAL_MISTRUST_LABEL = "🩹 Недоверие к Лечению";

/**
 * Источник — «враг в Ярости» субмутации 1: в Ярости и не союзник.
 * Одно условие и для рейтинга (rageFearRating), и для «не может игнорировать»
 * (sheets/tabs/disorders.mjs::fearDialogDefaults → rules/fear-ignore.mjs).
 * @param {{sourceInRage:boolean, relation:"ally"|"enemy"|"neutral"}} opts
 */
export function isRageFearSource({ sourceInRage = false, relation = "neutral" } = {}) {
  return !!sourceInRage && relation !== "ally";
}

/**
 * Рейтинг Страха источника для персонажа с субмутацией 1.
 * @param {number} srcFear собственный рейтинг источника
 * @param {{sourceInRage:boolean, relation:"ally"|"enemy"|"neutral"}} opts
 */
export function rageFearRating(srcFear, { sourceInRage = false, relation = "neutral" } = {}) {
  const own = Math.max(0, Number(srcFear) || 0);
  if (!isRageFearSource({ sourceInRage, relation })) return own;
  return Math.max(own, RAGE_FEAR_RATING);
}

/**
 * Враг/союзник по диспозициям двух токенов (HOSTILE −1, FRIENDLY 1; NEUTRAL
 * и SECRET — никому). Та же формула, что regions/auras.mjs::tokenRelationship;
 * не импортом — тот модуль тянет классы Foundry верхнего уровня (через
 * apps/mechanics.mjs), а этот файл обязан оставаться без зависимостей.
 */
export function relationByDisposition(ownDisposition, sourceDisposition) {
  const s = Number(ownDisposition) || 0;
  const t = Number(sourceDisposition) || 0;
  if (Math.abs(s) !== 1 || Math.abs(t) !== 1) return "neutral";
  return s === t ? "ally" : "enemy";
}

/** Момент, до которого действует штраф, если лечение пришло сейчас. */
export function healMistrustUntil(worldTime) {
  return (Number(worldTime) || 0) + HEAL_MISTRUST_SECONDS;
}

/**
 * Лечение пришло не от самого пациента. Тот же персонаж бывает разными
 * объектами: лист с боковой панели — мировой актор (Actor.x), его
 * несвязанный токен в цели — синтетический (Scene…Token…Actor.x) с тем же
 * id. Поэтому сверка и по id — как selfTreat в sheets/tabs/healing.mjs.
 */
export function isHealedByOther(healer, patient) {
  if (!healer || !patient || healer === patient) return false;
  if (healer.uuid && healer.uuid === patient.uuid) return false;
  return !(healer.id && healer.id === patient.id);
}

/** Источник реестра правил: −10 на всё, кроме T, пока метка не истекла. */
export function healMistrustRules(actor, worldTime) {
  const until = Number(actor?.getFlag?.("warhammer-dbc", HEAL_MISTRUST_FLAG)
    ?? actor?.flags?.["warhammer-dbc"]?.[HEAL_MISTRUST_FLAG]) || 0;
  if (until <= (Number(worldTime) || 0)) return [];
  return [{
    id: "mutation.warpTouched.healMistrust", label: HEAL_MISTRUST_LABEL,
    when: { charNotIn: ["t"] },
    effects: [{ kind: "rollBonus", target: "all", value: HEAL_MISTRUST_PENALTY, label: HEAL_MISTRUST_LABEL, auto: true }]
  }];
}
