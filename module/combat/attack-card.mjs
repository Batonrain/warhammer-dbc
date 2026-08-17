// module/combat/attack-card.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  Фаза 7 конвейера (docs/architecture-plan.md, §2.1): карточка чата.
//
//  Сюда приходят уже посчитанные числа, отсюда выходит HTML. Модуль ничего не
//  бросает, не читает документы Foundry и не трогает актора — поэтому его
//  проверяет test/combat/attack-card.test.mjs напрямую, без заглушки.
//
//  Блоки, которые собирают другие модули (свойства оружия, качество, напоминания
//  осколочного, кнопки эффектов на цель, развёрнутые кубы), приходят готовыми
//  строками в `blocks`: их авторы живут в своих файлах, и второй сборки здесь нет.
// ─────────────────────────────────────────────────────────────────────────────

import { _degWord } from "../helpers/utils.mjs";

/** Знак перед числом модификатора: −10 печатается как есть, +10 — со знаком. */
const signed = n => `${n >= 0 ? "+" : ""}${n}`;

/**
 * Карточка заклинившего оружия: бросок дошёл до порога Ненадёжности, атаки нет.
 * `blocks.props` — блок особых свойств (buildPropertyChatBlock).
 */
export function jamCard({ weaponName = "", rv = 0, blocks = {} } = {}) {
  return `
        <div class="wh-roll-result">
          ${blocks.props ?? ""}
          <div class="roll-header">${weaponName}</div>
          <div class="roll-statline">
            <span class="roll-stat"><label>Бросок</label><b>${rv}</b></span>
          </div>
          <div class="roll-outcome">
            <span class="roll-failure">Оружие заклинило! Требуется действие на устранение Клина.</span>
          </div>
        </div>`;
}

/** Строки «Попадание N — урон — место» с Экстремальным уроном под каждой. */
function hitLines(hits) {
  return hits.map((d, i) => {
    const extStr = d.hasExtreme ? `
      <div class="roll-extreme-block">
        <b>Экстремальный урон</b> · d5: ${d.extremeLevel}
        ${d.critEffect ? `<div class="roll-crit-effect">${d.critEffect}</div>` : ""}
      </div>` : "";
    const bonusStr = d.bonusNote
      ? `<span class="roll-bonus-dice">+${d.bonusNote} доп.</span>` : "";
    const deflStr = d.deflagrateNote
      ? `<span class="roll-bonus-dice">+${d.deflagrateNote} выгор.</span>` : "";
    const msStr = d.msPenalty
      ? `<span class="roll-hit-pen">−${d.msPenalty} мульти-удар</span>` : "";
    return `<div class="roll-hit-line">
      <span class="roll-hit-idx">Попадание ${i + 1}</span>
      <span class="roll-hit-dmg">${d.total}</span>
      <span class="roll-hit-loc">${d.loc}</span>
      ${bonusStr || deflStr || msStr ? `<span class="roll-hit-extra">${bonusStr}${deflStr}${msStr}</span>` : ""}
    </div>${extStr}`;
  }).join("");
}

/**
 * Кнопки «Применить урон»: всё, что нужно расчёту поглощения на цели.
 *
 * Данные про Орду (свойства, дающие ей лишние попадания, дальность для
 * Распыления, рукопашность и uuid стрелка для его Талантов) едут теми же
 * кнопками: цель выбирается уже после броска, и на момент сборки карточки
 * неизвестно, попадут ли в толпу.
 */
