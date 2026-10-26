// module/rules/requisition-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Таланты теста «Реквизиция» — галочки и бонусы в окне броска (источник
//  правил «requisitionTalents», rules/sources.mjs). Сам тест и таблицы —
//  rules/requisition.mjs; снижение Редкости Талантами (Повелитель Войны,
//  Древний Воин, Разгадыватель Ритуалов) считается там же ДО таблицы, потому
//  что меняет Редкость предмета, а не Порог.
//
//  Книга (DoomBC — Основная книга, «Арсенал» и «Социальные», стр. 62):
//    Чрезмерное Богатство — «+10 на тесты Inf для получения снаряжения и тесты
//      Commerce, если тратит время и ресурсы для демонстрации своего богатства
//      при переговорах. Особо впечатляющая демонстрация может давать больший
//      бонус по решению ГМа … может и не нуждаться в демонстрации». Что
//      «демонстрация» была — решает игрок: галочка. Прибавку сверх +10 ГМ
//      вписывает в поле «Модификатор» сам.
//    Повелитель Войны — «+20 на тесты Inf для получения снаряжения и тесты
//      Commerce для добычи снаряжения с Редкостью 0 или ниже в оптовых объемах
//      (1001+ штук)». В Реквизиции Редкость и Количество известны окну — бонус
//      автоматический; в тесте Commerce предмета нет — галочка. «Редкость 0 или
//      ниже» читается по Редкости ПОСЛЕ сдвигов Талантов (сам Талант её и
//      снижает) — допущение, вопрос владельцу. Снижение Редкости самого
//      Таланта («Экзотического снаряжения и Кибернетики на 1») — не здесь, а в
//      requisition.mjs::rarityShifts; «Кибернетика» там — вся имплант-техника
//      (Кибернетика, Бионика, Псибернетика, Механикус; IMPLANT_TECH_CATEGORIES,
//      решение владельца 26.10.2026).
//    Сеть Контактов — «может использовать свою F вместо Inf для тестов
//      Реквизиции, делая бросок по каждому миру с ячейкой подчиненных отдельно,
//      но считая это как один тест Реквизиции». Галочка переключает «Бросок
//      с:» на F; бросок по каждому миру — повторное нажатие «Достать
//      снаряжение», как и сказано в книге «один тест» — стол ведёт сам.
//      Требование «Cover Up, 5+ ячеек» — условие получения Таланта, не броска.
//    Дело Фактотума (Книга Пустоты, Пустоход) — «При приобретении узлов и
//      реквизиции на обслуживание пустолёта персонаж получает +10». Что
//      реквизиция именно на обслуживание пустолёта — решает игрок: галочка.
//      «Приобретение узлов» сюда НЕ подключено: теста приобретения узла в
//      системе нет (у компонентов корабля есть Редкость и цена в SP, но
//      ставятся они без броска); Книга Пустоты описывает «Реквизицию узлов» —
//      тест Реквизиции с Редкостью и Качеством узла, где вместо Количества
//      таблица по типу узла. Появится тот тест — +10 цепляется к нему тем же
//      правилом (ctx.requisitionNode), не отдельной подсистемой.
//
//  Файл подключён к sources.mjs и потому НЕ импортирует ничего, что ведёт
//  обратно к collect.mjs — см. AGENTS.md → «Источники правил» и
//  test/rules/source-registry-acyclic.test.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { hasRequisitionTalent, REQUISITION_TALENTS, BULK_QUANTITY } from "./requisition.mjs";

const isCommerce = ctx => ctx?.kind === "skill" && String(ctx.skill ?? "").toLowerCase() === "commerce";

export const EXCESSIVE_WEALTH_BONUS = 10;
export const LORD_OF_WAR_BONUS = 20;
export const FACTOTUM_CASE_BONUS = 10;

/**
 * Правила Талантов для ТЕКУЩЕГО теста. Работает на двух тестах: Реквизиция
 * (`ctx.requisition`) и Commerce («тесты Commerce» у Чрезмерного Богатства и
 * Повелителя Войны); на всех остальных молчит.
 */
