// module/apps/sus-an-heal.mjs
// ════════════════════════════════════════════════════════════════════════
//  Активное исцеление Сус-ан Мембраны у Призраков Смерти (Гвардия Ворона,
//  XIX легион, орден deathspectres): «раз/сутки исцеляет 2×СУ Ран» (книга,
//  геносемя ордена). Кулдаун считается по игровым суткам Календаря
//  (game.time.worldTime), а не по раундам боя и не по реальным часам за
//  столом — «раз в сутки» здесь именно про мир, а не про сессию.
//
//  Кнопка активации — та же идея, что переключатель Технофокусов на вкладке
//  ТЕХ (module/sheets/tabs/tech.mjs, флаг techActive): один флаг на предмете,
//  один чекбокс/кнопка. Отличие — это не постоянное состояние «вкл/выкл», а
//  разовое действие с перезарядкой, поэтому кнопка сама себя блокирует до
//  истечения суток, а не хранит two-state переключатель.
//
//  Не редкий общий вид Механики (kind), а свой маленький модуль — тем же
//  приёмом, что Тест Страха/Травмы (combat/fear.mjs) или наркотики
//  (sheets/tabs/drugs.mjs): расчёт слишком книжно-специфичен (свой тест,
//  своя формула, свой кулдаун), чтобы обобщать его в Конструкторе ради
//  одного органа одного ордена.
//
//  «В конце следующего Хода» (книга) — отдельная задержка ПОВЕРХ суточного
//  кулдауна, и меряется не Календарём, а Раундами боя (game.combat.round),
//  тем же приёмом, что «раз-в-Раунд» возможности (isRoundCapabilityAvailable
//  в apps/game-session.mjs) и сброс накопителя урона Орды по updateCombat
//  (hooks.mjs). Актор не в бою (нет активного Encounter, или актор не
//  комбатант в нём) — отследить «следующий Ход» нечем, лечение применяется
//  сразу, как раньше. Резолвер висит на updateCombat (смена Раунда) и на
//  deleteCombat (бой кончился раньше — доносим отложенное лечение, а не
//  теряем его).
// ════════════════════════════════════════════════════════════════════════

import { SECONDS_PER_DAY } from "../constants/imperial-calendar.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { worldTimeRemaining, markWorldTimeCooldownUsed } from "../rules/cooldown.mjs";

const FLAG = "warhammer-dbc";
const USED_AT_FLAG = "susAnHealUsedAt";
const PENDING_FLAG = "susAnHealPending";

/** Призрак Смерти — Гвардия Ворона (XIX легион), орден deathspectres. */
export function isDeathSpectre(actor) {
  const gs = actor?.system?.geneSeed;
  return gs?.legion === "XIX" && gs?.chapter === "deathspectres";
}

/** Сус-ан Мембрана — по имени, как и остальные органы Геносемени в паке. */
export function isSusAnMembraneItem(item) {
  return item?.type === "implant" && /Сус-ан Мембрана/i.test(item?.name || "");
}

