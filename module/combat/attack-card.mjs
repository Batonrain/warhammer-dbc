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
import { rollIcon } from "../constants/roll-icons.mjs";

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

/**
 * Строки «Попадание N — урон — место» с Экстремальным уроном под каждой.
 * Взрывное: каждое попадание очереди — отдельный шаблон (см. правило ниже),
 * поэтому подписывается «Взрыв N», а не «Попадание N».
 */
function hitLines(hits, { blastRating = 0 } = {}) {
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
    const idxLabel = blastRating > 0 ? `Взрыв ${i + 1}` : `Попадание ${i + 1}`;
    return `<div class="roll-hit-line">
      <span class="roll-hit-idx">${idxLabel}</span>
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
                                    attackerUuid = "", itemUuid = "", hordeHits = null }) {
  if (!hits.length) return "";
  // Взрывное/Распыление — разовый Шаблон (Region-плейсмент, module/combat/
  // templates.mjs): круг радиусом blastRating или конус 30° длиной Rng.
  // Найденные внутри токены становятся целями — дальше кнопки ниже
  // («Применить урон» → «Всем») работают как обычно, без изменений.
  //
  // Остаётся (Linger) — та же кнопка размещает не разовый, а персистентный
  // Region (module/regions/linger-zone.mjs): попадание берётся из первого
  // урона очереди (d[0], «один бросок урона на всех», как и у самого
  // Взрывного/Спрея) и переносится на каждого, кто впервые за ход окажется
  // в зоне следующие data-linger ходов стрелка. lingerDrift (Y, второй
  // рейтинг свойства) — на сколько метров зона дрейфует каждый такой ход
  // по розе смещения (0 — не дрейфует).
  const lingerAttrs = (wp.lingerRating > 0 && hits.length) ? `
      data-linger="${wp.lingerRating}"
      data-linger-drift="${wp.lingerDrift ?? 0}"
      data-damage="${hits[0].total}"
      data-penetration="${pen}"
      data-damage-type="${damageType}"
      data-hit-location="${hits[0].loc}"
      data-attacker="${actorName}"
      data-attacker-uuid="${attackerUuid}"
      data-felling="${wp.fellingRating ?? 0}"
      data-primitive="${wp.primitive ? 1 : 0}"
      data-ignore-shield="${wp.ignoreShield ? 1 : 0}"
      data-warp-soak="${wp.warpSoak ? 1 : 0}"
      data-lance="${wp.lance ? 1 : 0}"
      data-sanctified="${wp.sanctified ? 1 : 0}"
      data-power-field="${wp.powerField ? 1 : 0}"
      data-corrosive="${wp.corrosiveRating ?? 0}"
      data-crippling="${wp.cripplingRating ?? 0}"
      data-piercing="${wp.piercing ? 1 : 0}"
      data-haywire="${wp.haywire ? (wp.haywireRating ?? 0) : ""}"
      data-through-shot="${wp.throughShot ? 1 : 0}"` : "";
  // Гравитонное (wdbc-wlwf): только на Blast/Spray-шаблоне, взаимоисключимо с
  // Остаётся (Linger) — если у оружия почему-то есть оба, приоритет у Linger
  // (она размещается веткой выше по data-linger, здесь graviton просто не
  // читается на стороне hooks.mjs, когда linger > 0).
  const gravitonAttrs = (wp.shrinkTemplate > 0) ? ` data-graviton="1"` : "";
  const templateBtn = (wp.blastRating > 0 || wp.spray) ? `
    <button class="wh-place-template-btn" type="button"
      data-shape="${wp.spray ? "cone" : "circle"}"
      data-meters="${wp.spray ? weaponRange : wp.blastRating}"
      data-weapon-name="${weaponName}"
      data-attacker-uuid="${attackerUuid}"
      data-item-uuid="${itemUuid}"${lingerAttrs}${gravitonAttrs}>
      🎯 ${wp.lingerRating > 0
        ? `Разместить зону «Остаётся» (${wp.lingerRating} раунд.) и отметить цели`
        : wp.shrinkTemplate > 0
          ? "Разместить Гравитонную зону (тает 1м/ход, Ландшафт−30) и отметить цели"
          : "Разместить шаблон и отметить цели"}
    </button>` : "";
  // Тест на отмену попадания Распыления (wdbc-p06s, стр. 166-170): в отличие
  // от обычной атаки, Spray попадает автоматически по всем на пути шаблона —
  // Уклонение/Парирование выше (defenseSection) относится к ПЕРВОНАЧАЛЬНОЙ
  // цели атакующего броска, а не к каждому токену, отмеченному этим шаблоном
  // (templateBtn выше). Кнопка — на каждого отмеченного отдельно: выбрать его
  // токен на сцене и кликнуть, до того как жать «Применить урон» этому токену.
  const sprayCancelBtn = (!isMelee && wp.spray) ? `
    <div class="roll-defense-section">
      <button class="wh-spray-cancel-btn" type="button">
        ${rollIcon("run")} Тест на отмену (Распыление, Acrobatics A+0) — выберите токен цели
      </button>
      <div class="roll-defense-note">Свободное действие, Реакция не тратится. Если шаблон полностью накрывает Базу цели — годится только Отскок в исходе теста, не сама отмена (стр. 12).</div>
    </div>` : "";
  // Дым (wdbc-wlwf) — отдельная кнопка: не накрывает целей, не зависит от
  // Взрывного/Распыления (может быть у оружия без них).
  const smokeBtn = (wp.smokeRating > 0) ? `
    <button class="wh-place-smoke-btn" type="button"
      data-meters="${wp.smokeRating}" data-weapon-name="${weaponName}">
      🌫️ Разместить дымовую завесу (${wp.smokeRating}м)
    </button>` : "";
  // Дуга (wdbc-wlwf): показывается только если первое попадание очереди
  // достигло порога X (arcRating) — тот же «первый удар очереди» ориентир,
  // что и у lingerAttrs (hits[0]).
  const arcBtn = (wp.arcRating > 0 && hits.length && hits[0].total >= wp.arcRating) ? `
    <button class="wh-arc-btn" type="button"
      data-arc-damage="${wp.arcDamage}" data-weapon-name="${weaponName}"
      data-attacker="${actorName}" data-attacker-uuid="${attackerUuid}">
      ⚡ Дуга: выберите поражённую цель → ближайшая вторая в 5м (${wp.arcDamage}(El) Pen ${wp.arcDamage})
    </button>` : "";
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
    data-corrosive="${wp.corrosiveRating ?? 0}"
    data-crippling="${wp.cripplingRating ?? 0}"
    data-piercing="${wp.piercing ? 1 : 0}"
    data-haywire="${wp.haywire ? (wp.haywireRating ?? 0) : ""}"
    data-through-shot="${wp.throughShot ? 1 : 0}"
    ${toHorde ? `data-force-horde="${toHorde}"` : ""}>
    Применить урон ${i + 1}: <b>${d.total}</b> → ${toHorde ? "Орду (прикрыла цель)" : d.loc}${
      wp.blastRating > 0 ? ` <span class="roll-hit-extra">(отметьте всех в радиусе ${wp.blastRating}м — «Всем»)</span>` : ""}
  </button>${wp.warpSoak ? `
  <button class="wh-pain-absorb-btn" type="button" data-damage="${d.total}" title="Друкхари с Очками Боли: выбранный токен цели поглощает урон Болью вместо Ран (3 урона за 1 Боль)">
    🔥 Поглотить Болью ${i + 1}: <b>${d.total}</b>
  </button>` : ""}`;
  }).join("");
  return `
  <div class="roll-apply-dmg-section">
    ${templateBtn}
    ${sprayCancelBtn}
    ${smokeBtn}
    <div class="roll-section-head">Применить к цели <span class="roll-head-hint">— выберите токен</span></div>
    ${buttons}
    ${arcBtn}
  </div>`;
}