export function requisitionTalentRules(actor, ctx = {}) {
  const requisition = ctx?.requisition === true;
  const commerce = !requisition && isCommerce(ctx);
  if (!requisition && !commerce) return [];

  const target = requisition ? "requisition" : "skill:commerce";
  const T = REQUISITION_TALENTS;
  const rules = [];

  if (hasRequisitionTalent(actor, "excessiveWealth")) {
    rules.push({
      id: T.excessiveWealth.id, when: {},
      label: `${T.excessiveWealth.label}: демонстрация богатства`,   // число дописывает окно броска
      effects: [{ kind: "rollBonus", target, value: EXCESSIVE_WEALTH_BONUS, askOnly: true }]
    });
  }

  if (hasRequisitionTalent(actor, "lordOfWar")) {
    if (requisition) {
      const rarity = Number(ctx.requisitionRarity);
      const qty = Number(ctx.requisitionQuantity);
      if (Number.isFinite(rarity) && rarity <= 0 && qty >= BULK_QUANTITY) {
        rules.push({
          id: T.lordOfWar.id, when: {},
          label: `${T.lordOfWar.label}: опт ${BULK_QUANTITY}+ штук, Редкость 0 и ниже`,
          effects: [{ kind: "rollBonus", target, value: LORD_OF_WAR_BONUS, auto: true }]
        });
      }
    } else {
      rules.push({
        id: T.lordOfWar.id, when: {},
        label: `${T.lordOfWar.label}: опт ${BULK_QUANTITY}+ штук снаряжения Редкостью 0 и ниже`,
        effects: [{ kind: "rollBonus", target, value: LORD_OF_WAR_BONUS, askOnly: true }]
      });
    }
  }

  if (requisition && hasRequisitionTalent(actor, "contactNetwork")) {
    rules.push({
      id: T.contactNetwork.id, when: {},
      label: `${T.contactNetwork.label}: F вместо Inf (по каждому миру с ячейкой отдельно — один тест Реквизиции)`,
      effects: [{ kind: "rollBonus", target, value: 0, askOnly: true, setChar: "fel" }]
    });
  }

  // Что Захотите (Иерарх, «Домашнее правило»): «Когда Архонт требует пройти тест
  // на реквизицию для удовлетворения своих нужд, персонаж получает бонус
  // F.b×2 + Inf.b Архонта на этот тест». Решение владельца 26.10.2026: F.b — с
  // листа ПЕРСОНАЖА, Inf.b Архонта вводится числом в окне Реквизиции
  // (ctx.requisitionArchonInf; токен-Архонт не нужен). Поле пусто — реквизиция
  // не по требованию Архонта, бонуса нет. Число введено — бонус автоматический:
  // игрок сам заполнил поле именно для этого.
  if (requisition && hasRequisitionTalent(actor, "whateverYouWant")) {
    const raw = ctx.requisitionArchonInf;
    const archon = raw == null || raw === "" ? NaN : Number(raw);
    if (Number.isFinite(archon)) {
      const felBonus = Number(actor?.system?.characteristics?.fel?.bonus) || 0;
      const infBonus = Math.max(0, Math.round(archon));
      rules.push({
        id: T.whateverYouWant.id, when: {},
        label: `${T.whateverYouWant.label}: F.b×2 (${felBonus * 2}) + Inf.b Архонта (${infBonus})`,
        effects: [{ kind: "rollBonus", target, value: felBonus * 2 + infBonus, auto: true }]
      });
    }
  }

  if (requisition && hasRequisitionTalent(actor, "factotumCase")) {
    rules.push({
      id: T.factotumCase.id, when: {},
      label: `${T.factotumCase.label}: реквизиция на обслуживание пустолёта`,
      effects: [{ kind: "rollBonus", target, value: FACTOTUM_CASE_BONUS, askOnly: true }]
    });
  }

  return rules;
}