function applyDamageSection(hits, { wp, pen, damageType, weaponName, actorName, vehicleSide,
                                    isMelee = false, burst = false, weaponRange = 0,
                                    attackerUuid = "", hordeHits = null }) {
  if (!hits.length) return "";
  const buttons = hits.map((d, i) => {
    // «Прячась в Орде»: попадание, уведённое в союзную Орду, применяется к ней,
    // а не к тому, в кого целились.
    const toHorde = Array.isArray(hordeHits) && hordeHits[i];
    return `<button class="wh-apply-dmg-btn${toHorde ? " wh-apply-dmg-horde" : ""}" type="button"
    data-damage="${d.total}"
    data-penetration="${pen}"
    data-damage-type="${damageType}"
    data-hit-location="${d.loc}"
    data-vehicle-side="${vehicleSide}"
    data-weapon-name="${weaponName}"
    data-attacker="${actorName}"
    data-attacker-uuid="${attackerUuid}"
    data-felling="${wp.fellingRating ?? 0}"
    data-primitive="${wp.primitive ? 1 : 0}"
    data-ignore-shield="${wp.ignoreShield ? 1 : 0}"
    data-warp-soak="${wp.warpSoak ? 1 : 0}"
    data-lance="${wp.lance ? 1 : 0}"
    data-sanctified="${wp.sanctified ? 1 : 0}"
    data-blast="${wp.blastRating ?? 0}"
    data-flame="${wp.flame ? 1 : 0}"
    data-power-field="${wp.powerField ? 1 : 0}"
    data-spray="${wp.spray ? 1 : 0}"
    data-devastating="${wp.devastatingRating ?? 0}"
    data-weapon-range="${weaponRange}"
    data-melee="${isMelee ? 1 : 0}"
    data-burst="${burst ? 1 : 0}"
    ${toHorde ? `data-force-horde="${toHorde}"` : ""}>
    Применить урон ${i + 1}: <b>${d.total}</b> → ${toHorde ? "Орду (прикрыла цель)" : d.loc}
  </button>`;
  }).join("");
  return `
  <div class="roll-apply-dmg-section">
    <div class="roll-section-head">Применить к цели <span class="roll-head-hint">— выберите токен</span></div>
    ${buttons}
  </div>`;
}

/** Кнопки защиты цели. Уклонение и Парирование гасятся приёмом или Гибким. */
function defenseSection({ dodgeMod = 0, parryMod = 0, targetIsVehicle = false, note = "" }, { wp, deg }) {
  const cannotDodge = dodgeMod <= -900;
  const cannotParry = wp.flexible || parryMod <= -900;
  return `
    <div class="roll-defense-section">
      <div class="roll-section-head">Защита цели <span class="roll-head-hint">— выберите токен защищающегося</span></div>
      <div class="roll-defense-btns">
        ${cannotDodge
          ? `<button class="wh-dodge-btn wh-dodge-disabled" disabled>
               Уклонение (невозможно)
             </button>`
          : `<button class="wh-dodge-btn" type="button" data-extra-mod="${dodgeMod}" data-attack-deg="${deg}">
               Уклонение${dodgeMod !== 0 ? ` (${signed(dodgeMod)})` : ""}
             </button>`
        }
        ${cannotParry
          ? `<button class="wh-parry-btn wh-dodge-disabled" disabled>
               Парирование (невозможно${wp.flexible ? " — Гибкое" : ""})
             </button>`
          : `<button class="wh-parry-btn" type="button" data-extra-mod="${parryMod}" data-attack-deg="${deg}">
               Парирование${parryMod !== 0 ? ` (${signed(parryMod)})` : ""}
             </button>`
        }
        ${targetIsVehicle
          ? `<button class="wh-swerve-btn" type="button" data-extra-mod="0" data-attack-deg="${deg}"
               title="Техника: Operate − Размер×10">Вираж</button>`
          : ""}
      </div>
      ${note && (dodgeMod !== 0 || parryMod !== 0 || cannotDodge)
        ? `<div class="roll-defense-note">${note}</div>` : ""}
    </div>`;
}

/**
 * Кнопки сдвига места попадания (±A.b, Талант/Черта). Правят СРАЗУ эту карточку
 * (см. hooks.mjs), поэтому текущий сдвиг помечается неактивной кнопкой —
 * передумать можно до применения урона.
 */
function locShiftSection({ max, current = 0 }, actorName) {
  const btn = n => `<button type="button" class="wh-locshift-btn" data-shift="${n > 0 ? `${n}` : `-${-n}`}" ${current === n ? "disabled" : ""}>${n > 0 ? `+${n}` : `−${-n}`}</button>`;
  return `
    <div class="roll-defense-section roll-loc-shift">
      <div class="roll-defense-title">Сдвинуть место попадания (±${max}, A.b) — только ${actorName}</div>
      <div class="roll-defense-btns">
        ${Array.from({ length: max }, (_, i) => btn(-(max - i))).join("")}
        <button type="button" class="wh-locshift-btn" data-shift="0" ${!current ? "disabled" : ""}>Без сдвига</button>
        ${Array.from({ length: max }, (_, i) => btn(i + 1)).join("")}
      </div>
    </div>`;
}

