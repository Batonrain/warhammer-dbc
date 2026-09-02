// module/combat/grapple.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Борьба (стр. 12). После успешного Приёма «Захват» (module/constants/
//  combat.mjs, MELEE_MANEUVERS.grapple) атакующий и цель становятся связаны
//  Захватом — заводим состояние conditions.grappling (module/data/actor/
//  _creature.mjs) на обоих, как Оглушение/Беспомощный. Пока оно активно, оба
//  участника видят кнопку «Борьба» в блоке Состязаний вкладки БОЙ.
//
//  Роль (кто сейчас Атакующий/Цель Борьбы) НЕ отслеживается отдельным полем —
//  книга сама даёт способ её сменить (Перехватить Контроль), а бои и так
//  требуют доверия к игрокам за столом (см. остальные Приёмы: Повалить,
//  Финт — тоже не проверяют, чей сейчас Ход). Поэтому все 8 действий раздела
//  показаны обоим участникам разом, с текстом ровно по книге — кто отыгрывает
//  какое, решают сами за столом.
//
//  Сжать/Метнуть/Замахнуться/Укусы не имеют парного встречного теста между
//  Атакующим и партнёром — только Заломить/Пересилить/Вырваться/Выкрутиться/
//  Перехватить Контроль его имеют, и заведены через уже готовый
//  _showContestDialog (module/combat/techniques.mjs) — тот же диалог «Приём
//  vs Приём», что у Повалить/Напролом/Финта/Давления, просто с другой
//  характеристикой по умолчанию.
//
//  Метнуть/Замахнуться (стр. 12) — НЕ атака на самого партнёра: это общее
//  правило «Импровизированное оружие»/«Метание» (стр. 27-28,
//  module/rules/improvised-weapon.mjs), где партнёр — снаряд/дубина, а бьют
//  ими по ТРЕТЬЕЙ цели (текущая цель под прицелом Foundry). Партнёр получает
//  тот же урон, что и цель, минуя броню («урон от падения») — см. _doSwing/
//  _doThrow ниже.
// ════════════════════════════════════════════════════════════════════════════

import { _showContestDialog } from "./techniques.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { itemHasName, sizeOf } from "../rules/predicates.mjs";
import { resolveWeaponProps, aggregateAuto } from "./weapon-properties.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { MELEE_STANCES, MELEE_BASES } from "../constants/combat.mjs";
import { fatiguePenalty } from "../sheets/tabs/conditions.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { bodyWeightOf, totalWeightOf, throwTier, canWieldAsCudgel, footingRequirement }
  from "../rules/improvised-weapon.mjs";

const NS = "warhammer-dbc";
const PARTNER_FLAG = "grapplePartnerUuid";

/**
 * После попадания Приёмом «Захват» — связать атакующего и цель Борьбой.
 * Вызывается из module/combat/attack.mjs сразу после расчёта попадания.
 * @param {Actor} actor       атакующий
 * @param {Token|null} targetToken   первая наведённая цель (как у остального attack.mjs)
 * @param {boolean} hit
 * @param {{technique?:string}} techOpts
 */
