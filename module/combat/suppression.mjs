// module/combat/suppression.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  ПОДАВЛЕНИЕ (стр. 32-33): тест на W+0, тест Морали. Провал → состояние
//  «Подавлен» (system.conditions.pinned — уже существовало как флаг, но
//  ничего не читало; теперь есть сам тест, который его накладывает).
//  Снимается тестом W+0 (+30, если стрелок и округа 10м не обстреливались с
//  конца предыдущего Хода стрелка — бонус не автоматизирован, решает ГМ) в
//  конце Хода Подавленного.
//
//  Рукопашный контакт (стр. 33, wdbc-x1nz.2.62): «персонажи в рукопашной не
//  подвержены Подавлению» — тест не катается вовсе (ниже, actorMeleeContactNow,
//  та же геометрия contactType, что у Свободной Атаки, free-attack.mjs).
//  Автопреодоление «когда оказываются в рукопашной» — в free-attack.mjs
//  (clearPinnedOnMeleeEntry, зовётся на НОВОМ контакте, а не отсюда): у этого
//  файла нет доступа к хуку движения токена, а у free-attack.mjs он уже есть.
//
//  «Заведомо безопасно» (стр. 33, wdbc-x1nz.2.62): auto-pass, если обстрел
//  точно не нанесёт больше 3 урона после Поглощения. Точный расчёт требует
//  знать броню цели по локации и конкретный урон выстрела — вместо этого
//  чекбокс на карточке (attack-card.mjs), ГМ решает на глаз, safeOverride
//  ниже просто читает его.
//
//  Движение в укрытие при провале (стр. 33): без разметки укрытий и путей на
//  сцене полноценно не автоматизировать — вместо этого карточка провала
//  проверяет, стоит ли актор ПРЯМО СЕЙЧАС в зоне Укрытия (coverApForToken,
//  тот же приём, что у Отскока), и если нет — печатает напоминание с кнопкой
//  «Залечь», решение «дотянулся ли» остаётся за столом.
// ─────────────────────────────────────────────────────────────────────────────

import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollMoraleTest } from "../rules/morale-test.mjs";
import { applyLordOfExoditesFailPenalty } from "./lord-of-exodites.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { conditionApplyFields, conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { duckAndCoverAdvantage } from "../rules/duck-and-cover.mjs";
import { enemyContactTokenDocs } from "./free-attack.mjs";
import { coverApForToken } from "./cover.mjs";

/** Стрелковая RoF, которой ведётся Стрельба на Подавление, задаёт штраф цели. */
export function suppressionTestMod(sys) {
  return (Number(sys?.rof_full) || 0) > 0 ? -20 : -10;
}

function activeTokenOf(actor) {
  return actor?.getActiveTokens?.()?.[0] ?? null;
}

/** Есть ли у актора СЕЙЧАС враг личного масштаба в Базовом/Глубоком контакте. */
function actorMeleeContactNow(actor) {
  const token = activeTokenOf(actor);
  return !!token && enemyContactTokenDocs(token.document).length > 0;
}

/** Стоит ли актор ПРЯМО СЕЙЧАС в зоне Укрытия с AP > 0 (module/combat/cover.mjs). */
function actorInCoverNow(actor) {
  const token = activeTokenOf(actor);
  return !!token && coverApForToken(token) > 0;
}

/**
 * Тест на Подавление одной цели. mod — сумма штрафов (RoF-модификатор,
 * Импульсное и т.п.), уже посчитанная снаружи. sourceActor (wdbc-1rno) —
 * стрелок, если он известен (кнопка несёт его UUID из карточки атаки) —
 * cross-actor правила вроде Ненависти читают его как ctx.targetActor теста
 * Морали; без него ведёт себя как раньше.
 * safeOverride (стр. 33, wdbc-x1nz.2.62) — ГМ отметил галочку «Заведомо
 * безопасно» на карточке атаки: тест проходит автоматически, без броска.
 */