/** Секунд до следующей доступности (0 — доступно прямо сейчас). */
export function susAnHealCooldownRemaining(item) {
  const usedAt = Number(item?.getFlag?.(FLAG, USED_AT_FLAG) ?? item?.flags?.[FLAG]?.[USED_AT_FLAG]) || 0;
  if (!usedAt) return 0;
  return worldTimeRemaining(usedAt, game.time.worldTime, SECONDS_PER_DAY);
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}ч ${String(m).padStart(2, "0")}м`;
}

/**
 * Кнопка на листе Импланта — видна только владельцу-Призраку Смерти с этим
 * органом. Пустая строка у всех остальных: орган тот же самый, кнопка не
 * должна путать читателя листа другого Астартес.
 */
export function susAnHealButtonHtml(item, actor) {
  if (!isSusAnMembraneItem(item) || !isDeathSpectre(actor)) return "";
  const remaining = susAnHealCooldownRemaining(item);
  const ready = remaining <= 0;
  return `<div class="sus-an-heal">
    <div class="sus-an-heal-title">Призраки Смерти — исцеление раз в сутки</div>
    <button type="button" class="sus-an-heal-btn" data-item-id="${item.id}" ${ready ? "" : "disabled"}>
      ${rollIcon("heart", "#4dffa6")} Тест Т — исцелить 2×СУ Ран
    </button>
    <span class="sus-an-heal-status ${ready ? "sus-an-heal-ready" : ""}">${ready ? "Готово" : `Перезарядка: ${formatDuration(remaining)}`}</span>
  </div>`;
}

/** Комбатант актора в текущем бою, или null (нет боя / актор не в нём). */
function actorCombatant(actor) {
  if (!game.combat || !actor) return null;
  return game.combat.combatants.find(c => c.actor?.id === actor.id) || null;
}

async function applyHeal(actor, amount) {
  if (amount <= 0) return;
  const cur = Number(actor.system.wounds?.value) || 0;
  const max = Number(actor.system.wounds?.max) || 0;
  await actor.update({ "system.wounds.value": Math.min(max, cur + amount) });
}

/** Отложенное исцеление на предмете — {amount, dueRound} или null. */
export function susAnHealPending(item) {
  return item?.getFlag?.(FLAG, PENDING_FLAG) ?? item?.flags?.[FLAG]?.[PENDING_FLAG] ?? null;
}

/** Тест Т(+0); при успехе исцеляет 2×СУ Ран и уходит на сутки перезарядки. */
export async function useSusAnHeal(actor, item) {
  if (susAnHealCooldownRemaining(item) > 0) {
    return ui.notifications.warn("Сус-ан Мембрана ещё не восстановилась — раз в сутки.");
  }
  const t = actor.system.characteristics?.t?.total ?? 0;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= t;
  const sl = success ? Math.floor((t - rv) / 10) + 1 : 0;
  const healed = sl * 2;

  // «В конце следующего Хода» — только пока идёт бой и актор в нём
  // комбатант: без Раундов эту задержку отследить нечем, лечение сразу.
  const combatant = actorCombatant(actor);
  let delayNote = "";
  if (healed > 0 && combatant) {
    const dueRound = game.combat.round + 1;
    await item.setFlag(FLAG, PENDING_FLAG, { amount: healed, dueRound });
    delayNote = `Наступит в конце Раунда ${dueRound} — сообщение придёт отдельно.`;
  } else if (healed > 0) {
    await applyHeal(actor, healed);
  }
  // Перезарядка отсчитывается в любом случае — успех или провал, попытка
  // раз в сутки, а не «пока не получится».
  await markWorldTimeCooldownUsed(item, USED_AT_FLAG);

  const rollMode = game.settings.get("core", "rollMode");
  const dice = await roll.render();
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("heart", "#4dffa6")}Сус-ан Мембрана — ${esc(actor.name)}</div>
        <div class="roll-threshold">Т: <b>${t}</b></div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${success
          ? `<span class="roll-success">Успех (${sl} СУ) — ${delayNote ? `исцелит ${healed} Ран` : `исцелено ${healed} Ран`}</span>`
          : `<span class="roll-failure">Провал — Раны не исцелены</span>`}</div>
        ${delayNote ? `<div class="roll-threshold" style="font-size:.85em;opacity:.8;">${delayNote}</div>` : ""}
        <div class="roll-threshold" style="font-size:.85em;opacity:.8;">Раз в сутки (Календарь).</div>
        <details class="roll-dice-details"><summary>${rollIcon("chart", "#8fd0ff")}Показать кубы</summary>${dice}</details>
      </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, rollMode));
}

/**
 * Резолвер отложенных исцелений — вызывается из hooks.mjs на updateCombat
 * (смена Раунда) и deleteCombat (бой кончился раньше срока). force
 * применяет отложенное немедленно, не дожидаясь dueRound (bой всё равно
 * закончился, ждать больше нечего).
 */
export async function resolvePendingSusAnHeals(combat, { force = false } = {}) {
  if (!game.user.isGM) return;
  for (const combatant of combat?.combatants ?? []) {
    const actor = combatant.actor;
    if (!actor) continue;
    for (const item of actor.items ?? []) {
      if (!isSusAnMembraneItem(item)) continue;
      const pending = susAnHealPending(item);
      if (!pending) continue;
      if (!force && (combat.round ?? 0) <= pending.dueRound) continue;
      await applyHeal(actor, pending.amount);
      await item.unsetFlag(FLAG, PENDING_FLAG);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="wh-roll-result">
          <div class="roll-header">${rollIcon("heart", "#4dffa6")}Сус-ан Мембрана — ${esc(actor.name)}</div>
          <div class="roll-outcome"><span class="roll-success">Отложенное исцеление наступило — ${pending.amount} Ран</span></div>
        </div>`
      });
    }
  }
}
