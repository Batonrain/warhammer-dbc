// module/sheets/attack/markup.mjs
// ══════════════════════════════════════════════════════════════════════════
//  СБОРКА РАЗМЕТКИ ОКНА АТАКИ из готовых кусков (wdbc-uh56).
//
//  Второй односторонний шов функции showAttackDialog: сюда значения только
//  входят, наружу идёт одна строка разметки. Ничего не считает — все куски
//  собраны выше; здесь только порядок и обрамление.
//
//  Разрезать функцию поперёк нельзя (замер: 90–106 значений через границу в
//  середине), поэтому режется вдоль: расчёт остаётся в attack-dialog.mjs,
//  вёрстка уходит сюда, подключение окна — в attack/dialog.mjs.
// ══════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../../constants/characteristics.mjs";
import { WEAPON_CLASSES } from "../../constants/items.mjs";
import { esc } from "../../helpers/utils.mjs";
import { diceModeHtml } from "../../rules/test-kind-widget.mjs";
import { hasDeathDance } from "../../combat/death-dance.mjs";

/** @param {object} v готовые куски разметки и значения для подстановки */
export function buildAttackContent(v) {
  const {
    actor,
    aimHtml,
    aimingPills,
    ammoCondHtml,
    ammoDialogHtml,
    attackerMount,
    autoCoverMod,
    autoHitAvailable,
    autoMountRangedMod,
    badgesHtml,
    bandHtml,
    charKey,
    charSwapWhy,
    charVal,
    commonMods,
    distanceHintHtml,
    dyn0,
    fanningActive,
    fanningRofMax,
    forceMelee,
    isMelee,
    item,
    makeMods,
    maximalHtml,
    mountHtml,
    offHtml,
    oneVsHundredHtml,
    presetModifier,
    rangeInfoHtml,
    rechargeWarnHtml,
    rofPills,
    ruleMods,
    ruleRerolls,
    shortRangeHtml,
    specificMods,
    sys,
    techSectionsHtml,
    wp,
    wpDialogHtml,
  } = v;

return `
  <div class="wh-attack-form wh-atk-v2">
    <div class="av-header">
      <span class="av-name">${esc(item.name)}</span>
      <span class="av-class">${forceMelee ? "в упор / приклад" : (WEAPON_CLASSES[sys.weaponClass] || "")}</span>
      <span class="av-badges" id="atk-badges">${badgesHtml(dyn0)}</span>
    </div>

    <div class="av-preview">
      <div class="av-prev-lbl">Итоговый порог теста</div>
      <div class="av-prev-total" id="atk-total-display">${charVal}</div>
      <div class="av-prev-breakdown" id="atk-threshold-breakdown"></div>
    </div>

    ${ammoDialogHtml}${rechargeWarnHtml}${wpDialogHtml}

    <div class="av-row">
      <label>Характеристика</label>
      <select id="atk-char" class="av-input">
        ${Object.entries(CHARACTERISTICS).map(([k, m]) => {
          const v = actor.system.characteristics[k]?.total ?? 0;
          // Список характеристик и так полный — ГМ волен бросить чем угодно.
          // Локус Мутации (стр. 28, 32) делает бросок по Воле вместо WS/S
          // законным, и это подписывается прямо в пункте: иначе игрок не
          // отличит разрешённую книгой подмену от самоуправства.
          const swap = (k === "wp" && charSwapWhy.length)
            ? ` — вместо ${isMelee ? "WS" : "BS"}: ${charSwapWhy.join(", ")}` : "";
          return `<option value="${k}" ${k === charKey ? "selected" : ""}>${m.abbr} (${v})${swap}</option>`;
        }).join("")}
      </select>
      <label>Доп. мод</label>
      <input id="atk-modifier" class="av-input av-num" type="number" value="${presetModifier}"/>
    </div>
    <div class="av-row">
      <label>Бонус урона</label>
      <input id="atk-dmg-bonus" class="av-input av-num" type="number" value="0"
             title="Ручной бонус к урону этой атаки — прибавляется к итоговому урону после броска, отдельно от порога теста"/>
    </div>
    ${(isMelee && hasDeathDance(actor)) ? `
    <div class="av-row" id="atk-death-dance-row">
      <label>Смертельный Танец</label>
      <button type="button" id="atk-death-dance-btn" class="av-pill av-pill-disabled" disabled><span>+ Brutal Charge</span></button>
      <span class="av-opt-note" id="atk-death-dance-status"></span>
    </div>` : ""}
    ${wp.changeRating ? `
    <div class="av-row">
      <label class="attack-mod-check">
        <input type="checkbox" id="atk-change-soulless"/>
        Цель бездушна/техника (Перемены: +${wp.changeRating} Pen, не к попаданию)
      </label>
    </div>` : ""}
    <div class="av-row">
      <label>Укрытие</label>
      <input id="atk-cover" class="av-input av-num" type="number" value="${autoCoverMod}"
             title="Авто по зоне Укрытия на линии огня (regions/cover.mjs) — всегда можно поправить руками"/>
    </div>
    ${attackerMount ? `
    <div class="av-row">
      <label>Штраф стрельбы с седла</label>
      <input id="atk-mount-ranged" class="av-input av-num" type="number" value="${autoMountRangedMod}"
             title="Авто по скорости скакуна/байка на панели «ВЕРХОМ» (0 при Гиро-Стабилизированном) — для Интегрированного Оружия (0) или турели Коляски (сниженный штраф) поправьте вручную"/>
    </div>` : ""}

    ${techSectionsHtml}
    <div class="av-opt-note" id="atk-gripnote">${dyn0.note}</div>

    <div class="av-section">
      <div class="av-sec-lbl">Режим атаки</div>
      <div class="av-pills">${rofPills}</div>
    </div>
    ${fanningActive ? `
    <div class="av-row">
      <label>Быстрый Курок: RoF Длинной очереди</label>
      <input id="atk-fanning-rof" class="av-input av-num" type="number"
             min="2" max="${fanningRofMax}" value="${fanningRofMax}"
             title="2..BS.b (${fanningRofMax}) по выбору — заменяет фиксированный RoF револьвера в режиме Длинной очереди. Без бонуса Прицеливания."/>
    </div>` : ""}
    <div class="av-section">
      <div class="av-sec-lbl">Прицеливание</div>
      <div class="av-pills">${aimingPills}</div>
    </div>

    <div class="av-row">
      <label>Избирательная атака</label>
      <select id="atk-aim" class="av-input av-wide">${aimHtml}</select>
    </div>
    ${mountHtml}

    ${rangeInfoHtml}
    ${distanceHintHtml}
    ${shortRangeHtml}${bandHtml}${offHtml}${maximalHtml}
    ${ammoCondHtml}
    ${ruleMods.html}
    ${ruleRerolls.html}
    ${oneVsHundredHtml}
    ${diceModeHtml()}

    <details class="av-adv">
      <summary>Ситуативные модификаторы<span class="av-adv-hint">— разверни, если нужны</span></summary>
      <div class="av-mod-block">
        <div class="av-mod-head">Общие</div>
        <div class="av-mod-grid">${makeMods(commonMods)}</div>
      </div>
      <div class="av-mod-block">
        <div class="av-mod-head">${isMelee ? "Рукопашные" : "Стрелковые"}</div>
        <div class="av-mod-grid">${makeMods(specificMods)}</div>
      </div>
      <div class="av-mod-block">
        <div class="av-mod-head">Особые атаки</div>
        <div class="av-mod-col">
          <!-- Быстрая/Молниеносная Атака переехали в Приём (стр. 14, требуют
               соответствующий Талант) — см. MELEE_MANEUVERS.swift/lightning. -->
          <label class="attack-mod-check"><input type="checkbox" id="atk-allout"/><span>Атака всем телом (+20, теряет Уклонение)</span></label>
          ${autoHitAvailable ? `<label class="attack-mod-check"><input type="checkbox" id="atk-autohit"/><span>Локус Неизбежности: авто-попадание (1 Успех, −10 до след. Хода)</span></label>` : ""}
        </div>
      </div>
    </details>
  </div>`;
}
