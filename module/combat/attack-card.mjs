// module/combat/attack-card.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  Фаза 7 конвейера (docs/architecture-plan.md, §2.1): карточка чата.
//
//  Сюда приходят уже посчитанные числа, отсюда выходит HTML. Модуль ничего не
//  бросает, не читает документы Foundry и не трогает актора — поэтому его
//  проверяет test/combat/attack-card.test.mjs напрямую, без броска кубов.
//
//  Каркас карточки (корневой div, шапка, статлиния, исход) собирает общий
//  сборщик helpers/test-card.mjs (wdbc-kuun): порядок и подписи те же, что были
//  здесь своей разметкой, но живут они теперь в одном месте на все подсистемы.
//  Публикация — не здесь: обе функции возвращают строку, в чат её отправляет
//  combat/attack.mjs.
//
//  Блоки, которые собирают другие модули (свойства оружия, качество, напоминания
//  осколочного, кнопки эффектов на цель, развёрнутые кубы), приходят готовыми
//  строками в `blocks`: их авторы живут в своих файлах, и второй сборки здесь нет.
// ─────────────────────────────────────────────────────────────────────────────

import { _degWord, esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { isCompressibleLocation, normalizeCompressibleLocation } from "../rules/compression.mjs";
import { testCardHtml, statLine, outcomeHtml } from "../helpers/test-card.mjs";

/** Знак перед числом модификатора: −10 печатается как есть, +10 — со знаком. */
const signed = n => `${n >= 0 ? "+" : ""}${n}`;

/**
 * Идентификатор атаки для гейта «одна Реакция на одно Действие» (стр. 12,
 * wdbc-x1nz.2.28, см. attackId в defenseSection ниже). Свой генератор, а не
 * foundry.utils.randomID() — модуль намеренно не трогает Foundry API (см.
 * шапку файла), только строит HTML из уже посчитанных чисел.
 *
 * Время + счётчик уникальны только в пределах ОДНОГО клиента: у каждого свой
 * счётчик, и две атаки в одну миллисекунду с разных компьютеров совпадали —
 * гейт съедал Реакцию защитника на второй (wdbc-bjy1.11). Отсюда случайный
 * хвост клиента, выбранный один раз на загрузку модуля (чистый JS).
 */
const _clientTag = Math.random().toString(36).slice(2, 10);
let _attackIdSeq = 0;
function _newAttackId() {
  _attackIdSeq += 1;
  return `atk-${Date.now().toString(36)}-${_clientTag}-${_attackIdSeq}`;
}

/**
 * Карточка заклинившего оружия: бросок дошёл до порога Ненадёжности, атаки нет.
 * `blocks.props` — блок особых свойств (buildPropertyChatBlock).
 */
export function jamCard({ weaponName = "", rv = 0, blocks = {}, spoiled = 0 } = {}) {
  return testCardHtml({
    // Особые свойства стоят ВЫШЕ шапки — как и в полной карточке атаки.
    prelude: blocks.props ?? "",
    title: weaponName,
    // Порога у Клина нет: строку Порога занимает статлиния с одним броском.
    threshold: statLine([{ label: "Бросок", value: rv }]),
    outcome: outcomeHtml(false, "Оружие заклинило! Требуется действие на устранение Клина."),
    // Испорченные патроны (стр. 41, wdbc-x1nz.2.61) — восстановимы отдельным
    // тестом Trade(Weaponsmith)+10 вне боя, не самим «Расклином».
    sections: spoiled > 0
      ? [`<div class="roll-allout-note">Испорчено патронов: <b>${spoiled}</b> (восстановимо тестом Trade (Weaponsmith)+10 вне боя).</div>`]
      : []
  });
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
function applyDamageSection(hits, { wp, pen, damageType, damageSubtype = "", weaponName, actorName, vehicleSide,
                                    isMelee = false, burst = false, weaponRange = 0,
                                    attackerUuid = "", itemUuid = "", hordeHits = null, deadlyTrapLegacyDelta = 0 }) {
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
      data-damage-subtype="${damageSubtype}"
      data-hit-location="${hits[0].loc}"
      data-attacker="${actorName}"
      data-attacker-uuid="${attackerUuid}"
      data-felling="${wp.fellingRating ?? 0}"
      data-primitive="${wp.primitive ? 1 : 0}"
      data-ignore-shield="${wp.ignoreShield ? 1 : 0}"
      data-ignore-dome-shield="${wp.ignoreDomeShields ? 1 : 0}"
      data-stun-maneuver="${wp.stunManeuver ? 1 : 0}"
      data-warp-soak="${wp.warpSoak ? 1 : 0}"
      data-lance="${wp.lance ? 1 : 0}"
      data-sanctified="${wp.sanctified ? 1 : 0}"
      data-power-field="${wp.powerField ? 1 : 0}"
      data-corrosive="${wp.corrosiveRating ?? 0}"
      data-entropy="${wp.entropyRating ?? 0}"
      data-touch-of-pain="${wp.touchOfPainIgnoreTb ? 1 : 0}"
      data-crippling="${wp.cripplingRating ?? 0}"
      data-piercing="${wp.piercing ? 1 : 0}"
      data-haywire="${wp.haywire ? (wp.haywireRating ?? 0) : ""}"
      data-haywire-dmg2="${wp.haywireDamage2 || ""}"
      data-through-shot="${wp.throughShot ? 1 : 0}"
      data-has-extreme="${hits[0]?.hasExtreme ? 1 : 0}"
      data-opportunist-floor="${hits[0]?.opportunistFloor ? 1 : 0}"` : "";
  // Гравитонное (wdbc-wlwf): только на Blast/Spray-шаблоне, взаимоисключимо с
  // Остаётся (Linger) — если у оружия почему-то есть оба, приоритет у Linger
  // (она размещается веткой выше по data-linger, здесь graviton просто не
  // читается на стороне hooks.mjs, когда linger > 0).
  const gravitonAttrs = (wp.shrinkTemplate > 0) ? ` data-graviton="1"` : "";
  // Несколько попаданий Взрывного в Очереди (стр. 36, wdbc-x1nz.2.63):
  // «каждое попадание, вызывающее взрыв, считается отдельным шаблоном» —
  // одна общая кнопка на всю атаку раньше давала только ОДИН шаблон, даже
  // когда очередь даёт 2-3 попадания. Остаётся/Гравитон/Распыление — особые
  // одноразовые зоны поверх ванильного Взрывного (Остаётся — персистентный
  // Region на всю атаку, Распыление — один конус, не «попадание» в этом
  // смысле вовсе), их это НЕ касается — там по-прежнему одна кнопка.
  const perHitBlastTemplates = wp.blastRating > 0 && !wp.spray
    && !(wp.lingerRating > 0) && !(wp.shrinkTemplate > 0) && hits.length > 1;
  const templateBtn = (!perHitBlastTemplates && (wp.blastRating > 0 || wp.spray)) ? `
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
    // Замена кубика на Успехи (стр. 34, wdbc-x1nz.2.49): «заменить результат
    // броска ОДНОГО кубика в броске на урон на количество Успехов». Кнопка
    // правит data-damage/подпись СОСЕДНЕЙ .wh-apply-dmg-btn прямо в DOM
    // (hooks.mjs, без похода на сервер) — тот же total, из которого уже
    // сложены Экстремальный/Выгорание/доп. кубы, ей трогать не нужно.
    // Ограничения «только одно попадание» и «только одна цель у площадной
    // атаки» код не запирает (второй кнопки для второй цели физически нет,
    // GM решает сам, кому из отмеченных применить заменённое число, а кому —
    // родное) — тот же честный компромисс, что у Молотильщика/Дуэлянтского.
    const canSwapDie = d.baseDieResult != null && Number.isFinite(d.successes);
    const swappedTotal = canSwapDie ? Math.max(0, d.total - d.baseDieResult + d.successes) : 0;
    const swapBtn = canSwapDie ? `
    <button class="wh-dmg-swap-btn" type="button" data-base-die="${d.baseDieResult}" data-successes="${d.successes}"
      title="Один кубик этого попадания → число своих Успехов вместо выпавшего значения (стр. 34). Только одно попадание за атаку; у площадной — только одна цель.">
      🎲 Кубик→Успехи: ${d.baseDieResult}→${d.successes} (итог станет ${swappedTotal})
    </button>` : "";
    // Смертельная Ловушка (wdbc-1rno.35, vigilant 10-10, стр. 427): правит
    // data-damage соседней .wh-apply-dmg-btn прямо в DOM, тем же приёмом,
    // что и Кубик→Успехи выше — раз за бой, отмечается по клику
    // (hooks.mjs::markLegacyDeadlyTrapUsed). Честно НЕ заперто от клика на
    // второе попадание той же Очереди — раз-в-бой держит только сервер-флаг,
    // не сам DOM карточки.
    const deadlyTrapBtn = (deadlyTrapLegacyDelta > 0) ? `
    <button class="wh-legacy-deadly-trap-btn" type="button" data-delta="${deadlyTrapLegacyDelta}" data-attacker-uuid="${attackerUuid}"
      title="Смертельная Ловушка: раз за бой, попадая вне своего Хода — поднять бонус Оружия Наследия с ½Inf.b до 2×Inf.b на этом попадании.">
      🪤 Смертельная Ловушка: +${deadlyTrapLegacyDelta} урона (раз за бой)
    </button>` : "";
    // Стр. 36, wdbc-x1nz.2.63: своё место взрыва на каждое попадание очереди —
    // размещается ДО Избегания (кнопка стоит рядом с самим попаданием, а не
    // после «Применить урон», чтобы ГМ ставил шаблон прежде, чем цель решит,
    // как уклоняться).
    const perHitTemplateBtn = perHitBlastTemplates ? `
    <button class="wh-place-template-btn" type="button"
      data-shape="circle" data-meters="${wp.blastRating}"
      data-weapon-name="${weaponName}" data-attacker-uuid="${attackerUuid}" data-item-uuid="${itemUuid}">
      🎯 Разместить шаблон ${i + 1} и отметить цели
    </button>` : "";
    // Щит вне арки (core.json, «Типы Рукопашного Оружия», разд. «Щит») —
    // геометрию системой не считает никто (нет отслеживания угла атаки на
    // сцене), галочка рядом с кнопкой применения урона решает за ГМа на
    // глаз; hooks.mjs читает её состояние по клику из того же .roll-dmg-hit-group
    // (тот же приём, что уже читает соседний .wh-dmg-swap-btn/DOM-правку).
    const shieldArcCheckbox = !toHorde ? `
    <label class="attack-mod-check" style="display:block;font-size:0.82em;">
      <input type="checkbox" class="wh-shield-out-of-arc-checkbox"/> Цель вне арки щита (АР щита не считается)
    </label>` : "";
    return `<span class="roll-dmg-hit-group">
    ${perHitTemplateBtn}
    ${shieldArcCheckbox}
    <button class="wh-apply-dmg-btn${toHorde ? " wh-apply-dmg-horde" : ""}" type="button"
    data-damage="${d.total}"
    data-penetration="${pen}"
    data-damage-type="${damageType}"
    data-damage-subtype="${damageSubtype}"
    data-hit-location="${d.loc}"
    data-vehicle-side="${vehicleSide}"
    data-weapon-name="${weaponName}"
    data-weapon-uuid="${itemUuid}"
    data-attacker="${actorName}"
    data-attacker-uuid="${attackerUuid}"
    data-felling="${wp.fellingRating ?? 0}"
    data-primitive="${wp.primitive ? 1 : 0}"
    data-ignore-shield="${wp.ignoreShield ? 1 : 0}"
    data-ignore-dome-shield="${wp.ignoreDomeShields ? 1 : 0}"
    data-stun-maneuver="${wp.stunManeuver ? 1 : 0}"
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
    data-entropy="${wp.entropyRating ?? 0}"
    data-touch-of-pain="${wp.touchOfPainIgnoreTb ? 1 : 0}"
    data-crippling="${wp.cripplingRating ?? 0}"
    data-piercing="${wp.piercing ? 1 : 0}"
    data-haywire="${wp.haywire ? (wp.haywireRating ?? 0) : ""}"
    data-haywire-dmg2="${wp.haywireDamage2 || ""}"
    data-through-shot="${wp.throughShot ? 1 : 0}"
    data-has-extreme="${d.hasExtreme ? 1 : 0}"
    data-opportunist-floor="${d.opportunistFloor ? 1 : 0}"
    ${toHorde ? `data-force-horde="${toHorde}"` : ""}>
    Применить урон ${i + 1}: <b>${d.total}</b> → ${toHorde ? "Орду (прикрыла цель)" : d.loc}${
      wp.blastRating > 0 ? ` <span class="roll-hit-extra">(отметьте всех в радиусе ${wp.blastRating}м — «Всем»)</span>` : ""}
  </button>${wp.warpSoak ? `
  <button class="wh-pain-absorb-btn" type="button" data-damage="${d.total}" title="Друкхари с Очками Боли: выбранный токен цели поглощает урон Болью вместо Ран (3 урона за 1 Боль)">
    🔥 Поглотить Болью ${i + 1}: <b>${d.total}</b>
  </button>` : ""}${swapBtn}${deadlyTrapBtn}</span>`;
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
 * Рикошет промаха по цели, Связанной в Рукопашной (стр. 30, wdbc-x1nz.2.64):
 * готовые попадания уже посчитаны в attack.mjs (свой бросок урона/места и
 * свой d100 на выбор получателя — получатель НЕ выбирается ГМом за столом,
 * в отличие от Вторичных целей Очереди/Стрельбы на Подавление). Кнопка несёт
 * data-force-target — тот же общий приём hooks.mjs, что у Встречной атаки:
 * применение урона не просит игрока заново выцеливать токен на сцене.
 */
function misfireHitsSection(misfireHits, { wp, pen, damageType, damageSubtype = "", weaponName, actorUuid, itemUuid }) {
  if (!misfireHits.length) return "";
  const buttons = misfireHits.map((m, i) => `
    <button class="wh-apply-dmg-btn" type="button"
      data-damage="${m.total}" data-penetration="${pen}"
      data-damage-type="${damageType}" data-damage-subtype="${damageSubtype}"
      data-hit-location="${m.loc}" data-weapon-name="${weaponName}"
      data-weapon-uuid="${itemUuid}" data-attacker-uuid="${actorUuid}"
      data-force-target="${m.targetUuid}"
      data-felling="${wp.fellingRating ?? 0}" data-primitive="${wp.primitive ? 1 : 0}"
      data-ignore-shield="${wp.ignoreShield ? 1 : 0}" data-ignore-dome-shield="${wp.ignoreDomeShields ? 1 : 0}" data-stun-maneuver="${wp.stunManeuver ? 1 : 0}" data-warp-soak="${wp.warpSoak ? 1 : 0}"
      data-lance="${wp.lance ? 1 : 0}" data-sanctified="${wp.sanctified ? 1 : 0}"
      data-corrosive="${wp.corrosiveRating ?? 0}" data-entropy="${wp.entropyRating ?? 0}"
      data-touch-of-pain="${wp.touchOfPainIgnoreTb ? 1 : 0}" data-crippling="${wp.cripplingRating ?? 0}"
      data-piercing="${wp.piercing ? 1 : 0}"
      data-haywire="${wp.haywire ? (wp.haywireRating ?? 0) : ""}" data-haywire-dmg2="${wp.haywireDamage2 || ""}">
      Применить рикошет ${i + 1}: <b>${m.total}</b> → ${esc(m.targetName)} (${m.loc})
    </button>`).join("");
  return `
  <div class="roll-apply-dmg-section">
    <div class="roll-wprop-note">🎯 Промах по цели в рукопашной — рикошет в случайного участника контакта (стр. 30):</div>
    ${buttons}
  </div>`;
}

/**
 * Наследие Предательства (wdbc-1rno.35, стр. 427): нат. 100 на попадание —
 * «оружие попадает по случайному союзнику» ВМЕСТО исходной цели. Случайный
 * получатель и его дистанция/контакт уже посчитаны в attack.mjs (module/
 * combat/legacy-weapon-betrayal.mjs) — та же форма и тот же data-force-target
 * приём, что рикошет промаха выше, но урон один и тот же (не добавочный).
 */
function betrayalHitsSection(betrayalHits, { wp, pen, damageType, damageSubtype = "", weaponName, actorUuid, itemUuid }) {
  if (!betrayalHits.length) return "";
  const buttons = betrayalHits.map((m, i) => `
    <button class="wh-apply-dmg-btn" type="button"
      data-damage="${m.total}" data-penetration="${pen}"
      data-damage-type="${damageType}" data-damage-subtype="${damageSubtype}"
      data-hit-location="${m.loc}" data-weapon-name="${weaponName}"
      data-weapon-uuid="${itemUuid}" data-attacker-uuid="${actorUuid}"
      data-force-target="${m.targetUuid}"
      data-felling="${wp.fellingRating ?? 0}" data-primitive="${wp.primitive ? 1 : 0}"
      data-ignore-shield="${wp.ignoreShield ? 1 : 0}" data-ignore-dome-shield="${wp.ignoreDomeShields ? 1 : 0}" data-stun-maneuver="${wp.stunManeuver ? 1 : 0}" data-warp-soak="${wp.warpSoak ? 1 : 0}"
      data-lance="${wp.lance ? 1 : 0}" data-sanctified="${wp.sanctified ? 1 : 0}"
      data-corrosive="${wp.corrosiveRating ?? 0}" data-entropy="${wp.entropyRating ?? 0}"
      data-touch-of-pain="${wp.touchOfPainIgnoreTb ? 1 : 0}" data-crippling="${wp.cripplingRating ?? 0}"
      data-piercing="${wp.piercing ? 1 : 0}"
      data-haywire="${wp.haywire ? (wp.haywireRating ?? 0) : ""}" data-haywire-dmg2="${wp.haywireDamage2 || ""}">
      Применить попадание ${i + 1}: <b>${m.total}</b> → ${esc(m.targetName)} (${m.loc})
    </button>`).join("");
  return `
  <div class="roll-apply-dmg-section">
    <div class="roll-wprop-note">🗡️ Наследие Предательства: нат. 100 на попадание — оружие подвело, урон уходит случайному союзнику рядом:</div>
    ${buttons}
  </div>`;
}

/**
 * Перегруппировка/vigilant 1-2, Оружие Наследия (wdbc-1rno.35, стр. 427):
 * «После успешной атаки этим оружием (даже если цель Избежала её) персонаж
 * может потратить Очко Бесчестия, чтобы перебросить свою Инициативу начиная
 * со следующего Раунда.» Доступность (hit && Мутация) уже посчитана
 * attack.mjs — эта функция только рисует кнопку. Клик —
 * combat/legacy-weapon-regroup.mjs::activateLegacyRegroup (hooks.mjs).
 */
function regroupLegacySection(active, { actorUuid }) {
  if (!active) return "";
  return `
  <div class="roll-wprop-effects">
    <button class="wh-legacy-regroup-btn" type="button" data-attacker-uuid="${actorUuid}">
      ⚜ Перегруппировка: потратить Очко Бесчестия — переброс Инициативы со следующего Раунда
    </button>
  </div>`;
}

/**
 * Посох/Крюк (core.json, «Типы Рукопашного Оружия»): «При Избирательном
 * попадании в Ногу [Посохом] персонаж может потратить Реакцию, чтобы
 * провести против цели прием Повалить» / «На 3+ Успеха на попадание [Крюком]
 * ... персонаж может потратить Реакцию, чтобы провести против цели прием
 * Повалить». Это Реакция АТАКУЮЩЕГО (не защиты цели, потому не в
 * defenseSection — тот делит attackId с Уклонением/Парированием защищающегося,
 * общий гейт «одно чужое Действие → одна Реакция», к своей Реакции
 * атакующего отношения не имеющий), доступность уже посчитана attack.mjs.
 */
function reactionKnockdownSection(reason, { actorUuid }) {
  if (!reason) return "";
  return `
  <div class="roll-wprop-effects">
    <button class="wh-reaction-knockdown-btn" type="button" data-attacker-uuid="${actorUuid}"
      title="${esc(reason)} — тратит Реакцию атакующего, открывает обычный встречный тест «Повалить».">
      🦯 Реакция: Повалить
    </button>
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
 * @param {string} [hitLocLabel]  метка места попадания этой атаки: либо
 *   HIT_LOCATIONS случайного попадания (constants/combat.mjs, уже со
 *   стороной), либо AIM_LOCATIONS Избирательной атаки (combat/attack-
 *   outcome.mjs, стр. 35 — БЕЗ стороны: «Рука»/«Нога»/«Сочленение / Шея»/
 *   «Глаз (Голова)»). Кнопка Сжатия (rules/compression.mjs) показывается,
 *   только если это конечность/голова, не Торс — normalizeCompressibleLocation
 *   сводит обе формы к канонической стороне ПЕРЕД тем, как класть её в
 *   data-location/текст кнопки (wdbc-8dyp: иначе Избирательная атака в руку
 *   не давала кнопки вовсе — COMPRESSIBLE_LOCATIONS сравнивался с «Рука»
 *   напрямую). Доступность самой мутации у ЗАЩИЩАЮЩЕГОСЯ актора (тот на
 *   момент рендера карточки ещё не выбран) проверяется позже, в
 *   combat/defense.mjs::_performCompression — не здесь, этот модуль
 *   документов Foundry не касается (см. шапку файла).
 */
export function defenseSection({ dodgeMod = 0, parryMod = 0, targetIsVehicle = false, targetIsWalker = false, note = "",
                          forcedDefenceReroll = "", dodgeModRecoil = null }, { wp, attackerUuid = "", itemUuid = "", hitsCount = 1, pool = null,
                          swarm = null, unseen = false, unseenDetected = false, unseenPenalty = 0,
                          sixthSenseBypassAvailable = false, musicOfBattleBypassAvailable = false,
                          isMelee = false, burst = false, attackerIsHorde = false, hitLocLabel = "" }) {
  // Стр. 12, wdbc-x1nz.2.28: «Одно Действие может вызвать только одну
  // Реакцию» — один attackId на ВСЮ карточку (одна атака = один рендер этой
  // функции), общий для каждой кнопки Избегания ниже (Уклонение/Парирование/
  // Сжатие/Уклонение-Парирование Шагохода). action-economy.mjs::spendReaction
  // отклоняет вторую Реакцию с тем же attackId, кто бы её ни тратил.
  // Свой генератор, не foundry.utils.randomID() — этот модуль намеренно не
  // трогает Foundry API (см. шапку файла), только строит HTML из данных.
  const attackId = _newAttackId();
  const cannotDodge = dodgeMod <= -900;
  const cannotParry = wp.flexible || parryMod <= -900;
  // Незримое (стр. 32, wdbc-1rno.2): «Избегание доступно только если
  // засекли её альтернативными методами». Отдельное состояние от
  // cannotDodge/cannotParry выше (те — НАВСЕГДА недоступно, например Атака
  // всем телом): unseenLocked снимается кликом по кнопке засечения в ЭТОЙ
  // ЖЕ карточке — кнопки Уклонения/Парирования рендерятся полными данными,
  // но disabled, и hooks.mjs на успехе детекта просто снимает disabled, без
  // повторного рендера карточки (сервер уже не участвует).
  const unseenLocked = unseen && !unseenDetected;
  const canCompress = !targetIsVehicle && isCompressibleLocation(hitLocLabel);
  // Избирательная атака называет часть тела без стороны («Рука», «Нога»,
  // «Сочленение / Шея», «Глаз (Голова)») — Сжатие хранит и втягивает
  // конкретную сторону, поэтому кнопка несёт НОРМАЛИЗОВАННУЮ метку
  // (rules/compression.mjs), а не сырую hitLocLabel (wdbc-8dyp).
  const compressLocation = normalizeCompressibleLocation(hitLocLabel);
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
         data-dodge-mod="${dodgeMod}" data-dodge-mod-recoil="${dodgeModRecoil ?? ""}" data-parry-mod="${parryMod}"
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
  // Захват (стр. 12, wdbc-x1nz.2.66.13): «−30 Парирования (или +3 Успеха от
  // предыдущего Парирования)» — альтернатива обычной кнопке Парирования выше,
  // с той же цепочкой data-атрибутов, но extra-mod без −30 штрафа Приёма.
  const poolGrappleParryBtn = pool && pool.canWaiveGrappleParry && !cannotParry
    ? `<button class="wh-pool-grapple-parry-btn" type="button"
         data-attacker-uuid="${attackerUuid}" data-attacker-weapon-uuid="${itemUuid}"
         data-hits-count="${hitsCount}" data-force-reroll="${forcedDefenceReroll}"
         data-melee="${isMelee ? 1 : 0}" data-attack-id="${attackId}">
         🤼 Пул (${pool.successes} Усп.): Парировать без штрафа за 3 Усп.
       </button>`
    : "";
  // Императив Избегания/Крепости (wdbc-hdxj): у обоих книга переворачивает
  // знак бонуса на тесте Избегания СПЕЦИАЛЬНО для Отскока в укрытие — движок
  // не знает заранее, каким выйдет этот бросок, ЕСЛИ игрок не декларирует
  // намерение сам. Чекбокс рендерится ТОЛЬКО когда у защищающегося активен
  // один из этих двух Императивов (dodgeModRecoil задан и отличается от
  // обычного — см. attack.mjs::hasEvasionRecoilImperative) — для остальных
  // атак/акторов UX диалога Уклонения не меняется вовсе.
  const recoilPlanCheckbox = (!cannotDodge && dodgeModRecoil !== null && dodgeModRecoil !== dodgeMod)
    ? `<label class="wh-recoil-plan-label" style="font-size:0.85em;display:block;margin:2px 0 4px;">
         <input type="checkbox" class="wh-recoil-plan-checkbox"/>
         Планирую Отскочить в укрытие (Уклонение будет ${signed(dodgeModRecoil)} вместо ${signed(dodgeMod)})
       </label>`
    : "";
  return `
    <div class="roll-defense-section">
      <div class="roll-section-head">Защита цели <span class="roll-head-hint">— выберите токен защищающегося</span></div>
      ${recoilPlanCheckbox}
      <div class="roll-defense-btns">
        ${cannotDodge
          ? `<button class="wh-dodge-btn wh-dodge-disabled" disabled>
               Уклонение (невозможно)
             </button>`
          : unseenLocked
          ? `<button class="wh-dodge-btn wh-unseen-locked" type="button" disabled data-extra-mod="${dodgeMod}" data-extra-mod-recoil="${dodgeModRecoil ?? dodgeMod}" data-force-reroll="${forcedDefenceReroll}" data-attacker-uuid="${attackerUuid}" data-item-uuid="${itemUuid}" data-hits-count="${hitsCount}" data-melee="${isMelee ? 1 : 0}" data-burst="${burst ? 1 : 0}" data-attacker-is-horde="${attackerIsHorde ? 1 : 0}" data-attack-id="${attackId}"
               title="Незримая атака (стр. 32): Уклонение недоступно, пока не засечена альтернативными методами — Психонаукой/Техпользованием (кнопки ниже).">
               Уклонение${dodgeMod !== 0 ? ` (${signed(dodgeMod)})` : ""} — не засечена
             </button>`
          : `<button class="wh-dodge-btn" type="button" data-extra-mod="${dodgeMod}" data-extra-mod-recoil="${dodgeModRecoil ?? dodgeMod}" data-force-reroll="${forcedDefenceReroll}" data-attacker-uuid="${attackerUuid}" data-item-uuid="${itemUuid}" data-hits-count="${hitsCount}" data-melee="${isMelee ? 1 : 0}" data-burst="${burst ? 1 : 0}" data-attacker-is-horde="${attackerIsHorde ? 1 : 0}" data-attack-id="${attackId}">
               Уклонение${dodgeMod !== 0 ? ` (${signed(dodgeMod)})` : ""}
             </button>`
        }
        ${cannotParry
          ? `<button class="wh-parry-btn wh-dodge-disabled" disabled>
               Парирование (невозможно${wp.flexible ? " — Гибкое" : ""})
             </button>`
          : unseenLocked
          ? `<button class="wh-parry-btn wh-unseen-locked" type="button" disabled data-extra-mod="${parryMod}" data-force-reroll="${forcedDefenceReroll}" data-attacker-uuid="${attackerUuid}" data-attacker-weapon-uuid="${itemUuid}" data-hits-count="${hitsCount}" data-burst="${burst ? 1 : 0}" data-attacker-is-horde="${attackerIsHorde ? 1 : 0}" data-melee="${isMelee ? 1 : 0}" data-attack-id="${attackId}"
               title="Незримая атака (стр. 32): Парирование недоступно, пока не засечена альтернативными методами — Психонаукой/Техпользованием (кнопки ниже).">
               Парирование${parryMod !== 0 ? ` (${signed(parryMod)})` : ""} — не засечена
             </button>`
          : `<button class="wh-parry-btn" type="button" data-extra-mod="${parryMod}" data-force-reroll="${forcedDefenceReroll}" data-attacker-uuid="${attackerUuid}" data-attacker-weapon-uuid="${itemUuid}" data-hits-count="${hitsCount}" data-burst="${burst ? 1 : 0}" data-attacker-is-horde="${attackerIsHorde ? 1 : 0}" data-melee="${isMelee ? 1 : 0}" data-attack-id="${attackId}"${isMelee ? "" : ` title="Стрельбу без Базового контакта со стрелком парирует только Талант «Щит Клинков» оружием с Балансом 1+ (стр. 62) — право проверится при нажатии"`}>
               Парирование${parryMod !== 0 ? ` (${signed(parryMod)})` : ""}
             </button>`
        }
        ${targetIsVehicle
          ? `<button class="wh-swerve-btn" type="button" data-extra-mod="0" data-attacker-uuid="${attackerUuid}" data-hits-count="${hitsCount}" data-attack-id="${attackId}"
               title="Техника: Operate − Размер×10. Реакция водителя (Книга Машин).">Вираж</button>`
          : ""}
        ${targetIsWalker && !cannotParry && isMelee
          ? `<button class="wh-walker-parry-btn${unseenLocked ? " wh-unseen-locked" : ""}" type="button"${unseenLocked ? " disabled" : ""} data-extra-mod="${parryMod}" data-attacker-uuid="${attackerUuid}" data-hits-count="${hitsCount}" data-attack-id="${attackId}"
               title="Шагоход (Книга Машин): Парирует рукопашным орудием машины тестом WS ПИЛОТА со штрафом −Размер×10. Реакцию тратит пилот.">
               Парирование (Шагоход)
             </button>`
          : ""}
        ${targetIsWalker && !cannotDodge
          ? `<button class="wh-walker-dodge-btn${unseenLocked ? " wh-unseen-locked" : ""}" type="button"${unseenLocked ? " disabled" : ""} data-extra-mod="${dodgeMod}" data-attacker-uuid="${attackerUuid}" data-hits-count="${hitsCount}" data-attack-id="${attackId}"
               title="Шагоход (Книга Машин): Уклонение пилота со штрафом −Размер×10, ВСЕГДА комбинированное с Operate−10 машины — один бросок против наименьшего Предела.">
               Уклонение (Шагоход)
             </button>`
          : ""}
        ${canCompress
          ? `<button class="wh-compress-btn" type="button" data-location="${compressLocation}" data-attacker-uuid="${attackerUuid}" data-attack-id="${attackId}"
               title="Мутация Compression/Сжатие: вместо Уклонения — Реакцией втянуть ${compressLocation} в торс, нивелируя ЭТО попадание${compressLocation !== hitLocLabel ? ` (Избирательная атака не называет сторону — засчитывается как ${compressLocation}, как и для брони этого попадания)` : ""}">
               Сжатие (${compressLocation})
             </button>`
          : ""}
        ${poolBtn}
        ${poolRecoilBtn}
        ${poolGrappleParryBtn}
        ${swarm && swarm.count > 0
          ? `<button class="wh-swarm-btn" type="button" data-attacker-uuid="${attackerUuid}"
               title="Дар «Эфирная Стая»/Ethereal Swarm: тест Cor+0 (не Реакция) — Успех переносит ЭТО попадание на призрачного Крикуна (осталось ${swarm.count}), изгоняя его.">
               👻 Эфирная Стая (${swarm.count})
             </button>`
          : ""}
        ${unseenLocked
          ? `<button class="wh-unseen-detect-btn" type="button" data-attacker-uuid="${attackerUuid}" data-skill="psyniscience" data-penalty="${unseenPenalty}"
               title="Незримая атака (стр. 32): тест Психонауки (Пси-чутьё)${unseenPenalty ? ` ${signed(unseenPenalty)}` : ""} — не Реакция; Успех открывает Уклонение/Парирование от ЭТОЙ атаки выше.">
               🔮 Засечь (Пси-чутьё${unseenPenalty ? ` ${signed(unseenPenalty)}` : ""})
             </button>
             <button class="wh-unseen-detect-btn" type="button" data-attacker-uuid="${attackerUuid}" data-skill="techUse" data-penalty="${unseenPenalty}"
               title="Незримая атака (стр. 32): тест Техпользования (Ноосканирование)${unseenPenalty ? ` ${signed(unseenPenalty)}` : ""} — не Реакция; Успех открывает Уклонение/Парирование от ЭТОЙ атаки выше.">
               🔮 Засечь (Ноосканирование${unseenPenalty ? ` ${signed(unseenPenalty)}` : ""})
             </button>`
          : ""}
        ${unseenLocked && sixthSenseBypassAvailable
          ? `<button class="wh-unseen-bypass-btn" type="button" data-bypass="sixthSense" data-persistent="1"
               title="Sixth Sense/Шестое Чувство: потратить 1 Очко Бесчестия — Уклонение/Парирование от ЭТОЙ атаки доступны как обычно, и способность Избегать Незримые атаки сохраняется до начала следующего Хода.">
               💰 Шестое Чувство (1 Очко Бесчестия)
             </button>`
          : ""}
        ${unseenLocked && musicOfBattleBypassAvailable
          ? `<button class="wh-unseen-bypass-btn" type="button" data-bypass="musicOfBattle" data-persistent="0"
               title="Music of Battle/Музыка Битвы: потратить 1 Очко Бесчестия — Уклонение/Парирование от ЭТОЙ атаки доступны как обычно (разово, без персистентности).">
               💰 Музыка Битвы (1 Очко Бесчестия)
             </button>`
          : ""}
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
 * @param {object}   [d.allGunsBlazing] { testMod } — Огонь из Всех Орудий
 *                                       (wdbc-pb60), либо null
 * @param {object}   [d.notes]       текстовые примечания карточки (см. ниже)
 * @param {object}   [d.blocks]      готовые блоки: props, quality, splinter, targetEffects, dice,
 *                                    counterAttack (Встречная атака, wdbc-2wy7 — module/combat/counter-attack.mjs)
 */
export function attackCard({
  actorName = "", weaponName = "", wp = {},
  threshold = 0, rv = 0, modeLine = "", hit = false, deg = 0,
  // Почему исход не от броска (attack-outcome.mjs::attackHitOutcome):
  // "spray" — Распыление попадает автоматически, броска на попадание нет.
  autoHit = "",
  // Отброшенные перебросом кубы: без них потраченный Локус выглядит как
  // «мастер что-то посчитал», а не как использованная возможность.
  rerollDropped = [],
  // Критический Успех/Провал (натуральные 1-5/96-100, стр. 25) — готовая
  // строка из rules/test-kind-widget.mjs::critLineHtml, пустая, если не
  // сработало. Не путать с «Критическим Эффектом» ниже (свойство Extreme).
  critLine = "",
  hitsCount = 0, hits = [],
  hitLocLabel = "", locRoll = 0, locShift = null, gorget = null,
  isMelee = false, dtLabel = "", damageType = "", damageSubtype = "", pen = 0,
  // Assassin Strike / Удар Ассасина (wdbc-qpcg): доступность кнопки уже
  // посчитана вызывающей стороной (module/combat/assassin-strike.mjs —
  // владение Талантом + не потрачен в этом Раунде), карточка только рисует.
  assassinStrike = false,
  sbEff = 0, sbHalf = false, reverseThrustBonus = 0, taintedAdd = 0, vehicleSide = "",
  ammo = null, band = null, suppression = null, allGunsBlazing = null,
  corVal = 0, corEffects = [],
  soulBurnActorId = null,
  // Вторичные цели Очереди (стр. 35, wdbc-x1nz.2.55): [{name, distanceM}]
  // токенов ≤2м от основной цели — только подсказка, само распределение
  // попаданий делает стол через уже существующие кнопки «Применить урон».
  burstSecondaryTargets = [],
  // Рикошет промаха по цели в рукопашной (стр. 30, wdbc-x1nz.2.64):
  // [{total, loc, targetName, targetUuid}] — уже готовые попадания, своя
  // случайная цель посчитана в attack.mjs (не выбор ГМа за столом).
  misfireHits = [],
  // Наследие Предательства, Оружие Наследия (wdbc-1rno.35, История 4, стр.
  // 427): нат. 100 на попадание — «оружие попадает по случайному союзнику»
  // ВМЕСТО исходной цели. Та же форма и тот же data-force-target приём, что
  // misfireHits — единственная в этой атаке боевая единица (не добавочная).
  betrayalHits = [],
  // Перегруппировка, Оружие Наследия (wdbc-1rno.35, стр. 427): доступность
  // кнопки «потратить Очко Бесчестия» уже посчитана attack.mjs (hit &&
  // Мутация на оружии) — см. regroupLegacySection ниже.
  regroupLegacyActive = false,
  // Смертельная Ловушка, Оружие Наследия (wdbc-1rno.35, vigilant 10-10, стр.
  // 427): доступность и величина необязательной надбавки уже посчитаны
  // attack.mjs (актор/своя-очередь-Хода/раз-в-бой там, не здесь) — карточка
  // только рисует кнопку рядом с «Применить урон» (applyDamageSection ниже).
  deadlyTrapLegacyDelta = 0,
  // Посох/Крюк (core.json, «Типы Рукопашного Оружия»): непустая строка —
  // Реакция «Повалить» доступна, её текст объясняет почему (уже посчитано
  // attack.mjs — Избирательное попадание Посохом в Ногу / 3+ Успеха Крюком).
  reactionKnockdownReason = "",
  // Сабля, Верховая Атака (core.json, «Типы Рукопашного Оружия») — непустая
  // строка, уже готовый текст напоминания (attack.mjs уже решил, показывать
  // ли его — по opts.sabreSecondAttack).
  sabreSecondAttackNote = "",
  // Непустой — карточка первой атаки Сабли рисует кнопку второй
  // (combat/sabre-second-attack.mjs::activateSabreSecondAttack, hooks.mjs).
  sabreSecondAttackItemId = "",
  // Данные для урона по Орде: Rng нужен Распылению, burst — Таланту «Свинцовый
  // Дождь», uuid — чтобы найти Таланты и Размер стрелка, hordeHits — раскладка
  // попаданий правилом «Прячась в Орде» (combat/horde-tokens.mjs).
  weaponRange = 0, burst = false, attackerUuid = "", itemUuid = "", hordeHits = null,
  // One Against A Hundred (wdbc-u0by): защищающийся против атаки Орды.
  attackerIsHorde = false,
  // Остаток пула неизрасходованных Успехов защиты с ДРУГИХ атак этого же
  // противника в этом Ходу (стр. 12) — null, если пула нет или он пуст.
  pool = null,
  // Ethereal Swarm / Эфирная Стая (wdbc-1rno, rules/ethereal-swarm.mjs) —
  // {count, expiresAt} у ЦЕЛИ этой атаки, null если Стая не призвана/пуста/
  // истекла. Считается вызывающей стороной (attack.mjs) — этот модуль,
  // как и для pool выше, документов Foundry не касается.
  swarm = null,
  // Незримое (стр. 32, wdbc-1rno.2) — unseen: эта атака Незримая (свойство
  // оружия/психосилы/Техночуда ИЛИ разовая метка Сокрытой Угрозы,
  // wdbc-1rno.1, снятая в attack.mjs). unseenDetected: защищающийся УЖЕ
  // засёк её персистентно (Ноосферное Сканирование/Варп-Зрение,
  // rules/unseen-attack.mjs) — тогда Уклонение/Парирование рендерятся как
  // обычно, без блокировки и без кнопок засечения. unseenPenalty — штраф
  // на реактивный тест засечения (Сокрытая Угроза даёт −50, иначе 0). Этот
  // модуль документов Foundry не касается, как и pool/swarm выше.
  unseen = false, unseenDetected = false, unseenPenalty = 0,
  // Sixth Sense/Music of Battle (wdbc-1rno.2, rules/unseen-talents.mjs) —
  // считаются в attack.mjs (Очки Бесчестия защищающегося уже известны там),
  // рендерят кнопку «потратить Очко Бесчестия» рядом с кнопками засечения.
  sixthSenseBypassAvailable = false, musicOfBattleBypassAvailable = false,
  defense = {}, notes = {}, blocks = {}
} = {}) {
  const hitCountNote = hitsCount > 1 ? ` (${hitsCount} попадани${hitsCount < 5 ? "я" : "й"})` : "";
  // Распыление (стр. 168): броска на попадание нет — печатать «Попадание — 1
  // Успех» на глазах у выпавшего d100 значит врать про то, чего не бросали.
  const isSprayAuto = autoHit === "spray";
  const outcomeLine = outcomeHtml(hit, hit
    ? (isSprayAuto
        ? `Авто-попадание (Распыление) — по всем в конусе${hitCountNote}`
        : `Попадание — ${deg} ${_degWord(deg)}${hitCountNote}`)
    : `Промах — ${deg} ${_degWord(deg)}`);

  // Бонус Силы в рукопашной: Могучее ×2, Сдержанное 0, Обратный хват ½.
  // reverseThrustBonus — Выпад Полной Атакой Обратным хватом (стр. 39):
  // не половинит sbEff выше, а добавляет к нему ещё ½S.b (окр.▲) отдельной
  // строкой, чтобы игрок видел ДВЕ разные причины числа, а не одну.
  const sbNote = isMelee
    ? `, S.b +${sbEff}${wp.mightySB ? " (Могучее ×2)" : wp.containedSB ? " (Сдержанное)" : ""}${sbHalf ? " (½ хват)" : ""}`
      + (reverseThrustBonus ? `, +${reverseThrustBonus} (Обратный хват: Выпад Полной Атакой)` : "")
    : "";
  const taintedNote = taintedAdd ? `, Порча +${taintedAdd}` : "";
  // Backstab/Удар в Спину (wdbc-1rno.2): wp.doubleDice ставит attack.mjs
  // ДО построения dmgFormula — этот модуль его только показывает.
  const backstabNote = wp.doubleDice ? `, Удар в Спину: ×2 кубика урона` : "";
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
      <div class="roll-damage-meta">${dtLabel} · Пробитие ${pen}${sbNote}${taintedNote}${backstabNote}</div>
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
      <button class="wh-suppression-test-btn" type="button" data-test-mod="${suppression.testMod}" data-attacker-uuid="${attackerUuid}">
        ${rollIcon("target","#ff9a4d")}Тест Подавления — выбранный токен цели
      </button>
      <label class="wh-suppression-safe-label" title="Стр. 33: если персонаж уверен, что обстрел не может нанести ему больше 3 урона после Поглощения — тест проходит автоматически. Точный расчёт требует брони цели по локации и урона конкретного выстрела — решает ГМ.">
        <input type="checkbox" class="wh-suppression-safe-cb"/> Заведомо безопасно (≤3 урона)
      </label>
    </div>` : "";

  // Вторичные цели Короткой/Длинной Очереди (стр. 35, wdbc-x1nz.2.55):
  // список — уже замеренная дистанция (attack.mjs::measureTokens), а само
  // распределение и «не больше, чем у основной» — стол, теми же кнопками
  // «Применить урон N», что и у основной цели (второй machinery нет).
  const burstSecondaryHtml = burstSecondaryTargets.length ? `<div class="roll-suppression">
      Вторичные цели Очереди (≤2м от основной, с разрешения ГМа — и дальше при небольшом угловом расстоянии):
      <b>${burstSecondaryTargets.map(t => `${esc(t.name)} (${t.distanceM.toFixed(1)}м)`).join(", ")}</b><br>
      Можно распределить часть из ${hitsCount} попаданий по ним — не больше, чем достаётся основной цели, и всегда в Торс (стр. 35).
    </div>` : "";

  // Огонь из Всех Орудий (стр. 62, wdbc-pb60): обе атаки парного выстрела —
  // очереди по одной цели, цель проходит тест Подавления с тем же модификатором,
  // что и обычная Стрельба на Подавление — но без «попаданий в сектор»: это
  // обычная выцеленная атака парой оружия, не выстрел по площади.
  const allGunsBlazingHtml = allGunsBlazing ? `<div class="roll-suppression">
      Огонь из Всех Орудий: обе очереди пары — по одной цели —
      тест Подавление (${allGunsBlazing.testMod >= 0 ? "+" : ""}${allGunsBlazing.testMod})
      <button class="wh-all-guns-blazing-btn" type="button" data-test-mod="${allGunsBlazing.testMod}" data-attacker-uuid="${attackerUuid}">
        ${rollIcon("target","#ff9a4d")}Тест Подавления — выбранный токен цели
      </button>
      <label class="wh-suppression-safe-label" title="Стр. 33: если персонаж уверен, что обстрел не может нанести ему больше 3 урона после Поглощения — тест проходит автоматически. Точный расчёт требует брони цели по локации и урона конкретного выстрела — решает ГМ.">
        <input type="checkbox" class="wh-suppression-safe-cb"/> Заведомо безопасно (≤3 урона)
      </label>
    </div>` : "";

  return testCardHtml({
    // ВЫШЕ шапки: приём/стойка, прицеливание и боеприпасы — так карточка
    // выглядела и до общего сборщика, порядок сохранён.
    prelude: [
      techniqueHtml,
      notes.aiming ? `<div class="roll-aiming-note">${notes.aiming}</div>` : "",
      ammo ? ammoBlock(ammo) : ""
    ].filter(Boolean).join(""),
    title: weaponName,
    // Сразу под шапкой и ДО статлинии: свёрнутые «Хват и приёмы», особые
    // свойства, качество, напоминание осколочного.
    head: [
      notes.attack
        ? `<details class="roll-collapsible roll-note-collapsible">
               <summary class="roll-section-head"><span class="roll-sum-title">Хват и приёмы</span></summary>
               <div class="roll-threshold" style="font-size:0.82em;">${notes.attack}</div>
             </details>`
        : "",
      blocks.props ?? "",
      blocks.quality ?? "",
      blocks.splinter ?? ""
    ],
    // Место строки Порога здесь занимает статлиния: Бросок, Режим и Порог
    // читаются в ряд (wdbc-fyvv), приписка про отброшенные перебросом кубы
    // висит на ячейке Броска.
    threshold: statLine(isSprayAuto
      // У Распыления Порог и Бросок не участвуют в исходе вовсе — на их месте
      // то, что для потока и решает: режим и накрытый конус.
      ? [
          { label: "Режим", value: modeLine },
          { label: "Шаблон", value: `конус 30°, ${weaponRange}м` },
          { label: "Попадание", value: "авто" }
        ]
      : [
          { label: "Бросок", value: rv,
            note: rerollDropped.length
              ? `<em class="roll-reroll-note"> (переброс, отброшено ${rerollDropped.join(", ")})</em>` : "" },
          { label: "Режим", value: modeLine },
          { label: "Порог", value: threshold }
        ]),
    critLine,
    outcome: outcomeLine,
    sections: [
      isMelee && assassinStrike ? `
    <button class="wh-assassin-strike-btn" type="button" data-attacker-uuid="${attackerUuid}"
      title="Раз в Раунд после рукопашной атаки (успешной или нет): Acrobatics+0 → Полудвижение свободным действием, не вызывает Свободную Атаку при выходе из рукопашной">
      🗡️ Удар Ассасина — Acrobatics+0
    </button>` : "",
      notes.helpless ? `<div class="roll-allout-note">${notes.helpless}</div>` : "",
      notes.quietElimination ? `<div class="roll-allout-note">${notes.quietElimination}</div>` : "",
      hit && hitsCount > 0
        ? `<div class="roll-location">Место попадания: <b>${hitLocLabel}</b> (${locRoll})</div>`
        : "",
      notes.shelter ? `<div class="roll-wprop-note horde-shelter-note">🛡️ ${notes.shelter}</div>` : "",
      // Огрин и человеческое оружие (wdbc-flai): бросок 1d10 после атаки.
      notes.ogrynBreak ? `<div class="roll-wprop-note">${notes.ogrynBreak}</div>` : "",
      // Клин Распыления (стр. 168): по первому кубику урона, попадания в силе.
      notes.sprayJam ? `<div class="roll-allout-note">${notes.sprayJam}</div>` : "",
      // Граната в рукопашной, 3+ Успеха (стр. 40, wdbc-x1nz.2.60).
      notes.grenadeSelfImmune ? `<div class="roll-wprop-note">💥 ${notes.grenadeSelfImmune}</div>` : "",
      locShift ? locShiftSection(locShift, actorName) : "",
      gorget ? gorgetSection(gorget) : "",
      notes.aim ? `<div class="roll-aim-note">Прицел: <b>${notes.aim}</b></div>` : "",
      notes.blastScatter ? `
    <div class="roll-allout-note">
      💥 Взрыв мимо цели — смещение <b>${notes.blastScatter.distance}м</b>
      ${notes.blastScatter.dir.icon} <b>${notes.blastScatter.dir.label}</b>
      (роза, направление ${notes.blastScatter.dir.n}/8) от точки прицела.
      Радиус взрыва <b>${notes.blastScatter.radius}м</b> — проверьте, не задело ли исходную цель или тех, кто рядом.
    </div>` : "",
      notes.mount ? `<div class="roll-aim-note">${notes.mount}</div>` : "",
      damageSection,
      notes.maximal
        ? `<div class="roll-allout-note">Максимальный режим: +1d10 урона, +2 Проб., Взрыв(2), ×2 расход, Перезарядка.</div>` : "",
      notes.off ? `<div class="roll-wprop-note">${notes.off}</div>` : "",
      // Молотильщик (стр. 62, wdbc-pb60) — напоминание защищающемуся: успешное
      // Парирование этого удара сжигает его неиспользованные Успехи, а второе
      // оружие пары приходится парировать отдельным тестом. Сама эта цена
      // считается за столом (у Парирования нет понятия «оставшиеся Успехи
      // защиты», которое можно было бы обнулить), поэтому строка, а не расчёт.
      notes.pounder ? `<div class="roll-wprop-note">${notes.pounder}</div>` : "",
      corNotes,
      band ? `<div class="roll-wprop-note">Дистанция: ${band.label}${band.dice ? ` (+${band.dice}d10 урона)` : ""}${band.dmg ? ` (+${band.dmg} урона)` : ""}${band.pen ? ` (+${band.pen} Проб.)` : ""}</div>` : "",
      wp.devastatingRating ? `<div class="roll-wprop-note">Опустошительное (${wp.devastatingRating}): по Орде +${wp.devastatingRating} урона в Магнитуду</div>` : "",
      wp.wreckerRating ? `<div class="roll-wprop-note">Крушитель (${wp.wreckerRating}): +${wp.wreckerRating}d10 по земле/камню/рокриту/стеклу, AP таких укрытий вдвое меньше</div>` : "",
      wp.ordnance ? `<div class="roll-wprop-note">Артиллерия: все прочие атаки стрелка до начала его следующего Хода получают ${wp.otherAttacksMod}</div>` : "",
      suppressionHtml,
      burstSecondaryHtml,
      allGunsBlazingHtml,
      notes.allOut
        ? `<div class="roll-allout-note">Атака всем телом — Уклонение недоступно до следующего хода</div>` : "",
      notes.recharge
        ? `<div class="roll-allout-note">Перезарядка: следующий ход — подзарядка (стрелять можно раз в 2 хода).</div>` : "",
      blocks.dice ? `
    <details class="roll-dice-details">
      <summary>Показать кубы</summary>
      ${blocks.dice}
    </details>` : "",
      hit ? `
    <button class="wh-mount-hit-btn" type="button" data-roll="${rv}" data-unseen="${unseen ? 1 : 0}" title="Цель верхом: по книжной формуле (дубль/чётность) определяет, попало по всаднику или скакуну — бросок уже в карточке, перепечатывать не нужно">
      🐎 Верховое попадание (выберите токен цели)
    </button>` : "",
      // Распыление (стр. 168): книга даёт против потока ОДНУ защиту — тест
      // A+0 (кнопка ниже), Реакция не тратится. Обычные Уклонение/Парирование
      // рисовались потому, что hit у Spray теперь всегда true, и цель видела
      // две кнопки сразу — легко сжечь Реакцию там, где платить не надо
      // (wdbc-09t). У рукопашной Spray не бывает, поэтому гейт по autoHit.
      (hit && !isSprayAuto)
        ? defenseSection(defense, { wp, attackerUuid, itemUuid, hitsCount, pool, swarm, unseen, unseenDetected, unseenPenalty,
            sixthSenseBypassAvailable, musicOfBattleBypassAvailable, isMelee, burst, attackerIsHorde, hitLocLabel }) : "",
      applyDamageSection(hit ? hits : [], { wp, pen, damageType, damageSubtype, weaponName, actorName,
                                            vehicleSide, isMelee, burst, weaponRange,
                                            attackerUuid, itemUuid, hordeHits, deadlyTrapLegacyDelta }),
      misfireHitsSection(misfireHits, { wp, pen, damageType, damageSubtype, weaponName, actorUuid: attackerUuid, itemUuid }),
      betrayalHitsSection(betrayalHits, { wp, pen, damageType, damageSubtype, weaponName, actorUuid: attackerUuid, itemUuid }),
      regroupLegacySection(regroupLegacyActive, { actorUuid: attackerUuid }),
      reactionKnockdownSection(reactionKnockdownReason, { actorUuid: attackerUuid }),
      sabreSecondAttackNote ? `<div class="roll-wprop-effects"><div class="roll-defense-note">${esc(sabreSecondAttackNote)}</div>${sabreSecondAttackItemId
        ? `<button class="wh-sabre-second-attack-btn" type="button" data-attacker-uuid="${attackerUuid}" data-item-id="${esc(sabreSecondAttackItemId)}">⚔ Сабля: вторая атака (без ОД)</button>`
        : ""}</div>` : "",
      soulBurnActorId ? `
    <div class="roll-wprop-effects">
      <button class="wh-soulburn-btn" type="button" data-attacker-id="${soulBurnActorId}">
        Выжигание Души (выберите токен цели)
      </button>
    </div>` : "",
      blocks.targetEffects ?? "",
      blocks.counterAttack ?? ""
    ]
  });
}
