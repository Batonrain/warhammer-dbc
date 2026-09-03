// module/combat/spirit-talk.mjs
// ════════════════════════════════════════════════════════════════════════
//  Spirit Talk / Духовный Разговор (wdbc-q30d, Певцы Кости): «За Полное
//  действие персонаж выбирает один психокостяной конструкт не больше
//  призрачного лорда в радиусе W м. Союзный подчиняется автоматически;
//  враждебный (кроме одержимых демонами) — W+0/F+10 vs W+0, при победе
//  захват контроля. Контроль длится F.b раундов: конструкт ходит СРАЗУ
//  ПОСЛЕ персонажа, имеет его характеристики (кроме S, T, A), таланты и
//  навыки. До 3 раз за сессию.»
//
//  «Психокостяной конструкт» = актор типа vehicle — тот же приём, что уже
//  использует вся семья Певцов Кости (preservation.mjs/song-of-swiftness.mjs/
//  bone-song.mjs): движок не различает материал техники (психокость от
//  обычной брони), решение оставлено столу.
//
//  ЭТА находка — тот же класс сложности, что Last Actor (wdbc-1rno):
//  интеграция с порядком ходов Combat/Combatant напрямую, поверх
//  инфраструктуры module/combat/extra-turn.mjs (доп. Combatant) и того же
//  паттерна раундового хука, что middle-of-the-hunt.mjs (пере-применяется
//  идемпотентно в начале каждого Раунда, пока контроль активен). В отличие
//  от Last Actor конструкт — ДРУГОЙ актор, не тот же самый: если у него ещё
//  нет своего Combatant в бою, этот модуль заводит его сам (нужен активный
//  токен цели на сцене), помечает flags.warhammer-dbc.spiritTalkPossession
//  и держит его инициативу чуть ниже инициативы персонажа-кастера — «ходит
//  сразу после» на каждом раунде до истечения F.b.
//
//  Дальность W м (WP+0 персонажа, метров) — той же геометрией, что
//  измеряет стрельбу/рукопашную (combat/tactical-map.mjs::measureTokens,
//  edgeM — от края Базы до края Базы), а не отдельной формулой. Предел
//  размера «не больше призрачного лорда» — Призрачный Лорд/Wraithlord,
//  Размер 2 (Книга Эльдар: Техника, «ПРИЗРАЧНЫЕ КОНСТРУКТЫ» → «Призрачный
//  Лорд», stat-блок техники), Талант недоступен на Size > 2.
//
//  Манифестация психосил через захваченный конструкт — rules/psychic-
//  vessel.mjs: общий примитив «через кого сейчас манифестирует псайкер»,
//  которым также размечен Путь Силы Псайбер-Фамильяра (constants/
//  psyker.mjs, PSY_PATHS.familiar). Захват назначает конструкт носителем,
//  снятие захвата (истёк F.b или кастер выбыл из боя) его снимает.
//
//  НЕ смоделировано (см. capabilities.mjs):
//  1. «Имеет характеристики (кроме S/T/A), таланты и навыки персонажа» —
//     module/data/actor/vehicle.mjs вообще не несёт схему characteristics
//     (у Техники их нет ни у кого, только chassis.strength/spd/структура,
//     подтверждено книжным stat-блоком Призрачного Стража/Лорда — та же
//     AP/Структура/Размер форма, что у прочей техники, а не характеристики)
//     — заводить временный оверлей характеристик персонажа поверх актора
//     Техники и переучивать весь конвейер тестов/атак читать его для одной
//     находки не оправдано (тот же принцип, что Категория D wdbc-1rno).
//     Игровой эффект остаётся на столе.
//  2. Встречный тест W+0/F+10 vs W+0: у Техники нет характеристики Воли в
//     схеме — сторону цели не прочитать. Автоматизирована только сторона
//     персонажа (лучшее из WP+0/Fel+10), исход стол сравнивает вручную и
//     подтверждает диалогом (тот же приём, что Deadly Effectiveness — игрок
//     сам подтверждает клик).
//  3. Дальность самой манифестации психосилы через носителя не измеряется —
//     эта механика (sheets/tabs/psychic.mjs) вообще не мерит дистанцию даже
//     для собственной позиции кастера, только текстовая подсказка sys.range;
//     rules/psychic-vessel.mjs даёт лишь ИМЯ носителя в заметке.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { hasActionEconomy, isEncounterActive, spendActionPoints, apCostForActionType } from "./action-economy.mjs";
import { isThrottleCountAvailable, incrementThrottleCount } from "../rules/cooldown.mjs";
import { tokenRelationship } from "../regions/auras.mjs";
import { measureTokens } from "./tactical-map.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { setPsychicVessel, clearPsychicVessel } from "../rules/psychic-vessel.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const COOLDOWN_FLAG = "spiritTalk";
const MAX_USES = 3; // «До 3 раз за сессию» — фиксированное число, не F.b.
const POSSESSION_FLAG = "spiritTalkPossession"; // на Combatant цели
const ROUND_SYNC_FLAG = "spiritTalkSyncedRound"; // идемпотентность раундового хука
// Призрачный Лорд/Wraithlord, Размер 2 (Книга Эльдар: Техника) — предел «не
// больше призрачного лорда» книжного текста находки.
const WRAITHLORD_SIZE = 2;

