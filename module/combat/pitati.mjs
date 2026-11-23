// module/combat/pitati.mjs
// Питати — вплетение психосилы в Рунный Выстрел и Сквозной Выстрел
// (rules/runic-shot.mjs). Вплетение открывает обычное окно манифестации
// выбранной силы (sheets/tabs/psychic.mjs) — цель та же, что у пули.

import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { isThrottleReady, markThrottleUsed } from "../rules/cooldown.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import {
  hasRunicShot, hasPiercingShot, hasSeekerBullet, hasTimedExplosion, hasLivingBullet,
  runicWeaveAllowed, isPsychicBlast, SEEKER_EFFECTS, PIERCING_SHOT_FLAG, SEEKER_FLAG,
  TIMED_EXPLOSION_FLAG, timedExplosionPoint, timedExplosionVerdict
} from "../rules/runic-shot.mjs";
import { resolveCharFormula } from "../helpers/utils.mjs";
import { pxPerMeter } from "./templates.mjs";
import { rollTestCard } from "./duelist-tests.mjs";

const NS = "warhammer-dbc";
const WEAVE_FLAG = "pitati.runicWeave";

/** Рунный Выстрел: раз в Ход после успешного одиночного рунного выстрела — вплести психосилу. */
export async function weaveRunicPower(actor) {
  if (!actor || !hasRunicShot(actor)) return ui.notifications.warn("⚠️ У актора нет Черты Рунный Выстрел.");
  if (!isThrottleReady(actor, WEAVE_FLAG, "round")) return ui.notifications.warn("⚠️ Вплетение — раз в Ход, уже было.");
  const powers = [...actor.items].filter(p => runicWeaveAllowed(actor, p));
  if (!powers.length) return ui.notifications.warn("⚠️ Нет психосил, которые можно вплести в пулю.");
  const opts = powers.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
  const seekerOpts = SEEKER_EFFECTS.map((t, i) => `<option value="${i}">${esc(t)}</option>`).join("");
  const pick = await foundry.applications.api.DialogV2.wait({
    window: { title: "Рунный Выстрел: вплетение" }, classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="margin:4px 6px;">Психосила для пули (цель — та, в кого попала пуля; наведите её):</p>
      <select name="power" style="width:100%">${opts}</select>
      ${hasSeekerBullet(actor) ? `<p style="margin:6px;">Пуля Искатель (только для Mind Over Matter) — вместо эффекта на цели:</p>
        <select name="seek" style="width:100%"><option value="">— обычный эффект силы —</option>${seekerOpts}</select>` : ""}`,
    rejectClose: false,
    buttons: [{ action: "ok", label: "Вплести", default: true,
      callback: (ev, b) => ({ power: b.form.elements.power.value, seek: b.form.elements.seek?.value ?? "" }) }]
  });
  if (!pick) return;
  const power = actor.items.get(pick.power);
  if (!power) return;
  await markThrottleUsed(actor, WEAVE_FLAG, "round");
  const mom = itemHasName(power, "Mind Over Matter");
  const seek = (mom && pick.seek !== "") ? SEEKER_EFFECTS[Number(pick.seek)] : "";
  const seekIdx = seek ? Number(pick.seek) : null;
  await postTestCard(actor, {
    icon: "ᚱ", title: `Рунный Выстрел: вплетение «${esc(power.name)}» — ${esc(actor.name)}`,
    lines: [
      "Манифестация — на ступень короче (полное → полудействие → свободное). Феномены и Прорывы, кроме обычного эффекта, наносят оружию Клин.",
      "Сила применяется к цели попадания (психострельба — свои попадания, ауры — от цели), даже за пределом обычной дальности. Поддержание — не дольше начала следующего Хода.",
      (power.system?.powerType === "touch" || /касани/i.test(String(power.system?.range ?? ""))) && hasLivingBullet(actor) ? "Живая Пуля: Контакт Плоти Биомантии — через пулю." : "",
      seek ? `Пуля Искатель: вместо эффекта на цели — ${esc(seek)}. Манифестация Mind Over Matter (W+0) ниже; при Успехе эффект ляжет на следующий одиночный выстрел рунной пулей сам.` : "",
      hasTimedExplosion(actor) && isPsychicBlast(power) ? "Выдержанный Взрыв: при промахе или успешном Избегании взрыв разряжается в 1 м позади цели (по линии от Питати)." : ""
    ].filter(Boolean).map(l => `<div class="roll-threshold">${l}</div>`)
  }, { sound: false });
  const { showManifestDialog } = await import("../sheets/tabs/psychic.mjs");
  showManifestDialog(actor, power, seekIdx != null ? { seekerBullet: seekIdx } : {});
}

/** Успешная манифестация Mind Over Matter с выбранной Пулей Искателем — эффект ждёт рунного выстрела. */
export async function armSeekerBullet(actor, idx) {
  if (idx == null || !actor?.setFlag) return "";
  await actor.setFlag(NS, SEEKER_FLAG, Number(idx));
  return `ᚱ Пуля Искатель готова: ${esc(SEEKER_EFFECTS[idx] ?? "")} — на следующий одиночный выстрел рунной пулей (окно атаки учтёт само).`;
}

// ── Кнопки карточки рунного выстрела ────────────────────────────────────────

const SEEKER_BTN = "wh-pitati-seeker-btn";
const TIMED_BTN = "wh-pitati-timed-btn";

/**
 * Карточка выстрела рунной пулей (флаг attack.opts.talentPaid.runic):
 *  • Пуля Искатель «развернуть пулю» — если ей дан эффект разворота;
 *  • Выдержанный Взрыв — у Питати с Талантом (промах или Избегание цели).
 */
export function injectPitatiButtons(html, message) {
  const atk = message?.flags?.[NS]?.attack;
  const paid = atk?.opts?.talentPaid;
  if (!html?.querySelector || !paid?.runic || html.querySelector(`.${SEEKER_BTN}, .${TIMED_BTN}`)) return;
  // Несвязанный токен: game.actors.get(actorId) — актор-образец, а не стрелявший токен; берём по speaker.
  const spoke = globalThis.ChatMessage?.getSpeakerActor?.(message.speaker) ?? null;
  const actor = spoke?.id === atk.actorId ? spoke : globalThis.game?.actors?.get?.(atk.actorId);
  if (!actor?.isOwner) return;
  const host = html.querySelector(".message-content") ?? html;
  const add = (cls, text, title, fn) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = cls; b.textContent = text; b.title = title;
    b.addEventListener("click", ev => { ev.preventDefault(); fn(); });
    host.append(b);
  };
  if (paid.seeker === 3) add(SEEKER_BTN, "ᚱ Пуля Искатель: развернуть пулю (цель Избежала)",
    "Ещё одно Попадание тем же выстрелом — со спины цели.",
    () => seekerReturnHit(actor, { weaponId: atk.itemId, targetUuid: atk.targetUuid, runic: paid.runic }));
  if (hasTimedExplosion(actor)) add(TIMED_BTN, "ᚱ Выдержанный Взрыв: промах или Избегание",
    "Вплести психический взрыв: он разрядится в 1 м позади цели (по линии от Питати).",
    () => useTimedExplosion(actor, { targetUuid: atk.targetUuid }));
}

/** Пуля Искатель: «после успешного Избегания развернуть пулю и нанести ещё одно Попадание со спины цели». */
export async function seekerReturnHit(actor, { weaponId = "", targetUuid = "", runic = null } = {}) {
  const weapon = actor?.items?.get?.(weaponId);
  if (!weapon) return ui.notifications.warn("⚠️ Оружие выстрела не найдено.");
  const target = targetUuid ? await fromUuid(targetUuid).catch(() => null) : null;
  const sys = weapon.system ?? {};
  const base = resolveCharFormula(sys.damage || "0", actor.system?.characteristics, actor.system?.corruptionBonus ?? 0);
  const bonus = Number(runic?.dmg) || 0;
  const roll = await new Roll(bonus ? `${base} + ${bonus}` : base).evaluate();
  const pen = (Number(sys.penetration) || 0) + (Number(runic?.pen) || 0);
  await postTestCard(actor, {
    icon: "ᚱ", title: `Пуля Искатель: разворот — ${esc(actor.name)}`,
    lines: [
      `<div class="roll-threshold">Пуля огибает цель и бьёт ${target ? esc(target.name) : "цель"} со спины: урон ${esc(base)}${bonus ? ` + ${bonus} (рунная пуля)` : ""}, Pen ${pen}.</div>`,
      `<div class="roll-damage-section"><button class="wh-apply-dmg-btn" type="button"
        data-damage="${roll.total}" data-penetration="${pen}" data-damage-type="${esc(sys.damageType || "impact")}" data-damage-subtype=""
        data-hit-location="Торс" data-weapon-name="${esc(weapon.name)} (Пуля Искатель)" data-attacker="${esc(actor.name)}"
        data-felling="0" data-primitive="0" data-ignore-shield="0" data-warp-soak="0" data-melee="0">
        Применить ${roll.total} урона${target ? ` — ${esc(target.name)}` : ""}</button></div>`
    ]
  }, { rolls: [roll], sound: false });
}

/**
 * Точка разряда Выдержанного Взрыва для кнопки шаблона силы (одноразовая; null — нет).
 * Только для шаблона той силы, что вплетена (itemUuid), в том же бою и Раунде: иначе метка
 * жила вечно и подхватывалась любым Взрывным шаблоном. Метку снимает лишь тот, кто вправе
 * писать в Питати (владелец/ГМ); чужой клиент её не трогает и ставит шаблон мышью.
 */
export async function takeTimedExplosionPoint(attackerUuid, itemUuid = "") {
  if (!attackerUuid) return null;
  const doc = await fromUuid(attackerUuid).catch(() => null);
  const actor = doc?.actor ?? doc;
  const at = actor?.getFlag?.(NS, TIMED_EXPLOSION_FLAG);
  if (!at || !actor.isOwner) return null;
  const combat = globalThis.game?.combat?.started ? globalThis.game.combat : null;
  const verdict = timedExplosionVerdict(at, { itemUuid, sceneId: globalThis.canvas?.scene?.id ?? "", combat });
  if (verdict === "skip") return null;
  await actor.unsetFlag(NS, TIMED_EXPLOSION_FLAG);
  return verdict === "use" ? { x: Number(at.x) || 0, y: Number(at.y) || 0 } : null;
}

/**
 * Выдержанный Взрыв: вплести психический взрыв в промахнувшуюся (или
 * обойдённую Избеганием) рунную пулю. Точка разряда — в 1 м позади цели по
 * линии от Питати; её подхватит кнопка шаблона на карточке силы и сама
 * отметит накрытых.
 */
export async function useTimedExplosion(actor, { targetUuid = "" } = {}) {
  if (!actor || !hasTimedExplosion(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Выдержанный Взрыв.");
  if (!isThrottleReady(actor, WEAVE_FLAG, "round")) return ui.notifications.warn("⚠️ Вплетение — раз в Ход, уже было.");
  const doc = targetUuid ? await fromUuid(targetUuid).catch(() => null) : null;
  const target = doc?.actor ?? doc;
  const me = actor.getActiveTokens?.(true)?.[0] ?? null;
  const tt = target?.getActiveTokens?.(true)?.[0] ?? null;
  if (!me || !tt) return ui.notifications.warn("⚠️ Нет токенов стрелка и цели на сцене.");
  const powers = [...actor.items].filter(p => runicWeaveAllowed(actor, p) && isPsychicBlast(p));
  if (!powers.length) return ui.notifications.warn("⚠️ Нет психических взрывов, которые можно вплести.");
  let power = powers[0];
  if (powers.length > 1) {
    const id = await foundry.applications.api.DialogV2.wait({
      window: { title: "Выдержанный Взрыв" }, classes: ["warhammer-dbc", "wh-holo"],
      content: `<select name="power" style="width:100%">${powers.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select>`,
      rejectClose: false,
      buttons: [{ action: "ok", label: "Вплести", default: true, callback: (ev, b) => b.form.elements.power.value }]
    });
    power = actor.items.get(id);
    if (!power) return;
  }
  const size = globalThis.canvas?.grid?.size || 100;
  const radius = (Math.min(tt.document.width, tt.document.height) / 2) * size;
  const at = timedExplosionPoint(me.center, tt.center, radius, pxPerMeter());
  await markThrottleUsed(actor, WEAVE_FLAG, "round");
  const combat = game.combat?.started ? game.combat : null;
  await actor.setFlag(NS, TIMED_EXPLOSION_FLAG, { x: at.x, y: at.y, sceneId: globalThis.canvas?.scene?.id ?? "",
    itemUuid: power.uuid, combatId: combat?.id ?? "", round: Number(combat?.round) || 0 });
  await postTestCard(actor, {
    icon: "ᚱ", title: `Выдержанный Взрыв: «${esc(power.name)}» — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Пуля разряжает вплетённый взрыв в 1 м позади ${esc(target.name)} (по линии от Питати). Кнопка шаблона на карточке силы поставит зону туда сама и отметит накрытых.</div>`]
  }, { sound: false });
  const { showManifestDialog } = await import("../sheets/tabs/psychic.mjs");
  showManifestDialog(actor, power);
}

/** Сквозной Выстрел: вместо вплетения за полудействие тест W+0 — тPR ×2 в бонусе рунной пули. */
export async function usePiercingShot(actor) {
  if (!actor || !hasPiercingShot(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Сквозной Выстрел.");
  if (!isThrottleReady(actor, WEAVE_FLAG, "round")) return ui.notifications.warn("⚠️ В этот Ход уже было вплетение — Сквозной Выстрел вместо него.");
  await markThrottleUsed(actor, WEAVE_FLAG, "round");
  const res = await rollTestCard(actor, {
    icon: "ᚱ", title: "Сквозной Выстрел", label: "W",
    base: Number(actor.system?.characteristics?.wp?.total) || 0, ctx: { kind: "skill", char: "wp" },
    lines: r => [r.success
      ? "Следующий рунный выстрел: тPR удваивается в бонусе к Dmg и Pen (ставится само). Нанёс урон после Поглощения или цель увернулась — следующая цель на линии огня получает попадание с уроном меньше на эффективное Поглощение первой; и так далее."
      : "Пуля не напиталась."]
  });
  if (res.success) await actor.setFlag(NS, PIERCING_SHOT_FLAG, true);
}
