// module/sheets/tabs/psychic.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Псайкана и Силы навигатора. Функции принимают актора, а не лист.
// ════════════════════════════════════════════════════════════════════════════

import { CHARACTERISTICS } from "../../constants/characteristics.mjs";
import { SKILLS_DEF } from "../../constants/skills.mjs";
import { DAMAGE_TYPES } from "../../constants/items.mjs";
import { hasRuleFlag } from "../../rules/flags.mjs";
import { isPossessedByParasite } from "../../rules/parasite-trait.mjs";
import { isMentalActionBlocked } from "../../rules/predicates.mjs";
import { requiredMarks, MARK_LABELS } from "../../constants/talent-requirements.mjs";
import { dreadnoughtOf, hasOsirisMatrix } from "../../rules/dreadnought.mjs";
import { highSorceryManifestBlocked } from "../../rules/perfect-sorcerer.mjs";
import { focusQualityEffect, focusRollResult } from "../../rules/psy-focus.mjs";
import { PSY_NATURES, PSY_MODES, PSY_PATHS, PSY_POWER_TYPES, PSY_ACTIONS, subPathTotals } from "../../constants/psyker.mjs";
import { PSY_DISCIPLINES } from "../../constants/disciplines.mjs";
import { getPhenomenon, getPeril } from "../../constants/psyker-tables.mjs";
import { calmWarpButtonsHtml } from "../../combat/calm-warp.mjs";
import { WEAPON_PROPERTIES } from "../../constants/weapon-properties.mjs";
import { rollIcon } from "../../constants/roll-icons.mjs";
import { _degWord, resolveCharFormula, esc } from "../../helpers/utils.mjs";
import { resolveWeaponPropsList, buildTargetEffectButtons, buildPropertyChatBlock,
         aggregateAuto, applyDamageDiceMods, resolvePropRatings, resolvePropRating,
         filterPropsBySuccesses } from "../../combat/weapon-properties.mjs";
import { attackThreshold } from "../../combat/attack-threshold.mjs";
import { psychicHitCount } from "../../combat/attack-outcome.mjs";
import { rollExtremeDamage } from "../../combat/attack.mjs";
import { triggerAttackAnimation } from "../../integrations/autoanimations.mjs";
import { ruleRollModsHtml } from "../../rules/roll-mods.mjs";
import { syncItemEffectsDisabled } from "../../apps/effects.mjs";
import { woundLossUpdates } from "../../rules/wounds.mjs";
import { autoModsTotal, autoTestMods } from "../../rules/roll-mods.mjs";
import { resolveTest } from "../../rules/resolve-test.mjs";
import { getPsychicVessel } from "../../rules/psychic-vessel.mjs";
import { manifestEprFlags, safeModeEpr, CHILD_OF_THE_WARP_PUSH_BONUS } from "../../rules/psyker.mjs";
import { techniqueFocusFor, TECHNIQUE_FOCUS_TEST_BONUS, TECHNIQUE_FOCUS_PHEN_MOD,
         psychicSpiteApplies, hasPsychicSpite, normalizeSpiteChoice, PSYCHIC_SPITE_BONUS,
         manifestPrCeiling, RESURGENCE_FLAG,
         hasWarpWhisper, warpWhisperPenalty, hasInnumerations, innumerationsMod,
         hasFavouredByTheWarp, hasWarpConduit, WARP_CONDUIT_FORMULA, WARP_CONDUIT_PHEN_MOD,
         hasTechniqueFocus, hasPsychicPrecision, isPsychicShooting, precisionCost,
         PRECISION_COST, channelOutcome, isSignaturePower, signatureTalent, signatureToggle,
         hasFastWeaving, SIGNATURE_FLAG } from "../../rules/psyker-talents.mjs";
import { manifestActionPlan, payManifestAction, fastWeavingGateNow, signatureFreeHtml, weaveFluid, restoreFluidWeavePoint }
  from "../../combat/psyker-pools.mjs";
import { HIT_LOCATIONS } from "../../constants/combat.mjs";
import { spendCapabilityCost } from "../../combat/capability-cost.mjs";
import { isEncounterActive } from "../../combat/action-economy.mjs";
import { markCardOnce } from "../../combat/card-once.mjs";
import { gazeIntoAbyssReduction } from "../../rules/defiance-talents.mjs";
import { hasRuneMagic, runeMax, runeValue, runeCostForPower, runeCostTotal,
         runeStrikeMax, runeStrikeRefund, runeUpdate,
         RUNE_STRIKE_COST, isRuneLearned, hasImprovisedRune,
         runeLearnInfo, improvisedRuneCostUpdates,
         preparedRuneDiscount, markPreparedRuneUsed } from "../../rules/sigillite-runes.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../../helpers/test-card.mjs";
import { bluntedCasterTest } from "../../rules/blunted.mjs";
import { arcExtraAttrs } from "../../rules/arc-extra.mjs";
import { leftSustainRange } from "../../rules/psy-range.mjs";
import { measureTokens } from "../../combat/tactical-map.mjs";
import { mechRollData } from "../../rules/mech-formula.mjs";
import { runForceBladeShop } from "../../apps/force-blade-choice.mjs";
import { charDamageButtonHtml } from "../../combat/char-damage-button.mjs";
import { voidBlocksPower, isIndirectPower } from "../../rules/null-zones.mjs";
import { hasWoundInReality, woundAuraPhenMod, woundFreeToggleGate, WOUND_FREE_FLAG } from "../../rules/wound-in-reality.mjs";
import { setWoundFree } from "../../combat/wound-in-reality.mjs";
import { sustainOffPatch } from "../../combat/psychic-sustain.mjs";
import { warpLockBlocksManifest } from "../../rules/warp-lock.mjs";
import { warpLockButtonsHtml, applyWarpLock, resetWarpLockHour, clearWarpLockMark } from "../../combat/warp-lock.mjs";

/**
 * Через что кастуется психосила. Прорицание (divination) — через навык
 * Псинаука; также явный выбор testChar="psyniscience" использует навык.
 * Иначе — характеристика (WP/Int/Per/Fel).
 */
export function resolvePsyCastAttr(actor, sys) {
  let key = sys.testChar || "wp";
  if (sys.discipline === "divination" && (key === "per" || !sys.testChar)) key = "psyniscience";
  if (key === "psyniscience") {
    return { key, val: actor.system.skills?.psyniscience?.total ?? -20, abbr: "Псинаука" };
  }
  if (key === "cor") {
    // Психотест на Порчу (колдовство/демонология): бросок против значения Порчи.
    return { key, val: actor.system.corruption?.value ?? 0, abbr: "Порча" };
  }
  return {
    key,
    val:  actor.system.characteristics?.[key]?.total ?? 0,
    abbr: CHARACTERISTICS[key]?.abbr ?? key.toUpperCase()
  };
}

/**
 * Саркофаг Дредноута (стр. 57): «не может манифестировать и поддерживать
 * психосилы», пока на его Дредноуте не стоит Матрица Осирис (стр. 58) —
 * она снимает запрет ценой −3 к тПР пилота (сам штраф — эффект предмета,
 * не этой возможности, здесь не считается).
 */
export function sarcophagusBlocksPsychicPowers(actor) {
  if (!hasRuleFlag(actor, "sarcophagus.noPsychicPowers")) return false;
  const dread = dreadnoughtOf(actor?.uuid, game.actors ?? []);
  return !hasOsirisMatrix(dread?.items ?? []);
}

/**
 * Метка Бога, которой не хватает для этой психосилы (wdbc-k1q4), — или null.
 *
 * Книга держит Метку отдельным гейтом от Покровительства и проверяет её НЕ
 * ТОЛЬКО при изучении: «Если псайкер теряет Метку, он также лишается
 * возможности использовать психосилы, требующие её, но не забывает их и может
 * в будущем вернуть к ним доступ, если получит Метку обратно» (корбук,
 * «V. ПСАЙКАНА → МЕХАНИКА»). Поэтому проверка стоит на манифестации, а не
 * только на карточке: пороги PR и Характеристик так себя не ведут.
 */
export function missingMarkForPower(actor, item) {
  for (const key of requiredMarks(item?.system?.requirement)) {
    if (!hasRuleFlag(actor, `mark.${key}`)) return { key, label: MARK_LABELS[key] || key };
  }
  return null;
}

/**
 * Изучение Руны конкретной психосилы (wdbc-exjp, Sigillite Magic, стр. 101-102):
 * «Псайкер получает возможность изучить Руну любой психосилы, кроме
 * Божественных и Либрариума, за 50 опыта… Чтобы изучить руну псайкер должен
 * иметь минимально требуемый бPR, указанный в требованиях психосилы».
 *
 * Тот же приём, что и покупка Элитного архетипа (apps/elite-buy.mjs): цена
 * пишется на САМ предмет (item.system.runeLearnCost — суммируется в
 * system.experience.spentPsy автоматически, rules/character.mjs), а не
 * списывается напрямую с experience.current. Нехватка опыта/бPR — вопрос
 * ГМу («в долг» бывает за столом), а не жёсткий запрет; запрещённая
 * дисциплина без «Прометеева Огня» — жёсткий запрет книги, кнопка вовсе не
 * должна была вызваться (sheet-helpers.mjs её не показывает), но проверка
 * дублируется здесь на случай прямого вызова.
 */