/** Заряженный боеприпас, остаток магазина и расход за этот выстрел. */
function ammoBlock({ name = "", mods = "", magCur = "?", magMax = "?", spent = 0,
                     special = "", condLabels = [], warning = "" }) {
  return `
      <div class="roll-ammo-block${!name ? " roll-ammo-none" : ""}">
        Боеприпасы: <b>${name || "стандартные"}</b>
        ${mods ? `<span class="roll-ammo-mods">(${mods})</span>` : ""}
        | Магазин: <b>${magCur}/${magMax}</b>
        ${spent > 0 ? `<span class="roll-ammo-spent">(израсходовано: ${spent})</span>` : ""}
        ${special ? `<div class="roll-ammo-special">${special}</div>` : ""}
        ${condLabels.length
          ? `<div class="roll-ammo-cond">Учтено: ${condLabels.join("; ")}</div>` : ""}
      </div>
      ${warning}`;
}

/**
 * Полная карточка атаки.
 *
 * @param {object}   d
 * @param {object}   d.wp            свёрнутые свойства оружия (aggregateAuto)
 * @param {object[]} d.hits          попадания с уже посчитанным местом: { total, loc, ... }
 * @param {object}   [d.locShift]    { max, current } — кнопки сдвига места, либо null
 * @param {object}   [d.ammo]        блок боеприпасов (только стрелковое), либо null
 * @param {object}   [d.defense]     { dodgeMod, parryMod, targetIsVehicle, note }
 * @param {object}   [d.suppression] { pen, hits } — Подавление, либо null
 * @param {object}   [d.notes]       текстовые примечания карточки (см. ниже)
 * @param {object}   [d.blocks]      готовые блоки: props, quality, splinter, targetEffects, dice
 */
