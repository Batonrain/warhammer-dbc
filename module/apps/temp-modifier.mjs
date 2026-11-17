// module/apps/temp-modifier.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ВРЕМЕННЫЙ МОДИФИКАТОР ХАРАКТЕРИСТИКИ прямо с листа (wdbc-5qvo).
//
//  «На три Хода −10 к Ловкости» до этого выражалось только двумя способами, и
//  оба плохи для разового штрафа:
//   • поле «Мод.» на вкладке ПОКАЗАТЕЛИ (system.charDamage.<хар>) — работает,
//     но ГМ обязан помнить, что штраф надо снять, и НИГДЕ не написано, откуда
//     он взялся и до каких пор держится;
//   • запись Конструктора kind:"characteristic" на предмете — настоящий
//     ActiveEffect с источником, но ради разового штрафа приходится заводить
//     Черту/Способность.
//
//  Здесь третий путь и он же недостающий: эффект заводится на САМОМ АКТОРЕ,
//  с именем источника, сроком и снятием одним крестиком — тем же, чем снимают
//  Состояния. Ничего нового Foundry для этого не нужно: embedded ActiveEffect
//  с duration {value, units} ядро тикает само (см. rules/condition-duration.mjs
//  — там уже разобрано, что срок считает Foundry, а не мы).
//
//  Цель эффекта — `system.characteristics.<хар>.totalFx`, фаза "initial": это
//  ХРАНИМОЕ поле, из которого расчёт листа выводит Значение и Бонус (см.
//  constants/effect-keys.mjs::expectedPhase). Фаза "final" легла бы поверх уже
//  посчитанного и не дошла бы ни до навыков, ни до брони.
// ════════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { DURATION_UNITS, durationDataFor } from "../rules/condition-duration.mjs";
import { esc } from "../helpers/utils.mjs";
import { expectedPhase, effectKeyLabel } from "../constants/effect-keys.mjs";

const SYSTEM = "warhammer-dbc";

/** Флаг «этот эффект завели кнопкой на листе» — по нему рисуется крестик. */
export const TEMP_MODIFIER_FLAG = "tempModifier";

/** Иконка временного модификатора — та же, что у прочих безымянных эффектов. */
const TEMP_ICON = "icons/svg/downgrade.svg";

/** Что ещё, кроме значения характеристики, можно менять временно: путь → подпись. */
export const TEMP_OTHER_TARGETS = {
  "system.extraHands":            "Руки",
  "system.actionPoints.max":      "ОД макс.",
  "system.reactions.max":         "Реакции макс.",
  "system.reactions.defenseMax":  "Реакции Избегания макс.",
  "system.initiative":            "Инициатива",
  "system.speed":                 "Скорость",
  "system.incomingDamageReduction": "Снижение урона",
  "system.corruptionBonus":       "Cor.b"
};

/** Короткая подпись цели: «Ag», «Ag (Unnatural)», «Руки». */
export function tempTargetLabel(key) {
  const m = /^system\.characteristics\.(\w+)\.(totalFx|bonusFx)$/.exec(key);
  if (m) {
    const abbr = CHARACTERISTICS[m[1]]?.abbr ?? m[1].toUpperCase();
    return m[2] === "bonusFx" ? `${abbr} (Unnatural)` : abbr;
  }
  return TEMP_OTHER_TARGETS[key] ?? effectKeyLabel(key);
}

/** Заведён ли этот эффект кнопкой «Временный модификатор». */
export function isTempModifier(effect) {
  return !!(effect?.getFlag?.(SYSTEM, TEMP_MODIFIER_FLAG)
         ?? effect?.flags?.[SYSTEM]?.[TEMP_MODIFIER_FLAG]);
}

/**
 * Данные эффекта по ответам диалога. Чистая функция — её и проверяют тесты,
 * документов Foundry она не касается.
 *
 * @param {object} o
 * @param {string} o.charKey  ключ характеристики
 * @param {number} o.value    знаковый модификатор (−10 — штраф)
 * @param {string} o.source   откуда он взялся, свободный текст
 * @param {number} o.duration число единиц срока (0/пусто — без срока)
 * @param {string} o.unit     единица срока (DURATION_UNITS)
 */
