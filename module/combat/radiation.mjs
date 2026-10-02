// module/combat/radiation.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Лучевая болезнь (стр. 30-31, wdbc-r5o7.6) — осложнение Радиации: провал
//  теста T+0 при накоплении 10/20/30... уровней Радиации (combat/
//  condition-ticks.mjs::processConditionTurnEnd) ставит флаг
//  flags.warhammer-dbc.radiationSickness. Книга: «доп. урон в T каждые 8
//  часов, лечится Medicae−30» — конкретную кость для этого урона книга не
//  называет (в отличие от Гангрены, у которой прямо «1d10»); решение — тот
//  же фиксированный 1, что и у самой Радиации за Раунд (condition-ticks.mjs),
//  раз книга не задаёт число явно, а не подбирать кость самостоятельно.
//  «Лечится Medicae−30» — снятие флага руками через тест на листе, как и у
//  любого другого «вылечено» — отдельной кнопки-теста для лечения тут не
//  заводим, это уже стандартный путь через Лечение (wounds-heal-btn).
//
//  Тот же общий приём worldTime-кулдауна (rules/cooldown.mjs), что и Перевес
//  выключенной силовой брони (combat/armor-mods.mjs) и Гангрена (combat/
//  gangrene.mjs) — кнопка на листе, жмётся вручную раз в 8 часов игрового
//  времени, не автоматический хук по ходу времени.
// ════════════════════════════════════════════════════════════════════════════

import { worldTimeRemaining } from "../rules/cooldown.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { applyCharDamage } from "./char-damage.mjs";
import { rollConditionCharTest } from "./condition-ticks.mjs";
import { isImmuneToCondition } from "../rules/condition-guards.mjs";
import { isItemActive } from "../apps/effects.mjs";
import { combatEntryOf, combatOfActor } from "./actor-combat.mjs";
import {
  COMBAT_RAD_FLAG, COMBAT_RAD_TEST_THRESHOLD, combatRadiationAfterHit, combatRadiationDue,
  radiationTestExempt, vehicleOccupantUuids
} from "../rules/radiation-combat.mjs";

const FLAG = "warhammer-dbc";
const SICKNESS_FLAG = "radiationSickness";
const TEST_AT_FLAG = "radiationSicknessTestAt";
const SECONDS_PER_HOUR = 3600;
const INTERVAL_HOURS = 8;

/** Секунд до следующего тика лучевой болезни (0 — доступен прямо сейчас). */
export function radiationSicknessRemaining(testAt, worldTime) {
  return worldTimeRemaining(testAt, worldTime, INTERVAL_HOURS * SECONDS_PER_HOUR);
}

/**
 * Клик по кнопке листа: 1 непоглощаемого урона в T (system.charDamage.t,
 * см. заголовок файла про выбор фиксированного числа). Таймер сбрасывается
 * в любом исходе.
 */
export async function useRadiationSicknessTest(actor) {
  if (!actor?.getFlag?.(FLAG, SICKNESS_FLAG)) return;
  const testAt = actor.getFlag(FLAG, TEST_AT_FLAG);
  const remaining = radiationSicknessRemaining(testAt, game.time.worldTime);
  if (remaining > 0) {
    return ui.notifications.warn("Лучевая болезнь ещё не накопилась на новый урон T.");
  }

  // Единый конвейер урона в Характеристики (wdbc-x1nz.2.83).
  const { before, after, died } = await applyCharDamage(actor, "t", 1,
    { extra: { [`flags.${FLAG}.${TEST_AT_FLAG}`]: game.time.worldTime } });

  await postTestCard(actor, {
    icon: rollIcon("warp","#ffe14d"), title: `Лучевая болезнь → ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Урон в T: <b>1</b> (T ${before}→${after})${died ? " — умирает" : ""}</div>`]
  }, { sound: false });
}

// ── Rad (X): попадание и счёт «за бой» (wdbc-x1nz.10) ─────────────────────────
// Книга (core.json, Особые Свойства Оружия): «Если оно пробило броню цели,
// она получает X урона в T. Машины, вопреки распространенному заблуждению, не
// имунны к этому эффекту. Живые существа, получившие за один бой 10 и более
// урона в T от радиации, должны после боя пройти тест на T+0, или получить
// лучевую болезнь». Теста при попадании и порога «непоглощённый урон ≥ X»,
// что жили здесь раньше, в книге нет. Пробитие проверяет вызывающий
// (hooks.mjs::_applyWeaponPropEffect, flags.lastBreach).

// «Тот самый бой» книги — начатый бой, где цель участвует, а не game.combat
// (бой, открытый в трекере у ГМа): combat/actor-combat.mjs, общий с «Бичом
// Чемпионов».