export async function learnSigilliteRune(actor, item) {
  if (!hasRuneMagic(actor) || isRuneLearned(item)) return;
  const info = runeLearnInfo(actor, item);
  if (!info.allowed) {
    ui.notifications.warn(
      `«${item.name}»: Руну Божественной психосилы/Либрариума нельзя изучить без Таланта ` +
      "«Prometheus Fire / Прометеев Огонь».");
    return;
  }
  if (info.prBlocked) {
    const ok = await Dialog.confirm({
      title: `${item.name}: не хватает бPR`,
      content: `<p>Книга требует минимум бPR <b>${item.system.prRequired}</b> для изучения этой Руны, ` +
        `у персонажа бPR <b>${actor.system.psyker?.rating || 0}</b>. Изучить всё равно?</p>`
    });
    if (!ok) return;
  }
  const exp = actor.system.experience ?? {};
  const current = Number(exp.current) || 0;
  if (info.cost > current) {
    const ok = await Dialog.confirm({
      title: `${item.name}: не хватает опыта`,
      content: `<p>Руна стоит <b>${info.cost}</b>${info.forbidden ? " (в т.ч. +50 за «Прометеев Огонь»)" : ""}, ` +
        `свободно <b>${current}</b>. Изучить всё равно?</p>`
    });
    if (!ok) return;
  }
  await item.update({ "system.runeLearned": true, "system.runeLearnCost": info.cost });
  // Журнал опыта (apps/xp-log.mjs) — та же запись, что у Элитного архетипа
  // (apps/elite-buy.mjs): сумма не влияет на experience.current напрямую (её
  // считает автосумма spentPsy выше), это только читаемая история трат.
  const log = Array.isArray(exp.log) ? foundry.utils.deepClone(exp.log) : [];
  log.push({ at: Date.now(), amount: -info.cost, kind: "spend",
             reason: `Руна Сигиллитов «${item.name}»${info.forbidden ? " (Прометеев Огонь)" : ""}` });
  await actor.update({ "system.experience.log": log });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><b>Руна изучена:</b> ${esc(item.name)} — потрачено <b>${info.cost}</b> опыта.</p>`
  });
}

/**
 * @param {object} [extraOpts]  доливается в opts executePsychotest — напр.
 *   onResult({success, deg, ePR}) у Огня Души (module/combat/soulfire.mjs).
 */
export function showManifestDialog(actor, item, extraOpts = {}) {
  // Варп-Замок (rules/warp-lock.mjs): до начала следующего Хода персонаж не псайкер и манифестировать не может.
  if (warpLockBlocksManifest(actor)) {
    ui.notifications.warn(`«${item.name}»: Варп-Замок — до начала следующего Хода вы не псайкер и не можете манифестировать психосилы.`);
    return;
  }
  // Пустота Парии (rules/null-zones.mjs): психосилы в ауре развеиваются —
  // кроме Непрямых. Отказ до окна манифестации, фокус не бросается.
  if (voidBlocksPower(actor, item)) {
    ui.notifications.warn(`«${item.name}»: в Пустоте Парии психосилы развеиваются (кроме Непрямых).`);
    return;
  }
  if (sarcophagusBlocksPsychicPowers(actor)) {
    ui.notifications.warn("Саркофаг Дредноута: манифестация психосил заблокирована (нужна Матрица Осирис).");
    return;
  }
  const noMark = missingMarkForPower(actor, item);
  if (noMark) {
    ui.notifications.warn(
      `«${item.name}» требует Метку ${noMark.label}. Без Метки психосила не манифестируется — ` +
      "она не забыта, доступ вернётся вместе с Меткой (корбук, Псайкана).");
    return;
  }
  // Высшее Колдовство — книжный запрет манифестации для не-Хаоситов
  // (rules/perfect-sorcerer.mjs). По Покровительству здесь НЕ отказываем:
  // книга сохраняет право применять за тем, кто выучил силу раньше, чем
  // обрёл Покровителя.
  if (highSorceryManifestBlocked(actor, item.system?.discipline)) {
    ui.notifications.warn(
      `«${item.name}»: психосилы Высшего Колдовства манифестируют только псайкеры-хаоситы ` +
      "(корбук, запись дисциплины).");
    return;
  }
  // Мононить «Поцелуй Мимика» (Volunteer Actor/Доброволец Актёр, wdbc-ux8a):
  // за доп. 10 сек/1м мононити персонаж лишается возможности манифестировать
  // психосилы/техночудеса — тот же гейт-приём, что Высшее Колдовство выше.
  if (actor.system.conditions?.mimicWireBlocksPowers) {
    ui.notifications.warn(`«${item.name}»: мононить блокирует манифестацию психосил.`);
    return;
  }
  // Parasite/Паразит (Трейт — общий, wdbc-ux8a): хост под полным контролем
  // паразита «не может использовать психосилы» — тот же гейт-приём.
  if (isPossessedByParasite(actor)) {
    ui.notifications.warn(`«${item.name}»: тело под контролем паразита — собственные психосилы недоступны.`);
    return;
  }
  // Ментальное действие (стр. 12, wdbc-x1nz.2.32): «не может быть проведено,
  // когда разум расфокусирован (пьян/галлюцинирует/в Ярости)» — тот же
  // гейт-приём, что у мононити/Паразита выше.
  if (isMentalActionBlocked(actor)) {
    ui.notifications.warn(`«${item.name}»: разум расфокусирован (Ярость/Галлюцинации/Опьянение) — манифестация недоступна (стр. 12).`);
    return;
  }
  const sys      = item.system;
  const psy      = actor.system.psyker || {};
  const isEldar  = hasRuleFlag(actor, "psyker.ancientMastery");
  // Аэльдари всегда используют Природу «Древнее Мастерство» — флаг из данных
  // расы (module/rules/library/aeldari.mjs), не сравнение имени расы.
  const nature   = isEldar ? "ancientMastery" : (psy.class || "bound");
  // Манифест. PR (mPR) — свободный выбор от 1 до текущего Пси-Рейтинга (тPR),
  // стр. 289: тPR = бPR −1 за каждую поддерживаемую силу, а эPR можно снижать
  // «на любое значение до минимума в 1». `prRequired` — требование ИЗУЧЕНИЯ
  // силы («кроме требований»), а не нижняя граница манифестации, поэтому
  // список не должен им ограничиваться.
  // Потолок mPR: тPR, а у Необременённого (на свою силу) и при действующем
  // Психическом Возрождении — бPR (rules/psyker-talents.mjs::manifestPrCeiling).
  // Возрождение, ещё не включённое, добавляет верхние пункты за Очко Бесчестия.
  const ceiling  = manifestPrCeiling(actor, item);
  const maxPR    = ceiling.max;
  const minPR    = 1;
  const cast     = resolvePsyCastAttr(actor, sys);
  const charAbbr = cast.abbr;
  const charVal  = cast.val;

  let prOptions = "";
  const top = Math.max(1, maxPR);
  const listTop = ceiling.canResurge ? Math.max(top, Number(psy.rating) || 0) : top;
  for (let p = minPR; p <= listTop; p++)
    prOptions += `<option value="${p}" ${p === top ? "selected" : ""}>${p}${(ceiling.canResurge && p > maxPR) ? " — Психическое Возрождение (−1 ОБ)" : ""}</option>`;
  // тPR 0 — новые силы манифестировать нельзя (стр. 289) — кроме Возрождения.
  const prWarn = maxPR <= 0 && !ceiling.canResurge
    ? `<div class="pm-warn">тPR = 0 (все ${psy.sustain || 0} PR уходят на поддержание) — новые психосилы манифестировать нельзя.</div>`
    : (ceiling.ignored === "unburdened"
      ? `<div class="pm-note">Необременённый: поддержание (${psy.sustain || 0}) не снижает тPR для «${esc(item.name)}» — доступен весь бPR ${ceiling.max}.</div>`
      : ceiling.ignored === "resurgence"
      ? `<div class="pm-note">Психическое Возрождение действует до начала следующего Хода — поддержание не снижает тPR (бPR ${ceiling.max}).</div>`
      : (psy.sustain ? `<div class="pm-note">тPR ${maxPR} = бPR ${psy.rating || 0} − ${psy.sustain} на поддержание.${ceiling.canResurge ? " Выше тPR — только Психическим Возрождением (−1 Очко Бесчестия, до начала следующего Хода)." : ""}</div>` : ""));

  // Путь с полем `flag` (Руны Сигиллитов, wdbc-fsl9) виден только тому, кому
  // возможность реально выдана. Все прочие Пути поля не несут, поэтому у
  // псайкера без Черты список остаётся ровно прежним.
  const pathOptions = Object.entries(PSY_PATHS)
    .filter(([, p]) => !p.flag || hasRuleFlag(actor, p.flag))
    .map(([k, p]) =>
      `<option value="${k}"${p.req ? ` title="${esc(p.req)}"` : ""}>${p.label}${p.req ? " *" : ""}</option>`).join("");

  // ── Руны Сигиллитов ───────────────────────────────────────────────────────
  // Весь блок живёт под одним гейтом: нет Черты — нет ни строки в окне, ни
  // единого лишнего символа в разметке диалога.
  const runeMagic  = hasRuneMagic(actor);
  // wdbc-p2it: цена ниже уже со скидкой Заготовленной Руны, если она сейчас
  // применима к ЭТОЙ психосиле (выбрана на бой и первая манифестация ещё не
  // потрачена) — actor передан вторым аргументом, без него (как во всех
  // прочих вызовах системы) скидка не считалась бы вовсе.
  const runeBase   = runeMagic ? runeCostForPower(item, actor) : 0;
  const runeHave   = runeMagic ? runeValue(actor) : 0;
  const runeCap    = runeMagic ? runeMax(actor) : 0;
  const strikeMax  = runeMagic ? runeStrikeMax(actor, item) : 0;
  const preparedDiscount = runeMagic ? preparedRuneDiscount(actor, item) : 0;
  // wdbc-exjp: манифестация через ЭТОТ Путь ограничена изученными Рунами —
  // Импровизированная Руна снимает ограничение ценой урона, показанной ниже
  // заранее (реальное списание — только если игрок правда выберет этот Путь
  // и нажмёт «Психотест!», см. коллбэк кнопки).
  const runeLearned    = runeMagic ? isRuneLearned(item) : true;
  const canImprovise   = runeMagic ? hasImprovisedRune(actor) : false;
  const runeBlock  = !runeMagic ? "" : `
        <div class="pm-row">
          <label title="бPR психосилы × 2 (стр. 101-102)">Руны</label>
          <div class="pm-input pm-wide" style="border:none;background:none;">
            цена <b id="pm-rune-cost">${runeBase}</b> · есть <b>${runeHave}</b> из <b>${runeCap}</b>
          </div>
        </div>
        ${preparedDiscount > 0
          ? `<div class="pm-note">Заготовленная Руна: −${preparedDiscount} уже учтено в цене (первая манифестация «${esc(item.name)}» в этом бою).</div>` : ""}
        ${strikeMax > 0 ? `
        <div class="pm-row">
          <label title="Талант «Рунный Удар»: 4 Руны за +1 эPR, можно повторять">Рунный Удар</label>
          <select id="psy-rune-strike" class="pm-input">
            ${Array.from({ length: strikeMax + 1 }, (_, i) =>
              `<option value="${i}">${i ? `+${i} эPR (${i * RUNE_STRIKE_COST} Рун)` : "— нет —"}</option>`).join("")}
          </select>
        </div>` : `<input type="hidden" id="psy-rune-strike" value="0"/>`}
        ${runeHave < runeBase
          ? `<div class="pm-warn">Рун не хватает: нужно ${runeBase}, есть ${runeHave}.</div>` : ""}
        ${!runeLearned ? (canImprovise
          ? `<div class="pm-warn">Руна «${esc(item.name)}» не изучена — через этот Путь сработает только Импровизированной Руной: −1 непогл. Рана, −1 к Мод. S/A/W.</div>`
          : `<div class="pm-warn">Руна «${esc(item.name)}» не изучена — через этот Путь манифестировать нельзя. Изучите Руну (кнопка в таблице Психосил) или возьмите Талант «Improvised Rune / Импровизированная Руна».</div>`) : ""}
        <div class="pm-row pm-sigillite-subs" id="pm-sigillite-subs" style="display:none;">
          <label title="Книга (стр. 101-102): «может использовать механику всех следующих путей одновременно, псайкер может определять желаемые» — отметьте любую комбинацию, а не один Путь">Механики Пути</label>
          <div class="pm-input pm-wide" style="border:none;background:none;display:flex;flex-direction:column;align-items:flex-start;gap:2px;">
            <label style="display:flex;gap:4px;align-items:center;"><input type="checkbox" id="psy-sub-incantation"/> Инкантация (+1 эPR, +20 Феномен, действие→полное)</label>
            <label style="display:flex;gap:4px;align-items:center;"><input type="checkbox" id="psy-sub-meditation"/> Медитация (+3 эPR, концентрация)</label>
            <label style="display:flex;gap:4px;align-items:center;"><input type="checkbox" id="psy-sub-unholy"/> Нечестивые Символы (−20 Феномен)</label>
          </div>
        </div>`;

  const profiles = sys.profiles || [];
  const variants = sys.variants || [];

  // Данные для живого предпросмотра порога/Феномена (клиентская сторона).
  const NATx = PSY_NATURES[nature] || PSY_NATURES.bound;
  const natData = {
    normalPhenMod: NATx.normalPhenMod || 0,
    pushBonusType: NATx.pushBonusType || "fixed",
    pushBonus:     NATx.pushBonus || 0,
    pushFormula:   NATx.pushFormula || "",
    pushPhenType:  NATx.pushPhenType || "flat",
    pushPhenValue: NATx.pushPhenValue || 0
  };
  const pathData = Object.fromEntries(Object.entries(PSY_PATHS).map(([k, p]) => [k, {
    ePR: p.ePR || 0, testMod: p.testMod || 0, phenMod: p.phenMod || 0, dyn: p.dynamicTestMod || "",
    runeCost: !!p.runeCost, subPaths: p.subPaths || null
  }]));
  const dynBonus = { t: actor.system.characteristics?.t?.bonus ?? 0,
                     wp: actor.system.characteristics?.wp?.bonus ?? 0 };
  const powerMod = Number(sys.testMod) || 0;
  const variantMods = variants.map(v => Number(v.testMod) || 0);
  // Штрафы состояния тела — из конвейера (wdbc-kuun): область "power", как и
  // у прочих правил манифестации. Раньше считалась одна Усталость, а
  // выключенная броня и Перевес в психотест не доезжали.
  //
  // Именно autoMods, а НЕ collectTestMods: галочки правил у психотеста уже
  // есть свои (ruleRollModsHtml ниже) и приезжают отдельным числом из
  // диалога — общий сбор сложил бы их второй раз.
  const fatigue = autoModsTotal(resolveTest({ actor, kind: "power", power: item, char: cast.key }).autoMods);
  // Сдержанность (Безопасный) и Дитя Варпа (Усиленный) — Таланты, меняющие эПР;
  // тот же расчёт, что в executePsychotest (rules/psyker.mjs), иначе окно и
  // бросок разошлись бы в числе.
  const eprTalents = manifestEprFlags(actor);
  // Таланты, меняющие манифестацию (rules/psyker-talents.mjs, Sahara 3-28): Фокус
  // Техники на ЭТУ силу, Психическая Злоба по Ненавистной цели, Варповый Шёпот,
  // Проводник Варпа. Строки окна — только у тех, у кого Талант есть.
  const techFocus = techniqueFocusFor(actor, item);
  const targetActors = [...(game.user?.targets ?? [])].map(t => t.actor ?? null);
  const spiteOk = psychicSpiteApplies(actor, targetActors);
  const whisper = hasWarpWhisper(actor);
  const conduit = hasWarpConduit(actor);
  // Быстрое Плетение (пачка I1): отдельный пул 2 ОД — строка окна есть только у носителя Таланта.
  const fwGate = hasFastWeaving(actor) ? fastWeavingGateNow(actor, item) : null;
  const psyMeta = { charVal, charAbbr, powerMod, natData, pathData, dynBonus, variantMods, isEldar, fatigue,
                    runeBase, techFocus, ...eprTalents };
  const talentRows = [
    techFocus ? `<div class="pm-note">Фокус Техники: +${TECHNIQUE_FOCUS_TEST_BONUS} к психотесту этой силы, ${TECHNIQUE_FOCUS_PHEN_MOD} к её Феноменам — учтено.</div>`
      : (hasTechniqueFocus(actor) ? `<div class="pm-note" style="opacity:.75;">Фокус Техники: выбранная сила записана в поле «Специализация» Таланта; для «${esc(item.name)}» не выбрана.</div>` : ""),
    spiteOk ? `
        <div class="pm-row">
          <label title="Психическая Злоба: на Ненавистном враге +${PSYCHIC_SPITE_BONUS} к эPR — в расчёте психотеста, или дальности, или Dmg и Pen (выбрать до психотеста)">Злоба (+${PSYCHIC_SPITE_BONUS} эPR)</label>
          <select id="psy-spite" class="pm-input pm-wide">
            <option value="">— нет —</option>
            <option value="test">в психотесте</option>
            <option value="range">в дальности</option>
            <option value="damage">в Dmg и Pen</option>
          </select>
        </div>`
      : (hasPsychicSpite(actor) ? `<div class="pm-note" style="opacity:.75;">Психическая Злоба: наведите таргет (T) на Ненавистного врага — появится выбор +${PSYCHIC_SPITE_BONUS} эPR.</div>` : ""),
    whisper ? `
        <div class="pm-row">
          <label title="Варповый Шёпот: уменьшить эPR на X, чтобы наложить −10×X на тесты Пси-Чутья для засекания силы">Шёпот (−эPR)</label>
          <select id="psy-whisper" class="pm-input">
            ${Array.from({ length: Math.max(1, Math.max(maxPR, Number(psy.rating) || 0)) }, (_, i) =>
              `<option value="${i}">${i ? `−${i} эPR → засекание ${warpWhisperPenalty(i)}` : "— нет —"}</option>`).join("")}
          </select>
        </div>`
      : "",
    (hasPsychicPrecision(actor) && isPsychicShooting(sys)) ? `
        <div class="pm-row">
          <label title="Психическая Точность: стрелковая сила — уменьшить эPR на ${PRECISION_COST.part}, чтобы выбрать часть тела попадания, или на ${PRECISION_COST.fine} — для сочленений/глаз">Точность</label>
          <select id="psy-precision" class="pm-input">
            <option value="">— нет —</option>
            <option value="part">часть тела (−${PRECISION_COST.part} эPR)</option>
            <option value="fine">сочленение/глаза (−${PRECISION_COST.fine} эPR)</option>
          </select>
          <select id="psy-precision-loc" class="pm-input">
            ${HIT_LOCATIONS.map(l => `<option value="${esc(l.label)}"${l.label === "Голова" ? " selected" : ""}>${esc(l.label)}</option>`).join("")}
          </select>
        </div>`
      : "",
    (fwGate && fwGate.ok) ? `
        <div class="pm-row">
          <label title="Быстрое Плетение: отдельный пул 2 ОД, выданный в начале боя после инициативы. Только на психосилы без типа «Атака»; с началом своего Хода сбрасывается, Врасплох обнуляет">
            <input type="checkbox" id="psy-fastweave" checked/> Быстрое Плетение: −${fwGate.cover} ОД из пула (в пуле ${fwGate.left}) — на столько меньше спишутся обычные ОД</label>
        </div>`
      : ((fwGate && !["no-talent", "empty"].includes(fwGate.code)) ? `<div class="pm-note" style="opacity:.75;">${esc(fwGate.reason)}</div>` : ""),
    (hasWoundInReality(actor) && sys.sustainable) ? (() => {
      const g = woundFreeToggleGate(actor, item, { assumeSustained: true });
      return g.ok ? `
        <div class="pm-row">
          <label title="Рана в Реальности: сила, поддерживаемая бесплатно, не снижает тPR (до Cor.b сил). Все в Cor.b×2 м, включая вас, получают −5 Пси-чутьё, +10 Феномены, +10 Варп-Нестабильность за каждую такую силу; Завеса в ауре +1 за каждые три">
            <input type="checkbox" id="psy-woundfree"/> Рана в Реальности: поддерживать бесплатно (если манифестация удастся)</label>
        </div>`
        : `<input type="hidden" id="psy-woundfree" value=""/><div class="pm-note" style="opacity:.75;">${esc(g.reason)}</div>`;
    })() : "",
    (() => { const plan = manifestActionPlan(actor, item);
      if (plan.kind === "ap") return `<div class="pm-note">Действие силы (${PSY_ACTIONS[sys.action] ?? "Полудействие"}) в бою стоит ${plan.cost} ОД (есть ${Number(actor.system.actionPoints?.value) || 0}).</div>`;
      if (plan.kind === "reaction") return `<div class="pm-note">Действие силы — Реакция: в бою стоит 1 Реакцию (есть ${Number(actor.system.reactions?.value) || 0}).</div>`;
      return ""; })(),
    isSignaturePower(actor, item) ? `<div class="pm-note">Ключевая Сила: раз в Раунд на карточке этой манифестации Очко Бесчестия бесплатно — для психотеста, Феномена и Прорыва.</div>` : "",
    conduit ? `
        <div class="pm-row">
          <label title="Проводник Варпа: в Усиленном режиме за Очко Бесчестия +${WARP_CONDUIT_FORMULA} к эPR эффектов (не психотеста); +${WARP_CONDUIT_PHEN_MOD} к броску Феномена">
            <input type="checkbox" id="psy-conduit"/> Проводник Варпа: −1 ОБ, +${WARP_CONDUIT_FORMULA} эPR эффектов, +${WARP_CONDUIT_PHEN_MOD} Феномен (только Усиленный)</label>
        </div>`
      : ""
  ].join("");
  Object.assign(psyMeta, { spiteBonus: PSYCHIC_SPITE_BONUS, conduitFormula: WARP_CONDUIT_FORMULA });

  // Правила реестра. Манифестация — такой же тест конвейера, как бросок навыка
  // и атака: вид теста «power», область эффекта «power» или «power:<имя>». Сама
  // сила лежит в контексте целиком — по ней область и находит нужную
  // (rules/resolve-test.mjs).
  const ruleMods = ruleRollModsHtml(actor, {
    kind: "power", power: item, char: cast.key,
    skill: cast.key === "psyniscience" ? "psyniscience" : undefined,
    targetActor: [...(game.user?.targets ?? [])][0]?.actor ?? null
  });

  const discLabel = (PSY_DISCIPLINES?.[sys.discipline]?.label) || "";
  const typeLabel = (PSY_POWER_TYPES?.[sys.powerType]) || sys.powerType || "";
  const dmgLabel  = sys.damage ? ` · урон ${sys.damage}` : "";

  const content = `
      <form class="wh-psy-manifest">
        <div class="pm-header">
          <span class="pm-sigil">✨</span>
          <div class="pm-titles">
            <div class="pm-name">${esc(item.name)}</div>
            <div class="pm-sub">${[discLabel, typeLabel].filter(Boolean).join(" · ")}${dmgLabel}</div>
          </div>
          <span class="pm-nature" title="Природа Дара">${NATx.label || nature}</span>
        </div>

        <div class="pm-preview">
          <div class="pm-prev-thr-wrap">
            <div class="pm-prev-lbl">Порог психотеста (${charAbbr})</div>
            <div class="pm-prev-thr" id="pm-thr">—</div>
          </div>
          <div class="pm-prev-meta">
            <div class="pm-prev-chip">эPR <b id="pm-epr">—</b></div>
            <div class="pm-prev-chip pm-prev-phen" id="pm-phen">—</div>
          </div>
        </div>

        <div class="pm-modes" role="group" aria-label="Режим">
          <button type="button" class="pm-mode" data-mode="safe" title="эPR = ½ mPR (▲). Феномены не вызываются.">Безопасный</button>
          <button type="button" class="pm-mode is-on" data-mode="normal" title="эPR = mPR. Феномен при дубле на успехе или 99.">Обычный</button>
          <button type="button" class="pm-mode" data-mode="push" title="эPR = mPR + бонус Природы. Феномен гарантирован.">Усиленный</button>
        </div>
        <input type="hidden" id="psy-mode" value="normal"/>

        <div class="pm-row">
          <label>Манифест. PR</label>
          <select id="psy-pr" class="pm-input">${prOptions}</select>
          ${isEldar ? `
          <label class="pm-push-lbl">Усиление</label>
          <select id="psy-push-bonus" class="pm-input">
            <option value="1">+1</option><option value="2">+2</option>
            <option value="3">+3</option><option value="4">+4</option>
          </select>` : ""}
        </div>
        ${prWarn}

        <div class="pm-row">
          <label>Путь Силы</label>
          <select id="psy-path" class="pm-input pm-wide">${pathOptions}</select>
        </div>
        <div class="pm-note" style="font-size:0.78em;">* — путь требует условия (наведите курсор на пункт списка); выбор не проверяется автоматически — сверьтесь сами.</div>
        ${runeBlock}
        ${profiles.length ? `
        <div class="pm-row">
          <label>Профиль</label>
          <select id="psy-profile" class="pm-input pm-wide">
            <option value="-1">Основной</option>
            ${profiles.map((p, i) => `<option value="${i}">${p.label || ("Профиль " + (i + 1))}</option>`).join("")}
          </select>
        </div>` : `<input type="hidden" id="psy-profile" value="-1"/>`}
        ${variants.length ? `
        <div class="pm-row">
          <label>Вариация</label>
          <select id="psy-variant" class="pm-input pm-wide">
            <option value="-1">— нет —</option>
            ${variants.map((v, i) => `<option value="${i}">${v.label || ("Вариация " + (i + 1))}${v.testMod ? ` (${v.testMod >= 0 ? "+" : ""}${v.testMod})` : ""}</option>`).join("")}
          </select>
        </div>` : `<input type="hidden" id="psy-variant" value="-1"/>`}
        ${talentRows}

        <details class="pm-adv">
          <summary>Дополнительно</summary>
          <div class="pm-row">
            <label>Мод. PR (±)</label>
            <input id="psy-pr-mod" class="pm-input pm-num" type="number" value="0" title="Таланты/ситуации: каст по PR±N"/>
            <label>Доп. мод. теста</label>
            <input id="psy-mod" class="pm-input pm-num" type="number" value="0"/>
          </div>
          <div class="pm-row">
            <label>эPR урона</label>
            <input id="psy-pr-dmg" class="pm-input pm-num" type="number" value="0" min="0" title="0 = полный эPR. Можно снизить эPR только для урона (мин. 1)"/>
            <label>эPR дальности</label>
            <input id="psy-pr-range" class="pm-input pm-num" type="number" value="0" min="0" title="0 = полный эPR. Можно снизить эPR только для дальности (мин. 1)"/>
          </div>
        </details>
        ${ruleMods.html}
      </form>`;

  new Dialog({
    title: `Манифестация: ${item.name}`,
    content,
    buttons: {
      cast: {
        icon: '<i class="fas fa-hat-wizard"></i>', label: "Психотест!",
        callback: async html => {
          // Галочки правил — тот же формат и тот же разбор, что в диалоге атаки.
          let ruleMod = 0, halveRulePenalty = false;
          html.find(".rule-mod:checked").each((_, cb) => {
            ruleMod += parseInt(cb.dataset.value) || 0;
            if (cb.dataset.halve === "1") halveRulePenalty = true;
          });
          // Руны Сигиллитов: цена считается и проверяется ДО броска — иначе
          // манифестация состоялась бы в долг. Проверка стоит только у
          // носителя Черты: у всех прочих `runeMagic` ложно и ветка не
          // выполняется вовсе.
          const path = html.find("#psy-path").val() || "";
          const runeStrike = parseInt(html.find("#psy-rune-strike").val()) || 0;
          // wdbc-qd6w: у Пути «Руны Сигиллитов» книга разрешает СКЛАДЫВАТЬ
          // Инкантацию/Медитацию/Нечестивые Символы любой комбинацией — это
          // единственный Путь реестра с полем `subPaths` (constants/
          // psyker.mjs), поэтому у всех прочих Путей список пуст и флажки
          // просто не читаются.
          const pathSubKeys = PSY_PATHS[path]?.subPaths || [];
          const sigilliteSubs = pathSubKeys.filter(key => html.find(`#psy-sub-${key}`).is(":checked"));
          // wdbc-exjp: без изученной Руны этот Путь манифестирует ТОЛЬКО через
          // Improvised Rune — без Таланта манифестация здесь обязана остаться
          // невозможной, а не молча пройти как раньше (до этого тикета список
          // изученных Рун не существовал вовсе, и Путь пускал любую силу).
          const needsImprovise = runeMagic && PSY_PATHS[path]?.runeCost && !isRuneLearned(item);
          if (needsImprovise && !hasImprovisedRune(actor)) {
            ui.notifications.warn(
              `Руна «${item.name}» не изучена — манифестировать через Путь «Руны Сигиллитов» ` +
              "нельзя без Таланта «Improvised Rune / Импровизированная Руна». Изучите Руну за опыт " +
              "(кнопка в таблице Психосил) либо возьмите Талант.");
            return;
          }
          if (runeMagic && PSY_PATHS[path]?.runeCost) {
            const need = runeCostTotal(item, runeStrike, actor);
            const have = runeValue(actor);
            if (have < need) {
              ui.notifications.warn(
                `Рун не хватает: манифестация «${item.name}» стоит ${need} ` +
                `(бPR психосилы × 2${runeStrike ? ` + ${runeStrike * RUNE_STRIKE_COST} за Рунный Удар` : ""}), ` +
                `а у персонажа ${have}.`);
              return;
            }
          }
          await executePsychotest(actor, item, {
            ...extraOpts,
            ruleMod, halveRulePenalty, runeStrike, improvisedRune: needsImprovise, sigilliteSubs,
            mPR:      parseInt(html.find("#psy-pr").val())     || minPR,
            prMod:    parseInt(html.find("#psy-pr-mod").val()) || 0,
            mode:     html.find("#psy-mode").val()             || "normal",
            path,
            modifier: parseInt(html.find("#psy-mod").val())    || 0,
            eldar:    isEldar,
            pushChoice: parseInt(html.find("#psy-push-bonus").val()) || 1,
            damagePR: parseInt(html.find("#psy-pr-dmg").val())   || 0,
            rangePR:  parseInt(html.find("#psy-pr-range").val()) || 0,
            profileIdx: parseInt(html.find("#psy-profile").val()) ?? -1,
            variantIdx: parseInt(html.find("#psy-variant").val()) ?? -1,
            spite:   html.find("#psy-spite").val() || "",
            whisper: parseInt(html.find("#psy-whisper").val()) || 0,
            precision: html.find("#psy-precision").val() || "",
            precisionLoc: html.find("#psy-precision-loc").val() || "",
            conduit: html.find("#psy-conduit").is(":checked"),
            fastWeaving: html.find("#psy-fastweave").is(":checked"),
            woundFree: html.find("#psy-woundfree").is(":checked")
          });
        }
      },
      cancel: { label: "Отмена" }
    },
    default: "cast",
    render: html => wirePsyManifestPreview(html, psyMeta)
  }, { classes: ["dialog", "wh-attack-dialog", "warhammer-dbc", "wh-holo", "wh-psy-dialog"], width: 400 }).render(true);
}