export function hasSpiritTalk(actor) {
  return !!actor?.items?.some(i => i.type === "talent" && itemHasName(i, "Spirit Talk"));
}

/** Длительность контроля — F.b раундов (Товарищество, ключ "fel" в схеме характеристик). */
export function spiritTalkDuration(actor) {
  return Math.max(0, Number(actor?.system?.characteristics?.fel?.bonus) || 0);
}

/** Радиус W м — WP+0 (raw), тем же обозначением книги, что у прочих Певцов Кости. */
export function spiritTalkRadius(actor) {
  return Math.max(0, Number(actor?.system?.characteristics?.wp?.total) || 0);
}

/**
 * Дистанция цель-кастер (edgeM, от края Базы до края Базы — combat/
 * tactical-map.mjs::measureTokens, та же геометрия, что у стрельбы), или
 * null, если хотя бы одного токена нет на сцене — измерить нечем, гейт
 * тогда не блокирует по дальности (fail-open, тот же принцип, что у
 * остальных мест, где measureTokens может не найти токен).
 */
function distanceToTarget(actor, targetToken) {
  const casterToken = actor?.getActiveTokens?.(false, true)?.[0] ?? null;
  if (!casterToken || !targetToken) return null;
  return measureTokens(casterToken, targetToken)?.edgeM ?? null;
}

/** {disabled, title} для кнопки — гейт виден ДО клика (тот же приём, что bowToAudienceGate). */
export function spiritTalkGate(actor) {
  const duration = spiritTalkDuration(actor);
  const ap = Number(actor?.system?.actionPoints?.value) || 0;
  const targets = [...(game.user?.targets ?? [])];
  if (duration <= 0) return { disabled: true, title: "F.b = 0 — длительность захвата нулевая" };
  if (!game.combat) return { disabled: true, title: "Требует активного боя — конструкт должен встать в очередь ходов" };
  if (targets.length !== 1) return { disabled: true, title: "Наведите ровно один таргет (T) на психокостяной конструкт" };
  const targetActor = targets[0].actor;
  if (targetActor?.type !== "vehicle") return { disabled: true, title: "Цель должна быть Техникой (психокостяной конструкт)" };
  const size = Number(targetActor.system?.size) || 0;
  if (size > WRAITHLORD_SIZE)
    return { disabled: true, title: `Конструкт крупнее призрачного лорда (Размер ${size} > ${WRAITHLORD_SIZE}) — вне действия Таланта` };
  const radius = spiritTalkRadius(actor);
  const distance = distanceToTarget(actor, targets[0]);
  if (distance !== null && distance > radius)
    return { disabled: true, title: `Вне радиуса: WP=${radius} м, до цели ${distance} м` };
  if (ap < 2) return { disabled: true, title: `Не хватает ОД: нужно 2 (Полное действие), есть ${ap}` };
  if (!isThrottleCountAvailable(actor, COOLDOWN_FLAG, "session", MAX_USES))
    return { disabled: true, title: `Уже использовано ${MAX_USES} раз(а) за сессию` };
  return { disabled: false, title: `Захват контроля на F.b=${duration} раунд(а/ов), радиус WP=${radius} м, 2 ОД, до ${MAX_USES} раз за сессию` };
}

/** Первый (обычный) Combatant этого актора в бою — не доп.-Ходовой другой находки. */
function findCombatant(combat, actorId) {
  for (const c of combat?.combatants ?? []) if (c?.actorId === actorId) return c;
  return null;
}