/** Карточка без броска: Рад не сработал по причине цели. */
function radNoteCard(actor, label, text) {
  return postTestCard(actor, {
    icon: rollIcon("warp", "#ffe14d"), title: `${esc(label)} → ${esc(actor.name)}`,
    outcome: outcomeHtml(true, text)
  }, { sound: false });
}

/**
 * Попадание Rad (X), уже пробившее броню: X урона в T без теста; в бою —
 * ещё и в счётчик «за бой» (rules/radiation-combat.mjs).
 * @param {Actor}  actor
 * @param {object} o
 * @param {string} o.formula  рейтинг X — формула («1d5», «2d10+2») или число
 * @param {string} [o.label]  подпись свойства для карточки
 */
export async function applyRadHit(actor, { formula = "", label = "Рад" } = {}) {
  if (!actor) return;
  // Техника: у неё нет Характеристики T, радиация бьёт тех, кто внутри
  // (решение владельца 02.10.2026) — экипаж и пассажиры, каждому X в T.
  if (actor.type === "vehicle") return applyRadHitToVehicle(actor, { formula, label });

  // Урон в Характеристики хранится только у существ (system.charLoss,
  // data/actor/_creature.mjs).
  const skip = radSkipReason(actor);
  if (skip) return radNoteCard(actor, label, skip);
  const f = String(formula ?? "").trim();
  if (!f) {
    return ui.notifications.warn(`⚠️ ${label}: у оружия не задан рейтинг Рад (X) — впишите формулу на листе оружия (напр. 1d5).`);
  }

  const roll = await new Roll(f).evaluate();
  const amount = Math.max(0, Number(roll.total) || 0);
  const { applied, before, after, died, counter } = await radDamageToCreature(actor, amount);
  let combatNote = `<div class="roll-threshold" style="opacity:.8;">Вне боя — в счёт «10+ за бой» не идёт</div>`;
  if (counter != null) {
    combatNote = `<div class="roll-threshold">За этот бой от радиации: <b>${counter}</b> урона в T${counter >= COMBAT_RAD_TEST_THRESHOLD
      ? " — после боя тест T+0 на лучевую болезнь" : ` (с ${COMBAT_RAD_TEST_THRESHOLD} — тест T+0 после боя)`}</div>`;
  }

  await postTestCard(actor, {
    icon: rollIcon("warp", "#ffe14d"), title: `${esc(label)} → ${esc(actor.name)}`,
    lines: [
      `<div class="roll-threshold">Броня пробита — урон в T без теста: ${esc(f)} = <b>${applied}</b> (T ${before}→${after})${died ? " — <b>умирает</b>" : ""}</div>`,
      combatNote
    ]
  }, { rolls: [roll], sound: false });
}

/** Почему Рад по этому существу не сработает (текст для карточки) или "". */
function radSkipReason(actor) {
  if (!actor.system?.charLoss) return "Нет Характеристики T — урон в T не нанесён";
  // Иммунитет к радиации (Рад Печь, Облучённый и т.п.) — записью Конструктора
  // kind:"condition" condKey:"radiation", тот же ключ, что гасит Состояние.
  if (isImmuneToCondition(actor, "radiation", isItemActive)) return "Иммунитет к радиации — урон не нанесён";
  return "";
}

/**
 * X урона в T одному существу плюс запись в счёт «10+ за бой». Порядок —
 * сначала урон: в счётчик идёт то, что реально легло в T (с надбавками
 * Генетического Угасания и т.п., applyCharDamage), а не выпавшее число.
 * «За один бой» — идущий бой, где цель участник; вне боя урон есть, счёта нет
 * (counter === null).
 */
async function radDamageToCreature(actor, amount) {
  const combatId = combatOfActor(actor)?.id ?? null;
  const { applied, before, after, died } = await applyCharDamage(actor, "t", amount);
  let counter = null;
  if (combatId) {
    const next = combatRadiationAfterHit(actor.getFlag?.(FLAG, COMBAT_RAD_FLAG), combatId, applied);
    await actor.update({ [`flags.${FLAG}.${COMBAT_RAD_FLAG}`]: next });
    counter = next.amount;
  }
  return { applied, before, after, died, counter };
}

/** Кто сидит на местах Техники: актор по uuid места; удалённых и не найденных нет. */
async function vehicleOccupants(vehicle) {
  const out = [];
  for (const uuid of vehicleOccupantUuids(vehicle)) {
    const doc = await fromUuid(uuid).catch(() => null);
    const occupant = doc?.actor ?? doc;
    if (!occupant) continue;
    // Стоит в бою — бьём актора ТОКЕНА из трекера (под ним же копится счёт и
    // его же бросит тест после боя), а не мирового актора с боковой панели.
    const resolved = combatEntryOf(occupant)?.actor ?? occupant;
    if (!out.includes(resolved)) out.push(resolved);
  }
  return out;
}

