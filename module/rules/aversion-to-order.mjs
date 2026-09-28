// module/rules/aversion-to-order.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Aversion to Order / Отвращение к Порядку (Зверолюд, корбук глава I) —
//  части Черты, которые считаются кодом. Без Foundry.
//
//  Книга: «Бионика и кибернетика, будучи воплощениями Порядка, отвергаются
//  мутировавшим телом Зверолюда – установка каждой бионики или кибернетики
//  уменьшает его запас Ран на 2 и Т на 5.» Возможность order.rejectsBionics
//  даёт сама Черта (запись Конструктора, гейт «нет Символа Власти» — Шаман
//  Зверолюдей «не получает штрафов от кибернетики и имплантов»); читает её
//  module/rules/character.mjs.
//
//  Что считать «бионикой и кибернетикой»: всё установленное железо — Бионика,
//  Кибернетика, Псибернетика, импланты и кибернетика Механикус/Скитарии,
//  мехадендриты. НЕ считаются органы Геносемени Астартес и биоимпланты
//  Друкхари — это выращенная плоть, а не машина [допущение, вопрос владельцу
//  в отчёте сверки 28.09.2026].
//
//  Остальные части Черты живут данными на самой Черте (Конструктор):
//  Навыки групп Lore/Trade враждебны — override склонности
//  (rules/aptitude-overrides.mjs, приоритет над «всегда Дружественными» —
//  rules/advance-category.mjs); брифинги — order.noBriefing
//  (rules/command-effects.mjs); Таланты Combat Formation/Iron Discipline —
//  order.noFormationTalents (sheets/item-picker.mjs).
// ════════════════════════════════════════════════════════════════════════════

export const ORDER_REJECTS_BIONICS = "order.rejectsBionics";
export const ORDER_NO_BRIEFING = "order.noBriefing";
export const ORDER_NO_FORMATION_TALENTS = "order.noFormationTalents";

/** Категории имплантов-плоти, которые Порядком не считаются. */
const ORGANIC_CATEGORIES = new Set(["astartes", "bioimplant"]);

/** Таланты, которыми Зверолюд не может пользоваться (английская половина имени). */
export const FORMATION_TALENTS = ["Combat Formation", "Iron Discipline"];

const installed = item => !!(item?.getFlag?.("warhammer-dbc", "installed") ?? item?.flags?.["warhammer-dbc"]?.installed);

/** Установленные бионика и кибернетика на акторе. */
export function rejectedImplants(items) {
  return [...(items ?? [])].filter(i => i?.type === "implant" && installed(i)
    && !ORGANIC_CATEGORIES.has(String(i.system?.category || "")));
}

/** Штраф за N установленных имплантов: −5 T и −2 Раны за каждый. */
export function bionicsRejection(count) {
  const n = Math.max(0, Number(count) || 0);
  return { count: n, t: -5 * n, wounds: -2 * n };
}

/** Талант из списка Combat Formation / Iron Discipline? Сравнение по английской половине. */
export function isFormationTalent(name) {
  const eng = String(name || "").split("/")[0].trim().toLowerCase();
  return FORMATION_TALENTS.some(t => eng === t.toLowerCase());
}

/**
 * Несёт ли предмет актора запись Конструктора «Возможность» с этим ключом —
 * прямой скан, а не hasRuleFlag: rules/command-effects.mjs сам работает
 * внутри источника правил «command», и спрашивать у него сбор правил значило
 * бы замкнуть круг (docs/rules-format.md, «Чего не должен делать источник»).
 * Гейт «Когда» записи здесь не проверяется — у order.noBriefing его нет.
 */
export function actorCarriesCapability(actor, key) {
  const scan = entries => (entries || []).some(e =>
    (e?.kind === "capability" && e.capabilityKey === key) || (e?.kind === "group" && scan(e.group?.entries)));
  return [...(actor?.items ?? [])].some(i => {
    const groups = i?.flags?.["warhammer-dbc"]?.mechanics;
    return Array.isArray(groups) && groups.some(g => scan(g.entries));
  });
}
