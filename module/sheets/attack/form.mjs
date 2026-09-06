// module/sheets/attack/form.mjs
// ══════════════════════════════════════════════════════════════════════════
//  ЧТЕНИЕ ФОРМЫ ОКНА АТАКИ и два имени возможностей, которые нужны и расчёту,
//  и подключению окна (wdbc-uh56).
//
//  Отдельным файлом ради развязки: sheets/attack-dialog.mjs собирает диалог, а
//  sheets/attack/dialog.mjs его подключает, и обоим нужно одно и то же. Пока
//  это лежало в attack-dialog.mjs, получался круг импортов — ровно тот, что
//  сегодня уже подвешивал загрузку модулей насмерть (wdbc-795h, см. AGENTS.md).
//  Здесь файл-лист: он не импортирует ни один из этих двух.
// ══════════════════════════════════════════════════════════════════════════

import { mergeReroll } from "../../rules/test-kind-widget.mjs";


/** Возможность «раз в Раунд авто-попадание рукопашной» (Локус Неизбежности). */
export const AUTO_HIT_CAPABILITY = "autoHit.melee.oncePerRound";
/** Возможность «Полная атака как база приёма». */
export const FULL_ATTACK_CAPABILITY = "technique.baseFullAttack";
/**
 * Всё, что игрок отметил в окне, — одним чтением формы.
 *
 * Читатель намеренно ровно один. Раньше пересчёт в открытом окне и сам бросок
 * складывали модификаторы порознь, и расхождение между ними означало бы, что
 * игрок видит одно число, а кидается другое. Теперь это верно по построению.
 *
 * @param {HTMLFormElement} form       форма окна (DialogV2 отдаёт её в button.form)
 * @param {object[]}        ammoConds  условные эффекты боеприпаса, стр. 203
 */
