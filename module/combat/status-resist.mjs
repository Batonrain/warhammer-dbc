// module/combat/status-resist.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Стальная Челюсть и Стена (Таланты Стойкости, глава 3):
//    Iron Jaw / Стальная Челюсть — «Когда персонаж получает эффект Оглушения, он
//      может пройти тест на Т+0, чтобы проигнорировать его.»
//    Stonewall / Стена — «Когда персонажа сбивают с ног или насильно перемещают,
//      он может пройти тест на S+0, чтобы проигнорировать это. Если его пытались
//      сбить или сдвинуть рукопашным приёмом, на 5+ Успехов он может выбрать сбить
//      или сдвинуть (соответственно) атакующего.»
//
//  ── Единая точка наложения (решение владельца 18.10.2026) ────────────────────
//  Состояния накладывает синхронный conditionApplyFields (sheets/tabs/conditions.mjs):
//  он только СОБИРАЕТ патч, а писать его двадцать мест будут сами — спросить игрока
//  внутри него нельзя (диалог асинхронный, а его зовут и из пересчётов, и из тестов
//  без Foundry). Поэтому здесь тонкая асинхронная обёртка:
//
//      const { fields } = await statusApplyFields(actor, "prone", null, {...});
//
//  Она берёт патч у conditionApplyFields (значит, ИММУНИТЕТ уже учтён — пустой патч
//  диалога не вызывает), и ТОЛЬКО если Состояние реально накладывается, актор —
//  носитель Таланта и Состояние не стоит уже, предлагает тест. Тест пройден — патч
//  заменяется пустым: «состояние не накладывается».
//
//  Подключено в источниках, где Состояние накладывает ДРУГОЕ существо или эффект:
//  приём Оглушить, Повалить, Напролом, Пересилить, Критический Эффект (пилюли),
//  свойства оружия (Оглушающее, Вибро, Повалить, Гравитационное), Грозный Вопль,
//  падение из седла, Состояния от психосил/предметов при провале сопротивления.
//  НЕ подключено (осознанно): ручное наложение ГМом (диалог «Добавить», токен-HUD),
//  тики и снятие, загрузка и миграции, добровольное падение (Лечь, Залечь, «Падай
//  и Перекатывайся»), падение с высоты, самотравма броска без опоры,
//  Благословенные Припадки (расплата собственной Мутации).
//
//  «Насильно перемещают» НЕ автоматизируется: в системе нет принудительного сдвига
//  токена цели (фишки двигают руками), поэтому и тест на него не вешается.
// ════════════════════════════════════════════════════════════════════════════

import { conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import { statusResistFor, stonewallKnockBack } from "../rules/resilience-talents.mjs";
import { rollResilienceTest } from "./resilience-test.mjs";
import { esc } from "../helpers/utils.mjs";

/** Уже идущие предложения («актор:Состояние»): повторный вход — не спрашивать второй раз (защита от рекурсии). */
const inFlight = new Set();

const confirm = (title, text, yes, no) => foundry.applications.api.DialogV2.confirm({
  window: { title }, content: `<p>${text}</p>`, yes: { label: yes }, no: { label: no }
}).then(r => !!r).catch(() => false);

/** Состояние уже стоит: новое «наложение» ничего не меняет, а Оглушение лишь продлевается. */
function alreadyApplied(actor, condKey) {
  return condKey === "prone" && !!actor?.system?.conditions?.prone;
}

/**
 * Предложить носителю тест вместо наложения Состояния.
 * @param {Actor} actor носитель — тот, на кого накладывают
 * @param {"stunned"|"prone"} condKey
 * @param {object} [o]
 * @param {Actor|null} [o.attacker]    кто накладывает (для ответного сбива Стеной)
 * @param {boolean} [o.melee]          наложение рукопашным приёмом (Повалить, Напролом, Пересилить)
 * @param {string}  [o.source]         подпись источника для диалога («Повалить», «Критический Эффект»)
 * @param {boolean} [o.noKnockBack]    ответный сбив запрещён (сам был ответным — иначе два носителя Стены бесконечно сбивали бы друг друга)
 * @returns {Promise<{resisted:boolean, knockedBack:boolean, note:string}>} resisted — Состояние НЕ накладывать
 */
export async function offerStatusResist(actor, condKey, { attacker = null, melee = false, source = "", noKnockBack = false } = {}) {
  const none = { resisted: false, knockedBack: false, note: "" };
  const rule = statusResistFor(actor, condKey);
  if (!rule || alreadyApplied(actor, condKey)) return none;
  // Иммунитет: пустой патч единой точки — Состояние всё равно не наложится, тест не нужен.
  if (!Object.keys(conditionApplyFields(condKey, condKey === "stunned" ? 1 : null, actor)).length) return none;
  const guard = `${actor.uuid ?? actor.id}:${condKey}`;
  if (inFlight.has(guard)) return none;
  inFlight.add(guard);
  try {
    const agreed = await confirm(rule.name,
      `${esc(actor.name)}${source ? ` (${esc(source)})` : ""}: на персонажа накладывают «${esc(rule.what)}». Пройти тест ${rule.charLabel}+0, чтобы проигнорировать это?`,
      `Пройти тест ${rule.charLabel}+0`, "Принять эффект");
    if (!agreed) return none;

    const test = await rollResilienceTest(actor, rule.char, {
      title: rule.name, charLabel: rule.charLabel,
      // Сопротивление (Stun) даёт +10 на тесты против Оглушения — тег тот же, что у теста свойства оружия.
      ctx: condKey === "stunned" ? { stunTest: true } : {},
      successText: `Успех ({deg}) — ${condKey === "stunned" ? "Оглушение проигнорировано" : "остаётся на ногах"}`,
      failText: `Провал — ${condKey === "stunned" ? "Оглушение накладывается" : "сбит с ног"}`
    });
    if (!test.success) return none;

    // Стена: 5+ Успехов против рукопашного приёма — можно ответно сбить нападающего.
    let knockedBack = false;
    if (condKey === "prone" && !noKnockBack
        && stonewallKnockBack({ successes: test.deg, melee, hasAttacker: !!attacker })) {
      const choice = await foundry.applications.api.DialogV2.wait({
        window: { title: "Стена" },
        content: `<p>${test.deg} Успехов. ${esc(actor.name)} может не просто устоять, а сбить с ног ${esc(attacker.name)}.</p>`,
        rejectClose: false,
        buttons: [
          { action: "knock", label: `Сбить ${attacker.name}` },
          { action: "ignore", label: "Просто устоять" }
        ]
      }).catch(() => null);
      if (choice === "knock") {
        const back = await statusApplyFields(attacker, "prone", null, { attacker: actor, melee: false, source: "Стена", noKnockBack: true });
        if (Object.keys(back.fields).length) {
          await attacker.update(back.fields);
          knockedBack = true;
        }
      }
    }
    const note = `${rule.name}: тест ${rule.charLabel}+0 пройден (${test.deg} Усп.) — ${
      condKey === "stunned" ? "Оглушение проигнорировано" : "остаётся на ногах"}${knockedBack ? `; ${attacker.name} сбит с ног` : ""}.`;
    return { resisted: true, knockedBack, note };
  } finally {
    inFlight.delete(guard);
  }
}

/**
 * Патч наложения Состояния с учётом Стальной Челюсти и Стены — замена
 * conditionApplyFields в местах, где Состояние накладывает другое существо.
 * @returns {Promise<{fields:object, resisted:boolean, note:string}>}
 *   fields пуст при иммунитете или если носитель устоял
 */
export async function statusApplyFields(actor, condKey, level = null, opts = {}) {
  const fields = conditionApplyFields(condKey, level, actor);
  if (!Object.keys(fields).length) return { fields, resisted: false, note: "" };
  const r = await offerStatusResist(actor, condKey, opts);
  return { fields: r.resisted ? {} : fields, resisted: r.resisted, note: r.note };
}