/** Инициатива цели чуть ниже кастера — «ходит сразу после». Кастер ещё не бросил инициативу (null) — синхронизация откладывается до следующего раунда. */
async function _syncInitiativeAfterCaster(targetCombatant, casterCombatant) {
  const raw = casterCombatant?.initiative;
  if (raw === null || raw === undefined) return; // Number(null) === 0 — ловить явно, не полагаться на isFinite после коэрции
  const casterInit = Number(raw);
  if (!Number.isFinite(casterInit)) return;
  await targetCombatant.update({ initiative: casterInit - 0.01 });
}

/**
 * Применяет захват контроля: заводит (если ещё нет) Combatant цели в этом
 * бою и ставит его инициативу сразу за кастером. Возвращает Combatant цели,
 * или null, если у кастера самого нет Combatant (нечего "после" ставить).
 */
export async function applySpiritTalkPossession(combat, casterActor, targetActor, { targetTokenId = null, duration } = {}) {
  if (!combat || !casterActor || !targetActor) return null;
  const casterCombatant = findCombatant(combat, casterActor.id);
  if (!casterCombatant) return null;

  let targetCombatant = findCombatant(combat, targetActor.id);
  const added = !targetCombatant;
  if (!targetCombatant) {
    const [created] = await combat.createEmbeddedDocuments("Combatant", [
      { actorId: targetActor.id, tokenId: targetTokenId, initiative: null }
    ]);
    targetCombatant = created;
  }
  if (!targetCombatant) return null;

  const expiresRound = (Number(combat.round) || 1) + Number(duration) - 1;
  await targetCombatant.setFlag("warhammer-dbc", POSSESSION_FLAG, {
    casterCombatantId: casterCombatant.id, casterActorId: casterActor.id, expiresRound, added
  });
  await _syncInitiativeAfterCaster(targetCombatant, casterCombatant);
  return targetCombatant;
}

/**
 * Снимает захват: убирает метку, снимает носителя манифестации с кастера
 * (rules/psychic-vessel.mjs — только если он ещё указывает именно на эту
 * цель, чтобы не затереть более новый захват/фамильяра того же кастера),
 * удаляет Combatant, если его завёл сам этот модуль.
 */
async function _revokePossession(combat, combatant, possession, casterActor) {
  await combatant.unsetFlag("warhammer-dbc", POSSESSION_FLAG);
  await combatant.unsetFlag("warhammer-dbc", ROUND_SYNC_FLAG);
  if (casterActor?.getFlag?.("warhammer-dbc", "psychicVessel")?.uuid === combatant.actor?.uuid) {
    await clearPsychicVessel(casterActor);
  }
  if (possession?.added) await combat.deleteEmbeddedDocuments("Combatant", [combatant.id]);
}

/**
 * Смена Раунда: у каждого захваченного Combatant — либо снять захват
 * (истёк F.b или кастер выбыл из боя), либо пере-выставить инициативу сразу
 * за кастером (тот мог сам сдвинуться — Last Actor доп. Ход, Middle of the
 * Hunt +10 и т.п.). Идемпотентно тем же приёмом, что и
 * processMiddleOfTheHuntRoundStart — тег текущего раунда на Combatant.
 */
export async function processSpiritTalkRoundStart(combat) {
  if (!combat) return;
  for (const combatant of [...(combat.combatants ?? [])]) {
    const possession = combatant?.getFlag?.("warhammer-dbc", POSSESSION_FLAG);
    if (!possession) continue;
    if (combatant.getFlag?.("warhammer-dbc", ROUND_SYNC_FLAG) === combat.round) continue;

    const casterCombatant = findCombatant(combat, possession.casterActorId)
      ?? [...(combat.combatants ?? [])].find(c => c?.id === possession.casterCombatantId);

    if ((Number(combat.round) || 1) > possession.expiresRound || !casterCombatant) {
      await _revokePossession(combat, combatant, possession, casterCombatant?.actor ?? null);
      continue;
    }
    await _syncInitiativeAfterCaster(combatant, casterCombatant);
    await combatant.setFlag("warhammer-dbc", ROUND_SYNC_FLAG, combat.round);
  }
}

/** Списывает 2 ОД (Полное действие) и счётчик «до 3 раз за сессию». */
async function _spendAndCount(actor) {
  if (!await spendActionPoints(actor, apCostForActionType("Полное действие"))) return false;
  await incrementThrottleCount(actor, COOLDOWN_FLAG, "session", MAX_USES);
  return true;
}

