// module/rules/library/squat.mjs
//
// Черты Сквата, которые ложатся в конвейер теста правилом, а не записью
// Конструктора. Формат — docs/rules-format.md.
//
// Clever Hands / Умелые Руки: «+15 на все тесты Крафта, ремонта и
// обслуживания, требующие тонкой работы, поднимающийся до +30 в
// экстремальных ситуациях». Требует ли ЭТОТ тест тонкой работы и
// экстремальна ли ситуация — видно только за столом, поэтому две галочки:
// первая +15, вторая ещё +15 (вместе +30). Обе askOnly: запись Конструктора
// «Модификатор теста» так не умеет, и в бросках без диалога (кнопки в чате,
// collectTestMods) +30 складывалось бы само на любом Техпользовании.
// Расклин, который книга называет экстремальным прямо, получает +30 в
// combat/clear-jam.mjs (rules/squat-traits.mjs::cleverHandsClearJamBonus).
//
// Области: Ремесло (Крафт), Техпользование (ремонт/обслуживание) и
// Безопасность — «взлом замка» книга приводит в пример самой Черты.
//
// Отбор по Черте (hasTrait), а не по расе: Черта может достаться и не Сквату.
// Отдаются источником «core» (library/core.mjs вливает список в CORE_RULES):
// как «Проворный», это правило основной книги с отбором по `when`, свой
// источник ради двух записей не нужен.

const FINE_WORK = ["skill:trade", "skill:techuse", "skill:security"];

export const SQUAT_TRAIT_RULES = [
  {
    id: "squat.cleverHands.fine",
    label: "Умелые Руки: тонкая работа",
    when: { hasTrait: "Clever Hands" },
    effects: [{ kind: "rollBonus", target: FINE_WORK, value: 15, askOnly: true }]
  },
  {
    id: "squat.cleverHands.extreme",
    label: "Умелые Руки: экстремальная ситуация (с первой галочкой — итого +30)",
    when: { hasTrait: "Clever Hands" },
    effects: [{ kind: "rollBonus", target: FINE_WORK, value: 15, askOnly: true }]
  }
];