export function tempModifierData({ charKey, key = "", value, source = "", duration = 0, unit = "" }) {
  const path = key || `system.characteristics.${charKey}.totalFx`;
  const abbr = key ? tempTargetLabel(key)
    : (CHARACTERISTICS[charKey]?.abbr ?? String(charKey ?? "").toUpperCase());
  const amount = Number(value) || 0;
  const signed = amount < 0 ? `−${Math.abs(amount)}` : `+${amount}`;
  // Имя эффекта ВСЕГДА несёт число, даже когда источник назван: в сводке
  // ДЕБАФОВ источником показывается сам актор, и без числа две гранаты,
  // наложившие «Ослепление» на −10 и на −20, дали бы две одинаковые строки —
  // снимать пришлось бы наугад.
  const title = source.trim();
  const name = title ? `${title} (${abbr} ${signed})` : `${abbr} ${signed}`;
  return {
    name,
    img: TEMP_ICON,
    system: { changes: [{
      key: path,
      type: "add", value: amount, phase: expectedPhase(path), priority: 0
    }] },
    duration: durationDataFor(duration, unit),
    disabled: false,
    flags: { [SYSTEM]: { [TEMP_MODIFIER_FLAG]: true } }
  };
}

/**
 * Диалог «Временный модификатор» и создание эффекта. Возвращает созданный
 * эффект либо null, если диалог закрыли.
 */
export async function showTempModifierDialog(actor) {
  if (!actor) return null;
  const chars = Object.entries(CHARACTERISTICS).filter(([key]) => key !== "inf"); // у Инф нет бонуса/значения на листе
  const charOpts = `
    <optgroup label="Значение характеристики">${chars
      .map(([key, def]) => `<option value="system.characteristics.${key}.totalFx">${esc(def.abbr)} — ${esc(def.label)}</option>`).join("")}</optgroup>
    <optgroup label="Unnatural (бонус характеристики)">${chars
      .map(([key, def]) => `<option value="system.characteristics.${key}.bonusFx">${esc(def.abbr)} — бонус (Unnatural)</option>`).join("")}</optgroup>
    <optgroup label="Прочее">${Object.entries(TEMP_OTHER_TARGETS)
      .map(([path, label]) => `<option value="${path}">${esc(label)}</option>`).join("")}</optgroup>`;
  const unitOpts = DURATION_UNITS
    .map(u => `<option value="${u.key}">${esc(u.label)}</option>`).join("");

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: "Временный модификатор" },
    classes: ["wh-temp-modifier-dialog", "warhammer-dbc", "wh-holo"],
    position: { width: 380 },
    content: `
      <div class="wh-temp-modifier-form">
        <label class="tm-row">Что менять
          <select class="tm-char">${charOpts}</select>
        </label>
        <label class="tm-row">Модификатор
          <input type="number" class="tm-value" value="-10" step="1"/>
        </label>
        <label class="tm-row">Источник
          <input type="text" class="tm-source" placeholder="напр. Ослепляющая граната"/>
        </label>
        <label class="tm-row">Срок
          <input type="number" class="tm-duration" value="0" min="0"/>
          <select class="tm-unit">${unitOpts}</select>
        </label>
        <div class="tm-hint">Снимается крестиком на вкладке ЭФФЕКТЫ. Срок в раундах отсчитывает боевой трекер, остальные — игровое время.</div>
      </div>`,
    rejectClose: false,
    buttons: [
      {
        action: "add", label: "Наложить", icon: "fas fa-plus", default: true,
        callback: (event, button) => ({
          key:      button.form.querySelector(".tm-char")?.value || "system.characteristics.ws.totalFx",
          value:    Number(button.form.querySelector(".tm-value")?.value) || 0,
          source:   button.form.querySelector(".tm-source")?.value || "",
          duration: Number(button.form.querySelector(".tm-duration")?.value) || 0,
          unit:     button.form.querySelector(".tm-unit")?.value || ""
        })
      },
      { action: "cancel", label: "Отмена" }
    ]
  });

  if (!result || result === "cancel" || !result.value) return null;
  const [created] = await actor.createEmbeddedDocuments("ActiveEffect", [tempModifierData(result)]);
  return created ?? null;
}

/**
 * Снять временный модификатор по id его эффекта.
 *
 * Проверка isTempModifier — не формальность: крестик рисуется только у своих
 * строк, но эта функция принимает id снаружи, и удалить ею Черту или Мутацию
 * не должно быть возможно ни при какой ошибке разметки.
 */
export async function removeTempModifier(actor, effectId) {
  const effect = actor?.effects?.get?.(effectId);
  if (!effect || !isTempModifier(effect)) return false;
  await actor.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
  return true;
}
