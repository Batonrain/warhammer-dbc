// module/rules/resolve-test.mjs
//
// Единый конвейер теста. Семь фаз (docs/architecture-plan.md, этап 2):
//
//   1. Контекст     — кто бросает, чем, по кому, вид теста
//   2. Сбор правил  — источники плюс хук «dbc.collectRules»
//   3. Отбор        — по `when`, снятие вытесненных
//   4. Диалог       — ситуативные галочки игроку
//   5. Бросок       — единственное место, где встречается 1d100
//   6. Последствия  — урон, крит, состояния
//   7. Карточка     — сообщение в чат
//
// Здесь живут только фазы 1–3: они не знают ни про интерфейс, ни про чат, ни про
// кубик, и потому проверяются тестом без запуска Foundry. Фазы 4–7 пока остаются
// в листе персонажа, который берёт у конвейера готовый список правил и галочек.

import { gatherRules, selectRules } from "./collect.mjs";
import { isKnownEffectKind } from "./effects.mjs";

/** Хук вне Foundry не существует: в тестах конвейер работает без него. */
function callHook(name, ...args) {
  if (typeof Hooks === "undefined") return;
  Hooks.callAll(name, ...args);
}

/**
 * Фаза 1. Контекст броска в одном объекте.
 *
 * Поля `kind`, `skill`, `group`, `specialty`, `char` и флаговые (`suppression`,
 * `single`, `target`) читает матчер ситуативных модификаторов
 * (rules/match-context.mjs), поэтому имена и значения совпадают с тем, что лист
 * собирал раньше: `kind: "skill"` у тестов и навыка, и характеристики.
 *
 * Актор цели лежит в `targetActor`: имя `target` в этом же объекте занято
 * флагом «бросок нацелен».
 */
export function buildTestContext(input = {}) {
  const ctx = { kind: "skill", ...input };
  ctx.actor ??= null;
  return ctx;
}

/**
 * Область действия эффекта: `target` записывается с двоеточием
 * (`skill:medicae`, `char:wp`, `initiative`), `all` или пустой — «в любом тесте».
 *
 * Тест навыка и тест характеристики различаются наличием `ctx.skill`: у теста
 * характеристики его нет. Поэтому `char:int` не подхватывается броском навыка на
 * Интеллекте — иначе одна запись означала бы два разных правила книги.
 *
 * Области атак и психосил (`weapon:`, `power:`) на этом этапе не совпадают ни с
 * чем: атаки переводятся на конвейер на шаге 5.2 плана.
 */
function effectAppliesTo(target, ctx) {
  const scope = String(target ?? "all").trim().toLowerCase();
  if (scope === "all" || scope === "") return true;
  if (scope === "initiative") return ctx.kind === "initiative";
  if (ctx.skill) return scope === `skill:${String(ctx.skill).toLowerCase()}`;
  if (ctx.char)  return scope === `char:${String(ctx.char).toLowerCase()}`;
  return false;
}

/**
 * Галочки для диалога броска. Формат тот же, что у Особенностей Происхождения и
 * предметных `rollMods`: { value, label, halvePenalty } — лист складывает их
 * одинаково, не зная, откуда галочка пришла.
 *
 * Отбор по `when` уже прошёл на фазе 3, поэтому `when` в галочке нет: правило,
 * не подходящее актору, сюда не доходит. Остаётся `ruleId` — по нему видно,
 * какое правило дало модификатор.
 *
 * Модификатор не применяется молча: игрок сам решает, уместен ли он здесь, — так
 * же, как с Особенностями.
 */
export function rollModsFromRules(rules, ctx = {}) {
  const mods = [];
  for (const rule of rules ?? []) {
    for (const effect of rule?.effects ?? []) {
      if (!isKnownEffectKind(effect?.kind)) {
        console.error(`Warhammer DBC | правило «${rule?.id ?? "без id"}»: неизвестный вид эффекта «${effect?.kind}»`);
        continue;
      }
      if (!effectAppliesTo(effect.target, ctx)) continue;

      const label = effect.label ?? rule.label ?? rule.id;
      if (effect.kind === "rollBonus") {
        mods.push({ ruleId: rule.id, label, value: Number(effect.value) || 0, halvePenalty: false });
        continue;
      }
      // Диалог умеет только ополовинить штраф — другого множителя в нём нет.
      // Правило с иным factor не применяем молча, а жалуемся: тихо потерянный
      // множитель ищется днями.
      if (effect.kind === "penaltyMul") {
        if (Number(effect.factor) !== 0.5) {
          console.error(`Warhammer DBC | правило «${rule?.id ?? "без id"}»: множитель штрафа ${effect.factor} диалог броска не умеет, только 0.5`);
          continue;
        }
        mods.push({ ruleId: rule.id, label, value: 0, halvePenalty: true });
      }
      // Остальные виды эффектов на бросок не влияют: они про урон, броню и
      // производные поля, и подключаются вместе с фазами 5–6.
    }
  }
  return mods;
}

/**
 * Фазы 1–3 целиком: контекст, сбор, отбор.
 *
 * Хук «dbc.collectRules» получает контекст и изменяемый список правил до
 * отбора — так сторонний модуль дописывает правила, и они просеиваются по `when`
 * наравне с остальными.
 *
 * @returns {{ctx: object, rules: object[], mods: object[]}}
 */
export function resolveTest(input = {}) {
  const ctx = buildTestContext(input);
  const bag = gatherRules(ctx.actor, ctx);
  callHook("dbc.collectRules", ctx, bag);
  const rules = selectRules(bag, ctx.actor, ctx);
  return { ctx, rules, mods: rollModsFromRules(rules, ctx) };
}