// Живой предпросмотр окна манифестации: пилюли режима + пересчёт порога/эPR/Феномена.
export function wirePsyManifestPreview(html, m) {
  const el = html[0] ?? html;
  const $ = (sel) => el.querySelector(sel);
  const modeInput = $("#psy-mode");

  const recalc = () => {
    const mode  = modeInput.value || "normal";
    const mPR0  = parseInt($("#psy-pr")?.value) || 0;
    const prMod = parseInt($("#psy-pr-mod")?.value) || 0;
    const mod   = parseInt($("#psy-mod")?.value) || 0;
    const path  = $("#psy-path")?.value || "";
    const varIdx = parseInt($("#psy-variant")?.value ?? "-1");
    const pMR = Math.max(0, mPR0 + prMod);

    let ePR = pMR, phenText = "", eprSuffix = "";
    if (mode === "safe") { ePR = safeModeEpr(pMR, { restraint: !!m.restraint }); phenText = "Феноменов нет"; }
    else if (mode === "normal") { ePR = pMR; phenText = m.isEldar ? "Феномен: дубль 66 / крит-провал" : "Феномен: дубль / 99"; }
    else {
      let pb = 0;
      if (m.natData.pushBonusType === "choice" || m.isEldar) pb = parseInt($("#psy-push-bonus")?.value) || 1;
      else if (m.natData.pushBonusType === "roll") { pb = 0; eprSuffix = `+${m.natData.pushFormula || "1d5"}`; }
      else pb = m.natData.pushBonus || 0;
      ePR = pMR + pb + (m.childOfWarp ? CHILD_OF_THE_WARP_PUSH_BONUS : 0);
      phenText = "Феномен гарантирован";
    }
    const pd = m.pathData[path] || { ePR: 0, testMod: 0, phenMod: 0, dyn: "" };
    // wdbc-qd6w: «Руны Сигиллитов» — единственный Путь, где книга разрешает
    // складывать несколько суб-механик (Инкантация/Медитация/Нечестивые
    // Символы) одновременно, а не выбирать одну вместо целого Пути. Блок
    // флажков скрыт для всех прочих Путей — у них `subPaths` нет вовсе.
    const subsEl = $("#pm-sigillite-subs");
    if (subsEl) subsEl.style.display = pd.subPaths ? "flex" : "none";
    let subEPR = 0, subTestMod = 0;
    if (pd.subPaths) {
      for (const key of pd.subPaths) {
        if ($(`#psy-sub-${key}`)?.checked) {
          const sp = m.pathData[key] || {};
          subEPR += sp.ePR || 0;
          subTestMod += sp.testMod || 0;
        }
      }
    }
    ePR += (pd.ePR || 0) + subEPR;
    // Рунный Удар (wdbc-fsl9): +1 эPR за каждые 4 Руны, и только когда Путь
    // действительно платит Рунами — переключился на Медитацию, и надбавка
    // исчезает вместе с ценой. Элементов нет ни у кого, кроме Сигиллита.
    const strike = parseInt($("#psy-rune-strike")?.value) || 0;
    if (pd.runeCost) ePR += strike;
    // Варповый Шёпот, Злоба, Проводник — тот же порядок и те же числа, что в
    // executePsychotest: Шёпот снимает эPR (не ниже 1), Злоба «в психотесте»
    // прибавляет только к эPR порога, Проводник — только к эPR эффектов.
    const whisperX = Math.max(0, parseInt($("#psy-whisper")?.value) || 0);
    if (whisperX > 0) ePR = Math.max(1, ePR - Math.min(whisperX, Math.max(0, ePR - 1)));
    ePR -= precisionCost($("#psy-precision")?.value, ePR);
    const spiteTest = ($("#psy-spite")?.value === "test") ? (m.spiteBonus || 0) : 0;
    const ePRTest = ePR + spiteTest;
    if (mode === "push" && $("#psy-conduit")?.checked) eprSuffix += `+${m.conduitFormula || "1d5"}`;
    const runeCostEl = $("#pm-rune-cost");
    if (runeCostEl)
      runeCostEl.textContent = pd.runeCost ? String((m.runeBase || 0) + strike * RUNE_STRIKE_COST) : "—";
    const pathTest = (pd.testMod || 0) + (pd.dyn ? (m.dynBonus[pd.dyn] || 0) : 0) + subTestMod;
    const varMod = (varIdx >= 0) ? (m.variantMods[varIdx] || 0) : 0;
    // Галочки правил считаем тем же кодом, что и сам бросок (executePsychotest),
    // иначе игрок увидит в окне одно число, а бросится другое.
    let ruleMod = 0, halveRule = false;
    el.querySelectorAll(".rule-mod:checked").forEach(cb => {
      ruleMod += parseInt(cb.dataset.value) || 0;
      if (cb.dataset.halve === "1") halveRule = true;
    });
    const thr = attackThreshold({
      base: m.charVal + 5 * ePRTest,
      mods: [mod, ruleMod, pathTest, m.powerMod, varMod, m.fatigue, m.techFocus ? TECHNIQUE_FOCUS_TEST_BONUS : 0],
      halvePenalty: halveRule
    });

    $("#pm-thr").textContent = thr;
    $("#pm-epr").textContent = `${ePR}${eprSuffix}${spiteTest ? ` (тест ${ePRTest})` : ""}`;
    const phenEl = $("#pm-phen");
    phenEl.textContent = phenText;
    phenEl.classList.toggle("danger", mode === "push");
    phenEl.classList.toggle("safe", mode === "safe");
  };

  // Пилюли режима.
  el.querySelectorAll(".pm-mode").forEach(b => b.addEventListener("click", () => {
    el.querySelectorAll(".pm-mode").forEach(x => x.classList.remove("is-on"));
    b.classList.add("is-on");
    modeInput.value = b.dataset.mode;
    // Поле «Усиление» актуально только в Усиленном режиме.
    const pushLbl = el.querySelector(".pm-push-lbl");
    const pushSel = $("#psy-push-bonus");
    if (pushLbl && pushSel) { const on = b.dataset.mode === "push"; pushLbl.style.opacity = pushSel.style.opacity = on ? "1" : "0.4"; }
    recalc();
  }));
  el.querySelectorAll("select, input").forEach(inp => {
    inp.addEventListener("change", recalc);
    inp.addEventListener("input", recalc);
  });

  // Раскрытие «Дополнительно» — растянуть окно диалога под новый контент,
  // иначе блок обрезается.
  const details = el.querySelector(".pm-adv");
  if (details) {
    const win = el.closest("[data-appid]");
    const app = win ? ui.windows?.[win.dataset.appid] : null;
    details.addEventListener("toggle", () => app?.setPosition?.({ height: "auto" }));
  }
  recalc();
}

