// module/combat/fear.mjs
// ════════════════════════════════════════════════════════════════════════
//  Тест Страха / Ментальной Травмы. Вынесено из actor-sheet.mjs (по образцу
//  defense.mjs) — свободные функции, а не методы листа, чтобы кнопка
//  бесплатного переброса (см. ниже) могла вызвать их из hooks.mjs.
// ════════════════════════════════════════════════════════════════════════

import { FEAR_RATINGS, SHOCK_TABLE, TRAUMA_TABLE, lookupTable } from "../constants/fear-tables.mjs";
import { _degWord, esc }                               from "../helpers/utils.mjs";
import { rollIcon }                                from "../constants/roll-icons.mjs";

/**
 * Тест Страха (1d100 + 10×Провалы−1 − Infamy → таблица Шока при провале).
 * ratingKey — ключ FEAR_RATINGS. properties.demon + провал → карточка
 * получает кнопку ОДНОГО бесплатного переброса; opts.free помечает, что
 * ЭТОТ вызов — уже сам такой переброс, поэтому повторно кнопку не даём
 * (одна бесплатная попытка на тест, не бесконечная цепочка).
 */
export async function _executeFearRoll(actor, ratingKey, type, infamy, mod, properties = {}, opts = {}) {
  const wp = actor.system.characteristics.wp?.total ?? 0;
  const r  = FEAR_RATINGS[ratingKey] || FEAR_RATINGS[1];
  const ratingMod = type === "important" ? r.important : r.normal;
  const eff      = wp + ratingMod + mod;
  const autoPass = infamy >= r.infamy;
  const roll     = await new Roll("1d100").evaluate();
  const rv       = roll.total;
  const success  = autoPass || rv <= eff;
  const dof      = success ? 0 : Math.floor((rv - eff) / 10) + 1;
  const allRolls = [roll];
  let shockHtml  = "";
  if (!success) {
    const sRoll = await new Roll("1d100").evaluate(); allRolls.push(sRoll);
    const total = sRoll.total + 10 * (dof - 1) - infamy;
    if (total <= 0) {
      shockHtml = `<div class="roll-outcome"><span class="roll-success">${rollIcon("shield","#4dffa6")}Шок предотвращён (Infamy)</span></div>`;
    } else {
      const row = lookupTable(SHOCK_TABLE, total);
      shockHtml = `<div class="roll-damage-section">
        <div class="roll-damage-label">Шок (${sRoll.total}${dof > 1 ? ` +${10 * (dof - 1)}` : ""}${infamy ? ` −${infamy}` : ""} = ${total}):</div>
        <div class="roll-threshold">${row?.text ?? "—"}</div></div>`;
    }
  }
  // 5+ степеней провала Страха → Ментальная Травма (в конце сцены)
  if (!success && dof >= 5) {
    shockHtml += `<div class="roll-threshold" style="margin-top:4px;color:#9a0000;font-weight:bold;">5+ степеней провала — в конце сцены пройдите тест Ментальной Травмы (кнопка «Травма»).</div>`;
  }

  const canReroll = !!properties.demon && !success && !opts.free;
  await _postFearMsg(actor, "Тест Страха", r.label, wp, ratingMod + mod, rv, eff, success, dof, shockHtml, allRolls,
    properties, canReroll ? { ratingKey, type, infamy, mod } : null);
}

/** Тест Ментальной Травмы (W+0) → при провале таблица Травмы. Без Демона/переброса. */
export async function _executeTraumaRoll(actor) {
  const wp   = actor.system.characteristics.wp?.total ?? 0;
  const roll = await new Roll("1d100").evaluate();
  const rv   = roll.total;
  const success = rv <= wp;
  const dof  = success ? 0 : Math.floor((rv - wp) / 10) + 1;
  const allRolls = [roll];
  let traumaHtml = "";
  if (!success) {
    const tRoll = await new Roll("1d100").evaluate(); allRolls.push(tRoll);
    const total = tRoll.total + 10 * (dof - 1);
    const row   = lookupTable(TRAUMA_TABLE, total);
    traumaHtml = `<div class="roll-damage-section">
      <div class="roll-damage-label">Травма (${tRoll.total}${dof > 1 ? ` +${10 * (dof - 1)}` : ""} = ${total}):</div>
      <div class="roll-threshold">${row?.text ?? "—"}</div></div>`;
  }
  await _postFearMsg(actor, "🧠 Ментальная Травма", "тест W+0", wp, 0, rv, wp, success, dof, traumaHtml, allRolls);
}

/**
 * Общая карточка для Страха/Травмы. rerollCtx (только у Страха, при
 * непройденном тесте с «Демон») добавляет кнопку и кладёт контекст в
 * flags.warhammer-dbc.fearTest — оттуда её читает обработчик в hooks.mjs.
 */
export async function _postFearMsg(actor, header, sub, wp, mod, rv, eff, success, dof, extraHtml, allRolls, properties = {}, rerollCtx = null) {
  const rollMode = game.settings.get("core", "rollMode");
  const dice = (await Promise.all(allRolls.map(r => r.render()))).join("");
  // Свойства источника Страха (напр. Демон) — для будущих эффектов, которые
  // будут цепляться за них (Хатред и т.п.); здесь же дают бесплатный переброс.
  const propLabels = { demon: "Демон" };
  const activeProps = Object.entries(properties).filter(([, v]) => v).map(([k]) => propLabels[k] || k);
  const propsHtml = activeProps.length
    ? `<div class="roll-threshold">Свойства: <b>${activeProps.join(", ")}</b></div>` : "";
  const rerollHtml = rerollCtx ? `
    <div class="roll-defense-section roll-fear-reroll">
      <div class="roll-defense-title">Демон — доступен бесплатный переброс</div>
      <div class="roll-defense-btns">
        <button type="button" class="wh-fear-reroll-btn">🎲 Бесплатный переброс</button>
      </div>
    </div>` : "";

  const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${header} — ${esc(actor.name)}</div>
        <div class="roll-threshold">${sub} | W: <b>${wp}</b>${mod !== 0 ? ` ${mod >= 0 ? "+" : ""}${mod}` : ""} → Порог: <b>${eff}</b></div>
        ${propsHtml}
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${success
          ? `<span class="roll-success">Успех — выстоял</span>`
          : `<span class="roll-failure">Провал — ${dof} ${_degWord(dof)}</span>`}</div>
        ${extraHtml}
        ${rerollHtml}
        <details class="roll-dice-details"><summary>${rollIcon("chart","#8fd0ff")}Показать кубы</summary>${dice}</details>
      </div>`,
    rolls: allRolls, sound: CONFIG.sounds.dice
  }, rollMode);

  if (rerollCtx) {
    messageData.flags = foundry.utils.mergeObject(messageData.flags || {}, {
      "warhammer-dbc": { fearTest: { actorId: actor.id, properties, ...rerollCtx } }
    });
  }
  await ChatMessage.create(messageData);
}
