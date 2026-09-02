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
//  Сжать/Метнуть-Замахнуться/Укусы не имеют парного встречного теста — только
//  Заломить/Пересилить/Вырваться/Выкрутиться/Перехватить Контроль его имеют,
//  и заведены через уже готовый _showContestDialog (module/combat/
//  techniques.mjs) — тот же диалог «Приём vs Приём», что у Повалить/Напролом/
//  Финта/Давления, просто с другой характеристикой по умолчанию.
// ════════════════════════════════════════════════════════════════════════════

import { _showContestDialog } from "./techniques.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { resolveWeaponProps, aggregateAuto } from "./weapon-properties.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { worldTimeRemaining, markWorldTimeCooldownUsed } from "../rules/cooldown.mjs";
import { tentacleBonusSuppressed } from "../rules/tentacle-hand-form.mjs";

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
// Укус — тоже настоящий тест (WS/BS через attack-dialog.mjs), но получает
// бонус отдельно, через presetModifier — см. _doBite ниже. Сжать и Хруст
// броска не делают вовсе (первое — накопительный штраф без теста, второе —
// автоматическое попадание по книге), бонусу там нечего усиливать. Метнуть/
// Замахнуться сейчас вообще не реализовано роллом (только текст в чат) —
// отдельный, более старый пробел, не про эту мутацию.
/**
 * +20, если у актора есть Щупальце (mutation.tentacle) — иначе 0. Субмутация
 * 9 «Изменчивое» (wdbc-2ynk): пока предмет временно в форме руки, бонусу
 * нечем помогать ни приёму Захват, ни этим тестам, ни Укусу.
 */