export async function rollSuppressionTest(actor, { mod = 0, sourceLabel = "", sourceActor = null, safeOverride = false } = {}) {
  // Рукопашный контакт (стр. 33): тест не катается вовсе, Подавление не
  // накладывается — не «авто-успех» теста, а иммунитет к самому тесту.
  if (actorMeleeContactNow(actor)) {
    await postTestCard(actor, {
      icon: rollIcon("target","#8fd0ff"),
      title: `Тест Подавления${sourceLabel ? ` — ${esc(sourceLabel)}` : ""} → ${esc(actor.name)}`,
      outcome: `<span class="roll-success">В рукопашном контакте — Подавлению не подвержен(а) (стр. 33)</span>`
    });
    return { success: true, rv: null, threshold: null, immune: true };
  }
  if (safeOverride) {
    await postTestCard(actor, {
      icon: rollIcon("target","#8fd0ff"),
      title: `Тест Подавления${sourceLabel ? ` — ${esc(sourceLabel)}` : ""} → ${esc(actor.name)}`,
      outcome: `<span class="roll-success">Заведомо безопасно (≤3 урона) — тест не требуется (стр. 33)</span>`
    });
    return { success: true, rv: null, threshold: null, autoSafe: true };
  }

  const wpTotal   = actor.system.characteristics?.wp?.total ?? 0;
  // Перебежка (стр. 30, wdbc-x1nz.2.38): переброс Подавления до конца Раунда.
  const { eff: threshold, parts, roll, rv, rerollNote, success: rolledSuccess, dof, usedReroll } = await rollMoraleTest(actor, wpTotal + mod, {
    sourceActor, selfAdvantage: duckAndCoverAdvantage(actor), selfAdvantageLabel: "Перебежка"
  });
  // Саркофаг Дредноута (стр. 57, wdbc-drn): автоматически проходит тесты
  // Подавления независимо от броска.
  const success   = rolledSuccess || hasRuleFlag(actor, "sarcophagus.autoPassFear");

  if (!success) await actor.update(conditionApplyFields("pinned", null, actor));
  await applyLordOfExoditesFailPenalty(actor, { dof, usedReroll });

  // Подписи, а не голая сумма (wdbc-kuun): раньше здесь стояло « +30 -10»
  // без объяснения, откуда −10 — тот же дефект, что живая проверка нашла в
  // Командовании и Ударе Ассасина.
  const modParts = [mod !== 0 ? `модификатор ${mod >= 0 ? "+" : ""}${mod}` : "", ...parts];
  // Не в укрытии (стр. 33, wdbc-x1nz.2.62): книга требует потратить все
  // действия, чтобы добраться до укрытия, или Залечь, если не вышло — само
  // движение к укрытию не автоматизировано (нет разметки путей на сцене),
  // но факт «уже стоит в зоне Укрытия» проверить можно, и напомнить/дать
  // кнопку Залечь, если нет.
  const notInCoverNote = (!success && !actorInCoverNow(actor))
    ? `<div class="roll-allout-note">Не в укрытии относительно источника — потратьте все действия, чтобы добраться до укрытия, или Залягте, если не выйдет.
        <button class="wh-suppression-prone-btn" type="button" data-actor-uuid="${actor.uuid}">Залечь (Ничком)</button>
      </div>`
    : "";
  await postTestCard(actor, {
    icon: rollIcon("target","#ff9a4d"),
    title: `Тест Подавления${sourceLabel ? ` — ${esc(sourceLabel)}` : ""} → ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "WP", base: wpTotal, parts: modParts, threshold, rv }),
    rerollNote,
    outcome: success
      ? `<span class="roll-success">Успех — сохраняет самообладание</span>`
      : `<span class="roll-failure">Провал — Подавлен (📌)</span>`,
    sections: [notInCoverNote]
  }, { rolls: [roll] });
  return { success, rv, threshold };
}

/** Кнопка «Залечь» на карточке провала (стр. 33) — не смог добраться до укрытия. */
export async function applySuppressionProne(actor) {
  if (!actor) return;
  const fields = conditionApplyFields("prone", null, actor);
  if (!Object.keys(fields).length) return ui.notifications?.warn("⚠️ Иммунитет — Состояние «Повален» не наложено.");
  await actor.update(fields);
}

/**
 * Напоминание в конце Хода Подавленного персонажа (стр. 33) — две кнопки:
 * обычный тест и тест с +30 (округа не обстреливалась — решает ГМ, не
 * автоопределяется). Зовётся из hooks.mjs при смене Хода, если у уходящего
 * актора стоит conditions.pinned.
 */
export async function postSuppressionRecoveryPrompt(actor) {
  const rollMode = game.settings.get("core", "rollMode");
  const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("target","#ff9a4d")}${esc(actor.name)} Подавлен(а) — конец Хода</div>
        <div class="roll-threshold">Тест W+0 на преодоление Подавления (+30, если сам и округа 10м не обстреливались с конца предыдущего Хода — решает ГМ).</div>
        <div class="roll-defense-btns">
          <button class="wh-suppression-recovery-btn" type="button" data-actor-uuid="${actor.uuid}" data-bonus="0">Тест (+0)</button>
          <button class="wh-suppression-recovery-btn" type="button" data-actor-uuid="${actor.uuid}" data-bonus="30">Тест (+30, тихо)</button>
        </div>
      </div>`,
    sound: null
  }, rollMode);
  await ChatMessage.create(messageData);
}