/**
 * Клик по кнопке: тратит 2 ОД + счётчик сессии, союзной цели захват
 * автоматический, враждебной — бросок персонажа (лучшее из WP+0/Fel+10) +
 * ручное подтверждение встречного теста (см. заголовок файла, п.3), затем
 * встраивает конструкт в очередь ходов на F.b раундов.
 */
export async function triggerSpiritTalk(actor) {
  if (!hasActionEconomy(actor) || !hasSpiritTalk(actor) || !isEncounterActive()) return null;
  const gate = spiritTalkGate(actor);
  if (gate.disabled) { ui.notifications?.warn(`⚠️ ${gate.title}`); return null; }

  const targetToken = [...(game.user?.targets ?? [])][0];
  const targetActor = targetToken?.actor;
  const combat = game.combat;
  const duration = spiritTalkDuration(actor);
  const rollMode = game.settings.get("core", "rollMode");

  if (!await _spendAndCount(actor)) {
    ui.notifications?.warn("⚠️ Не хватает ОД (нужно 2).");
    return null;
  }

  const casterToken = actor.getActiveTokens?.(false, true)?.[0] ?? null;
  const relationship = casterToken?.document && targetToken?.document
    ? tokenRelationship(casterToken.document.disposition, targetToken.document.disposition)
    : "neutral";
  const hostile = relationship === "enemy";
  let rollInfo = null;

  if (hostile) {
    const wp = Number(actor.system?.characteristics?.wp?.total) || 0;
    const fel = Number(actor.system?.characteristics?.fel?.total) || 0;
    const useChar = (fel + 10) > wp ? "fel" : "wp";
    const threshold = useChar === "fel" ? fel + 10 : wp;
    const roll = await new Roll("1d100").evaluate();
    const outcome = testOutcome(roll.total, threshold);
    rollInfo = { ...outcome, threshold, useChar, rv: roll.total };

    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="wh-roll-result">
        <div class="roll-header">${rollIcon("spark", "#c98bff")}${esc(actor.name)} — Духовный Разговор vs ${esc(targetActor.name)}</div>
        <div class="roll-threshold">${useChar === "fel" ? "Fel+10" : "WP+0"} = <b>${threshold}</b>, бросок <b>${roll.total}</b> — ${outcome.success ? `успех, степень ${outcome.deg}` : "провал"}.</div>
        <div class="roll-threshold" style="font-size:0.85em;">Встречный тест против WP+0 конструкта — у Техники нет характеристики Воли в схеме, стол сверяет степени вручную и подтверждает захват в диалоге.</div>
      </div>`
    }, rollMode));

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Духовный Разговор — встречный тест" },
      content: `<p>Персонаж прошёл ${useChar === "fel" ? "Fel+10" : "WP+0"} = <b>${threshold}</b> против <b>${roll.total}</b>${outcome.success ? `, степень ${outcome.deg}` : " (провал)"}.</p>
        <p>Сравните за столом со встречным тестом WP+0 конструкта «${esc(targetActor.name)}». Персонаж выиграл встречный тест и захватывает контроль?</p>`,
      rejectClose: false
    });
    if (!confirmed) {
      await ChatMessage.create(ChatMessage.applyRollMode({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="wh-roll-result"><div class="roll-outcome"><span class="roll-failure">Встречный тест проигран — контроль не захвачен, действие израсходовано впустую.</span></div></div>`
      }, rollMode));
      return { success: false, hostile: true, roll: rollInfo };
    }
  }

  const combatant = await applySpiritTalkPossession(combat, actor, targetActor, {
    targetTokenId: targetToken?.document?.id ?? null, duration
  });
  if (!combatant) {
    ui.notifications?.warn("⚠️ Не удалось встроить конструкт в очередь ходов (у персонажа нет Combatant в этом бою?).");
    return { success: true, hostile, roll: rollInfo, applied: false };
  }
  // Носитель манифестации (rules/psychic-vessel.mjs) — «может манифестировать
  // психосилы... через конструкт»: перезаписывает предыдущего носителя того
  // же кастера (более свежий захват старше). Снимается _revokePossession
  // выше при истечении/выбытии кастера.
  await setPsychicVessel(actor, targetActor);

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("spark", "#c98bff")}${esc(actor.name)} — Духовный Разговор</div>
      <div class="roll-threshold">Контроль над «${esc(targetActor.name)}» захвачен на <b>${duration}</b> раунд(а/ов): конструкт ходит сразу после персонажа.</div>
    </div>`
  }, rollMode));

  return { success: true, hostile, roll: rollInfo, applied: true, duration };
}