export async function applyGrappleOnHit(actor, targetToken, hit, techOpts) {
  if (!hit || techOpts?.technique !== "grapple") return;
  const target = targetToken?.actor;
  if (!actor || !target || target === actor) return;

  // Состояние и флаг партнёра одним update на актора: каждая отдельная
  // запись — это prepareData + re-render листа и токена у всех клиентов.
  await actor.update({ "system.conditions.grappling": true, [`flags.${NS}.${PARTNER_FLAG}`]: target.uuid });
  await target.update({ "system.conditions.grappling": true, [`flags.${NS}.${PARTNER_FLAG}`]: actor.uuid });

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("sword","#e08a3a")}Захват — ${esc(actor.name)} ↔ ${esc(target.name)}</div>
      <div class="roll-outcome"><span class="roll-success">Оба персонажа связаны Захватом (состояние «Борьба»).</span></div>
      <div class="roll-threshold" style="font-size:0.85em;">Кнопка «Борьба» появилась на вкладке БОЙ у обоих участников.</div>
    </div>`
  }, rollMode));
}

/** Партнёр по Борьбе (или null, если флаг протух — цель распалась/сменила сцену). */
export function grapplePartner(actor) {
  const uuid = actor?.getFlag?.(NS, PARTNER_FLAG);
  if (!uuid) return null;
  try { return fromUuidSync(uuid); } catch { return null; }
}

/** Снять Борьбу с обоих участников разом (кнопка «Разорвать Захват» и любой Выход). */
export async function endGrapple(actor) {
  const partner = grapplePartner(actor);
  await actor.update({ "system.conditions.grappling": false, [`flags.${NS}.-=${PARTNER_FLAG}`]: null });
  if (partner) {
    await partner.update({ "system.conditions.grappling": false, [`flags.${NS}.-=${PARTNER_FLAG}`]: null });
  }
}

// ── Действия Атакующего (стр. 12) ────────────────────────────────────────────
const ATTACKER_TESTS = {
  wrench: {
    label: "Заломить", defaultChar: "s",
    note: "Полудействие. Athletics(S)+0 vs Athletics(S)+0 партнёра. Победа: на выбор — 1d5+S.b I(Cr) Dmg (игнорирует броню) и/или 1 Усталость цели.",
    chatNote: "🤼 Борьба: Заломить"
  },
  overpower: {
    label: "Пересилить", defaultChar: "s",
    note: "Полное действие. Athletics(S)+0 vs Athletics(S)+0 партнёра. Победа: сдвиг цели на Успехи м. (до меньшего из SPD) в любом направлении вместе с собой, либо Повалить её.",
    chatNote: "🤼 Борьба: Пересилить"
  }
};

// ── Действия Цели (стр. 12) ──────────────────────────────────────────────────
const TARGET_TESTS = {
  breakFree: {
    label: "Вырваться", defaultChar: "s",
    note: "Полное действие. Athletics(S)+0 vs Athletics(S)+0 партнёра. Победа: персонаж вырывается из Захвата — снимите «Борьба» кнопкой ниже.",
    chatNote: "🤼 Борьба: Вырваться"
  },
  twistFree: {
    label: "Выкрутиться", defaultChar: "a",
    note: "Полное действие. Acrobatics(A)+0 vs Athletics(S)+0 партнёра. Победа: персонаж вырывается из Захвата — снимите «Борьба» кнопкой ниже.",
    chatNote: "🤼 Борьба: Выкрутиться"
  },
  takeover: {
    label: "Перехватить Контроль", defaultChar: "s", defaultMod: -20,
    note: "Полное действие. Athletics(S)−20 vs Athletics(S)+0 партнёра. Победа: персонаж становится Атакующим Захвата и получает обратно одно полудействие.",
    chatNote: "🤼 Борьба: Перехватить Контроль"
  }
};

const ALL_TESTS = { ...ATTACKER_TESTS, ...TARGET_TESTS };

// Мутация Tentacle/Щупальце (wdbc-vkwe): «+20 на приём Захват и все тесты в
// Борьбе». Приём Захват читается отдельно, в module/sheets/attack-dialog.mjs
// (resolveSelection) — здесь только 5 РОЛЕВЫХ тестов раздела (Заломить/
// Пересилить/Вырваться/Выкрутиться/Перехватить Контроль, см. ALL_TESTS выше).
// Укус — тоже настоящий тест (WS/BS через attack-dialog.mjs, у него есть
// Item-оружие), получает бонус через techniqueOpts.modifier — см. _doBite
// ниже. Метнуть/Замахнуться — свои бесповодочные тесты (см. блок ниже, после
// _doCrunch), бонус закладывается прямо в порог. Сжать и Хруст броска не
// делают вовсе (первое — накопительный штраф без теста, второе —
// автоматическое попадание по книге), бонусу там нечего усиливать.
/** +20, если у актора есть Щупальце (mutation.tentacle) — иначе 0. */
export function tentacleBonus(actor) {
  return hasRuleFlag(actor, "mutation.tentacle") ? 20 : 0;
}

export function tentacleTechDef(actor, techDef) {
  const bonus = tentacleBonus(actor);
  return bonus
    ? { ...techDef, extraBonus: (techDef.extraBonus ?? 0) + bonus, extraBonusLabel: "Щупальце" }
    : techDef;
}

/** Сжать — без броска, накопительный штраф −10 за полудействие (стр. 12). */
async function _doSqueeze(actor) {
  const partner = grapplePartner(actor);
  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("sword","#e08a3a")}Борьба: Сжать</div>
      <div class="roll-outcome">${esc(actor.name)} крепче заламывает ${partner ? esc(partner.name) : "цель"}.</div>
      <div class="roll-threshold" style="font-size:0.85em;">Пока цель в Захвате: −10 на все Физические действия в её Ход за каждое потраченное на Сжатие полудействие (накапливается вручную).</div>
    </div>`
  }, rollMode));
}