export function readAttackForm(form, ammoConds) {
  const el   = sel => form.querySelector(sel);
  const all  = sel => [...form.querySelectorAll(sel)];
  const on   = sel => !!el(sel)?.checked;
  const attr = (sel, key) => parseInt(el(sel)?.dataset?.[key]) || 0;

  const ROF = "input[name='atk-rof']:checked";
  const AIM = "input[name='atk-aiming']:checked";

  // Стойка/База/Приём/Хват/Профиль — undefined, если в форме нет такой
  // группы (стрелковое: только Профиль) или ничего не выбрано (не должно
  // случиться — по одному option всегда checked), resolveSelection тогда
  // берёт стартовое значение диалога.
  const stanceKey    = el("input[name='atk-stance']:checked")?.value;
  const baseKey      = el("input[name='atk-base']:checked")?.value;
  const maneuverKey  = el("input[name='atk-maneuver']:checked")?.value;
  const gripKeySel   = el("input[name='atk-grip']:checked")?.value;
  const profIdxRaw   = el("input[name='atk-profile']:checked")?.value;
  const profIdxSel   = profIdxRaw === undefined ? undefined : Number(profIdxRaw);

  const ammoSel = all(".atk-ammo-cond:checked")
    .map(cb => ammoConds[parseInt(cb.dataset.idx)]).filter(Boolean);

  // Галочки от реестра правил — тот же формат, что у Особенностей Происхождения
  // и предметных rollMods в диалоге броска навыка.
  let ruleMods = 0, halvePenalty = false;
  for (const cb of all(".rule-mod:checked")) {
    ruleMods += parseInt(cb.dataset.value) || 0;
    if (cb.dataset.halve === "1") halvePenalty = true;
  }

  const allOut = on("#atk-allout");

  // Выбранный переброс: −1 значит «без переброса». Именной (от правила)
  // важнее общего Кубика (Преимущество/Помеха) — тот же приём, что у диалога
  // Навыка/Характеристики (rules/test-kind-widget.mjs).
  const rerollEl = el(".rule-reroll-opt:checked");
  const rerollIdx = parseInt(rerollEl?.dataset?.idx ?? "-1");
  const namedReroll = rerollIdx >= 0
    ? { mode: rerollEl.dataset.mode, rolls: parseInt(rerollEl.dataset.rolls) || 2 }
    : null;
  const diceChoice = el(".dice-mode-opt:checked")?.value ?? "normal";

  return {
    reroll: mergeReroll(namedReroll, diceChoice),
    autoFail:   all(".atk-mod-cb[data-autofail]:checked").length > 0,
    // Беспомощная цель в упор/в рукопашной (см. specificMods выше) — авто-
    // успех и удвоенный урон вместо обычного порога, отдельно от autoFail.
    autoSuccess: all(".atk-mod-cb[data-autosuccess]:checked").length > 0,
    char:       el("#atk-char")?.value,
    modifier:   parseInt(el("#atk-modifier")?.value) || 0,
    dmgBonus:   parseInt(el("#atk-dmg-bonus")?.value) || 0,
    coverMod:   parseInt(el("#atk-cover")?.value) || 0,
    // Штраф стрельбы с седла (wdbc-8nz6) — раньше нигде не применялся к
    // настоящему броску, только показывался в панели «ВЕРХОМ». Авто-число
    // предполагает обычное личное оружие; для Интегрированного/турели
    // Коляски (штраф ниже/отсутствует) поле правится руками.
    mountRangedMod: parseInt(el("#atk-mount-ranged")?.value) || 0,
    rofMode:    el(ROF)?.value,
    rofBonus:   attr(ROF, "bonus"),
    // Fanning / Быстрый Курок (wdbc-fy33): RoF Длинной очереди 2..BS.b по
    // выбору — 0 значит «поля в форме нет» (Талант неактивен для этого броска).
    fanningRof: parseInt(el("#atk-fanning-rof")?.value) || 0,
    aimVal:     el("#atk-aim")?.value,
    aimPenalty: attr("#atk-aim option:checked", "penalty"),
    // Кого выцеливают в паре «всадник + скакун» и во что это обходится. Штраф
    // берётся только вместе с зоной прицела: не-Избирательная атака никого не
    // выцеливает вовсе — там попадание делится по дублю (стр. 478).
    mountPick:    el("#atk-mount")?.value || "",
    mountPenalty: el("#atk-aim")?.value
      ? (parseInt(el("#atk-mount option:checked")?.dataset?.penalty) || 0) : 0,
    aiming:     el(AIM)?.value || "none",
    aimBonus:   attr(AIM, "bonus"),
    // Отмеченные ситуативные: сумма — в порог, список — в сводку заголовка.
    sitPicked:  all(".atk-mod-cb:checked"),
    // data-value уже 0 у автоуспеха (см. makeMods выше), поэтому отдельно
    // исключать его из суммы не нужно — селектор тот же, что и раньше.
    sitMods:    all(".atk-mod-cb:not([data-autofail]):checked")
      .reduce((n, cb) => n + (parseInt(cb.dataset.value) || 0), 0),
    ammoSel,
    ammoMods:   ammoSel.reduce((n, c) => n + (c.atk || 0), 0),
    ruleMods, halvePenalty,
    allOut,
    extraBonus: allOut ? 20 : 0,
    autoHit: on("#atk-autohit"),
    shortRange: on("#atk-shortrange"),
    // Карабин (wdbc-z56a): нужен на исполнении броска, чтобы дать цели +10
    // вместо +30 на Уклонение — см. #atk-melee-shot в specificMods выше.
    meleeShot:  on("#atk-melee-shot"),
    // Перемены (Change, стр. 74 Книги Аэльдари): цель бездушна/техника → +X Pen.
    changeSoulless: on("#atk-change-soulless"),
    weaponOff:  on("#atk-weaponoff"),
    maximal:    on("#atk-maximal"),
    bandIdx:    Number(el("#atk-band")?.value ?? -1),
    stanceKey, baseKey, maneuverKey, gripKey: gripKeySel, profIdx: profIdxSel
  };
}