/**
 * Кнопки защиты цели. Уклонение и Парирование гасятся приёмом или Гибким.
 *
 * Экспортирована: её же реюзает module/combat/evasion-pool.mjs, чтобы
 * дорисовать свежие кнопки на ОСТАТОК попаданий после частичной траты пула
 * (та же разметка, без второй копии).
 *
 * @param {object} [pool]  { successes, hits, cost, perHit } — остаток пула
 *   неизрасходованных Успехов с ДРУГИХ атак этого же противника в этом Ходу
 *   (стр. 12), уже посчитанный вызывающей стороной (module/combat/attack.mjs
 *   — она одна касается документов Foundry, этот модуль их не читает).
 */
export function defenseSection({ dodgeMod = 0, parryMod = 0, targetIsVehicle = false, note = "",
                          forcedDefenceReroll = "" }, { wp, attackerUuid = "", hitsCount = 1, pool = null, isMelee = false, burst = false, attackerIsHorde = false }) {
  const cannotDodge = dodgeMod <= -900;
  const cannotParry = wp.flexible || parryMod <= -900;
  // Очередь/Быстрая/Молниеносная Атака дают больше одного попадания за
  // атаку — кнопки несут их число, чтобы Уклонение/Парирование/Вираж снимали
  // по одному попаданию за степень успеха, а не всю атаку разом (стр. 12).
  const hitsNote = hitsCount > 1
    ? `<div class="roll-defense-note">Эта атака даёт ${hitsCount} попаданий — Успех защиты снимает их по одному за степень.</div>`
    : "";
  // Стр. 12 (wdbc-9wvm): от атак, ПОЛНОСТЬЮ накрывающих Базу цели (Взрывное/
  // Распыление), Уклонение допустимо только Отскоком, не обычной нивеляцией —
  // проект не отслеживает геометрию Базы/шаблона (см. aoe-target.mjs), решает
  // стол: только текстовое напоминание, кнопка Уклонения не гейтится кодом.
  const blastRecoilNote = (!isMelee && !cannotDodge && (wp.blastRating > 0 || wp.spray))
    ? `<div class="roll-defense-note">💥 Если шаблон полностью накрывает Базу цели — Уклонение допустимо только Отскоком (стр. 12), не нивеляцией.</div>`
    : "";
  const poolBtn = pool && pool.hits > 0
    ? `<button class="wh-pool-spend-btn" type="button"
         data-attacker-uuid="${attackerUuid}" data-hits-count="${hitsCount}"
         data-dodge-mod="${dodgeMod}" data-parry-mod="${parryMod}"
         data-target-vehicle="${targetIsVehicle ? 1 : 0}" data-flexible="${wp.flexible ? 1 : 0}"
         data-force-reroll="${forcedDefenceReroll}" data-melee="${isMelee ? 1 : 0}">
         💰 Пул (${pool.successes} Усп.): снять ${pool.hits} из ${hitsCount} за ${pool.cost}
       </button>`
    : "";
  // Пул → Отскок (wdbc-16ss, Voltagheist Blast): та же банковая валюта, но
  // покупает открытие диалога Отскока (module/combat/recoil.mjs), а не
  // негацию попаданий ЭТОЙ атаки — независимая кнопка рядом с poolBtn.
  const poolRecoilBtn = pool && pool.canRecoil
    ? `<button class="wh-pool-recoil-btn" type="button" data-attacker-uuid="${attackerUuid}">
         🏃 Пул (${pool.successes} Усп.): Отскочить за 2 Усп.
       </button>`
    : "";
  return `
    <div class="roll-defense-section">
      <div class="roll-section-head">Защита цели <span class="roll-head-hint">— выберите токен защищающегося</span></div>
      <div class="roll-defense-btns">
        ${cannotDodge
          ? `<button class="wh-dodge-btn wh-dodge-disabled" disabled>
               Уклонение (невозможно)
             </button>`
          : `<button class="wh-dodge-btn" type="button" data-extra-mod="${dodgeMod}" data-force-reroll="${forcedDefenceReroll}" data-attacker-uuid="${attackerUuid}" data-hits-count="${hitsCount}" data-melee="${isMelee ? 1 : 0}" data-burst="${burst ? 1 : 0}" data-attacker-is-horde="${attackerIsHorde ? 1 : 0}">
               Уклонение${dodgeMod !== 0 ? ` (${signed(dodgeMod)})` : ""}
             </button>`
        }
        ${cannotParry
          ? `<button class="wh-parry-btn wh-dodge-disabled" disabled>
               Парирование (невозможно${wp.flexible ? " — Гибкое" : ""})
             </button>`
          : `<button class="wh-parry-btn" type="button" data-extra-mod="${parryMod}" data-force-reroll="${forcedDefenceReroll}" data-attacker-uuid="${attackerUuid}" data-hits-count="${hitsCount}" data-burst="${burst ? 1 : 0}" data-attacker-is-horde="${attackerIsHorde ? 1 : 0}">
               Парирование${parryMod !== 0 ? ` (${signed(parryMod)})` : ""}
             </button>`
        }
        ${targetIsVehicle
          ? `<button class="wh-swerve-btn" type="button" data-extra-mod="0" data-attacker-uuid="${attackerUuid}" data-hits-count="${hitsCount}"
               title="Техника: Operate − Размер×10">Вираж</button>`
          : ""}
        ${poolBtn}
        ${poolRecoilBtn}
      </div>
      ${note && (dodgeMod !== 0 || parryMod !== 0 || cannotDodge)
        ? `<div class="roll-defense-note">${note}</div>` : ""}
      ${hitsNote}
      ${blastRecoilNote}
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

/**
 * Кнопка Горжета (стр. 228, wdbc-8b5): случайное попадание в голову можно
 * попытаться перевести в Торс броском 1d10 против рейтинга X свойства.
 * Правит эту же карточку (см. hooks.mjs) — тем же приёмом, что locShift выше.
 */
function gorgetSection({ rating, outcome }) {
  if (outcome) {
    return `
    <div class="roll-defense-section roll-gorget">
      <div class="roll-defense-title">🩹 Горжет: 1d10=<b>${outcome.roll}</b> против ${rating}+ — ${
        outcome.success ? "<b>успех</b>, попадание перенесено в Торс" : "<b>провал</b>, остаётся Голова"}</div>
    </div>`;
  }
  return `
    <div class="roll-defense-section roll-gorget">
      <div class="roll-defense-title">Горжет: случайное попадание в голову можно перенести в Торс — только защищающийся</div>
      <div class="roll-defense-btns">
        <button type="button" class="wh-gorget-btn" data-rating="${rating}">🩹 Бросить 1d10 (${rating}+ → Торс)</button>
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
 * @param {object}   [d.gorget]      { rating, outcome } — кнопка Горжета (wdbc-8b5), либо null
 * @param {object}   [d.ammo]        блок боеприпасов (только стрелковое), либо null
 * @param {object}   [d.defense]     { dodgeMod, parryMod, targetIsVehicle, note }
 * @param {object}   [d.suppression] { testMod, hits, cap } — Подавление, либо null
 * @param {object}   [d.notes]       текстовые примечания карточки (см. ниже)
 * @param {object}   [d.blocks]      готовые блоки: props, quality, splinter, targetEffects, dice
 */
export function attackCard({
  actorName = "", weaponName = "", wp = {},
  threshold = 0, rv = 0, modeLine = "", hit = false, deg = 0,
  // Отброшенные перебросом кубы: без них потраченный Локус выглядит как
  // «мастер что-то посчитал», а не как использованная возможность.
  rerollDropped = [],
  // Критический Успех/Провал (натуральные 1-5/96-100, стр. 25) — готовая
  // строка из rules/test-kind-widget.mjs::critLineHtml, пустая, если не
  // сработало. Не путать с «Критическим Эффектом» ниже (свойство Extreme).
  critLine = "",
  hitsCount = 0, hits = [],
  hitLocLabel = "", locRoll = 0, locShift = null, gorget = null,
  isMelee = false, dtLabel = "", damageType = "", pen = 0,
  // Assassin Strike / Удар Ассасина (wdbc-qpcg): доступность кнопки уже
  // посчитана вызывающей стороной (module/combat/assassin-strike.mjs —
  // владение Талантом + не потрачен в этом Раунде), карточка только рисует.
  assassinStrike = false,
  sbEff = 0, sbHalf = false, taintedAdd = 0, vehicleSide = "",
  ammo = null, band = null, suppression = null,
  corVal = 0, corEffects = [],
  soulBurnActorId = null,
  // Данные для урона по Орде: Rng нужен Распылению, burst — Таланту «Свинцовый
  // Дождь», uuid — чтобы найти Таланты и Размер стрелка, hordeHits — раскладка
  // попаданий правилом «Прячась в Орде» (combat/horde-tokens.mjs).
  weaponRange = 0, burst = false, attackerUuid = "", itemUuid = "", hordeHits = null,
  // One Against A Hundred (wdbc-u0by): защищающийся против атаки Орды.
  attackerIsHorde = false,
  // Остаток пула неизрасходованных Успехов защиты с ДРУГИХ атак этого же
  // противника в этом Ходу (стр. 12) — null, если пула нет или он пуст.
  pool = null,
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
  // Общее напоминание о свойстве Взрывное едет отдельным блоком (blocks.props/
  // targetEffects — module/combat/weapon-properties.mjs); здесь — только то, что
  // касается именно ЭТОЙ очереди попаданий (несколько шаблонов из одной атаки).
  const blastNote = (wp.blastRating > 0 && hits.length > 1) ? `
    <div class="roll-wprop-note">
      💥 Каждый Взрыв этой очереди — отдельный шаблон, размещается до Уклонения.
    </div>` : "";
  // Выстрел Насквозь: порог «пробивает ли» числом, не общей фразой — Pen×2
  // прямо сейчас, у этого выстрела (стр. 74 Книги Аэльдари).
  const throughShotNote = (wp.throughShot && hits.length) ? `
    <div class="roll-wprop-note">
      🎯 Выстрел Насквозь: пробивает укрытие/цель насквозь, если AP+T.b &lt; <b>${pen * 2}</b> (Pen×2) —
      следующая цель получает попадание со сниженным на 1d10 уроном (затем 1d5, затем флэт −1), Pen падает на Поглощение пробитой цели.
    </div>` : "";
  const damageSection = hits.length ? `
    <div class="roll-damage-section">
      <div class="roll-section-head">Урон</div>
      <div class="roll-damage-meta">${dtLabel} · Пробитие ${pen}${sbNote}${taintedNote}</div>
      ${blastNote}
      ${throughShotNote}
      ${hitLines(hits, { blastRating: wp.blastRating })}
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
      Подавление: все в секторе 45°, прямой видимости, Короткой/Боевой дистанции —
      тест Подавление (${suppression.testMod >= 0 ? "+" : ""}${suppression.testMod})<br>
      ГМ распределяет <b>${suppression.hits}</b> попадан${suppression.hits === 1 ? "ие" : suppression.hits < 5 ? "ия" : "ий"} в торс
      по случайным целям в секторе (нечётные Успехи, максимум RoF ${suppression.cap})
      <button class="wh-suppression-test-btn" type="button" data-test-mod="${suppression.testMod}">
        ${rollIcon("target","#ff9a4d")}Тест Подавления — выбранный токен цели
      </button>
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
          <span class="roll-stat"><label>Бросок</label><b>${rv}</b>${
            rerollDropped.length ? `<em class="roll-reroll-note"> (переброс, отброшено ${rerollDropped.join(", ")})</em>` : ""}</span>
        </div>
        ${critLine}
        <div class="roll-outcome">${outcomeHtml}</div>
        ${isMelee && assassinStrike ? `
    <button class="wh-assassin-strike-btn" type="button" data-attacker-uuid="${attackerUuid}"
      title="Раз в Раунд после рукопашной атаки (успешной или нет): Acrobatics+0 → Полудвижение свободным действием, не вызывает Свободную Атаку при выходе из рукопашной">
      🗡️ Удар Ассасина — Acrobatics+0
    </button>` : ""}
        ${notes.helpless ? `<div class="roll-allout-note">${notes.helpless}</div>` : ""}
        ${hit && hitsCount > 0
          ? `<div class="roll-location">Место попадания: <b>${hitLocLabel}</b> (${locRoll})</div>`
          : ""}
        ${notes.shelter ? `<div class="roll-wprop-note horde-shelter-note">🛡️ ${notes.shelter}</div>` : ""}
        ${locShift ? locShiftSection(locShift, actorName) : ""}
        ${gorget ? gorgetSection(gorget) : ""}
        ${notes.aim ? `<div class="roll-aim-note">Прицел: <b>${notes.aim}</b></div>` : ""}
        ${notes.blastScatter ? `
    <div class="roll-allout-note">
      💥 Взрыв мимо цели — смещение <b>${notes.blastScatter.distance}м</b>
      ${notes.blastScatter.dir.icon} <b>${notes.blastScatter.dir.label}</b>
      (роза, направление ${notes.blastScatter.dir.n}/8) от точки прицела.
      Радиус взрыва <b>${notes.blastScatter.radius}м</b> — проверьте, не задело ли исходную цель или тех, кто рядом.
    </div>` : ""}
        ${notes.mount ? `<div class="roll-aim-note">${notes.mount}</div>` : ""}
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
        ${hit ? `
    <button class="wh-mount-hit-btn" type="button" data-roll="${rv}" title="Цель верхом: по книжной формуле (дубль/чётность) определяет, попало по всаднику или скакуну — бросок уже в карточке, перепечатывать не нужно">
      🐎 Верховое попадание (выберите токен цели)
    </button>` : ""}
        ${hit ? defenseSection(defense, { wp, attackerUuid, hitsCount, pool, isMelee, burst, attackerIsHorde }) : ""}
        ${applyDamageSection(hit ? hits : [], { wp, pen, damageType, weaponName, actorName,
                                                vehicleSide, isMelee, burst, weaponRange,
                                                attackerUuid, itemUuid, hordeHits })}
        ${soulBurnActorId ? `
    <div class="roll-wprop-effects">
      <button class="wh-soulburn-btn" type="button" data-attacker-id="${soulBurnActorId}">
        Выжигание Души (выберите токен цели)
      </button>
    </div>` : ""}
        ${blocks.targetEffects ?? ""}
      </div>`;
}