/**
 * Тест на преодоление Подавления (конец Хода Подавленного). bonus — обычно
 * +30, если решает ГМ (округа не обстреливалась) — передаётся снаружи,
 * авто-определения «обстреливали ли рядом» нет.
 */
export async function rollSuppressionRecovery(actor, { bonus = 0 } = {}) {
  const wpTotal   = actor.system.characteristics?.wp?.total ?? 0;
  const { eff: threshold, parts: ruleParts, roll, rv, rerollNote, success: rolledSuccess, dof, usedReroll } = await rollMoraleTest(actor, wpTotal + bonus);
  // Саркофаг Дредноута (стр. 57, wdbc-drn): та же возможность, что и на самом
  // тесте Подавления выше — практически недостижимо (auto-pass не даёт
  // Подавлению вообще наступить), но на случай ручного наложения ГМом.
  const success   = rolledSuccess || hasRuleFlag(actor, "sarcophagus.autoPassFear");

  if (success) await actor.update(conditionRemoveFields("pinned"));
  await applyLordOfExoditesFailPenalty(actor, { dof, usedReroll });

  const bonusParts = [bonus !== 0 ? `тишина ${bonus >= 0 ? "+" : ""}${bonus}` : "", ...ruleParts];
  await postTestCard(actor, {
    icon: rollIcon("target","#4dffa6"), title: `Преодоление Подавления → ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "WP", base: wpTotal, parts: bonusParts, threshold, rv }),
    rerollNote,
    outcome: success
      ? `<span class="roll-success">Успех — Подавление снято</span>`
      : `<span class="roll-failure">Провал — всё ещё Подавлен</span>`
  }, { rolls: [roll] });
  return { success, rv, threshold };
}

/**
 * Рукопашный контакт снимает Подавление (стр. 33, wdbc-x1nz.2.62):
 * «персонажи в рукопашной ... автоматически преодолевают Подавление, когда
 * оказываются в рукопашной». Зовётся из free-attack.mjs на НОВОМ контакте
 * (появившемся этим перемещением) — для обеих сторон контакта, не только для
 * того, кто сам подошёл: тот, к кому подошли, тоже «оказался в рукопашной».
 */
export async function clearPinnedOnMeleeEntry(actor) {
  if (!actor?.system?.conditions?.pinned) return;
  await actor.update(conditionRemoveFields("pinned"));
}