/**
 * Rad по Технике: один бросок X, тот же урон в T каждому на борту, одна общая
 * карточка. Пробитие брони Техники система не считает (у неё свой учёт), так
 * что кнопку жмут, когда броня машины пробита.
 */
async function applyRadHitToVehicle(vehicle, { formula, label }) {
  const occupants = await vehicleOccupants(vehicle);
  if (!occupants.length) {
    return radNoteCard(vehicle, label, "На борту никого нет — урон в T не нанесён (у самой Техники T нет)");
  }
  const f = String(formula ?? "").trim();
  if (!f) {
    return ui.notifications.warn(`⚠️ ${label}: у оружия не задан рейтинг Рад (X) — впишите формулу на листе оружия (напр. 1d5).`);
  }
  const roll = await new Roll(f).evaluate();
  const amount = Math.max(0, Number(roll.total) || 0);

  const lines = [
    `<div class="roll-threshold">Радиация по Технике бьёт тех, кто на борту: ${esc(f)} = <b>${amount}</b> урона в T каждому, без теста</div>`
  ];
  for (const who of occupants) {
    // Кнопку жмёт владелец машины, а экипаж может быть чужим персонажем:
    // правка чужого актора падает с ошибкой прав. ГМ — владелец всех.
    const skip = who.isOwner === false
      ? "нет прав на этого персонажа — урон ему применяет ГМ (кнопка от его лица)"
      : radSkipReason(who);
    if (skip) { lines.push(`<div class="roll-threshold" style="opacity:.8;">${esc(who.name)}: ${esc(skip)}</div>`); continue; }
    const { applied, before, after, died, counter } = await radDamageToCreature(who, amount);
    const tally = counter == null ? "" : `, за бой ${counter}${counter >= COMBAT_RAD_TEST_THRESHOLD ? " — тест T+0 после боя" : ""}`;
    lines.push(`<div class="roll-threshold">${esc(who.name)}: <b>${applied}</b> (T ${before}→${after})${died ? " — <b>умирает</b>" : ""}${tally}</div>`);
  }
  await postTestCard(vehicle, {
    icon: rollIcon("warp", "#ffe14d"), title: `${esc(label)} → ${esc(vehicle.name)} (экипаж)`,
    lines
  }, { rolls: [roll], sound: false });
}

/**
 * Конец боя (hooks.mjs, deleteCombat): у кого за этот бой набралось 10+
 * урона в T от Рад — тест T+0, провал — лучевая болезнь (тот же флаг, что
 * ставит Состояние «Радиация», дальше работает 8-часовой тик выше). Счётчик
 * этого боя снимается у всех, тест он вызвал или нет.
 */
export async function resolveCombatRadiation(combat) {
  if (!combat) return;
  // deleteCombat приходит каждому ГМу (и «Помощнику ГМа»): бросает один —
  // активный, иначе тест T+0 катился бы столько раз, сколько ГМов в сети.
  const activeGM = globalThis.game?.users?.activeGM;
  if (activeGM && !activeGM.isSelf) return;
  for (const combatant of combat.combatants ?? []) {
    const actor = combatant.actor;
    const rec = actor?.getFlag?.(FLAG, COMBAT_RAD_FLAG);
    if (!rec || rec.combatId !== combat.id) continue;
    await actor.update({ [`flags.${FLAG}.-=${COMBAT_RAD_FLAG}`]: null });
    if (!combatRadiationDue(rec, combat.id)) continue;
    // Демоны и Демоны-Принцы тест не бросают — «радиация — не болезнь».
    if (radiationTestExempt(actor)) continue;

    const t = await rollConditionCharTest(actor, "t");
    if (!t.success) await actor.setFlag(FLAG, SICKNESS_FLAG, true);
    await postTestCard(actor, {
      icon: rollIcon("warp", "#ffe14d"),
      title: `Радиация после боя — ${esc(actor.name)}`,
      threshold: rollStatLine({ label: "T+0", base: t.base, parts: t.parts, threshold: t.eff, rv: t.rv }),
      lines: [`<div class="roll-threshold">За бой получено <b>${rec.amount}</b> урона в T от радиации (${COMBAT_RAD_TEST_THRESHOLD}+ — тест)</div>`],
      outcome: outcomeHtml(t.success, t.success ? "Успех — без последствий" : "Провал — лучевая болезнь")
    }, { rolls: [t.roll] });
  }
}