// Оружие «Укус» — обе половины двуязычного имени (wdbc-l07y: было /укус/i, не
// находило предмет, записанный только английской половиной «Bite»).
export function isBiteWeapon(item) {
  return item?.type === "weapon" && (itemHasName(item, "Укус") || itemHasName(item, "Bite"))
    && (item.system?.weaponClass === "melee" || !item.system?.weaponClass);
}

/** Укусы — свободное действие, автоматический бой в торс (или Избирательно). */
async function _doBite(actor) {
  const biteWeapon = actor.items.find(isBiteWeapon);
  if (!biteWeapon) {
    ui.notifications.warn(`${actor.name}: не найдено оружие «Укус» в снаряжении — Укус доступен только персонажам, способным кусаться.`);
    return;
  }
  // Укус — единственное из четырёх «безролловых» действий Борьбы (см. шапку
  // файла), которое на деле идёт полным тестом WS/BS через attack-dialog.mjs
  // — а не автоматическим попаданием, как Хруст. Значит, это тоже «тест в
  // Борьбе» из текста мутации Tentacle (wdbc-vkwe) — тот же +20, что и у
  // остальных пяти, только через presetModifier диалога атаки (виден и
  // редактируем игроком, как и любой другой её пресет вроде Контратаки).
  const { showAttackDialog } = await import("../sheets/attack-dialog.mjs");
  const bonus = tentacleBonus(actor);
  return showAttackDialog(actor, biteWeapon, {
    techniqueLabel: "Укус (Борьба)",
    modifier: bonus,
    chatNote: "🤼 Борьба: автоматический Укус — свободное действие, попадает в торс, если не выбрана Избирательная атака."
      + (bonus ? ` Щупальце: +${bonus} учтено в Доп. мод.` : "")
  });
}

// Оружие со свойством Crunch (стр. 168): «Когда удерживаете цель в Борьбе,
// можете как свободное действие нанести автоматическое попадание (S.b÷2)» —
// wdbc-1d5u. Реестр auto.crunch уже был заведён (module/constants/
// weapon-properties.mjs), но нигде не читался.
export function crunchWeapon(item) {
  if (item?.type !== "weapon") return false;
  return !!aggregateAuto(resolveWeaponProps(item)).crunch;
}

