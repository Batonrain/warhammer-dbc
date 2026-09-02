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
// Укус, Метнуть и Замахнуться — тоже настоящие тесты (WS/BS через
// attack-dialog.mjs), но получают бонус отдельно: Укус — через
// techniqueOpts.modifier (showAttackDialog, у него есть Item-оружие), Метнуть/
// Замахнуться — через techDef.wsBonus/bsBonus (showAttackDialogNoWeapon,
// партнёр не Item) — см. _doBite/_doThrow ниже. Сжать и Хруст броска не
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

// Метнуть/Замахнуться (стр. 12): одно действие, два способа его разрешить —
// текст сам отсылает к «Дубине»/«Метанию» (стр. 27-28), обычным правилам
// импровизированного оружия, а не к отдельному встречному тесту Борьбы (в
// отличие от Заломить/Пересилить/Вырваться/Выкрутиться/Перехватить Контроль,
// у которых своя Athletics(S)/Acrobatics(A) — здесь урон один и тот же для
// обоих способов, различается только характеристика/дальность самого теста):
//   Замахнуться — рукопашный удар партнёром как дубиной: WS, как у любого
//     другого рукопашного оружия в этой системе (не Athletics — иначе
//     наложилось бы на Заломить/Пересилить, см. п.5 wdbc-oxdn).
//   Метнуть — дальнобойный бросок партнёра: BS+0, дальность до S.b×3 м.
// Оба идут через showAttackDialogNoWeapon (тот же приём, что Кулак/Пинок/
// Удар оружием в упор, apps/hud.mjs::gunMeleeStrike) — партнёр не Item,
// полноценного showAttackDialog для него нет. Цель урона — сам партнёр
// (techDef.forceTargetActor), а не то, что игрок навёл прицелом Foundry: тот
// же принцип, что у Хруста (_doCrunch выше), просто с настоящим тестом
// вместо автоматического попадания.
const THROW_DAMAGE = "1d5+S.b";

/** Метнуть (ranged=true, BS) или Замахнуться (ranged=false, WS) партнёром. */
async function _doThrow(actor, ranged) {
  const partner = grapplePartner(actor);
  if (!partner) {
    ui.notifications.warn(`${actor.name}: партнёр по Борьбе не найден (Захват уже разорван?).`);
    return;
  }
  const sb = Number(actor.system?.characteristics?.s?.bonus) || 0;
  const bonus = tentacleBonus(actor);
  const label = ranged ? "Метнуть" : "Замахнуться";
  const techDef = {
    label, ranged,
    headerSuffix: ranged ? `Борьба — Метание, дальность до ${sb * 3} м` : "Борьба — удар захваченным партнёром",
    wsBonus: bonus, bsBonus: bonus,
    damage: THROW_DAMAGE, damageType: "impact", pen: 0,
    props: "Primitive",
    forceTargetActor: partner,
    chatNote: `🤼 Борьба: ${label} — ${esc(partner.name)} используется как импровизированное оружие (стр. 27-28).`
      + (bonus ? ` Щупальце: +${bonus} учтено.` : "")
  };
  const { showAttackDialogNoWeapon } = await import("../sheets/attack-dialog.mjs");
  return showAttackDialogNoWeapon(actor, techDef);
}

/** Диалог «Борьба» — вызывается кнопкой из блока Состязаний вкладки БОЙ. */
export function showGrappleDialog(actor) {
  if (!actor?.system?.conditions?.grappling) {
    ui.notifications.warn(`${actor.name}: не связан Захватом.`);
    return;
  }
  const partner = grapplePartner(actor);
  const hasCrunch = actor.items.some(crunchWeapon);

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
      ${btn("throwRanged", "Метнуть (дальний, BS+0)")}
      ${btn("throwMelee", "Замахнуться (ближний, WS)")}
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
        else if (key === "throwRanged") await _doThrow(actor, true);
        else if (key === "throwMelee") await _doThrow(actor, false);
        else if (key === "bite") await _doBite(actor);
        else if (key === "crunch") await _doCrunch(actor);
        else if (key === "release") await endGrapple(actor);
        else if (ALL_TESTS[key]) await _showContestDialog(actor, tentacleTechDef(actor, ALL_TESTS[key]));
        dialog.close();
      }));
    }
  });
}