export function attackCard({
  actorName = "", weaponName = "", wp = {},
  threshold = 0, rv = 0, modeLine = "", hit = false, deg = 0,
  hitsCount = 0, hits = [],
  hitLocLabel = "", locRoll = 0, locShift = null,
  isMelee = false, dtLabel = "", damageType = "", pen = 0,
  sbEff = 0, sbHalf = false, taintedAdd = 0, vehicleSide = "",
  ammo = null, band = null, suppression = null,
  corVal = 0, corEffects = [],
  soulBurnActorId = null,
  // Данные для урона по Орде: Rng нужен Распылению, burst — Таланту «Свинцовый
  // Дождь», uuid — чтобы найти Таланты и Размер стрелка, hordeHits — раскладка
  // попаданий правилом «Прячась в Орде» (combat/horde-tokens.mjs).
  weaponRange = 0, burst = false, attackerUuid = "", hordeHits = null,
  defense = {}, notes = {}, blocks = {}
} = {}) {
  const hitCountNote = hitsCount > 1 ? ` (${hitsCount} попадани${hitsCount < 5 ? "я" : "й"})` : "";
  const outcomeHtml = hit
    ? `<span class="roll-success">Попадание — ${deg} ${_degWord(deg)}${hitCountNote}</span>`
    : `<span class="roll-failure">Промах — ${deg} ${_degWord(deg)}</span>`;

  // Бонус Силы в рукопашной: Могучее ×2, Сдержанное 0, Обратный хват ½.
  const sbNote = isMelee
    ? `, S.b +${sbEff}${wp.mightySB ? " (Могучее ×2)" : wp.containedSB ? " (Сдержанное)" : ""}${sbHalf ? " (½ хват)" : ""}`
    : "";
  const taintedNote = taintedAdd ? `, Порча +${taintedAdd}` : "";
  const damageSection = hits.length ? `
    <div class="roll-damage-section">
      <div class="roll-section-head">Урон</div>
      <div class="roll-damage-meta">${dtLabel} · Пробитие ${pen}${sbNote}${taintedNote}</div>
      ${hitLines(hits)}
    </div>` : "";

  const tech = notes.technique || {};
  const techniqueHtml = tech.label ? `
    <div class="roll-technique-block">
      Приём: <b>${tech.label}</b>
      ${tech.stance ? ` | Стойка: <b>${tech.stance}</b>` : ""}
      ${tech.note ? `<div class="roll-technique-note">${tech.note}</div>` : ""}
    </div>` : "";

  // Эффекты, открывающиеся по Порче владельца (стр. 220, Чёрная Булава):
  // печатаем только те, что уже доступны при текущей Cor, — остальные молчат.
  const corNotes = corEffects
    .filter(e => corVal >= (Number(e.cor) || 0))
    .map(e => `<div class="roll-wprop-note">Порча ${e.cor}+: ${e.text}</div>`)
    .join("");

  // Стр. 35: ГМ распределяет попадания по случайным целям в секторе, поэтому
  // урон не бросается автоматически — карточка подсказывает их число.
  const suppressionHtml = suppression ? `<div class="roll-suppression">
      Подавление: все в секторе 45° проходят тест Подавление (${suppression.pen})<br>
      ГМ распределяет <b>${suppression.hits}</b> попадан${suppression.hits === 1 ? "ие" : suppression.hits < 5 ? "ия" : "ий"} в торс
      по случайным целям в секторе (нечётные Успехи, максимум RoF ${suppression.cap})
    </div>` : "";

  return `
      <div class="wh-roll-result">
        ${techniqueHtml}
        ${notes.aiming ? `<div class="roll-aiming-note">${notes.aiming}</div>` : ""}
        ${ammo ? ammoBlock(ammo) : ""}
        <div class="roll-header">${weaponName}</div>
        ${notes.attack
          ? `<details class="roll-collapsible roll-note-collapsible">
               <summary class="roll-section-head"><span class="roll-sum-title">Хват и приёмы</span></summary>
               <div class="roll-threshold" style="font-size:0.82em;">${notes.attack}</div>
             </details>`
          : ""}
        ${blocks.props ?? ""}
        ${blocks.quality ?? ""}
        ${blocks.splinter ?? ""}
        <div class="roll-statline">
          <span class="roll-stat"><label>Порог</label><b>${threshold}</b></span>
          <span class="roll-stat"><label>Режим</label><b>${modeLine}</b></span>
          <span class="roll-stat"><label>Бросок</label><b>${rv}</b></span>
        </div>
        <div class="roll-outcome">${outcomeHtml}</div>
        ${hit && hitsCount > 0
          ? `<div class="roll-location">Место попадания: <b>${hitLocLabel}</b> (${locRoll})</div>`
          : ""}
        ${notes.shelter ? `<div class="roll-wprop-note horde-shelter-note">🛡️ ${notes.shelter}</div>` : ""}
        ${locShift ? locShiftSection(locShift, actorName) : ""}
        ${notes.aim ? `<div class="roll-aim-note">Прицел: <b>${notes.aim}</b></div>` : ""}
        ${damageSection}
        ${notes.maximal
          ? `<div class="roll-allout-note">Максимальный режим: +1d10 урона, +2 Проб., Взрыв(2), ×2 расход, Перезарядка.</div>` : ""}
        ${notes.off ? `<div class="roll-wprop-note">${notes.off}</div>` : ""}
        ${corNotes}
        ${band ? `<div class="roll-wprop-note">Дистанция: ${band.label}${band.dice ? ` (+${band.dice}d10 урона)` : ""}${band.dmg ? ` (+${band.dmg} урона)` : ""}${band.pen ? ` (+${band.pen} Проб.)` : ""}</div>` : ""}
        ${wp.devastatingRating ? `<div class="roll-wprop-note">Опустошительное (${wp.devastatingRating}): по Орде +${wp.devastatingRating} урона в Магнитуду</div>` : ""}
        ${wp.wreckerRating ? `<div class="roll-wprop-note">Крушитель (${wp.wreckerRating}): +${wp.wreckerRating}d10 по земле/камню/рокриту/стеклу, AP таких укрытий вдвое меньше</div>` : ""}
        ${wp.ordnance ? `<div class="roll-wprop-note">Артиллерия: все прочие атаки стрелка до начала его следующего Хода получают ${wp.otherAttacksMod}</div>` : ""}
        ${suppressionHtml}
        ${notes.allOut
          ? `<div class="roll-allout-note">Атака всем телом — Уклонение недоступно до следующего хода</div>` : ""}
        ${notes.recharge
          ? `<div class="roll-allout-note">Перезарядка: следующий ход — подзарядка (стрелять можно раз в 2 хода).</div>` : ""}
        ${blocks.dice ? `
    <details class="roll-dice-details">
      <summary>Показать кубы</summary>
      ${blocks.dice}
    </details>` : ""}
        ${hit ? defenseSection(defense, { wp, deg }) : ""}
        ${applyDamageSection(hit ? hits : [], { wp, pen, damageType, weaponName, actorName,
                                                vehicleSide, isMelee, burst, weaponRange,
                                                attackerUuid, hordeHits })}
        ${soulBurnActorId ? `
    <div class="roll-wprop-effects">
      <button class="wh-soulburn-btn" type="button" data-attacker-id="${soulBurnActorId}">
        Выжигание Души (выберите токен цели)
      </button>
    </div>` : ""}
        ${blocks.targetEffects ?? ""}
      </div>`;
}