/** Хруст — автоматическое попадание S.b÷2 (окр. вверх) партнёру, свободное действие. */
async function _doCrunch(actor) {
  const weapon = actor.items.find(crunchWeapon);
  if (!weapon) {
    ui.notifications.warn(`${actor.name}: нет оружия со свойством Crunch — Хруст доступен только персонажам с таким оружием.`);
    return;
  }
  const partner = grapplePartner(actor);
  if (!partner) {
    ui.notifications.warn(`${actor.name}: партнёр по Борьбе не найден (Захват уже разорван?).`);
    return;
  }
  const sb  = Number(actor.system?.characteristics?.s?.bonus) || 0;
  const dmg = Math.ceil(sb / 2);
  const { applyDamageToActor } = await import("./damage.mjs");
  await applyDamageToActor(partner, {
    rawDamage: dmg, penetration: 0, damageType: weapon.system?.damageType || "impact",
    hitLocation: "Торс", melee: true,
    attackerName: actor.name, attackerUuid: actor.uuid, weaponName: weapon.name
  });
  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("sword","#e08a3a")}Борьба: Хруст (${esc(weapon.name)})</div>
      <div class="roll-outcome">${esc(actor.name)} автоматически наносит ${esc(partner.name)}: <b>${dmg}</b> Dmg (S.b÷2, окр. вверх).</div>
      <div class="roll-threshold" style="font-size:0.85em;">Свободное действие. Доступно только пока цель удержана Захватом.</div>
    </div>`
  }, rollMode));
}

// Метнуть/Замахнуться (стр. 12) отсылают к ОБЩЕМУ правилу «Импровизированное
// оружие»/«Метание» (стр. 27-28, module/rules/improvised-weapon.mjs) — это
// ДВА РАЗНЫХ действия книги (Дубина и Метание — свои профили, свои гейты по
// весу/размеру), не один приём с выбором характеристики, как предполагалось
// раньше:
//   Замахнуться (Дубина, стр. 27) — рукопашный удар партнёром по ДРУГОЙ цели:
//     WS−20 (как обычный рукопашный тест — Стойка/База/усталость те же, что
//     у любого другого безоружного приёма), урон 1d10 I(Cr) +1d10 за каждый
//     Размер партнёра больше 0. Годится только если партнёр ≤¼ Веса Ношения
//     и Размером не больше владельца — иначе кнопка недоступна. Партнёр
//     получает ТОТ ЖЕ урон, что и цель, ВСЕГДА — даже при промахе или
//     уклонении/парировании цели (урон от падения, минует броню).
//   Метнуть (Метание, стр. 28) — дальнобойный/силовой бросок партнёра в
//     ДРУГУЮ цель, тир зависит от полного веса партнёра относительно Веса
//     Ношения бросающего: лёгкий (≤¼) — BS+0, дальность S.b×3м; средний
//     (¼-½)/тяжёлый (½-полного, доп. −30) — Athletics(S), дальность
//     1d10+S.b+2×Успехи, направление приблизительное. Отдельно — опора
//     (сравнение с СОБСТВЕННЫМ весом ТЕЛА бросающего, не с Ношением): без
//     неё в диапазоне 0.5-3× тела — совмещённый тест Athletics(S)−30 И
//     Acrobatics(A)−30, провал — Повален и вдвое меньше дальность/урон.
//     Партнёр получает тот же урон, что и цель, ТОЛЬКО при попадании
//     (в отличие от Дубины) — минуя броню (урон от падения).
// Оба — настоящие тесты WS/BS/Athletics(S) в Борьбе, получают +20 от Мутации
// Tentacle/Щупальце (wdbc-vkwe) наравне с Укусом — здесь напрямую заложено
// в порог через tentacleBonus(actor), не через presetModifier/extraBonus (у
// обоих нет ни Item-оружия, ни общего с 5 контестами _showContestDialog).
// Совмещённый тест на опору (Athletics/Acrobatics−30) намеренно НЕ получает
// бонус Щупальца — это отдельная механика общего правила «Метание», не сам
// тест Борьбы, который мутация усиливает.
const TIER_LABEL = { light: "лёгкий", medium: "средний", heavy: "тяжёлый" };

/**
 * Годность и параметры Замахнуться партнёром как Дубиной (стр. 27). Чистая
 * функция — тестируема без бросков.
 * @returns {{ok:boolean, wsBonus?:number, tentacleBonus?:number, diceCount?:number}}
 */
export function swingProfile(actor, partner) {
  if (!canWieldAsCudgel(actor, partner)) return { ok: false };
  const extraDice = Math.max(0, Math.floor(sizeOf(partner)));
  const tentacle = tentacleBonus(actor);
  return { ok: true, wsBonus: -20 + tentacle, tentacleBonus: tentacle, diceCount: 1 + extraDice };
}

/**
 * Тир и параметры Метнуть партнёром (стр. 28). null — партнёр тяжелее
 * полного Веса Ношения бросающего, метать нельзя вовсе. Чистая функция.
 * @returns {?{tier:string, testChar:string, testLabel:string, testBonus:number,
 *   tentacleBonus:number, rangeM?:number, athleticsPenalty?:number}}
 */
export function throwProfile(actor, partner) {
  const carry = Number(actor.system?.encumbrance?.carry) || 0;
  const tier  = throwTier(carry, totalWeightOf(partner));
  if (!tier) return null;
  const sb = Number(actor.system?.characteristics?.s?.bonus) || 0;
  const tentacle = tentacleBonus(actor);
  if (tier === "light") {
    return { tier, testChar: "bs", testLabel: "BS", testBonus: tentacle, tentacleBonus: tentacle, rangeM: sb * 3 };
  }
  const athleticsPenalty = tier === "heavy" ? -30 : 0;
  return { tier, testChar: "s", testLabel: "Athletics(S)",
    testBonus: athleticsPenalty + tentacle, tentacleBonus: tentacle, athleticsPenalty };
}

/** Общий блок «применить урон цели + защита» — тот же HTML-контракт, что и
 *  showAttackDialogNoWeapon (классы читает module/hooks.mjs). */
function _targetDamageSection(dmgTotal, weaponName, actor) {
  return `
    <div class="roll-damage-section">
      <div class="roll-damage-label">Урон цели (Ударный, Проб. 0): <b>${dmgTotal}</b> · Primitive, Баланс −2</div>
      <button class="wh-apply-dmg-btn" type="button"
        data-damage="${dmgTotal}" data-penetration="0"
        data-damage-type="impact" data-hit-location="Торс"
        data-primitive="1" data-weapon-name="${weaponName}" data-attacker="${actor.name}" data-attacker-uuid="${actor.uuid}">
        Применить урон: ${dmgTotal} → Торс
      </button>
    </div>
    <div class="roll-defense-section">
      <div class="roll-defense-title">${rollIcon("shield","#4dffa6")}Защита цели (выберите токен защищающегося):</div>
      <div class="roll-defense-btns">
        <button class="wh-dodge-btn" type="button" data-extra-mod="0" data-attacker-uuid="${actor.uuid}">Уклонение</button>
        <button class="wh-parry-btn" type="button" data-extra-mod="0">Парирование</button>
      </div>
    </div>`;
}

/** Партнёр по Захвату — обязательная третья цель под прицелом Foundry (то, во что бьют партнёром). */
function _requireThirdPartyTarget(actor, partner, verb) {
  const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  if (!target) {
    ui.notifications.warn(`${actor.name}: наведите прицел на цель, по которой вы ${verb} ${esc(partner.name)}.`);
    return null;
  }
  if (target === partner) {
    ui.notifications.warn(`${actor.name}: ${verb === "замахнётесь" ? "Замахнуться" : "Метнуть"} бьёт кого-то ДРУГОГО, не самого партнёра — выберите цель.`);
    return null;
  }
  return target;
}

/** Замахнуться — удар партнёром как Дубиной по третьей цели под прицелом. */
async function _doSwing(actor) {
  const partner = grapplePartner(actor);
  if (!partner) {
    ui.notifications.warn(`${actor.name}: партнёр по Борьбе не найден (Захват уже разорван?).`);
    return;
  }
  const profile = swingProfile(actor, partner);
  if (!profile.ok) {
    ui.notifications.warn(`${actor.name}: ${esc(partner.name)} слишком тяжёл(а) или крупен(на) для Дубины — нужно ≤¼ Веса Ношения и Размер не больше своего (стр. 27).`);
    return;
  }
  const target = _requireThirdPartyTarget(actor, partner, "замахнётесь");
  if (!target) return;

  const stance  = actor.system.meleeStance || "standard";
  const stBon   = MELEE_STANCES[stance]?.wsBonus ?? 0;
  const baseKey = actor.system.meleeBase || "standard";
  const baseBon = MELEE_BASES[baseKey]?.wsBonus ?? 0;
  const fatigue = fatiguePenalty(actor, "ws");
  const ws      = actor.system.characteristics.ws?.total ?? 0;
  const final   = ws + profile.wsBonus + baseBon + stBon + fatigue;

  const roll = await new Roll("1d100").evaluate();
  const { success: hit, deg } = testOutcome(roll.total, final);
  const dmgRoll = await new Roll(`${profile.diceCount}d10`).evaluate();
  const dmgTotal = dmgRoll.total;

  // Партнёр получает тот же урон ВСЕГДА — даже при промахе/уклонении
  // цели (стр. 27), минуя броню (урон от падения).
  const { applyWoundLoss } = await import("../rules/wounds.mjs");
  await applyWoundLoss(partner, dmgTotal);

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-technique-block">${rollIcon("sword")}Приём: <b>Замахнуться (Дубина)</b>
        <div class="roll-technique-note">🤼 Борьба: ${esc(partner.name)} используется как импровизированная Дубина против ${esc(target.name)} (стр. 27).${profile.tentacleBonus ? ` Щупальце: +${profile.tentacleBonus} учтено.` : ""}</div>
      </div>
      <div class="roll-header">${rollIcon("sword")}Замахнуться — удар Дубиной (${profile.diceCount}d10 I(Cr))</div>
      <div class="roll-threshold">
        WS: <b>${ws}</b> база ${baseBon >= 0 ? "+" : ""}${baseBon}
        ${stBon !== 0 ? ` стойка ${stBon >= 0 ? "+" : ""}${stBon}` : ""}
        Дубина −20${profile.tentacleBonus ? ` Щупальце +${profile.tentacleBonus}` : ""}
        ${fatigue !== 0 ? ` усталость ${fatigue}` : ""}
        → Порог: <b>${final}</b>
      </div>
      <div class="roll-dice">Бросок: <b>${roll.total}</b></div>
      <div class="roll-outcome">${hit
        ? `<span class="roll-success">Попадание по ${esc(target.name)} — ${deg} степеней</span>`
        : `<span class="roll-failure">Промах мимо ${esc(target.name)} — ${deg} степеней</span>`}</div>
      <div class="roll-threshold" style="font-size:0.85em;">${esc(partner.name)} получил(а) как Дубина: <b>${dmgTotal}</b> Dmg — урон от падения (игнорирует броню, может быть поглощён Группированием вручную), НЕЗАВИСИМО от исхода атаки.</div>
      ${hit ? _targetDamageSection(dmgTotal, "Замахнуться (Борьба)", actor) : ""}
    </div>`,
    rolls: [roll, dmgRoll], sound: CONFIG.sounds.dice
  }, rollMode));
}

