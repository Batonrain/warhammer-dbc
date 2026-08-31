// module/apps/stat-log.mjs
// ════════════════════════════════════════════════════════════════════════
//  Кнопка «+» у показателей (Безумие, Порча, Опыт, Благосклонность Богов):
//  маленький диалог — значение (+ обязательная причина) — прибавляется
//  к полю на акторе, лог изменения уходит в чат (спикер = актёр).
//  allowDice: значение может быть не только int, но и формулой XdY(+Z)
//  (Безумие/Порча — «можно бросить кости порчи/безумия»).
// ════════════════════════════════════════════════════════════════════════
import { esc } from "../helpers/utils.mjs";

const DICE_RE = /^(\d+)d(\d+)\s*([+-]\s*\d+)?$/i;

function parseDelta(raw, allowDice) {
  const s = String(raw ?? "").trim();
  if (allowDice) {
    const m = s.match(DICE_RE);
    if (m) return { formula: `${m[1]}d${m[2]}${m[3] ? m[3].replace(/\s+/g, "") : ""}` };
  }
  const n = Number(s.replace(/^\+/, ""));
  return Number.isFinite(n) && s !== "" ? { flat: n } : null;
}

/**
 * Диалог «добавить к показателю» + запись лога изменения в чат.
 * @param {Actor} actor
 * @param {object} opts
 * @param {string} opts.label     — заголовок диалога и подпись в чате
 * @param {string} opts.path      — путь к полю, напр. "system.insanity.value"
 * @param {boolean} [opts.allowDice=false] — разрешить формулу XdY(+Z) вместо целого числа
 * @param {number|null} [opts.clampMin=0]  — минимум после прибавления (null — без ограничения)
 * @param {number|null} [opts.clampMax=null] — максимум после прибавления
 * @param {number} [opts.bonusPercent=0] — надбавка сверху на положительное значение
 *   (Ловит на Лету / Fast Learner (X): +X% к опыту, ГМ округляет вверх — на
 *   отрицательные и нулевые правки не действует, книга говорит только про «получает»)
 * @param {string} [opts.bonusLabel] — подпись источника модификатора (для окна и чата);
 *   умолчание — единственный источник, который сейчас передаёт bonusPercent.
 * @param {string} [opts.note] — произвольная памятка-напоминание в окне (не влияет на
 *   расчёт, просто видна ДО ввода) — напр. «раса не получает доп. Cor от иных источников».
 */
export async function promptStatAdd(actor, { label, path, allowDice = false, clampMin = 0, clampMax = null,
    bonusPercent = 0, bonusLabel = "Ловит на Лету / Fast Learner", note = "" } = {}) {
  const hint = allowDice ? "целое число, либо XdY+Z, напр. 2d10+3" : "целое число";
  // Видно ДО ввода, не только в чате постфактум — иначе игрок вводит число
  // вслепую, не зная, что оно вырастет.
  const bonusHint = bonusPercent > 0
    ? `<div class="wh-statlog-bonus" title="Действует только на положительные значения — книга говорит про «получает», не про правки задним числом.">
         ⚡ Активен модификатор: <b>${esc(bonusLabel)} +${bonusPercent}%</b></div>`
    : "";
  const noteHint = note ? `<div class="wh-statlog-note">📝 ${esc(note)}</div>` : "";
  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: `${label} — добавить` },
    content: `
      <div class="wh-statlog-form">
        ${bonusHint}${noteHint}
        <label>Значение <small>(${hint})</small>
          <input type="text" name="delta" autofocus required/>
        </label>
        <label>Причина
          <input type="text" name="reason" required/>
        </label>
      </div>`,
    ok: {
      label: "Добавить",
      callback: (_ev, btn) => ({
        delta: btn.form.elements.delta.value,
        reason: btn.form.elements.reason.value.trim()
      })
    }
  }).catch(() => null);
  if (!result || !result.reason) return;

  const parsed = parseDelta(result.delta, allowDice);
  if (!parsed) return ui.notifications.warn(`Не удалось разобрать значение «${result.delta}».`);

  let amount, formulaText, roll = null;
  if (parsed.formula) {
    roll = await new Roll(parsed.formula).evaluate();
    amount = roll.total;
    formulaText = `${parsed.formula} = ${amount}`;
  } else {
    amount = parsed.flat;
    formulaText = `${amount >= 0 ? "+" : ""}${amount}`;
  }

  if (bonusPercent > 0 && amount > 0) {
    const base = amount;
    amount = Math.ceil(amount * (1 + bonusPercent / 100));
    formulaText += ` → ${bonusLabel} +${bonusPercent}%: ${base} → ${amount}`;
  }

  const cur = Number(foundry.utils.getProperty(actor, path)) || 0;
  let next = cur + amount;
  if (clampMin != null) next = Math.max(clampMin, next);
  if (clampMax != null) next = Math.min(clampMax, next);
  await actor.update({ [path]: next });

  const rollMode = game.settings.get("core", "rollMode");
  const diceHtml = roll ? await roll.render() : "";
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result wh-statlog-card">
        <div class="roll-header">${esc(label)} — ${esc(actor.name)}</div>
        <div class="roll-dice">Изменение: <b>${amount >= 0 ? "+" : ""}${amount}</b> (${esc(formulaText)})</div>
        <div class="roll-outcome">Причина: <i>${esc(result.reason)}</i></div>
        <div class="roll-threshold">${cur} → <b>${next}</b></div>
        ${diceHtml ? `<details class="roll-dice-details"><summary>Показать кубы</summary>${diceHtml}</details>` : ""}
      </div>`,
    rolls: roll ? [roll] : [],
    sound: roll ? CONFIG.sounds.dice : undefined
  }, rollMode));
}