export async function executePsychotest(actor, item, opts) {
  const sys      = item.system;
  const psy      = actor.system.psyker || {};
  const nature   = opts.eldar ? "ancientMastery" : (psy.class || "bound");
  const NAT      = PSY_NATURES[nature] || PSY_NATURES.bound;
  const PATH     = PSY_PATHS[opts.path] || PSY_PATHS[""];
  // Руны Судьбы/Битвы: манифестация только в Безопасном/Обычном режиме.
  let runeNote = "";
  if (PATH.runeMode && opts.mode === "push") {
    opts.mode = "normal";
    runeNote = "Руна: Усиленный режим недоступен — использован Обычный.";
  }
  const MODE     = PSY_MODES[opts.mode] || PSY_MODES.normal;
  // Цена действия силы в бою (пачка I3): ОД по полю действия самой силы, пул Быстрого Плетения только
  // уменьшает списание. Проверка — ДО любых трат (Очко Возрождения и т.п.): отказ ничего не стоит.
  // Переброс психотеста (Ключевые Силы) действие заново не оплачивает — оно уже оплачено первой попыткой.
  const actionPlan = opts.reroll ? null : manifestActionPlan(actor, item, { fastWeaving: !!opts.fastWeaving });
  if (actionPlan && !actionPlan.ok) {
    ui.notifications.warn(`⚠️ ${actor.name}: «${item.name}» — ${actionPlan.reason}`);
    return;
  }
  // Путь «Псайбер-Фамильяр» — если сейчас назначен носитель (rules/
  // psychic-vessel.mjs: Spirit Talk на время захвата, либо связанный
  // фамильяр), заметка называет его по имени вместо общей формулировки.
  const vessel   = PATH === PSY_PATHS.familiar ? getPsychicVessel(actor) : null;
  const cast     = resolvePsyCastAttr(actor, sys);
  const charVal  = cast.val;
  const charAbbr = cast.abbr;

  // ── Эффективный Пси-Рейтинг и модификатор к броску Феноменов ──────────────
  // Манифест. PR с учётом модификатора (таланты/ситуации: PR±N), мин. 0.
  const prMod = opts.prMod || 0;
  const mPR   = Math.max(0, (opts.mPR || 0) + prMod);
  // Психическое Возрождение (rules/psyker-talents.mjs): mPR выше потолка тPR —
  // только за Очко Бесчестия, метка живёт до начала следующего Хода. Нет Очка —
  // манифестации нет (spendCapabilityCost уже сказал об этом игроку).
  const prCeiling = manifestPrCeiling(actor, item);
  let resurgenceLine = "";
  if (prCeiling.canResurge && (opts.mPR || 0) > prCeiling.max) {
    const paid = opts.reroll || await spendCapabilityCost(actor, { pool: "infamy", amount: 1 }, "Психическое Возрождение");
    if (!paid) return;
    // Метка «до начала следующего Хода» гасится началом Хода В БОЮ; вне боя её
    // некому погасить, поэтому там Возрождение действует только на эту манифестацию.
    const inFight = isEncounterActive();
    if (inFight) await actor.setFlag("warhammer-dbc", RESURGENCE_FLAG, true);
    resurgenceLine = `<div class="roll-threshold" style="font-size:0.85em;">Психическое Возрождение: −1 Очко Бесчестия, ${inFight ? "поддержание не снижает тPR до начала следующего Хода" : "вне боя — поддержание не снижает тPR только для этой манифестации"}.</div>`;
  } else if (prCeiling.ignored === "unburdened" && (opts.mPR || 0) > prCeiling.normal) {
    resurgenceLine = `<div class="roll-threshold" style="font-size:0.85em;">Необременённый: поддержание не снижает тPR для этой силы (тPR ${prCeiling.normal} → бPR ${prCeiling.max}).</div>`;
  }
  let ePR = mPR;
  let pushBonus = 0;
  // Выпавшее в этой попытке (Психофокус, Проводник): кладётся во флаг карточки для переброса.
  let rolledFocus = null, rolledConduit = null;
  let phenMod = 0;
  const eprTalents = manifestEprFlags(actor);
  if (opts.mode === "safe") {
    ePR = safeModeEpr(mPR, { restraint: eprTalents.restraint });
  } else if (opts.mode === "normal") {
    ePR = mPR;
    phenMod = NAT.normalPhenMod;
  } else { // push (Усиленный)
    if (NAT.pushBonusType === "roll") {
      // Переброс психотеста берёт выпавшее Усиление первой попытки: «те же модификаторы».
      pushBonus = (opts.reroll && opts.rolled?.pushBonus != null)
        ? Number(opts.rolled.pushBonus)
        : (await new Roll(NAT.pushFormula).evaluate()).total;
    } else if (NAT.pushBonusType === "choice") {
      pushBonus = Math.max(1, Math.min(NAT.pushChoiceMax || 4, opts.pushChoice || 1));
    } else pushBonus = NAT.pushBonus;
    // Дитя Варпа: «+1 PR при Усиленной манифестации» — сверх Усиления природы.
    // К модификатору Феноменов не добавляется: он считается от самого Усиления
    // (pushBonus), а этот +1 — отдельная прибавка Таланта.
    ePR = mPR + pushBonus + (eprTalents.childOfWarp ? CHILD_OF_THE_WARP_PUSH_BONUS : 0);
    phenMod = NAT.pushPhenType === "flat"
      ? NAT.pushPhenValue
      : NAT.pushPhenValue * pushBonus;
  }

  // ── Бонусы Пути Силы ──────────────────────────────────────────────────────
  // wdbc-qd6w: «Руны Сигиллитов» разрешает складывать Инкантацию/Медитацию/
  // Нечестивые Символы любой отмеченной комбинацией (книга, стр. 101-102) —
  // единственный Путь реестра с `subPaths`; у всех прочих Путей subTotals
  // нулевой по построению (subPathTotals фильтрует по `PATH.subPaths`).
  const subTotals = subPathTotals(opts.path, opts.sigilliteSubs);
  ePR     += PATH.ePR || 0;
  phenMod += PATH.phenMod || 0;
  ePR     += subTotals.ePR;
  phenMod += subTotals.phenMod;
  // Рунный Удар (wdbc-fsl9): «потратить дополнительно четыре руны, добавив ей
  // +1 эPR в расчёте всех эффектов». Считается только на Пути, который Рунами
  // и платит: иначе эPR рос бы бесплатно.
  //
  // Зажим по `runeStrikeMax` здесь, а не только в окне манифестации: окно —
  // не единственный вход (HUD, макрос, старая точка вызова), и запрет,
  // живущий только в разметке, обходится молча. Максимум сам учитывает и
  // наличие Таланта, и остаток Рун после базовой цены.
  const runeStrike = (PATH.runeCost && hasRuneMagic(actor))
    ? Math.min(Math.max(0, Math.trunc(Number(opts.runeStrike) || 0)), runeStrikeMax(actor, item))
    : 0;
  ePR += runeStrike;

  // ── Таланты манифестации (rules/psyker-talents.mjs, Sahara 3-28) ───────────
  // Порядок тот же, что в wirePsyManifestPreview: Шёпот снимает эPR, Злоба
  // прибавляет к одному из аспектов, Проводник — к эPR эффектов, Фокус Техники —
  // к порогу и к Феноменам.
  const talentLines = [];
  const whisperAsked = hasWarpWhisper(actor) ? Math.max(0, Math.trunc(Number(opts.whisper) || 0)) : 0;
  const whisperX = Math.min(whisperAsked, Math.max(0, ePR - 1));
  if (whisperX > 0) {
    ePR -= whisperX;
    talentLines.push(`<div class="roll-threshold" style="font-size:0.85em;">Варповый Шёпот: эPR −${whisperX}; тесты Пси-Чутья на засекание этой силы <b>${warpWhisperPenalty(whisperX)}</b>${opts.mode === "safe" ? " (Безопасный режим: успешные тесты на засекание перебрасываются)" : ""}.</div>`);
  }
  // Психическая Точность: стрелковая сила, −2 эPR за часть тела, −4 за сочленения/глаза.
  const precisionKey = (hasPsychicPrecision(actor) && isPsychicShooting(sys)) ? String(opts.precision || "") : "";
  const precisionCut = precisionCost(precisionKey, ePR);
  let hitLoc = "Торс";
  if (precisionCut) {
    ePR -= precisionCut;
    hitLoc = HIT_LOCATIONS.find(l => l.label === opts.precisionLoc)?.label ?? "Торс";
    talentLines.push(`<div class="roll-threshold" style="font-size:0.85em;">Психическая Точность: эPR −${precisionCut}, попадание — <b>${esc(hitLoc)}</b>${precisionKey === "fine" ? " (сочленение/глаза)" : ""}.</div>`);
  } else if (precisionKey) {
    talentLines.push(`<div class="roll-threshold" style="font-size:0.85em;color:#a33;">Психическая Точность не применена: эPR не хватает (после снятия нужно не меньше 1).</div>`);
  }
  const spiteTargets = [...(game.user?.targets ?? [])].map(t => t.actor ?? null);
  const spiteChoice = psychicSpiteApplies(actor, spiteTargets) ? normalizeSpiteChoice(opts.spite) : "";
  if (spiteChoice) {
    const where = { test: "психотеста", range: "дальности", damage: "Dmg и Pen" }[spiteChoice];
    talentLines.push(`<div class="roll-threshold" style="font-size:0.85em;">Психическая Злоба (Ненавистная цель): +${PSYCHIC_SPITE_BONUS} к эPR ${where}.</div>`);
  } else if (opts.spite && hasPsychicSpite(actor)) {
    talentLines.push(`<div class="roll-threshold" style="font-size:0.85em;color:#a33;">Психическая Злоба не применена: цель не из Ненавистных.</div>`);
  }
  const eprTest = ePR + (spiteChoice === "test" ? PSYCHIC_SPITE_BONUS : 0);
  const conduitRolls = [];
  if (opts.conduit && hasWarpConduit(actor)) {
    if (opts.mode !== "push") {
      talentLines.push(`<div class="roll-threshold" style="font-size:0.85em;color:#a33;">Проводник Варпа работает только в Усиленном режиме — не применён.</div>`);
    } else if (opts.reroll || await spendCapabilityCost(actor, { pool: "infamy", amount: 1 }, "Проводник Варпа")) {
      let crTotal;
      if (opts.reroll && opts.rolled?.conduit != null) crTotal = Number(opts.rolled.conduit);
      else { const cr = await new Roll(WARP_CONDUIT_FORMULA).evaluate(); conduitRolls.push(cr); crTotal = cr.total; }
      rolledConduit = crTotal;
      ePR += crTotal;
      phenMod += WARP_CONDUIT_PHEN_MOD;
      talentLines.push(`<div class="roll-threshold" style="font-size:0.85em;">Проводник Варпа: −1 Очко Бесчестия, +${crTotal} к эPR эффектов (психотест не затронут), +${WARP_CONDUIT_PHEN_MOD} к броску Феномена.</div>`);
    }
  }
  const techFocus = techniqueFocusFor(actor, item);
  if (techFocus) {
    phenMod += TECHNIQUE_FOCUS_PHEN_MOD;
    talentLines.push(`<div class="roll-threshold" style="font-size:0.85em;">Фокус Техники: +${TECHNIQUE_FOCUS_TEST_BONUS} к психотесту, ${TECHNIQUE_FOCUS_PHEN_MOD} к Феноменам этой силы.</div>`);
  }
  // Аура Раны в Реальности (Талант Псайканы, пачка I2): «+10 на Феномены» за каждую бесплатную силу
  // любого псайкера, в чьём радиусе стоит манифестирующий (включая его самого). Метка ауры лежит на акторе.
  const woundPhen = woundAuraPhenMod(actor);
  if (woundPhen) {
    phenMod += woundPhen;
    talentLines.push(`<div class="roll-threshold" style="font-size:0.85em;color:#a33;">Рана в Реальности (аура): +${woundPhen} к броску Феномена.</div>`);
  }
  if (resurgenceLine) talentLines.push(resurgenceLine);
  const pathLabel = PATH.label || "";
  // Динамический бонус Пути от характеристики (Телесная Конверсия: +T.b)
  const pathDynMod = PATH.dynamicTestMod
    ? (actor.system.characteristics?.[PATH.dynamicTestMod]?.bonus ?? 0) : 0;

  // Психофокус: отдельный тест W+0 (свободное действие, 1/ход). Успех → +10,
  // крит. успех (дубль на успехе) → +15, крит. провал (дубль на провале) → −10.
  // Качество привязанного предмета-Психофокуса (rules/psy-focus.mjs): Good.Q
  // +5 к полученному бонусу на силах резонирующей Дисциплины, Best.Q ещё и
  // снимает штраф крит. провала. Не у всякого Пути с focusTest есть предмет
  // (Руны Сигиллитов «считаются Best.Q» без предмета — там эффект пустой).
  let focusMod = 0, focusNote = "", focusRoll = null, focusPassed = false;
  if (PATH.focusTest) {
    const wpv = actor.system.characteristics?.wp?.total ?? 0;
    const savedFocus = opts.reroll ? opts.rolled?.focusRoll : null;
    if (savedFocus == null) focusRoll = await new Roll("1d100").evaluate();
    const fv      = savedFocus ?? focusRoll.total;
    rolledFocus   = fv;
    const fPass   = fv <= wpv;
    focusPassed   = fPass;
    const fDouble = (fv % 11 === 0) || fv === 100;
    const fEffect = focusQualityEffect(actor, item);
    const fResult = focusRollResult({ pass: fPass, double: fDouble }, fEffect);
    focusMod = fResult.mod;
    const fWord = (fPass && fDouble) ? "крит. успех" : fPass ? "успех" : fDouble ? "крит. провал" : "провал";
    const fCls  = focusMod >= 0 ? "roll-success" : "roll-failure";
    const fItem = fEffect.item
      ? ` <i>[${esc(fEffect.item.name)}${fResult.itemBonus ? `: +${fResult.itemBonus} резонанс` : ""}${fResult.critFailIgnored ? ": штраф крит. провала игнорируется" : ""}]</i>`
      : "";
    focusNote = `<div class="roll-defense-note">${rollIcon("spark","#c98bff")}Психофокус (W ${wpv}): бросок <b>${fv}</b> → <span class="${fCls}">${fWord}${focusMod ? `, ${focusMod > 0 ? "+" : ""}${focusMod}` : ", без бонуса"}</span> к психотесту.${fItem} <i>(свободное действие, 1/ход, в свой Ход)</i></div>`;
  }
  const pathTestMod = (PATH.testMod || 0) + pathDynMod + focusMod + subTotals.testMod;
  // Заметка в карточку — только если хоть одна суб-механика реально отмечена
  // (subTotals.labels пуст у всех Путей без `subPaths`, и у Сигиллита без
  // отмеченных флажков — тогда действует только базовый Best.Q Психофокус).
  const subPathNote = subTotals.labels.length
    ? `Руны Сигиллитов: сложены — ${subTotals.labels.join(", ")}` +
      (opts.sigilliteSubs?.includes("incantation") ? " (Инкантация: действие манифестации на ступень выше — вручную)" : "")
    : "";

  const actorUpdates = {}; // накопленные изменения (Порча Варп-Шока, Раны Конверсии)

  // ── Эффективный PR по аспектам ─────────────────────────────────────────────
  // Псайкер может независимо снизить эPR для урона и дальности (минимум 1),
  // не трогая эPR психотеста. 0 в диалоге = использовать полный эPR.
  // Психическая Злоба прибавляет +2 ровно одному аспекту (дальность либо Dmg и
  // Pen), поэтому «полный эPR» у них свой; Исчисления ниже пересчитают оба.
  const clampPR  = (v, bonus = 0) => (v > 0 ? Math.max(1, Math.min(ePR, v)) : ePR) + bonus;
  const spiteBonusFor = aspect => (spiteChoice === aspect ? PSYCHIC_SPITE_BONUS : 0);
  let damagePR = clampPR(opts.damagePR || 0, spiteBonusFor("damage"));
  let rangePR  = clampPR(opts.rangePR  || 0, spiteBonusFor("range"));
  let aspectsDiffer = damagePR !== ePR || rangePR !== ePR;

  // wdbc-5kd/wdbc-ufns: Пробитие основного профиля — формула, не константа
  // («Разрушение» Pen=PR, «Сверхъестественный Шторм» Pen=PR×3, «Вихрь Рока»
  // Pen=2×Х где Х=½Успехи(окр.▲) — в данных «2*ceil(СУ/2)»). Раньше здесь был
  // собственный резолвер (голый \bPR\b-replace + mechFormulaTotalSafe) —
  // теперь то же самое место, что читает rating свойств оружия психосилы
  // (combat/weapon-properties.mjs::resolvePropRating): один резолвер формул на
  // damage/pen/rating, а не три независимых копии одной и той же подстановки
  // (та же причина, что у PR-подстановки в дайс-строках, wdbc-cy4z/wdbc-wv8u —
  // разошедшиеся копии рано или поздно расходятся МЕЖДУ собой, не только с
  // документацией). Раньше «PR» подставлялся, «СУ»/Cor.b — нет; теперь Пробитие
  // психосилы умеет то же самое, что Рейтинг записи Конструктора. Формула не
  // резолвится здесь СРАЗУ (deg ещё не известна, психотест ещё не брошен) —
  // atk.pen хранит СЫРУЮ формулу/число, реальное число считается ниже, вместе
  // с atkProps (там же уже есть {deg, rollData}).
  //
  // ── Профиль атаки и вариация броска ────────────────────────────────────────
  // Если выбран доп. профиль — берём его урон/тип/пробитие/свойства/урон-в-хар-ку,
  // иначе основной. Вариация добавляет свой модификатор к психотесту.
  const profile = (opts.profileIdx >= 0) ? (sys.profiles || [])[opts.profileIdx] : null;
  const atk = profile ? {
    damage:    profile.damage, damageType: profile.damageType || "energy",
    damageSubtype: profile.damageSubtype || "",
    // Пробитие доп. профиля — формула, как у основного (wdbc-1mwm9:
    // Devastating Rain, профиль C(Tx) — Pen PR); голое число по-прежнему валидно.
    pen:       profile.penetration ?? 0,
    props:     parsePsyPropsText(profile.propsText),
    charStat:  profile.charDamageStat || "",
    charForm:  profile.charDamageFormula || "",
    label:     profile.label || "профиль"
  } : {
    damage:    sys.damage, damageType: sys.damageType || "energy",
    damageSubtype: sys.damageSubtype || "",
    pen:       sys.penetration,
    props:     sys.weaponProps || [],
    charStat:  sys.charDamageStat || "",
    charForm:  sys.charDamageFormula || "",
    label:     "основной"
  };
  const variant    = (opts.variantIdx >= 0) ? (sys.variants || [])[opts.variantIdx] : null;
  const variantMod = Number(variant?.testMod) || 0;

  const powerMod  = sys.testMod || 0; // собственный модификатор силы
  // Только autoMods — галочки приходят из диалога в opts.ruleMod, см.
  // комментарий в showManifestDialog выше.
  //
  // Держим и подписи, а не одну сумму (wdbc-lnl3): в карточке стояло намертво
  // «− 10 (😓 Усталость)», тогда как в Порог уходила фактическая сумма всех
  // автоматических штрафов — несколько уровней Усталости, выключенная силовая
  // броня, Перевес инвентаря. Порог считался верно, врала подпись, и понять
  // по карточке, откуда взялось число, было нельзя.
  const bodyMods = autoTestMods(actor, { kind: "power", power: item, char: cast.key });
  const fatigue = bodyMods.total;
  // Складываем тем же счётчиком, что и атака: галочка «ополовинить штраф»
  // делит сумму, только если она в минус, и округляет в пользу игрока.
  // Фокус Техники — +10 на психотест выбранной силы (rules/psyker-talents.mjs);
  // эPR порога — с надбавкой Злобы «в психотесте» (eprTest), без Проводника.
  const tfMod = techFocus ? TECHNIQUE_FOCUS_TEST_BONUS : 0;
  const threshold = attackThreshold({
    base: charVal + 5 * eprTest,
    mods: [opts.modifier || 0, opts.ruleMod || 0, pathTestMod, powerMod, variantMod, fatigue, tfMod],
    halvePenalty: !!opts.halveRulePenalty
  });
  // Списание действия (пачка I3): ОД/Реакция по плану, пул Быстрого Плетения (отдельный пул 2 ОД,
  // выданный в начале боя) покрывает часть. Пул пересчитывался в плане, а не доверялся галочке окна.
  if (actionPlan) {
    const paidAction = await payManifestAction(actor, item, actionPlan);
    if (!paidAction.ok) return;
    talentLines.push(...paidAction.lines);
  }
  if (opts.reroll) {
    talentLines.push(`<div class="roll-threshold" style="font-size:0.85em;">⚜ Переброс психотеста (Ключевая Сила): ${esc(opts.rerollNote || "")}. Результат прежней карточки заменён этим; те же модификаторы, поддержание и Феномен пересчитаны. Разовые траты первой попытки (ОД, Рун, Очки Возрождения/Проводника) заново не платились.</div>`);
  }
  const roll = await new Roll("1d100").evaluate();
  const rv   = roll.total;
  let success = rv <= threshold;
  let deg  = Math.floor(Math.abs(rv - threshold) / 10) + 1;
  const allRolls = focusRoll ? [roll, focusRoll] : [roll];
  allRolls.push(...conduitRolls);

  // Аэльдари, Безопасный режим: авто-успех, число успехов = тPR (mPR)
  if (opts.eldar && opts.mode === "safe") {
    success = true;
    deg = Math.max(1, mPR);
  }

  // ── Будет ли Феномен — решается СРАЗУ после психотеста ────────────────────
  // Раньше определялось ниже, прямо перед броском Феномена. Вынесено сюда
  // ради Исчислений (Sahara 3-28): «сразу после психотеста, но до бросков на
  // Феномен и эффекты психосилы» псайкер может снять 1 эPR и получить модификатор
  // до −2×I.b на бросок Феномена — эПР эффектов (урон, дальность, поддержание)
  // должны считаться уже после этого решения.
  let phenomena = false;
  const isDouble = (rv % 11 === 0) || rv === 100;
  if (PATH.phenOnly99) {
    // Руны Сигиллитов (стр. 101-102): «вызывает феномен только при выпадении
    // 99». Безопасный режим Феноменов не даёт и здесь — это общее правило
    // режима, а книжная оговорка Пути его только сужает, тем же приёмом, что
    // у Рун Судьбы/Битвы ниже.
    phenomena = (opts.mode === "normal") && rv === 99;
  } else if (PATH.phenOnly66) {
    // Руны Судьбы/Битвы: Феномен только на броске 66 в Обычном режиме.
    phenomena = (opts.mode === "normal") && success && rv === 66;
  } else if (opts.eldar) {
    // Эльдарские правила Феноменов по режимам:
    if (opts.mode === "safe") {
      phenomena = false;                                   // Безопасный — никогда
    } else if (opts.mode === "normal") {
      const critFail = !success && (isDouble || rv === 100);
      phenomena = (success && rv === 66) || critFail;      // дубль 66 на успехе или крит. провал
    } else { // push
      phenomena = !success || (success && isDouble);       // провал или дубль
    }
  } else if (MODE.phenomena === "always") {
    phenomena = true;
  } else if (MODE.phenomena === "double") {
    phenomena = (success && isDouble) || rv === 99;
  }

  // Исчисления: снять 1 эPR ради −2×I.b к броску Феномена. Спрашиваем только
  // когда Феномен действительно выпал, есть что снимать (эPR ≥ 2) и мод не нулевой.
  const innumMod = innumerationsMod(actor);
  if (phenomena && hasInnumerations(actor) && innumMod !== 0 && ePR > 1) {
    const take = await foundry.applications.api.DialogV2.confirm({
      window: { title: `Исчисления — ${actor.name}` },
      content: `<p>«${esc(item.name)}» вызывает Феномен. Исчисления: снять <b>1 эPR</b> силы (эPR эффектов ${ePR} → ${ePR - 1}) ради <b>${innumMod}</b> к броску Феномена?</p>`,
      yes: { label: `Снять 1 эPR (${innumMod})` }, no: { label: "Нет" },
      rejectClose: false
    });
    if (take) {
      ePR -= 1;
      phenMod += innumMod;
      damagePR = clampPR(opts.damagePR || 0, spiteBonusFor("damage"));
      rangePR  = clampPR(opts.rangePR  || 0, spiteBonusFor("range"));
      aspectsDiffer = damagePR !== ePR || rangePR !== ePR;
      talentLines.push(`<div class="roll-threshold" style="font-size:0.85em;">Исчисления: эPR эффектов −1 (теперь ${ePR}), бросок Феномена ${innumMod}.</div>`);
    }
  }

  // Пропускание (пачка I1, решение владельца 26.10.2026): строка в карточке — Проявлений Силы
  // как подсистемы нет. Психофокус удался и Феномена нет → «Проявлений нет».
  const channel = channelOutcome(actor, { path: opts.path, focusPassed, phenomena });
  if (channel === "quiet") {
    talentLines.push(`<div class="roll-threshold" style="font-size:0.85em;">Пропускание: Психофокус удался — <b>Проявлений Силы нет</b> (Феномена нет).</div>`);
  } else if (channel === "exposed") {
    talentLines.push(`<div class="roll-threshold" style="font-size:0.85em;color:#a33;">Пропускание: Психофокус удался, но сила вызвала Феномен — проявление очевидно для всех.</div>`);
  }

  // wdbc-8m0x: сохраняем степень успеха НА ПРЕДМЕТЕ — единственное место, где
  // она переживает этот вызов (иначе deg был только локальной переменной,
  // видной лишь в этом одном чат-сообщении). Пишем при любой манифестации
  // (не только когда isSustained уже включён), чтобы число было готово к
  // моменту, когда игрок следом поставит галочку «Подд.». Провал — сброс в
  // null, поддерживать нечего.
  //
  // wdbc-1wvn: тем же приёмом сохраняем эPR психотеста — сустейн-баффы к
  // ДРУГИМ тестам (Sharpened Senses и подобные) обязаны считать бонус по эPR
  // МОМЕНТА КАСТА (книга), а не по текущему тPR персонажа на момент того
  // позднего теста. item-rules.mjs (modCharBonus:"pr") читает это поле вместо
  // currentRating, если оно не null.
  await item.update({ "system.sustainedDegree": success ? deg : null, "system.sustainedEpr": success ? ePR : null });
  // Переброс провалился, а сила уже поддерживается прежним успехом: поддерживать нечего — снимается так же, как
  // галочкой «Подд.» (купленные свойства Силового Клинка, метка «бесплатная», цель — общим патчом).
  if (opts.reroll && !success && item.system?.isSustained) {
    await item.update(sustainOffPatch(item));
    await syncItemEffectsDisabled(item);
    talentLines.push(`<div class="roll-threshold" style="font-size:0.85em;color:#a33;">Переброс провален: поддержание силы снято — прежний успех заменён провалом.</div>`);
  }

  // Рана в Реальности: галочка «бесплатная» из окна — только у удавшейся манифестации (поддерживать нечего,
  // если провал); пометка живёт на самой силе и гасится вместе с поддержанием.
  if (opts.woundFree && success && hasWoundInReality(actor) && !opts.reroll) {
    if (await setWoundFree(actor, item, true, { assumeSustained: true })) {
      talentLines.push(`<div class="roll-threshold" style="font-size:0.85em;">Рана в Реальности: сила поддерживается бесплатно — тPR не снижается (поставьте «Подд.»). Аура Cor.b×2 м.</div>`);
    }
  }

  // wdbc-vxgd: Force Blade — «магазин» покупки свойств оружия за Успехи ЭТОГО
  // психотеста. Диалог сам пишет system.effects.weaponBuff на предмете; при
  // провале (нечего тратить) или отказе от диалога — Force Blade просто не
  // накладывает временных свойств (weaponBuff остаётся как после последнего
  // снятия поддержания).
  if (success && sys.hasWeaponShop) await runForceBladeShop(item, deg);

  // Телесная Конверсия — цена в Ранах (платится при использовании Пути)
  if (PATH.woundCost && !opts.reroll) {
    Object.assign(actorUpdates, woundLossUpdates(actor.system, PATH.woundCost));
  }

  // ── Цена в Рунах (wdbc-fsl9) ──────────────────────────────────────────────
  // Списывается ПОСЛЕ броска, потому что размер возврата зависит от исхода:
  // Rune Strike при провале возвращает I.b Рун (но не больше, чем на него же
  // и потрачено — вернуть больше, чем заплатил, книга не обещает). Достаток
  // Рун проверен ещё до открытия броска (showManifestDialog), здесь остаётся
  // только запись. Ветка целиком под гейтом Черты.
  let runeLine = "";
  if (PATH.runeCost && hasRuneMagic(actor) && !opts.reroll) {
    // wdbc-p2it: скидка Заготовленной Руны считается ДО charge (та же цена,
    // что уже показывал диалог) — если она реально применилась к ЭТОЙ
    // манифестации, метка «использована» ставится сразу после, отдельным
    // вызовом actor.setFlag: списание Рун идёт через actorUpdates/
    // actor.update ниже по конвейеру, а флаг — своя запись.
    const discount = preparedRuneDiscount(actor, item);
    const cost   = runeCostTotal(item, runeStrike, actor);
    const refund = (!success && runeStrike > 0)
      ? Math.min(runeStrikeRefund(actor), runeStrike * RUNE_STRIKE_COST) : 0;
    const before = runeValue(actor);
    const patch  = runeUpdate(actor, refund - cost);
    if (patch) Object.assign(actorUpdates, patch);
    const after = patch ? patch["system.sigilliteRunes.value"] : before;
    runeLine = `<div class="roll-threshold">Руны: −<b>${cost}</b> (бPR психосилы × 2`
      + (runeStrike ? `, из них ${runeStrike * RUNE_STRIKE_COST} на Рунный Удар +${runeStrike} эPR` : "")
      + (discount ? `, Заготовленная Руна: −${discount} (первая манифестация в этом бою)` : "")
      + `)${refund ? `, возврат за провал +<b>${refund}</b>` : ""}`
      + ` → осталось <b>${after}</b> из ${runeMax(actor)}</div>`;
    if (discount > 0) await markPreparedRuneUsed(actor);
  }

  // ── Импровизированная Руна (wdbc-exjp) ────────────────────────────────────
  // Талант Improvised Rune: манифестация ЕЩЁ НЕ изученной Руны через этот
  // Путь — «взамен получая 1 непоглощаемого R Dmg в руку и 1 урона в S, A и
  // W». Цена не заменяет обычную цену Рун выше (PATH.runeCost), а идёт
  // ДОПОЛНИТЕЛЬНО к ней — книга говорит «взамен», а не «вместо»: платится и
  // Рунами за саму манифестацию, и телом за то, что Руна не изучена. Платится
  // независимо от исхода психотеста — это цена ПОПЫТКИ сотворить неизвестную
  // Руну, а не цена успеха (та же логика, что у PATH.woundCost выше).
  let improviseLine = "";
  if (opts.improvisedRune && !opts.reroll) {
    Object.assign(actorUpdates, improvisedRuneCostUpdates(actor));
    improviseLine = `<div class="roll-threshold" style="color:#7a1010;">Импровизированная Руна: ` +
      "−1 непогл. Рана, −1 к Мод. S/A/W (не лечится психосилами, Судьбой/Бесчестием, медитацией).</div>";
  }

  // ── Авто-урон (для атакующих сил при успехе) ──────────────────────────────
  const isDamaging = ["attack", "psychicShoot", "psychicBlade"].includes(sys.powerType);
  // wdbc-lui3: rating свойства психосилы может быть формулой с PR («2*PR» у
  // Blast/Devastating, «PR» у Linger) — резолвим тем же аспектом эПР, что и
  // урон (damagePR), ДО агрегации: aggregateAuto читает rating как голое
  // число (общий движок с обычным оружием, где rating всегда константа).
  // wdbc-kifa: плюс «СУ» книжного «Успехи» (deg этого психотеста, известна
  // только сейчас, после броска) и Cor.b/др. бонусы характеристик через
  // общий mechRollData(actor) — Felling(Cor.b) у Infernal Gaze.
  // wdbc-zlx7: свойства с requiredSuccesses (Neural Storm «3+ Успеха —
  // Shocking/Haywire», Fire Barrage/Bolt/Storm «N+ Успехов — поджигает»)
  // отсекаются здесь по deg ЭТОГО психотеста — ниже aggregateAuto/
  // buildTargetEffectButtons их уже не видят вовсе, как будто не было в
  // weaponProps.
  //
  // wdbc-ufns: «Х» (Vortex of Doom: Х=½Успехи(окр.▲), используется сразу в
  // damage/pen/Blast-rating/Linger-rating) — считается ОДИН раз здесь (та же
  // resolvePropRating, что и rating ниже — sys.xFormula пишется тем же
  // языком формул, «ceil(СУ/2)») и передаётся дальше через rollOpts.x во ВСЕ
  // резолверы этого предмета. Пусто у sys.xFormula → xValue=null → «Х» нигде
  // не подставляется, поведение любого другого предмета не меняется.
  // Надбавка Психической Злобы «в Dmg и Pen» идёт только урону и Пробитию — не
  // рейтингам свойств (Blast, Linger) и не «Х»: их считаем от эPR без неё.
  const ratingPR = damagePR - spiteBonusFor("damage");
  const xValue = sys.xFormula
    ? Number(resolvePropRating(sys.xFormula, ratingPR, { deg, rollData: mechRollData(actor) })) || 0
    : null;
  const rollOpts = { deg, rollData: mechRollData(actor), ...(xValue != null ? { x: xValue } : {}) };
  const atkProps   = filterPropsBySuccesses(
    resolvePropRatings(resolveWeaponPropsList(atk.props), ratingPR, rollOpts),
    deg
  );
  // wdbc-5kd/wdbc-ufns: тот же резолвер, что у rating выше — Пробитие никогда
  // не дайс (см. комментарий у atk.pen), поэтому дайс-ветка resolvePropRating
  // (вернула бы строку) здесь отбрасывается Number(...)||0, как и раньше
  // отбрасывала mechFormulaTotalSafe молчаливым 0 на «d» вне SAFE_REST — не
  // регрессия.
  const atkPen = Number(resolvePropRating(atk.pen, damagePR, rollOpts)) || 0;
  // Тот же движок, что читает system.weaponProps у обычного оружия
  // (module/combat/attack.mjs): без него Рвущее/Проверенное/Экстремальный урон
  // и подобные свойства атаки психосилы были только текстовой памяткой ниже,
  // а числа в бросок не попадали.
  const wp         = aggregateAuto(atkProps);
  let damageSection = "";
  if (success && isDamaging && atk.damage) {
    const chars = actor.system.characteristics;
    // wdbc-ufns: «Х» подставляется той же текстовой заменой, что и «PR» —
    // damage остаётся дайс-капабельной строкой для Roll() ниже, через
    // resolvePropRating/mechFormulaTotalSafe (нет дайсов) её не провести.
    let dmgRaw = String(atk.damage).replace(/\bPR\b/gi, damagePR);
    if (xValue != null) dmgRaw = dmgRaw.replace(/Х/gi, String(xValue));
    const dmgFormula = applyDamageDiceMods(
      resolveCharFormula(dmgRaw, chars, actor.system.corruptionBonus ?? 0),
      wp
    );
    // Число попаданий по подтипу Психострельбы (стр. 290). Считается по самому
    // подтипу, а не по типу силы: в книге такие силы помечены «Атака ·
    // Психический Шторм · Стрельба», то есть powerType у них «Атака».
    const shootType = sys.shootSubtype || "";
    const shots = psychicHitCount(shootType, deg);
    const hits  = shots.count;
    const hitsNote = shots.label
      ? `${shots.label}: <b>${hits}</b> попад. (${shootType === "storm"
          ? `по 1 за каждый из ${deg} Успехов`
          : `по 1 за нечётный из ${deg} Успехов`}).`
      : "";
    try {
      const dtLabel = DAMAGE_TYPES[atk.damageType] || atk.damageType;
      const pen     = atkPen;
      const hitLines = [];
      let firstHitTotal = null;
      for (let h = 0; h < hits; h++) {
        const dmgRoll = await new Roll(dmgFormula).evaluate();
        allRolls.push(dmgRoll);
        if (h === 0) firstHitTotal = dmgRoll.total;
        // Экстремальный урон (стр. 166-170) — тот же расчёт, что у оружия.
        const ext = await rollExtremeDamage(dmgRoll, { wp, damageType: atk.damageType, hitLocation: hitLoc, attacker: actor });
        if (ext.exRoll) allRolls.push(ext.exRoll);
        const extStr = ext.hasExtreme ? `
              <div class="roll-extreme-block">
                <b>Экстремальный урон</b> · d5: ${ext.extremeLevel}
                ${ext.critEffect ? `<div class="roll-crit-effect">${ext.critEffect}</div>` : ""}
              </div>` : "";
        hitLines.push(`
            <div class="roll-damage-hit">
              <span>${hits > 1 ? `Попадание #${h + 1}` : "Урон"} (${dtLabel}, Проб. ${pen}): <b>${dmgRoll.total}</b></span>
              <button class="wh-apply-dmg-btn" type="button"
                data-damage="${dmgRoll.total}" data-penetration="${pen}"
                data-damage-type="${atk.damageType}" data-damage-subtype="${atk.damageSubtype}"
                data-hit-location="${esc(hitLoc)}"
                data-weapon-name="${item.name}" data-attacker="${actor.name}" data-attacker-uuid="${actor.uuid}"
                data-psychic="1" data-psy-power-type="${esc(item.system?.powerType || "")}"
                data-psy-indirect="${isIndirectPower(item.system) ? 1 : ""}"
                data-felling="${wp.fellingRating ?? 0}"
                data-primitive="${wp.primitive ? 1 : 0}"
                data-ignore-shield="${wp.ignoreShield ? 1 : 0}"
                data-warp-soak="${wp.warpSoak ? 1 : 0}"
                data-lance="${wp.lance ? 1 : 0}"
                data-sanctified="${wp.sanctified ? 1 : 0}"
                data-has-extreme="${ext.hasExtreme ? 1 : 0}">
                ${dmgRoll.total} → ${esc(hitLoc)}
              </button>
            </div>${extStr}`);
      }
      // wdbc-86rm: Дуга (wp.arcRating/arcDamage, module/combat/weapon-
      // properties.mjs::aggregateAuto) у психосил не рисовала кнопку вовсе —
      // buildTargetEffectButtons её не строит (arc: {auto:{arc:null}}, без
      // targetEffect), настоящая кнопка .wh-arc-btn до сих пор жила только в
      // attack-card.mjs (обычное оружие). Тот же гейт «первое попадание
      // очереди достигло порога X» и та же разметка — обработчик в hooks.mjs
      // (.wh-arc-btn) общий, ничего своего заводить не пришлось.
      const arcBtn = (wp.arcRating > 0 && firstHitTotal != null && firstHitTotal >= wp.arcRating) ? `
        <button class="wh-arc-btn" type="button"
          data-arc-damage="${wp.arcDamage}" data-weapon-name="${item.name}"${arcExtraAttrs(wp)}
          data-attacker="${actor.name}" data-attacker-uuid="${actor.uuid}">
          ⚡ Дуга: выберите поражённую цель → ближайшая вторая в 5м (${wp.arcDamage}(El) Pen ${wp.arcDamage})
        </button>` : "";
      damageSection = `
          <div class="roll-damage-section">
            ${hitsNote ? `<div class="roll-threshold" style="font-size:0.82em;">${hitsNote}${profile ? ` Профиль «${atk.label}».` : ""} Вторичные цели (в 2м) — попадания в Торс.</div>` : (profile ? `<div class="roll-threshold" style="font-size:0.82em;">Профиль «${atk.label}».</div>` : "")}
            ${hitLines.join("")}
            ${arcBtn}
          </div>`;
    } catch(e) {
      ui.notifications.warn(`Не удалось бросить урон психосилы: ${atk.damage}`);
      console.error(e);
    }
  }

  // ── Урон в характеристику (если задан) ─────────────────────────────────────
  let charDamageSection = "";
  if (success && atk.charStat && atk.charForm) {
    try {
      const cdRoll = await new Roll(String(atk.charForm).replace(/\bPR\b/gi, damagePR)).evaluate();
      allRolls.push(cdRoll);
      const cdAbbr = CHARACTERISTICS[atk.charStat]?.abbr || atk.charStat.toUpperCase();
      charDamageSection = `
          <div class="roll-damage-section">
            <div class="roll-damage-label">Урон в характеристику <b>${cdAbbr}</b>: <b>${cdRoll.total}</b></div>
            ${charDamageButtonHtml({ amount: cdRoll.total, keys: [atk.charStat] }, { source: item.name ?? "" })}
          </div>`;
    } catch {
      ui.notifications.warn(`Не удалось бросить урон в характеристику: ${atk.charForm}`);
    }
  }

  // ── Свойства атаки психосилы: памятки + кнопки эффектов на цель ─────────────
  let attackPropsSection = "";
  if (success && isDamaging && atkProps.length) {
    const propBlock  = buildPropertyChatBlock(atkProps);
    const effectBtns = buildTargetEffectButtons(atkProps, { hit: true, deg });
    attackPropsSection = (propBlock || "") + (effectBtns || "");
  }

  // wdbc-ufns: «Разместить Вихрь» — персистентная зона (module/regions/
  // vortex-zone.mjs) для предметов с sys.vortexPersistent (сейчас только
  // Vortex of Doom). xValue уже посчитан выше (sys.xFormula), тот же, что
  // ушёл в damage/pen/Blast-rating этого попадания.
  if (success && sys.vortexPersistent && xValue != null && xValue > 0) {
    attackPropsSection += `
      <div class="roll-threshold" style="margin-top:4px;">
        <button type="button" class="wh-vortex-place-btn"
          data-x-value="${xValue}" data-owner-uuid="${esc(actor.uuid)}"
          data-item-uuid="${esc(item.uuid)}" data-item-name="${esc(item.name)}">
          🌀 Разместить Вихрь (Х=${xValue})
        </button>
      </div>`;
  }

  // ── Феномен / Прорыв ──────────────────────────────────────────────────────
  // Будет ли Феномен — решено выше (phenomena), сразу после психотеста.
  let phenSection = "";
  let perilTriggered = false;
  if (phenomena) {
    let phenRoll = await new Roll(`1d100 + ${phenMod}`).evaluate();
    allRolls.push(phenRoll);
    // Любимец Варпа: «бросает два кубика на Феномены (но не Прорывы) и может
    // выбрать любой из них». Выше на таблице — хуже (Прорыв в самом конце), так
    // что лучший выбор всегда меньший бросок; выбираем его и показываем второй.
    let favouredNote = "";
    if (hasFavouredByTheWarp(actor)) {
      const second = await new Roll(`1d100 + ${phenMod}`).evaluate();
      allRolls.push(second);
      const [keep, drop] = second.total < phenRoll.total ? [second, phenRoll] : [phenRoll, second];
      favouredNote = ` <i>(Любимец Варпа: два броска ${phenRoll.total} и ${second.total} — взят меньший, отброшен ${drop.total}: ${esc(getPhenomenon(drop.total).label)})</i>`;
      phenRoll = keep;
    }
    const phenVal = phenRoll.total;
    const phen = getPhenomenon(phenVal);
    phenSection = `
        <div class="psy-phenomenon">
          <div class="psy-phen-header">⚠️ Психический Феномен (бросок ${phenVal}${phenMod !== 0 ? `, мод ${phenMod >= 0 ? "+" : ""}${phenMod}` : ""})${favouredNote}</div>
          <div class="psy-phen-name">${phen.label}</div>
          <div class="psy-phen-text">${phen.text}</div>
        </div>`;

    // Прорыв (если Феномен переходит в Прорыв)
    if (phen.peril) {
      perilTriggered = true;
      const perilRoll = await new Roll("1d100").evaluate();
      allRolls.push(perilRoll);
      const peril = getPeril(perilRoll.total);
      phenSection += `
          <div class="psy-peril">
            <div class="psy-peril-header">💀 ВАРП-ПРОРЫВ! (бросок ${perilRoll.total})</div>
            <div class="psy-peril-name">${peril.label}</div>
            <div class="psy-peril-text">${peril.text}</div>
          </div>`;
    }
    // «Усмирение Варпа» (Очко Бесчестия, Cor 20+) — переброс Феномена/Прорыва
    // прямо с карточки; Имперское Санкционирование добавляет бесплатный
    // переброс Прорыва после оплаченного переброса Феномена (combat/calm-warp.mjs).
    phenSection += calmWarpButtonsHtml(actor, { phenMod, peril: perilTriggered, powerUuid: item.uuid });
    // Варп-Замок (Талант Псайканы, пачка I2): игнорировать выпавший Феномен/Прорыв ценой 1d5 E в голову.
    phenSection += warpLockButtonsHtml(actor);
  } else if (opts.mode === "safe") {
    phenSection = `<div class="roll-threshold" style="font-size:0.85em;">Безопасный режим — Феномены не вызываются.</div>`;
  } else {
    phenSection = `<div class="roll-threshold" style="font-size:0.85em;color:#3a7a3a;">Феномен не вызван.</div>`;
  }

  // ── Варп-Шок: не-Хаоситы получают Порчу при Феномене (1d5 при Прорыве) ──────
  let warpShockSection = "";
  if (phenomena && !NAT.isChaos) {
    let corrAmt = 1;
    if (perilTriggered) {
      const corrRoll = await new Roll("1d5").evaluate();
      allRolls.push(corrRoll);
      corrAmt = corrRoll.total;
    }
    // Взгляд в Бездну (rules/defiance-talents.mjs): «на 1 Порчи меньше от
    // эффектов … Варп-Шока» — за каждое взятие, не ниже нуля.
    const gaze = Math.min(corrAmt, gazeIntoAbyssReduction(actor));
    corrAmt -= gaze;
    const curCorr = actor.system.corruption?.value || 0;
    if (corrAmt > 0) actorUpdates["system.corruption.value"] = curCorr + corrAmt;
    warpShockSection = `<div class="psy-warpshock">🌀 Варп-Шок: <b>+${corrAmt} Порчи</b>${gaze ? ` (Взгляд в Бездну −${gaze})` : ""}${perilTriggered ? " (1d5 — за Прорыв)" : ""}. Не-Хаоситы в радиусе PR×5 м от Прорыва: тест W+0 или +1 Порчи.</div>`;
  } else if (phenomena && NAT.isChaos) {
    warpShockSection = `<div class="roll-threshold" style="font-size:0.82em;color:#5a4a30;">Демонический дар игнорирует негативные эффекты собственных Феноменов (но не Прорывов).</div>`;
  }

  // Цена Конверсии в чат
  let conversionLine = "";
  if (PATH.woundCost) {
    conversionLine = `<div class="roll-threshold" style="font-size:0.85em;color:#8b0000;">${rollIcon("blood","#ff6b6b")}Телесная Конверсия: −${PATH.woundCost} Раны.</div>`;
  }

  // ── Тест Сопротивления ЦЕЛИ (wdbc-5vf4) ────────────────────────────────────
  // Книжный формат «Психотест X vs Y+N» — при успешной манифестации цель
  // защищается СВОИМ тестом Y+N (см. sys.resistChar/resistMod, психика-power.mjs).
  // Только при успехе: провал манифестации — до цели дело не доходит, книжные
  // тексты («Победа: …») всегда завязаны на исход психотеста кастера.
  let resistSection = "";
  if (success && sys.resistChar) {
    const resistAbbr = CHARACTERISTICS[sys.resistChar]?.abbr ?? sys.resistChar.toUpperCase();
    const resistMod  = Number(sys.resistMod) || 0;
    const resistModTxt = `${resistMod >= 0 ? "+" : ""}${resistMod}`;
    // Тот же таргет сцены, что уже читает ruleRollModsHtml выше в
    // showManifestDialog — если игрок сменил цель между открытием диалога и
    // нажатием «Психотест!», в карточку идёт актуальный на МОМЕНТ броска.
    const targetToken = [...(game.user?.targets ?? [])][0] ?? null;
    const targetActor = targetToken?.actor ?? null;
    // data-discipline/data-target-token-uuid (wdbc-1rno, Фатализм/Нургл):
    // дисциплина силы и UUID ТОКЕНА (не актора — нужна геометрия сцены, rules/
    // fatalism.mjs::tokensWithinRadius) едут вместе с запросом. hooks.mjs
    // проверяет, не защищён ли токен аурой Фатализма, ДО открытия обычного
    // диалога Характеристики, и если да — тест не открывает вовсе, эффекты
    // силы игнорируются книжно («игнорируют эффекты», не «получают бонус на
    // сопротивление»).
    const resistBtn = targetActor
      ? `<button type="button" class="psy-resist-request-btn"
           data-target-uuid="${esc(targetActor.uuid)}" data-caster-uuid="${esc(actor.uuid)}"
           data-char-key="${esc(sys.resistChar)}" data-mod="${resistMod}"
           data-discipline="${esc(sys.discipline || "")}"
           data-target-token-uuid="${esc(targetToken?.document?.uuid || "")}"
           data-item-uuid="${esc(item.uuid)}"
           data-psy-indirect="${isIndirectPower(item.system) ? 1 : ""}"
           data-label="${esc(`Сопротивление: ${item.name}`)}">
           📨 Запросить тест Сопротивления у ${esc(targetActor.name)}
         </button>`
      : `<div class="roll-threshold" style="font-size:0.78em;opacity:0.8;">Наведите цель (T на токене сцены) до манифестации — тогда кнопка откроет тест сразу у неё.</div>`;
    resistSection = `
        <div class="psy-resist-section roll-threshold">
          Цель делает тест Сопротивления: <b>${resistAbbr} ${resistModTxt}</b>
          ${resistBtn}
        </div>`;
  }

  // ── Затупленная цель (wdbc-j8cn, rules/blunted.mjs) ──────────────────────
  // Черта Blunted (X) или Подавляющее поле друкхарийской брони: кастер
  // проходит Psyniscience−10×X, при Провале цель игнорирует эффект целиком.
  // Порог считается здесь же — игроку не нужно искать навык и вычитать.
  let bluntedSection = "";
  if (success) {
    const bTarget = [...(game.user?.targets ?? [])][0]?.actor ?? null;
    const bt = bluntedCasterTest(actor, bTarget, item, (sys.weaponProps || []).map(p => p?.key));
    if (bt) {
      const base = Number(actor.system.skills?.[bt.skill]?.total ?? -20) || 0;
      const modTxt = `${bt.mod >= 0 ? "+" : "−"}${Math.abs(bt.mod)}`;
      bluntedSection = `
        <div class="roll-threshold" style="color:#c07000;">
          ${esc(bTarget.name)} — Затупленный (${bt.rating}): пройдите <b>${bt.label} ${modTxt}</b>
          (Порог <b>${base + bt.mod}</b>). При Провале цель полностью игнорирует эффект силы.
        </div>`;
    }
  }

  // ── Парирование психосилы Талантом «Щит Клинков» (wdbc-bwf9) ──────────────
  // Отдельная секция, а не общий defenseSection карточки атаки: от психосилы
  // не Уклоняются, Вираж и Сжатие к ней тоже не относятся, а само Парирование
  // отменяет не попадание, а эффекты силы. Кнопка показывается всегда, когда
  // манифестация удалась, — право на неё проверяется у ЗАЩИЩАЮЩЕГОСЯ в момент
  // клика (module/combat/blade-shield.mjs::canParryPsychic): на момент рендера
  // карточки токен защищающегося ещё не выбран, тот же приём, что у Сжатия.
  // Только ВРАЖДЕБНАЯ психосила: книга даёт Щиту Клинков парировать «вражеские
  // психосилы», а собственное благословение или самобаф парировать не от кого.
  // Признак враждебности тот же, что уже читает карточка: сила либо наносит
  // урон (powerType), либо требует от цели теста Сопротивления.
  const hostilePower = isDamaging || !!sys.resistChar;
  const bladeShieldSection = success && hostilePower
    ? `<div class="psy-parry-section roll-threshold">
         <button type="button" class="psy-blade-shield-btn"
           data-power-name="${esc(item.name)}" data-epr="${ePR}"
           title="Талант «Щит Клинков» + силовое эльдарское / психосиловое психокостяное оружие или ноктиковый щит в руках">
           ${rollIcon("sword")}Парировать психосилу (Щит Клинков)
         </button>
         <div style="font-size:0.78em;opacity:0.8;">Выберите токен защищающегося на сцене — Талант и предмет в руках проверятся сами.</div>
       </div>`
    : "";

  // Применяем накопленные изменения (Раны/Порча)
  if (Object.keys(actorUpdates).length) await actor.update(actorUpdates);

  // wdbc-fyvv: Порог психотеста — книжная формула «хар-ка + 5×эPR» с
  // приписками Пути/Вариации, но это те же база+слагаемые, что и у прочих
  // тестов — просто одно из слагаемых само посчитано (5×эPR). Плашка встаёт
  // сразу под шапкой (там же, где у любой другой карточки), Природа/Режим/
  // Путь и разбор mPR→эPR остаются своими строками под ней — это контекст
  // силы, не слагаемые Порога.
  // Переброс есть только у карточки СВОЕЙ ключевой силы и только у первой попытки (переброс переброса книга не даёт).
  const signatureRerollable = !opts.reroll && !opts.onResult && isSignaturePower(actor, item);
  const manifestCard = await postTestCard(actor, {
    icon: rollIcon("spark","#c98bff"), title: esc(item.name),
    threshold: rollStatLine({
      label: charAbbr, base: charVal,
      parts: [
        `5×${eprTest}`,
        opts.modifier ? `${opts.modifier >= 0 ? "+" : ""}${opts.modifier}` : "",
        pathTestMod ? `${pathTestMod >= 0 ? "+" : ""}${pathTestMod} (Путь)` : "",
        variantMod ? `${variantMod >= 0 ? "+" : ""}${variantMod} (Вариация)` : "",
        tfMod ? `+${tfMod} (Фокус Техники)` : "",
        ...bodyMods.parts
      ],
      threshold, rv
    }),
    lines: [
      `<div class="roll-threshold">Природа: <b>${NAT.label}</b> | Режим: <b>${MODE.label}</b>${pathLabel ? ` | Путь: <b>${pathLabel}</b>` : ""}</div>`,
      `<div class="roll-threshold">mPR <b>${opts.mPR}</b>${prMod ? ` ${prMod >= 0 ? "+" : ""}${prMod} = <b>${mPR}</b>` : ""} → эPR <b>${ePR}</b>${pushBonus ? ` (Усиление +${pushBonus})` : ""}${(PATH.ePR || subTotals.ePR) ? ` (Путь +${(PATH.ePR || 0) + subTotals.ePR})` : ""}</div>`,
      aspectsDiffer || eprTest !== ePR ? `<div class="roll-threshold" style="font-size:0.82em;">эPR по аспектам: тест <b>${eprTest}</b>${isDamaging ? ` · урон <b>${damagePR}</b>` : ""} · дальность <b>${rangePR}</b></div>` : "",
      sys.range ? `<div class="roll-threshold" style="font-size:0.82em;">Дальность: ${String(sys.range).replace(/\bPR\b/gi, rangePR)}</div>` : "",
      sys.sustainable && sys.sustainRange ? `<div class="roll-threshold" style="font-size:0.82em;">Дальность поддержания (П): ${String(sys.sustainRange).replace(/\bPR\b/gi, rangePR)}</div>` : "",
      variant ? `<div class="roll-threshold" style="font-size:0.82em;">Вариация: <b>${variant.label || "—"}</b>${variant.note ? ` — ${variant.note}` : ""}</div>` : "",
      PATH.note ? `<div class="roll-threshold" style="font-size:0.82em;color:#5a4a30;">Путь: ${PATH.note}${vessel ? ` — <b>${esc(vessel.name)}</b>` : ""}</div>` : "",
      subPathNote ? `<div class="roll-threshold" style="font-size:0.82em;color:#5a4a30;">${subPathNote}</div>` : "",
      runeNote ? `<div class="roll-threshold" style="font-size:0.82em;color:#7a1010;">${runeNote}</div>` : "",
      runeLine,
      improviseLine,
      focusNote,
      ...talentLines
    ],
    outcome: outcomeHtml(success, success
      ? `Манифестация удалась — ${deg} ${_degWord(deg)}`
      : `Психотест провален — ${deg} ${_degWord(deg)}`),
    sections: [conversionLine, bluntedSection, resistSection, bladeShieldSection, damageSection, charDamageSection,
               attackPropsSection, signatureFreeHtml(actor, item, { success, rerollable: signatureRerollable, freeSpent: !!opts.signatureFreeSpent }), phenSection, warpShockSection]
  }, { rolls: allRolls, flags: signatureRerollable
    // Параметры броска — чтобы кнопка «Переброс» с карточки повторила тест с теми же модификаторами.
    // JSON-круг выкидывает функции (onResult и т.п.): во флаге только данные.
    ? { "warhammer-dbc": { psyManifest: { actorUuid: actor.uuid, powerUuid: item.uuid, opts: JSON.parse(JSON.stringify(opts)),
        rolled: { focusRoll: rolledFocus, pushBonus: pushBonus || null, conduit: rolledConduit } } } }
    : null });
  // Бесплатное Очко Ключевых Сил этого переброса уже занято (вне боя Раунда нет — иначе новая карточка дала бы второе).
  if (opts.signatureFreeSpent && manifestCard) await markCardOnce(manifestCard, "signatureFreeUsed");
  // Automated Animations (если установлен и включён) — module/integrations/autoanimations.mjs.
  triggerAttackAnimation({ actor, item, hit: success });
  // Кто открыл манифестацию с контекстом (Огонь Души с карточки урона,
  // module/combat/soulfire.mjs) — узнаёт исход; обычный каст с листа его не передаёт.
  await opts.onResult?.({ success, deg, ePR });
}

/**
 * Вышел ли носитель Плода Плоти из радиуса поддержания силы (wdbc-bd1ii).
 * эПР — зафиксированный при поддержании (sustainedEpr), иначе текущий тПР.
 */
function fruitLeftSustainRange(casterActor, bearerActor, power) {
  const a = casterActor?.getActiveTokens?.(false)?.[0] ?? null;
  const b = bearerActor?.getActiveTokens?.(false)?.[0] ?? null;
  if (!a || !b) return false;
  const pr = Number(power.system?.sustainedEpr ?? casterActor.system?.psyker?.currentRating) || 0;
  return leftSustainRange(power.system, pr, measureTokens(a, b)?.edgeM ?? null);
}

export function rollPsyniscience(actor, rollSkill) {
  const def = SKILLS_DEF.psyniscience;
  const sk  = actor.system.skills?.psyniscience;
  // cannotUntrained (книга, стр. 57, сноска ²): тест вообще недоступен без
  // изучения — минуя .psy-sense-btn (onSkillRoll сюда не вызывается).
  if (def?.cannotUntrained && (sk?.rank ?? "untrained") === "untrained") {
    ui.notifications.warn(`${def.label}: нельзя использовать неизученным.`);
    return;
  }
  return rollSkill(def?.label ?? "Пси-чутьё", sk?.total ?? -20, def?.char ?? "per", { skill: "psyniscience" });
}

/** Тест W + PR×5 (для Пси-капюшона и Выжигания Души). */
export async function rollPsyWpTest(actor, label, note) {
  const wp  = actor.system.characteristics?.wp?.total ?? 0;
  const pr  = actor.system.psyker?.currentRating ?? 0;
  const eff = wp + 5 * pr;
  const roll = await new Roll("1d100").evaluate();
  const rv   = roll.total;
  const success = rv <= eff;
  const deg  = Math.floor(Math.abs(rv - eff) / 10) + 1;
  await postTestCard(actor, {
    title: label,
    threshold: rollStatLine({ label: "WP", base: wp, parts: [`5×PR(${pr})`], threshold: eff, rv }),
    outcome: outcomeHtml(success, `${success ? "Успех" : "Провал"} — ${deg} ${_degWord(deg)}`),
    sections: [`<div class="roll-threshold" style="font-size:0.85em;color:#5a4a30;">${note}</div>`]
  }, { rolls: [roll] });
}

/** Применение Силы навигатора: простой тест характеристики (без Феноменов/Прорывов). */
export async function activateNavigatorPower(actor, item) {
  const sys     = item.system;
  const charKey = sys.testChar || "wp";
  const meta    = CHARACTERISTICS[charKey];
  const charVal = actor.system.characteristics?.[charKey]?.total ?? 0;
  // У Силы навигатора своего диалога с галочками нет, но берём тот же
  // autoMods — чтобы правило «+10 к манифестациям» не применялось молча.
  const fatigue = autoModsTotal(resolveTest({ actor, kind: "power", power: item, char: charKey }).autoMods);
  const eff     = charVal + (sys.testMod || 0) + fatigue;

  const roll    = await new Roll("1d100").evaluate();
  const rv      = roll.total;
  const success = rv <= eff;
  const deg     = Math.floor(Math.abs(rv - eff) / 10) + 1;
  const allRolls = [roll];

  // Урон (если задан и сила сработала)
  let dmgSection = "";
  if (success && sys.damage) {
    const chars = actor.system.characteristics;
    const f = resolveCharFormula(String(sys.damage), chars, actor.system.corruptionBonus ?? 0);
    try {
      const dmgRoll = await new Roll(f).evaluate();
      allRolls.push(dmgRoll);
      const dt  = DAMAGE_TYPES[sys.damageType] || sys.damageType;
      const pen = sys.penetration || 0;
      dmgSection = `
          <div class="roll-damage-section">
            <div class="roll-damage-label">Урон (${dt}, Проб. ${pen}): <b>${dmgRoll.total}</b></div>
            <button class="wh-apply-dmg-btn" type="button"
              data-damage="${dmgRoll.total}" data-penetration="${pen}"
              data-damage-type="${sys.damageType}" data-hit-location="Торс"
              data-weapon-name="${item.name}" data-attacker="${actor.name}"
              data-psychic="1" data-psy-power-type="${esc(item.system?.powerType || "")}"
              data-psy-indirect="${isIndirectPower(item.system) ? 1 : ""}">
              Применить урон: ${dmgRoll.total} → Торс
            </button>
          </div>`;
    } catch (e) { ui.notifications.warn(`Не удалось бросить урон: ${sys.damage}`); console.error(e); }
  }

  const dice = (await Promise.all(allRolls.map(r => r.render()))).join("");

  // wdbc-8m0x: тот же паттерн, что у executePsychotest — сохраняем степень
  // успеха на предмете, чтобы номер был виден на листе, пока Сила поддерживается.
  await item.update({ "system.sustainedDegree": success ? deg : null });

  await postTestCard(actor, {
    icon: rollIcon("spark","#8b78ff"), title: `Сила навигатора: ${esc(item.name)}`,
    threshold: rollStatLine({
      label: meta?.abbr ?? charKey, base: charVal,
      parts: [sys.testMod ? `${sys.testMod >= 0 ? "+" : ""}${sys.testMod}` : "", fatigue ? `😓 ${fatigue}` : ""],
      threshold: eff, rv
    }),
    lines: [
      sys.powerKind ? `<div class="roll-threshold" style="font-size:0.85em;">${sys.powerKind}</div>` : "",
      sys.opposed ? `<div class="roll-threshold" style="font-size:0.85em;">Встречный — цель бросает свою хар-ку.</div>` : "",
      sys.range ? `<div class="roll-threshold" style="font-size:0.85em;">Дальность: <b>${sys.range}</b></div>` : ""
    ],
    outcome: outcomeHtml(success, `${success ? "Успех" : "Провал"} — ${deg} ${_degWord(deg)}`),
    sections: [
      dmgSection,
      sys.effect ? `<div class="roll-threshold">${sys.effect}</div>` : "",
      `<div class="roll-threshold" style="font-size:0.78em;color:#5a4a30;">Навигатор не бросает по таблицам Феноменов и Прорывов Варпа.</div>`,
      `<details class="roll-dice-details"><summary>${rollIcon("chart","#8fd0ff")}Показать кубы</summary>${dice}</details>`
    ]
  }, { rolls: allRolls });
}

export function activatePsychicListeners(html, actor, { rollSkill, resolveSoulBurn } = {}) {
  // ── Силы навигатора (вкладка НАВ) ──────────────────────────────────────
  html.find(".nav-add-btn").click(async ev => {
    ev.preventDefault();
    const item = await Item.create({ name: "Новая сила навигатора", type: "navigatorPower" }, { parent: actor });
    item?.sheet?.render(true);
  });
  html.find(".nav-activate-btn").click(ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) activateNavigatorPower(actor, item);
  });
  html.find(".nav-sustain-cb").change(async ev => {
    const id = ev.currentTarget.dataset.itemId;
    const on = ev.currentTarget.checked;
    // Можно поддерживать только одну Силу навигатора одновременно
    const updates = [];
    for (const it of actor.items) {
      if (it.type !== "navigatorPower") continue;
      const want = it.id === id ? on : false;
      if ((it.system.isSustained || false) !== want) {
        // wdbc-8m0x: снятие поддержания (в т.ч. чужой Силы — тут можно
        // поддерживать только одну) сбрасывает сохранённую степень успеха.
        const upd = { _id: it.id, "system.isSustained": want };
        if (!want) upd["system.sustainedDegree"] = null;
        updates.push(upd);
      }
    }
    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
    for (const it of actor.items) {
      if (it.type !== "navigatorPower") continue;
      await syncItemEffectsDisabled(it, it.id === id ? on : false);
    }
  });

  // ── Псайкана ──────────────────────────────────────────────────────────
  // Базовый PR и Природа Дара редактируются и в ПСИ, и в Развитии — через
  // class-обработчики (без name=), чтобы не было конфликта дублей в форме.
  html.find(".psy-rating-input").change(ev => {
    actor.update({ "system.psyker.rating": parseInt(ev.currentTarget.value) || 0 });
  });
  html.find(".psy-class-select").change(ev => {
    actor.update({ "system.psyker.class": ev.currentTarget.value });
  });

  // wdbc-l6zg: чип «Фокус Дисциплины» — клик отмечает/снимает свой выбор.
  // Дарованные способностью (Perfect Sorcerer и т.п.) чипы приходят disabled
  // из шаблона; disabled-кнопка click в браузере не всплывает, проверка ниже
  // — просто защита для тестовых стабов, где .disabled не влияет на click().
  html.find(".psy-focus-chip").click(ev => {
    if (ev.currentTarget.disabled) return;
    const key = ev.currentTarget.dataset.discipline;
    if (!key) return;
    const own = Array.isArray(actor.system.psyker?.focusDisciplines) ? actor.system.psyker.focusDisciplines : [];
    const next = own.includes(key) ? own.filter(k => k !== key) : [...own, key];
    actor.update({ "system.psyker.focusDisciplines": next });
  });

  // Предмет-Психофокус и его резонанс (rules/psy-focus.mjs::focusQualityEffect).
  // Смена предмета сбрасывает резонанс: он выбирался под другой фокус.
  html.find(".psy-focus-item-select").change(ev => {
    actor.update({
      "system.psyker.focusItemId": ev.currentTarget.value,
      "system.psyker.focusResonance": ""
    });
  });
  html.find(".psy-focus-resonance-select").change(ev => {
    actor.update({ "system.psyker.focusResonance": ev.currentTarget.value });
  });

  html.find(".psy-add-btn").click(async ev => {
    ev.preventDefault();
    const item = await Item.create({ name: "Новая психосила", type: "psychicPower" }, { parent: actor });
    item?.sheet?.render(true);
  });
  html.find(".psy-sustain-cb").change(async ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (!item) return;
    const turningOn = ev.currentTarget.checked;
    if (turningOn && warpLockBlocksManifest(actor)) {
      ev.currentTarget.checked = false;
      ui.notifications.warn("Варп-Замок: до начала следующего Хода вы не псайкер — поддержание не включить.");
      return;
    }
    if (turningOn && sarcophagusBlocksPsychicPowers(actor)) {
      ev.currentTarget.checked = false;
      ui.notifications.warn("Саркофаг Дредноута: поддержание психосил заблокировано (нужна Матрица Осирис).");
      return;
    }
    // Заточение Силы (Fruit of Flesh/Плод Плоти, Тзинч, wdbc-1rno,
    // apps/fruit-of-flesh.mjs::activateSpellLockFruit): цель психосилы
    // выбрала провалить встречный тест на W и заточить атаку в плод — снять
    // поддержание нельзя, пока плод (fromUuid по сохранённому uuid) ещё
    // существует. Уничтоженный/удалённый плод просто не резолвится —
    // отдельного хука на его удаление не нужно.
    if (!turningOn) {
      const lockUuid = item.getFlag?.("warhammer-dbc", "fruitOfFleshLockUuid");
      const fruit = lockUuid ? await fromUuid(lockUuid) : null;
      // «...или покинет радиус поддержания» (wdbc-bd1ii): замок отпускает,
      // когда носитель плода на сцене дальше радиуса поддержания силы
      // (rules/psy-range.mjs::leftSustainRange). Нет обоих токенов на сцене
      // или радиус не числовой — выход не доказан, замок держится.
      if (fruit && !fruitLeftSustainRange(actor, fruit.actor, item)) {
        ev.currentTarget.checked = true;
        ui.notifications.warn("Заточена в Плоде Плоти — нельзя развеять, пока плод не уничтожен или не покинет радиус поддержания.");
        return;
      }
    }
    // wdbc-8m0x: снятие поддержания сбрасывает сохранённую степень успеха —
    // иначе на листе осталось бы висеть устаревшее число от прошлого каста.
    // Поддержание снято — один общий набор сбросов (combat/psychic-sustain.mjs: степень успеха, эPR, цель,
    // свойства Force Blade, замок Плода Плоти, «бесплатно» Раны в Реальности); тот же список использует Варп-Замок.
    const upd = turningOn ? { "system.isSustained": true } : sustainOffPatch(item);
    if (turningOn) {
      // wdbc-lmd2: запоминаем текущую цель (Foundry-таргетинг) — нужна
      // способностям вида «Цели психосилы получают...» (Dragon Scales/Wings
      // of the Phoenix). Ничего не выделено — сила всё равно поддерживается
      // (себе тоже можно), просто без cross-actor эффекта на посторонней цели.
      const targetActor = [...(game.user?.targets ?? [])][0]?.actor;
      upd["system.sustainedTargetUuid"] = targetActor?.uuid || "";
    }
    await item.update(upd); await syncItemEffectsDisabled(item);
  });
  // Ключевые Силы (пачка I1): звёздочка у силы — отметить/снять; список хранится на самом Таланте.
  html.find(".psy-signature-toggle").click(async ev => {
    ev.preventDefault();
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    const talent = signatureTalent(actor);
    if (!item || !talent) return;
    const res = signatureToggle(actor, item);
    if (!res.ok) { ui.notifications.warn(res.reason); return; }
    await talent.setFlag("warhammer-dbc", SIGNATURE_FLAG, res.names);
  });
  // Варп-Замок (пачка I2): подавить потенциал в начале Хода / сбросить счётчик часа / снять метку «не псайкер».
  html.find(".psy-warplock-suppress").click(async ev => { ev.preventDefault(); await applyWarpLock(actor, "suppress"); });
  html.find(".psy-warplock-reset").click(async ev => { ev.preventDefault(); await resetWarpLockHour(actor); });
  html.find(".psy-warplock-clear").click(async ev => { ev.preventDefault(); await clearWarpLockMark(actor); });
  // Рана в Реальности (пачка I2): «бесплатно» у поддерживаемой силы — отметить/снять (до Cor.b сил).
  html.find(".psy-wound-free-toggle").click(async ev => {
    ev.preventDefault();
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (!item) return;
    await setWoundFree(actor, item, !item.getFlag("warhammer-dbc", WOUND_FREE_FLAG));
  });
  // Текучее Плетение (пачка I1): «Переплести» у поддерживаемой силы и возврат очка концентрацией.
  html.find(".psy-weave-btn").click(async ev => {
    ev.preventDefault();
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) await weaveFluid(actor, item);
  });
  html.find(".psy-fluid-restore-btn").click(async ev => {
    ev.preventDefault();
    await restoreFluidWeavePoint(actor);
  });
  html.find(".psy-manifest-btn").click(ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) showManifestDialog(actor, item);
  });
  html.find(".psy-learn-rune-btn").click(async ev => {
    const item = actor.items.get(ev.currentTarget.dataset.itemId);
    if (item) await learnSigilliteRune(actor, item);
  });
  html.find(".psy-sense-btn").click(() => {
    if (rollSkill) rollPsyniscience(actor, rollSkill);
  });
  html.find(".psy-hood-btn").click(() => rollPsyWpTest(
    actor,
    "🛡️ Пси-капюшон",
    "Реакция: встречный тест W+PR×5 — уменьшает Успехи вражеской манифестации на ваши (при равенстве/больше — гасит силу)."));
  html.find(".psy-soulburn-btn").click(() => resolveSoulBurn?.(actor.id));
}

// Парсит текст особых свойств профиля психосилы («Tearing, Felling (4), Toxic (7, 2d10)»)
// в записи {key,rating,rating2}. Имена сопоставляются по label/en реестра.
function parsePsyPropsText(text) {
  if (!text) return [];
  const tokens = []; let depth = 0, cur = "";
  for (const ch of String(text)) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) { tokens.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) tokens.push(cur.trim());
  const byName = {};
  for (const d of Object.values(WEAPON_PROPERTIES)) {
    byName[d.label.toLowerCase()] = d.key;
    if (d.en) byName[d.en.toLowerCase()] = d.key;
  }
  const out = [];
  for (const tok of tokens) {
    if (!tok) continue;
    const m = tok.match(/^(.*?)\s*\((.*)\)\s*$/);
    let name = tok, rating = null;
    if (m) { name = m[1].trim(); rating = m[2].trim(); }
    const key = byName[name.toLowerCase()];
    if (!key) continue;
    const entry = { key, rating: 0, rating2: 0 };
    if (rating != null) {
      // Число — числом, формула («PR*2», «(PR+СУ)*3») — строкой: её считает
      // resolvePropRatings так же, как рейтинги system.weaponProps основного
      // профиля (wdbc-1mwm9; раньше parseInt давал 0 или обрезал формулу).
      const asRating = s => (/^-?\d+$/.test(s) ? Number(s) : s);
      const parts = rating.split(",").map(s => s.trim());
      if (parts[0]) entry.rating = asRating(parts[0]);
      if (parts[1]) entry.rating2 = asRating(parts[1]);
    }
    out.push(entry);
  }
  return out;
}