/** Метнуть — бросок партнёра в третью цель под прицелом, тир по весу партнёра. */
async function _doThrow(actor) {
  const partner = grapplePartner(actor);
  if (!partner) {
    ui.notifications.warn(`${actor.name}: партнёр по Борьбе не найден (Захват уже разорван?).`);
    return;
  }
  const profile = throwProfile(actor, partner);
  if (!profile) {
    ui.notifications.warn(`${actor.name}: ${esc(partner.name)} тяжелее полного Веса Ношения (${Number(actor.system?.encumbrance?.carry) || 0} кг) — метнуть нельзя вовсе (стр. 28).`);
    return;
  }
  const target = _requireThirdPartyTarget(actor, partner, "метнёте");
  if (!target) return;

  // Опора (стр. 28) — сравнение с СОБСТВЕННЫМ весом ТЕЛА бросающего
  // (bodyWeightOf), отдельная ось от тира выше (тот — про Ношение).
  const footing = footingRequirement(bodyWeightOf(actor), totalWeightOf(partner));
  if (footing === "impossible") {
    ui.notifications.warn(`${actor.name}: ${esc(partner.name)} весит втрое больше вашего собственного тела (без снаряжения) или больше — метнуть невозможно без магии (стр. 28).`);
    return;
  }
  let combinedTestRequired = false;
  if (footing === "harsh") {
    const hasFooting = await Dialog.confirm({
      title: "Опора при Метании",
      content: `<p>${esc(partner.name)} весит от 1.5 до 3 раз больше вашего собственного тела. Без надёжной опоры (стена, борт машины и т.п. позади, в стороне, противоположной броску) метнуть нельзя вовсе.</p><p>Опора есть?</p>`
    });
    if (!hasFooting) {
      ui.notifications.warn(`${actor.name}: без надёжной опоры метнуть настолько тяжёлого (относительно вас самих) партнёра нельзя (стр. 28).`);
      return;
    }
    combinedTestRequired = true; // «даже с опорой тест — как будто её нет»
  } else if (footing === "check") {
    const hasFooting = await Dialog.confirm({
      title: "Опора при Метании",
      content: `<p>${esc(partner.name)} весит сравнимо с вашим собственным телом (0.5-1.5×). Без надёжной опоры — риск сбития с ног.</p><p>Опора есть?</p>`
    });
    combinedTestRequired = !hasFooting;
  }

  let knockedDown = false, halved = false;
  if (combinedTestRequired) {
    const sTotal = actor.system.characteristics.s?.total ?? 0;
    const aTotal = actor.system.characteristics.a?.total ?? 0;
    const sRoll = await new Roll("1d100").evaluate();
    const aRoll = await new Roll("1d100").evaluate();
    if (!(sRoll.total <= sTotal - 30 && aRoll.total <= aTotal - 30)) {
      knockedDown = true;
      halved = true;
      await actor.update({ "system.conditions.prone": true });
    }
  }

  const charVal = actor.system.characteristics[profile.testChar]?.total ?? 0;
  const fatigue = fatiguePenalty(actor, profile.testChar);
  const final   = charVal + profile.testBonus + fatigue;
  const roll = await new Roll("1d100").evaluate();
  const { success: hit, deg } = testOutcome(roll.total, final);
  const rollMode = game.settings.get("core", "rollMode");
  const knockNote = knockedDown
    ? `<div class="roll-threshold" style="font-size:0.85em;">Без надёжной опоры: ${esc(actor.name)} сбит(а) с ног (Повален), дальность и урон уменьшены вдвое.</div>` : "";

  if (!hit) {
    await ChatMessage.create(ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="wh-roll-result">
        <div class="roll-technique-block">${rollIcon("sword")}Приём: <b>Метнуть</b>
          <div class="roll-technique-note">🤼 Борьба: ${esc(partner.name)} метается в ${esc(target.name)} (стр. 28, тир «${TIER_LABEL[profile.tier]}»).</div>
        </div>
        <div class="roll-header">${rollIcon("sword")}Метнуть — ${profile.testLabel}${profile.rangeM ? `, дальность до ${profile.rangeM} м` : ""}</div>
        <div class="roll-threshold">Порог: <b>${final}</b></div>
        <div class="roll-dice">Бросок: <b>${roll.total}</b></div>
        <div class="roll-outcome"><span class="roll-failure">Промах — ${esc(partner.name)} улетает мимо ${esc(target.name)}, ${deg} степеней</span></div>
        ${knockNote}
      </div>`,
      rolls: [roll], sound: CONFIG.sounds.dice
    }, rollMode));
    return;
  }

  const sb = Number(actor.system?.characteristics?.s?.bonus) || 0;
  const dmgRoll = profile.tier === "light"
    ? await new Roll(`1d5+${sb}`).evaluate()
    : await new Roll(`1d10+${sb}+${deg}`).evaluate();
  const dmgTotal = halved ? Math.ceil(dmgRoll.total / 2) : dmgRoll.total;

  // Партнёр получает тот же урон, что и цель, ТОЛЬКО при попадании
  // (в отличие от Дубины) — минуя броню (урон от падения).
  const { applyWoundLoss } = await import("../rules/wounds.mjs");
  await applyWoundLoss(partner, dmgTotal);

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-technique-block">${rollIcon("sword")}Приём: <b>Метнуть</b>
        <div class="roll-technique-note">🤼 Борьба: ${esc(partner.name)} метается в ${esc(target.name)} (стр. 28, тир «${TIER_LABEL[profile.tier]}»).${profile.tentacleBonus ? ` Щупальце: +${profile.tentacleBonus} учтено.` : ""}</div>
      </div>
      <div class="roll-header">${rollIcon("sword")}Метнуть — ${profile.testLabel}${profile.rangeM ? `, дальность до ${profile.rangeM} м` : ""}</div>
      <div class="roll-threshold">
        ${profile.testLabel}: <b>${charVal}</b>
        ${profile.athleticsPenalty ? ` тир ${profile.athleticsPenalty}` : ""}
        ${profile.tentacleBonus ? ` Щупальце +${profile.tentacleBonus}` : ""}
        ${fatigue !== 0 ? ` усталость ${fatigue}` : ""}
        → Порог: <b>${final}</b>
      </div>
      <div class="roll-dice">Бросок: <b>${roll.total}</b></div>
      <div class="roll-outcome"><span class="roll-success">Попадание — ${deg} степеней</span></div>
      ${knockNote}
      <div class="roll-threshold" style="font-size:0.85em;">${esc(partner.name)} получил(а) как снаряд: <b>${dmgTotal}</b> Dmg — урон от падения (игнорирует броню, может быть поглощён Группированием вручную).</div>
      ${_targetDamageSection(dmgTotal, "Метнуть (Борьба)", actor)}
    </div>`,
    rolls: [roll, dmgRoll], sound: CONFIG.sounds.dice
  }, rollMode));
}

