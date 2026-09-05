// module/rules/item-marker.mjs
// ════════════════════════════════════════════════════════════════════════════
//  «ЭТОТ ЛИ ПРЕДМЕТ X» — по ключу, а не по названию (wdbc-wdlw).
//
//  Полтора десятка мест спрашивают не актора, а КОНКРЕТНЫЙ предмет: «эта ли
//  Мутация — Освежёванный», «этот ли Талант — Пластина Короля», «эта ли
//  психосила — Кровь Демона». Возможность (rules/ability-by-key.mjs) сюда не
//  годится: она живёт на акторе и вернуть сам предмет не может, а половина этих
//  мест читает у найденного предмета его же поля — рейтинг, ступень, сторону.
//
//  Поэтому вопрос задаётся предмету напрямую: несёт ли он запись Конструктора
//  «Возможность» с таким ключом. Ключ тот же самый и из того же реестра
//  (module/constants/capabilities.mjs) — одно имя, два читателя:
//    • itemHasKey(предмет, ключ)  — «этот предмет и есть X» (здесь);
//    • hasRuleFlag(актор, ключ)   — «у актора есть X» (rules/flags.mjs).
//  Это не совпадение, а одно и то же утверждение с разных сторон.
//
//  АКТИВНОСТЬ ЗДЕСЬ НЕ ПРОВЕРЯЕТСЯ, в отличие от сборки правил. Не вставленный
//  имплант — всё ещё Чёрный Панцирь, и снятое оружие не перестаёт быть
//  метеоритным молотом. Вопрос про личность предмета, а не про то, работает ли
//  он сейчас; активность спрашивают отдельно, там, где она нужна.
//
//  Записи в ИЛИ-ветках не считаются — по той же причине, что в item-rules.mjs:
//  выбор в них делается один раз диалогом при выдаче, и личность предмета от
//  этого выбора зависеть не может.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

const SYSTEM = "warhammer-dbc";

/** Механика предмета — и у живого документа Foundry, и у сырых данных пака. */
const mechanicsOf = (item) => {
  const viaFlag = item?.getFlag?.(SYSTEM, "mechanics");
  const raw = viaFlag ?? item?.flags?.[SYSTEM]?.mechanics;
  return Array.isArray(raw) ? raw : [];
};

/**
 * Несёт ли предмет запись «Возможность» с этим ключом.
 *
 * @param {object} item предмет (документ или сырые данные)
 * @param {string} key  ключ из module/constants/capabilities.mjs
 * @returns {boolean}
 */
export function itemHasKey(item, key) {
  const want = String(key ?? "").trim();
  if (!want) return false;

  const walk = (entries, operator) => {
    if (operator === "OR") return false;
    for (const entry of entries || []) {
      if (entry?.kind === "group" && entry.group) {
        if (walk(entry.group.entries, entry.group.operator)) return true;
        continue;
      }
      if (entry?.kind === "capability" && String(entry.capabilityKey ?? "").trim() === want) return true;
    }
    return false;
  };

  return mechanicsOf(item).some(group => walk(group.entries, group.operator));
}

/**
 * «Этот предмет — тот самый X»: нужного типа И опознан ключом либо, пока ключа
 * на нём ещё нет, названием.
 *
 * Название проверяется ВТОРЫМ и остаётся временно — приём проекта «новое живёт
 * рядом со старым»: пока не все документы паков несут ключ, опознание по имени
 * обязано продолжать работать. Снимать его — отдельным шагом, после живой
 * проверки.
 *
 * @param {object} item
 * @param {string} type тип предмета по схеме («mutation», «talent», …)
 * @param {string} key  ключ Возможности
 * @param {string} name имя (одна половина двуязычного, не пара)
 */
export function itemIs(item, type, key, name) {
  if (item?.type !== type) return false;
  if (itemHasKey(item, key)) return true;
  return !!name && itemHasName(item, name);
}