export function tentacleBonus(actor) {
  return (hasRuleFlag(actor, "mutation.tentacle") && !tentacleBonusSuppressed(actor)) ? 20 : 0;
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

// wdbc-1f5j: субмутация 10 «Отделяемое» (стр. 440) — единственная из шести
// оставшихся необработанных строк Щупальца, что трогает сам движок Захвата,
// а не просто числовой бонус (сравни с флейвором «растягивается до 4м» у
// базовой мутации, wdbc-vkwe). Книга: «Взяв персонажа в Захват, персонаж
// может отсоединить своё щупальце у плеча. Оно продолжит держать цель в
// Захвате. Новое щупальце отрастёт из культи через 3 часа.» Действие ломает
// СИММЕТРИЮ endGrapple — Атакующий выходит из Борьбы, Цель остаётся.
// Отдельного флага «отделено» не заводим: состояние ВЫЧИСЛЯЕТСЯ (см.
// isDetachedGrapple ниже) — так его не нужно чистить отдельным путём, когда
// Цель в итоге вырывается обычным Разорвать Захват (endGrapple уже приводит
// оба conditions.grappling к false, а вычисляемый признак пропадает сам).
//
// Три пункта из тикета:
//  1. Асимметрия — реализована ниже (_doDetachTentacle + isDetachedGrapple).
//  2. Регенерация «через 3 часа» — таймер заведён через готовый
//     worldTime-примитив rules/cooldown.mjs (тот же, что у Void supply-timer,
//     doombc-supply-timer-poolmax-target), просто как информационная метка
//     в чате/диалоге. Временная потеря бонусов Щупальца на культю НЕ
//     автоматизирована: что именно «отваливается» на 3 часа — не текст
//     книги, а собственная гипотеза тикета, и движок Возможностей
//     (rules/mech-when.mjs) сейчас не умеет гейтить запись по временному
//     флагу актора — только по легиону/субмутации/Таланту. Отдельная
//     архитектурная работа ради одной строки d10 не оправдана — тот же
//     флейвор/договорённость за столом, что и растяжение до 4м.
//  3. Что с культёй, если Цель вырвется — книга не уточняет нигде (ни в
//     тексте самой строки, ни в общих правилах Захвата стр. 12 — сверено).
//     Решение: отсоединённая культя ведёт себя как обычный partner в тестах
//     Вырваться/Выкрутиться (сила культи — это сила её бывшего владельца,
//     она никуда не делась), а после победы Цели просто отпускает — как
//     любой другой Захват, без предмета/токена на карте (система и так не
//     трекает большинство подобного реквизита боя).
const TENTACLE_REGROW_SECONDS = 3 * 3600;
const TENTACLE_REGROW_FLAG = "tentacleRegrowAt";

/** Мутация Щупальце с выпавшей субмутацией 10 «Отделяемое» — есть ли она у актора. */
export function detachableTentacle(actor) {
  return actor?.items?.find(i => i.type === "mutation"
    && (itemHasName(i, "Щупальце") || itemHasName(i, "Tentacle"))
    && i.system?.submutation?.label === "10") ?? null;
}

/**
 * Захват «расщеплён»: Цель ещё связана (conditions.grappling), а её партнёр
 * (владелец щупальца, найденный ровно как обычно — через её же
 * grapplePartnerUuid) уже нет. Единственный способ попасть в такое
 * рассогласованное состояние — _doDetachTentacle ниже; никакой другой путь
 * симметрию endGrapple не ломает.
 */
export function isDetachedGrapple(actor, partner) {
  return !!(actor?.system?.conditions?.grappling && partner && !partner?.system?.conditions?.grappling);
}

/** Отсоединить щупальце у плеча — без теста. Атакующий выходит из Захвата,
 *  культя остаётся держать цель одна (стр. 440, субмутация 10). */
async function _doDetachTentacle(actor) {
  const partner = grapplePartner(actor);
  if (!partner) {
    ui.notifications.warn(`${actor.name}: партнёр по Борьбе не найден (Захват уже разорван?).`);
    return;
  }
  await actor.update({ "system.conditions.grappling": false, [`flags.${NS}.-=${PARTNER_FLAG}`]: null });
  await markWorldTimeCooldownUsed(actor, TENTACLE_REGROW_FLAG);

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("sword","#e08a3a")}Борьба: Отсоединить щупальце</div>
      <div class="roll-outcome">${esc(actor.name)} отсоединяет щупальце у плеча — оно продолжает держать ${esc(partner.name)} в Захвате, а сам ${esc(actor.name)} волен действовать свободно.</div>
      <div class="roll-threshold" style="font-size:0.85em;">Без теста (действие по решению стола — книга не уточняет). Новое щупальце отрастёт из культи через 3 часа. ${esc(partner.name)} по-прежнему может Вырваться или Выкрутиться из хватки культи.</div>
    </div>`
  }, rollMode));
}

/** Метнуть или Замахнуться — полное действие (полудействие двумя руками). */
async function _doThrow(actor) {
  const partner = grapplePartner(actor);
  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("sword","#e08a3a")}Борьба: Метнуть или Замахнуться</div>
      <div class="roll-outcome">${esc(actor.name)} пытается метнуть ${partner ? esc(partner.name) : "цель"}, или использовать её как импровизированное оружие.</div>
      <div class="roll-threshold" style="font-size:0.85em;">Полное действие (полудействие, если цель держат двумя руками). Разрешается как Метание/Импровизированное оружие (стр. 27-28 — «Дубина»/«Метание»): Dmg 1d5+S.b I(Cr) при замахе, дальность до S.b×3 м при броске BS+0.</div>
    </div>`
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
  // wdbc-1f5j: после Отсоединить щупальце (субмутация 10) держащий сторону
  // покинул Захват — Атакующего у Борьбы больше нет, только оставленная
  // культя. Действия Атакующего (в т.ч. новое «Отсоединить») и Перехватить
  // Контроль (некого перехватывать) в этом состоянии не показываются —
  // Цели остаются только Вырваться/Выкрутиться и общий Разорвать Захват.
  const detached = isDetachedGrapple(actor, partner);
  const canDetach = !detached && !!detachableTentacle(actor);

  const btn = (key, label, extra = "") =>
    `<button type="button" class="wh-grapple-action" data-action="${key}" style="width:100%;text-align:left;margin:2px 0;">${label}</button>${extra}`;

  const detachedNote = detached
    ? `<div style="font-size:0.82em;margin-bottom:6px;">Держит культя отсоединённого щупальца${partner ? ` ${esc(partner.name)}` : ""} — Атакующего в Захвате больше нет, но культя всё ещё держит крепко: Вырваться/Выкрутиться работают как обычно, против той же Силы.${(() => {
        const usedAt = partner?.getFlag?.(NS, TENTACLE_REGROW_FLAG);
        const remaining = worldTimeRemaining(usedAt, game.time?.worldTime, TENTACLE_REGROW_SECONDS);
        return remaining > 0 ? ` Новое щупальце отрастёт через ~${Math.ceil(remaining / 3600)}ч.` : "";
      })()}</div>`
    : `<div style="font-size:0.82em;margin-bottom:6px;">Оба участника Захвата видят все действия раздела — кто сейчас Атакующий, а кто Цель, решается за столом.</div>`;

  const content = `
    <div class="wh-wizard-form" style="padding:6px;">
      <div class="atk-dlg-header"><span class="atk-weapon-name">${rollIcon("sword","#e08a3a")}Борьба${partner ? ` — ${esc(partner.name)}` : ""}</span></div>
      ${detachedNote}
      ${detached ? "" : `
      <b style="font-size:0.85em;">Действия Атакующего</b>
      ${btn("squeeze", "Сжать (полудействие, без броска)")}
      ${btn("wrench", "Заломить")}
      ${btn("overpower", "Пересилить")}
      ${btn("throw", "Метнуть или Замахнуться")}
      ${btn("bite", "Укусы (свободное действие)")}
      ${hasCrunch ? btn("crunch", "Хруст (свободное действие, S.b÷2 авто-урона)") : ""}
      ${canDetach ? btn("detach", "Отсоединить щупальце (без теста)") : ""}
      `}
      <b style="font-size:0.85em;display:block;margin-top:6px;">Действия Цели</b>
      ${btn("breakFree", "Вырваться")}
      ${btn("twistFree", "Выкрутиться")}
      ${detached ? "" : btn("takeover", "Перехватить Контроль")}
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
        else if (key === "bite") await _doBite(actor);
        else if (key === "crunch") await _doCrunch(actor);
        else if (key === "detach") await _doDetachTentacle(actor);
        else if (key === "release") await endGrapple(actor);
        else if (ALL_TESTS[key]) await _showContestDialog(actor, tentacleTechDef(actor, ALL_TESTS[key]));
        dialog.close();
      }));
    }
  });
}