/** Диалог «Борьба» — вызывается кнопкой из блока Состязаний вкладки БОЙ. */
export function showGrappleDialog(actor) {
  if (!actor?.system?.conditions?.grappling) {
    ui.notifications.warn(`${actor.name}: не связан Захватом.`);
    return;
  }
  const partner = grapplePartner(actor);
  const hasCrunch = actor.items.some(crunchWeapon);

  // Метнуть/Замахнуться (стр. 27-28) годятся не всегда — зависит от веса/
  // Размера партнёра относительно бросающего (module/rules/improvised-weapon.mjs).
  // Без партнёра (флаг протух) считаем недоступными обе — нет payload'а.
  const throwP = partner ? throwProfile(actor, partner) : null;
  const swingP = partner ? swingProfile(actor, partner) : null;

  const btn = (key, label, extra = "") =>
    `<button type="button" class="wh-grapple-action" data-action="${key}" style="width:100%;text-align:left;margin:2px 0;">${label}</button>${extra}`;

  const content = `
    <div class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-header"><span class="atk-weapon-name">${rollIcon("sword","#e08a3a")}Борьба${partner ? ` — ${esc(partner.name)}` : ""}</span></div>
      <div style="font-size:0.82em;margin-bottom:6px;">Оба участника Захвата видят все действия раздела — кто сейчас Атакующий, а кто Цель, решается за столом.</div>
      <b style="font-size:0.85em;">Действия Атакующего</b>
      ${btn("squeeze", "Сжать (полудействие, без броска)")}
      ${btn("wrench", "Заломить")}
      ${btn("overpower", "Пересилить")}
      ${throwP ? btn("throw", `Метнуть (${TIER_LABEL[throwP.tier]} тир, ${throwP.testLabel}) — цель под прицелом`)
               : `<div style="font-size:0.78em;opacity:0.7;margin:2px 0;">Метнуть недоступно — ${esc(partner?.name ?? "партнёр")} тяжелее полного Веса Ношения.</div>`}
      ${swingP?.ok ? btn("swing", "Замахнуться (Дубина, WS−20) — цель под прицелом")
                   : `<div style="font-size:0.78em;opacity:0.7;margin:2px 0;">Замахнуться недоступно — нужно ≤¼ Веса Ношения и Размер не больше своего.</div>`}
      ${btn("bite", "Укусы (свободное действие)")}
      ${hasCrunch ? btn("crunch", "Хруст (свободное действие, S.b÷2 авто-урона)") : ""}
      <b style="font-size:0.85em;display:block;margin-top:6px;">Действия Цели</b>
      ${btn("breakFree", "Вырваться")}
      ${btn("twistFree", "Выкрутиться")}
      ${btn("takeover", "Перехватить Контроль")}
      <hr style="margin:8px 0;opacity:0.3;"/>
      ${btn("release", "Разорвать Захват (снять «Борьба» с обоих)")}
    </div>`;

  return foundry.applications.api.DialogV2.wait({
    window: { title: "Борьба" },
    classes: ["wh-attack-dialog", "warhammer-dbc"],
    position: { width: 380 },
    content,
    rejectClose: false,
    buttons: [{ action: "close", label: "Закрыть" }],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form") || dialog.element;
      form.querySelectorAll(".wh-grapple-action").forEach(b => b.addEventListener("click", async () => {
        const key = b.dataset.action;
        if (key === "squeeze") await _doSqueeze(actor);
        else if (key === "throw") await _doThrow(actor);
        else if (key === "swing") await _doSwing(actor);
        else if (key === "bite") await _doBite(actor);
        else if (key === "crunch") await _doCrunch(actor);
        else if (key === "release") await endGrapple(actor);
        else if (ALL_TESTS[key]) await _showContestDialog(actor, tentacleTechDef(actor, ALL_TESTS[key]));
        dialog.close();
      }));
    }
  });
}
