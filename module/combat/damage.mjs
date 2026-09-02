// module/combat/damage.mjs

import { HIT_LOCATIONS }  from "../constants/combat.mjs";
import { DAMAGE_TYPES }   from "../constants/items.mjs";
import { _degWord, esc }       from "../helpers/utils.mjs";
import { getCriticalEffect } from "../../critical-tables.mjs";
import { parseCritEffectPills, critPillsHtml } from "./crit-effect-parser.mjs";
import { SHIELD_STATUS }  from "../constants/shields.mjs";
import { applyDamageToVehicle } from "./vehicle.mjs";
import { applyDamageToHorde }   from "./horde-damage.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { ablativeDamage } from "../rules/mount.mjs";
import { resolveArmorAbsorptionAP, breachArmorAtLocation } from "./armor-properties.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { isFrontArcHit, resolveAttackerToken } from "./facing.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { hasWeaponPropertyImmunity } from "./weapon-properties.mjs";
import { PACIFISM_CAPABILITY, PACIFISM_ATTACKED_FLAG } from "./pacifism.mjs";
import { maybeGrantEnjoymentPain } from "./enjoyment.mjs";
import { throughShotPierces, throughShotReductionDie } from "./through-shot.mjs";
import { activeAblativeArmorMods } from "./armor-mods.mjs";
import { ablativeApAfterHit } from "../rules/ablative-ap.mjs";

// ─── Свойства оружия wdbc-plsf: Corrosive/Piercing/Crippling/Haywire ──────────
// Применяются здесь (не в attack.mjs/hooks.mjs), потому что только тут разом
// известны актор, место попадания (armorKey), тип урона и непоглощённый урон.

/** Разъедающее: −X AP в месте попадания; остаток рейтинга — непоглощ. C Dmg. */
async function _applyCorrosive(actor, armorKey, hitLocation, rating) {
  const currentAP = Math.max(0, Number(actor.system.absorption?.armorOnly?.[armorKey]) || 0);
  const existing  = Number(actor.system.armorCorrosion?.[armorKey]) || 0;
  const lost      = Math.min(rating, currentAP);
  const overflow  = rating - lost;
  await actor.update({ [`system.armorCorrosion.${armorKey}`]: existing + lost });

  let overflowNote = "";
  if (overflow > 0) {
    const { currentWounds, newWounds, newCritical, gotCritical } = await applyWoundLoss(actor, overflow);
    overflowNote = `, остаток <b>${overflow}</b> — непоглощаемый урон (Раны ${currentWounds}→${newWounds}${gotCritical ? `, крит. ${newCritical}` : ""})`;
  }
  return `<div class="dmg-tb-note">🧪 Разъедающее: −${lost} AP брони (${hitLocation})${overflowNote}</div>`;
}

/**
 * Убирает урон в AP брони от Разъедающего в указанной локации: техобслуживание
 * за ½ смены работы (без теста, Trade(Armourer)+0) — сам тест/время не
 * проверяются, кнопка на листе (вкладка БОЙ) доступна всегда.
 */
export async function repairArmorCorrosion(actor, armorKey) {
  if (!actor.system.armorCorrosion?.[armorKey]) {
    return ui.notifications?.info(`${actor.name}: в этой части тела нет разъеденного AP.`);
  }
  await actor.update({ [`system.armorCorrosion.${armorKey}`]: 0 });
}

/**
 * Проникающее: снаряд в ране (после непоглощённого урона) — −10 действий
 * частью тела (GM-отыгрыш: нет понятия «тест использует эту часть тела»),
 * −1 SPD торс/нога (автоматизировано, rules/character.mjs). Кнопка
 * извлечения — тот же полудействие+1 R Dmg, что и клик hooks.mjs
 * (.wh-piercing-extract-btn) вызывает extractPiercingWound().
 */
async function _applyPiercing(actor, armorKey, hitLocation) {
  const already = !!actor.system.piercingWounds?.[armorKey];
  if (!already) await actor.update({ [`system.piercingWounds.${armorKey}`]: 1 }); // NumberField — Foundry кастовал бы true в 1
  const spdNote = ["body", "leftLeg", "rightLeg"].includes(armorKey) ? "; −1 SPD" : "";
  return `<div class="dmg-tb-note">
    🏹 Проникающее: снаряд в ране (${hitLocation}) — −10 действия этой частью тела${spdNote}, пока не извлечён${already ? " (рана уже была)" : ""}
    <button class="wh-piercing-extract-btn" type="button" data-actor-uuid="${actor.uuid}" data-armor-key="${armorKey}" data-location="${hitLocation}">Извлечь снаряд (+1 непоглощ. R Dmg)</button>
  </div>`;
}

/**
 * Извлекает застрявший снаряд Проникающего: полудействие, +1 непоглощаемый
 * R Dmg в ту же часть, снимает штраф/рану. Дёргается кнопкой в чате
 * (.wh-piercing-extract-btn, hooks.mjs) из заметки _applyPiercing выше.
 */
export async function extractPiercingWound(actor, armorKey) {
  if (!actor.system.piercingWounds?.[armorKey]) {
    return ui.notifications?.info(`${actor.name}: в этой части тела нет застрявшего снаряда.`);
  }
  await actor.update({ [`system.piercingWounds.${armorKey}`]: 0 });
  const { currentWounds, newWounds, newCritical, gotCritical } = await applyWoundLoss(actor, 1);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">🏹 Извлечение снаряда → ${esc(actor.name)}</div>
      <div class="roll-threshold">Снаряд извлечён (${armorKey}), +1 непоглощ. R Dmg (Раны ${currentWounds}→${newWounds}${gotCritical ? `, крит. ${newCritical}` : ""})</div>
    </div>`
  });
}

/**
 * Калечащее: рана с шипами — записывается в system.crippledWounds (список,
 * видимый на будущее UI/для лечения) И сразу получает кнопку в этой же
 * заметке чата: игрок/ГМ решают, когда «оба ОД в Ход ушли на физические
 * действия» (в economy.mjs действия не размечены на физические/нефизические
 * — отдельный, более широкий рефакторинг, не в этом тикете) и жмут её.
 * Клик наносит непоглощаемый урон, НО НЕ снимает рану (снимается только
 * лечением/полным исцелением, стр. 168) — кнопка кликабельна многократно.
 */
async function _applyCrippling(actor, armorKey, hitLocation, damageType, rating) {
  const wounds = [...(actor.system.crippledWounds ?? [])];
  wounds.push({ location: armorKey, locationLabel: hitLocation, rating, damageType });
  await actor.update({ "system.crippledWounds": wounds });
  return `<div class="dmg-tb-note">
    🩸 Калечащее: рана с шипами в ${hitLocation} — снимается лечением/полным исцелением
    <button class="wh-crippling-trigger-btn" type="button" data-actor-uuid="${actor.uuid}" data-rating="${rating}" data-location="${hitLocation}">Оба ОД на физ. действие — нанести ${rating} урона</button>
  </div>`;
}

/** Наносит урон одной раны Калечащего (клик .wh-crippling-trigger-btn, hooks.mjs) — рана не снимается. */
export async function applyCripplingTrigger(actor, rating, hitLocation) {
  const { currentWounds, newWounds, newCritical, gotCritical } = await applyWoundLoss(actor, rating);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">🩸 Калечащее (${hitLocation}) → ${esc(actor.name)}</div>
      <div class="roll-threshold">Непоглощ. урон: <b>${rating}</b> (Раны ${currentWounds}→${newWounds}${gotCritical ? `, крит. ${newCritical}` : ""})</div>
    </div>`
  });
}

const HAYWIRE_TABLE = [
  { max: 2,  label: "Незначительно",         text: "Никакого эффекта." },
  { max: 4,  label: "Слабое Нарушение",       text: "Действия с хай-тек снаряжением −10. SPD силовой брони/Машин −1. Машины — 1 полудействие в Ход." },
  { max: 6,  label: "Сильное Нарушение",      text: "Действия с хай-тек снаряжением −20. Рукопашное оружие — как примитивное. SPD силовой брони −3. Машины Оглушены, пока не покинут поле." },
  { max: 8,  label: "Мёртвая Зона",           text: "Хай-тек снаряжение отключено: стрелковое не работает, рукопашное — как примитивное, силовая броня отключена, бионика отключена (штрафы по ГМу). Машины Беспомощны." },
  { max: 10, label: "Длительная Мёртвая Зона", text: "Как Мёртвая Зона, но на два Хода." },
  { max: Infinity, label: "ЭМИ Шторм",        text: "Как Мёртвая Зона + Качество электроники −1 (или отключение ниже Poor.Q), стрелковое Заклинивает, Машины — 1d5+1 непоглощ. E Dmg." }
];

/**
 * ЭМИ: бросок 1d10+X по таблице (стр. 168). Применяется только к персонажам/
 * тварям — Техника (actor.type "vehicle") уходит через applyDamageToVehicle
 * ДО этой функции (см. applyDamageToActor), у неё нет system.absorption/
 * этой ветки урона вовсе; урон «Машинам» по столбцу 11+ (1d5+1 E) — ручное
 * применение ГМом через обычную кнопку «Применить урон», как и остальные
 * эффекты таблицы (действия/SPD/Заклинивание/деградация Качества).
 */
async function _applyHaywire(actor, rating) {
  // X у Haywire — РАДИУС поля в метрах, к мощности не прибавляется:
  // «Изначальная мощность ЭМИ-поля определяется броском 1d10» (стр. 168).
  const roll = await new Roll("1d10").evaluate();
  const total = roll.total;
  const tier = HAYWIRE_TABLE.find(t => total <= t.max);
  return `<div class="dmg-tb-note">📡 ЭМИ${rating ? ` (радиус ${rating} м)` : ""}: 1d10=<b>${total}</b> → <b>${tier.label}</b>. ${tier.text}</div>`;
}

// ─── Маппинг места попадания → поле брони актора ──────────────────────────────
const LOCATION_TO_ARMOR = {
  "Голова":           "head",
  "Торс":             "body",
  "П. Рука":          "rightArm",
  "Л. Рука":          "leftArm",
  "Рука":             "rightArm",
  "П. Нога":          "rightLeg",
  "Л. Нога":          "leftLeg",
  "Нога":             "rightLeg",
  "Сочленение / Шея": "head",
  "Глаз (Голова)":    "head"
};

// ─── Бросок щита ─────────────────────────────────────────────────────────────
/**
 * Выполняет бросок активного щита при получении урона.
 * Возвращает объект:
 *   { blocked: true }                         — попадание аннулировано
 *   { blocked: false, overloaded: true }      — щит перегружен и выключен
 *   { blocked: false, overloaded: false }     — щит не сработал
 *   null                                      — нет активного щита
 */
async function _rollActiveShield(actor, { skipWarp = false } = {}) {
  // Ищем самый мощный активный щит (по currentRating). Освящённое оружие
  // (skipWarp) пропускает чародейские (варп-природные) щиты.
  const shieldItem = actor.items.contents
    .filter(i =>
      i.type === "forcefield" &&
      i.system.equipped &&
      i.system.status === "active" &&
      !(skipWarp && (i.system.shieldNature || "technological") === "warp")
    )
    .sort((a, b) => (b.system.currentRating ?? 0) - (a.system.currentRating ?? 0))[0];

  if (!shieldItem) return null;

  const s          = shieldItem.system;
  const rating     = s.currentRating     ?? 0;
  const threshold  = s.overloadThreshold ?? 0;
  const shieldType = s.shieldType        || "dome";
  const shieldNature = s.shieldNature    || "technological";

  // Бросок d100
  const roll = await new Roll("1d100").evaluate();
  const rv   = roll.total;

  const rollMode = game.settings.get("core", "rollMode");

  // ── Определяем результат (стр. 240) ───────────────────────────────────────
  // Бросок ≤ рейтинг → удар аннулирован. Рейтинг перегрузки (после «/») — это
  // ПОДМНОЖЕСТВО успеха (низкий бросок): удар всё равно поглощён, но щит
  // перегружается и выключается.
  const blocked    = rv <= rating;
  const overloaded = blocked && threshold > 0 && rv <= threshold;

  // ── Обновляем статус щита если перегружен ────────────────────────────────
  if (overloaded) {
    await shieldItem.update({
      "system.status":       "overloaded",
      "system.equipped":     false,
      "system.currentRating": 0
    });
  }

  // ── Тип щита для отображения ──────────────────────────────────────────────
  const typeLabels = { dome: "Купол", deflector: "Дефлект.", penetrating: "Сквозной" };
  const natureLabels = { technological: "Технологический", warp: "Чародейский" };
  const typeLabel    = typeLabels[shieldType]    ?? shieldType;
  const natureLabel  = natureLabels[shieldNature] ?? shieldNature;

  // ── Лейбл результата ─────────────────────────────────────────────────────
  let resultLabel = "";
  let resultClass = "";
  if (overloaded) {
    resultLabel = `Бросок <b>${rv}</b> ≤ Рейтинг <b>${rating}</b> — попадание аннулировано, но щит перегружен (≤ ${threshold}) и выключен!`;
    resultClass = "roll-warning";
  } else if (blocked) {
    resultLabel = `Бросок <b>${rv}</b> ≤ Рейтинг <b>${rating}</b> — попадание аннулировано`;
    resultClass = "roll-success";
  } else {
    resultLabel = `Бросок <b>${rv}</b> > Рейтинг <b>${rating}</b> — щит не сработал`;
    resultClass = "roll-failure";
  }

  // ── Сообщение в чат ───────────────────────────────────────────────────────
  const messageData = ChatMessage.applyRollMode({
    speaker: { alias: "Система" },
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">
          ${overloaded ? "Щит поглотил удар и перегрузился" : blocked ? "Щит поглотил удар" : "Бросок щита"}
        </div>
        <div class="roll-threshold">
          ${shieldItem.name}
        </div>
        <div class="roll-outcome">
          <span class="${resultClass}">${resultLabel}</span>
        </div>
        <div class="roll-threshold" style="font-size:0.85em; opacity:0.8;">
          Рейтинг: <b>${rating}</b>
          ${threshold > 0 ? `| Порог перегрузки: <b>${threshold}</b>` : ""}
          | Тип: <b>${typeLabel}</b>
          | Природа: <b>${natureLabel}</b>
        </div>
        ${overloaded ? `
        <div class="roll-threshold" style="color:#c07000;">
          Щит нуждается в обслуживании перед повторным использованием.
        </div>` : ""}
      </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, rollMode);

  await ChatMessage.create(messageData);

  return { blocked, overloaded };
}

/**
 * Защитные Руны (Runes of Protection X, wdbc-tejb): тест W+0+(бPR×5) на
 * каждое попадание извне — автоматический, тем же приёмом, что _rollActiveShield
 * выше: исход всегда ≥0 (провал всё равно даёт +бPR AP), поэтому «пробовать
 * или нет» по сути никогда не бывает «нет», спрашивать игрока незачем. Успех
 * → +(бPR+Успехи+4) AP этой локации, провал → +бPR AP. бPR — БАЗОВЫЙ Психо-
 * рейтинг (system.psyker.rating), не текущий/эффективный (currentRating) —
 * книга явно пишет «бPR», не «тPR»/«эPR» (см. module/rules/psyker.mjs).
 *
 * НЕ покрыто (сознательно, доп. случаи книги — оценить отдельно, если
 * понадобится): Выжигание Души («исключение» книги — этот урон бьёт мимо
 * applyDamageToActor совсем, минуя броню, hooks.mjs::_executeSoulBurn),
 * «считается чародейским силовым щитом» для способов его обходить
 * (Sanctified и другие анти-варп-щит эффекты здесь не проверяются), и
 * стр. 20 книги — модификаторы бPR ПО КОНКРЕТНОЙ Рунной Броне в зависимости
 * от свойств ВХОДЯЩЕЙ атаки (+1 бPR за Accurate/Blast/Concussive/Felling/
 * Extreme/Flame/Force/Grav/Maximal/Piercing/Precise/Power Field/Proven/
 * Tearing, до +3 суммарно; +2 бPR флэт за Dmg 2d10+/психосилу/техночудо;
 * +3 бPR за Lance/Melta/Mighty каждое) — не читается вообще, здесь всегда
 * голый system.psyker.rating. «Рунная Броня» (packs-src/armor) прямо в
 * тексте предмета несёт свой персональный «+2 бPR к Runes of Protection» —
 * тоже не подключён.
 */
async function _rollRunesOfProtection(actor) {
  const bPR      = Number(actor.system.psyker?.rating) || 0;
  const wpTotal  = Number(actor.system.characteristics?.wp?.total) || 0;
  const threshold = wpTotal + bPR * 5;
  const roll = await new Roll("1d100").evaluate();
  const rv   = roll.total;
  const success = rv <= threshold;
  const deg  = success ? Math.floor((threshold - rv) / 10) + 1 : 0;
  const apBonus = success ? bPR + deg + 4 : bPR;

  const rollMode = game.settings.get("core", "rollMode");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("shield","#8fd0ff")}Защитные Руны — ${esc(actor.name)}</div>
        <div class="roll-threshold">W <b>${wpTotal}</b>${bPR ? ` + бPR×5 (бPR <b>${bPR}</b>)` : ""} → Порог <b>${threshold}</b></div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${success
          ? `<span class="roll-success">Успех (${deg} ст.) — +${apBonus} AP (бPR ${bPR} + Успехи ${deg} + 4)</span>`
          : `<span class="roll-failure">Провал — +${apBonus} AP (бPR)</span>`}</div>
      </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, rollMode));

  return apBonus;
}

// ─── Применить урон к актору ──────────────────────────────────────────────────
export async function applyDamageToActor(actor, damageData) {
  // «Крайне миролюбив» (wdbc-gzuf, Серый Человек) — флаг «атакован в этом
  // бою» взводится здесь, в единой точке резолва урона (обычные атаки через
  // hooks.mjs, атаки Орды через horde-sheet.mjs — оба пути доходят сюда).
  // Сбрасывается Hooks.on("combatStart") в warhammer-dbc.mjs. Гейт на вход
  // в Ярость читает флаг там же — module/combat/pacifism.mjs.
  if (hasRuleFlag(actor, PACIFISM_CAPABILITY) && !actor.getFlag("warhammer-dbc", PACIFISM_ATTACKED_FLAG)) {
    await actor.setFlag("warhammer-dbc", PACIFISM_ATTACKED_FLAG, true);
  }
  // Техника: урон сразу в Структуру. Сторона брони пришла из окна атаки
  // (damageData.side), часть машины — из авто-места попадания (damageData.hitLocation).
  if (actor.type === "vehicle") {
    const VEH_PARTS = ["Ходовая", "Корпус", "Орудие", "Башня"];
    return applyDamageToVehicle(actor, {
      ...damageData,
      side: damageData.side || "side",
      vehicleLocation: VEH_PARTS.includes(damageData.hitLocation) ? damageData.hitLocation : "Корпус"
    });
  }
  // Орда: Ран у неё нет, Поглощение лежит одним числом, а попадания всегда идут
  // в торс — общий расчёт зон брони и Критических Ран ей не подходит.
  if (actor.type === "horde") return applyDamageToHorde(actor, damageData);

  // «Избегает атак Орды как одиночная цель» (wdbc-gzuf, Серый Человек) —
  // цель ещё не была известна на момент броска Орды (magDiceBonus едет
  // отдельным числом от horde-sheet.mjs через hooks.mjs), поэтому кубы
  // Магнитуды вычитаются здесь, где актор-цель уже точно известен. Теряется
  // при Размере 2+ (тот же sizeTotal, что читает sizeOf() в horde-damage.mjs).
  if (Number(damageData.magDiceBonus) > 0) {
    const sizeTotal = actor.system?.sizeTotal != null
      ? Number(actor.system.sizeTotal) || 0
      : (Number(actor.system?.size) || 0) + (Number(actor.system?.sizeMod) || 0) + (Number(actor.system?.sizeModNoSpd) || 0);
    if (sizeTotal < 2 && hasRuleFlag(actor, "horde.singleTargetImmune")) {
      damageData = { ...damageData, rawDamage: Math.max(0, (Number(damageData.rawDamage) || 0) - Number(damageData.magDiceBonus)) };
    }
  }

  const {
    rawDamage,       // число — урон до поглощения
    penetration,     // число — бронепробитие
    damageType,      // строка — "impact", "rending" и т.д.
    hitLocation,     // строка — "Голова", "Торс" и т.д.
    attackerName,    // строка
    attackerUuid = "", // Выстрел Насквозь: нужен токен стрелка для геометрии луча (wdbc-wlwf)
    weaponName,      // строка
    felling = 0,     // Разящее (X): −X к Сверхъест. Стойкости цели
    primitive = false, // Примитивное: броня цели ×2 (макс +6)
    ignoreShield = false, // Омывание (Flush) / Варп-Оружие: игнор щита
    warpSoak = false,  // Варп-Оружие: поглощение по W.b вместо AP+T.b
    lance = false,     // Копьё/Пика: AP цели капается до 20 (до вычета Pen)
    sanctified = false, // Освящённое: игнорирует чародейские (варп) щиты
    melee = false,      // Рукопашная атака — нужно свойству брони Rods (Стержни)
    frontArcHit = false, // Атака из передней дуги защищающегося — Cloak/Плащ (wdbc-p5el)
    corrosiveRating = 0, // Разъедающее (X): −X AP в месте попадания (wdbc-plsf)
    cripplingRating = 0, // Калечащее (X): рана с шипами (wdbc-plsf)
    piercing = false,    // Проникающее: снаряд в ране при непоглощ. уроне (wdbc-plsf)
    haywireActive = false, // ЭМИ: свойство присутствует (Haywire(0) — валидный рейтинг, wdbc-plsf)
    haywireRating = 0,   // ЭМИ (X): бросок по таблице при попадании (wdbc-plsf)
    throughShot = false  // Выстрел Насквозь: свойство присутствует (wdbc-wlwf)
  } = damageData;

  // ── Бросок щита (если есть активный) ─────────────────────────────────────
  // ignoreShield (Flush/Варп) — щит не катится совсем; sanctified — катится, но
  // варп-природные (чародейские) щиты пропускаются.
  const shieldResult = ignoreShield ? null : await _rollActiveShield(actor, { skipWarp: sanctified });

  // Если щит заблокировал — урон аннулирован, выходим
  if (shieldResult?.blocked) return;

  // ── Расчёт поглощения ─────────────────────────────────────────────────────
  const system    = actor.system;
  const absorption = system.absorption || {};
  const armorKey  = LOCATION_TO_ARMOR[hitLocation] || "body";
  // wdbc-bxw6: аблативный AP-щит (Роба Чемпиона и т.п., system.ablativeApShield)
  // — плоская добавка к поглощению ЭТОГО попадания, читается ДО того, как то
  // же попадание списывает с неё заряд (см. decrement ниже).
  const ablativeShieldBefore = Number(system.ablativeApShield?.value) || 0;

  let tb, armorAP, effArmorAP, totalAbsorption;
  let runesBonus = 0;

  if (warpSoak) {
    // Варп-Оружие: игнорирует броню и обычную Стойкость — поглощает только W.b.
    // Два источника «AP всё же считается» (wdbc-unku/wdbc-sg57), не суммируются
    // друг с другом — берётся лучший: capability armor.apVsWarpFull (освящённая
    // броня/руническая кольчуга — AP брони этой локации целиком) приоритетнее
    // Рунической Вязи «Эгида Г'Нелле» (½AP, окр.▼). Только персонажи/твари —
    // применение «по вязи на сторону» для техники не реализовано: урон
    // технике идёт другим путём (combat/vehicle.mjs), не через эту функцию.
    tb = 0;
    // absorption[armorKey] хранит AP + T.b (documents/actor.mjs) — Варп-Оружие
    // Стойкость не учитывает никогда, поэтому T.b вычитается, как и в обычной
    // ветке ниже: иначе «AP брони» протаскивал бы Бонус Стойкости обратно.
    const warpArmorAP = (absorption[armorKey] ?? 0) - (absorption.toughnessBonus ?? 0);
    armorAP = hasRuleFlag(actor, "armor.apVsWarpFull")
      ? warpArmorAP
      : hasRuleFlag(actor, "runicWeave.aegisOfGnelle")
        ? Math.floor(warpArmorAP / 2)
        : 0;
    effArmorAP = armorAP;
    totalAbsorption = (system.characteristics?.wp?.bonus ?? 0) + armorAP + ablativeShieldBefore;
  } else {
    // T.b — не игнорируется пробитием. Разящее снижает Сверхъест. часть Стойкости.
    tb = absorption.toughnessBonus ?? 0;
    if (felling > 0) {
      const unnaturalT = (system.characteristics?.t?.supernatural ?? 0)
                       + (system.traitCharBonus?.t ?? 0);
      tb -= Math.min(felling, Math.max(0, unnaturalT));
      tb  = Math.max(0, tb);
    }
    // AP брони — может быть уменьшен пробитием. Свойства брони этой локации
    // (Conductive/Flak/Soft/Rods/Open/Primitive) — см. armor-properties.mjs и
    // сбор флагов по локациям в documents/actor.mjs.
    armorAP = resolveArmorAbsorptionAP({
      baseArmorAP: (absorption[armorKey] ?? 0) - (absorption.toughnessBonus ?? 0),
      vsTypeBonus: absorption.vsType?.[damageType] ?? 0,
      damageType, melee, hitLocation, primitive, frontArcHit,
      flags: absorption.propFlags?.[armorKey],
      wornAP: absorption.wornOnly?.[armorKey]
    });
    // Защитные Руны (Runes of Protection, wdbc-tejb): +AP этой локации ДО
    // Копья/Пробития — читает WP/бPR актора, сама решает, применяться ли
    // (пропускает, если у брони этой локации нет свойства).
    if (absorption.propFlags?.[armorKey]?.runesOfProtection) {
      runesBonus = await _rollRunesOfProtection(actor);
      armorAP += runesBonus;
    }
    // Копьё/Пика (Lance): если AP цели > 20 — снижается до 20 в расчёте
    // поглощения, ДО вычета пробития (стр. 168).
    if (lance && armorAP > 20) armorAP = 20;
    // Эффективный AP брони после пробития (мин. 0)
    effArmorAP = Math.max(0, armorAP - (penetration || 0));
    // Итоговое поглощение = эффективный AP + T.b (всегда) + аблативный AP-щит
    // (не подчиняется Пробитию/Копью — отдельный слой, не физическая броня).
    totalAbsorption = effArmorAP + tb + ablativeShieldBefore;
  }
  // Точка расширения (wdbc-ls9d): плоское снижение входящего урона от эффектов
  // (system.incomingDamageReduction, суммируется — см. _creature.mjs) —
  // отдельно от AP/T.b, пробитием не уменьшается.
  const incomingReduction = Number(system.incomingDamageReduction) || 0;

  // Непоглощённый урон. Аблативное Бронирование скакуна (стр. 478) срезает
  // его до 1, пока запас Ран полон, — первый же удар снимает слой, и дальше
  // Черта молчит до полного восстановления.
  const rawNet = Math.max(0, rawDamage - totalAbsorption - incomingReduction);
  // Пробитие (wdbc-k0ff): непоглощённый урон дошёл до цели — броня этой
  // локации скомпрометирована. warpSoak не считается: варп-оружие обходит
  // броню целиком, а не проламывает её физически.
  if (rawNet > 0 && !warpSoak) await breachArmorAtLocation(actor, armorKey);

  // wdbc-bxw6: аблативные AP-моды брони и аблативный AP-щит теряют ровно 1
  // заряд с ЭТОГО попадания — независимо от нанесённого урона (rules/ablative-ap.mjs).
  const ablativeMods = activeAblativeArmorMods(actor);
  if (ablativeMods.length) {
    await actor.updateEmbeddedDocuments("Item", ablativeMods.map(m => ({
      _id: m.id, "system.ablativeCharge": ablativeApAfterHit(m.system.ablativeCharge)
    })));
  }
  if (ablativeShieldBefore > 0) {
    await actor.update({ "system.ablativeApShield.value": ablativeApAfterHit(ablativeShieldBefore) });
  }

  const netDamage = ablativeDamage(rawNet, actor);
  const ablated = netDamage !== rawNet;

  const { currentWounds, newWounds, newCritical, gotCritical } =
    await applyWoundLoss(actor, netDamage);

  // Критический эффект по таблице — только при уходе в Критические.
  const critEffect = gotCritical ? getCriticalEffect(damageType, hitLocation, newCritical) : null;

  // Enjoyment/Наслаждение (wdbc-sk8s): Непоглощённый Урон / Критический
  // Эффект от атаки — 1 Боли раз за бой, без траты Реакции.
  if (netDamage > 0) await maybeGrantEnjoymentPain(actor);

  // ── Свойства оружия wdbc-plsf: Corrosive/Piercing/Crippling/Haywire ────────
  // Гейт capability weaponPropertyImmunity.<key> — Мутации/Дары («Пылающее
  // Тело», «Щит Чистоты» и т.п.) дают его через Механику (kind: "capability").
  const propEffectNotes = [];
  if (corrosiveRating > 0 && !hasWeaponPropertyImmunity(actor, "corrosive")) {
    propEffectNotes.push(await _applyCorrosive(actor, armorKey, hitLocation, corrosiveRating));
  }
  if (piercing && netDamage > 0 && !hasWeaponPropertyImmunity(actor, "piercing")) {
    propEffectNotes.push(await _applyPiercing(actor, armorKey, hitLocation));
  }
  if (cripplingRating > 0 && netDamage > 0 && !hasWeaponPropertyImmunity(actor, "crippling")) {
    propEffectNotes.push(await _applyCrippling(actor, armorKey, hitLocation, damageType, cripplingRating));
  }
  if (haywireActive && !hasWeaponPropertyImmunity(actor, "haywire")) {
    propEffectNotes.push(await _applyHaywire(actor, haywireRating));
  }

  // ── Сообщение в чат ──────────────────────────────────────────────────────
  const rollMode = game.settings.get("core", "rollMode");
  const dtLabel  = DAMAGE_TYPES[damageType] || damageType;

  const propNotes = [];
  if (primitive)   propNotes.push("Примитивное: броня ×2");
  if (felling > 0) propNotes.push(`Разящее ${felling}: −Сверхъест. T`);
  if (ignoreShield && !warpSoak) propNotes.push("Омывание: щит проигнорирован");
  if (!warpSoak) {
    const pfNote = absorption.propFlags?.[armorKey] || {};
    if (pfNote.noEnergy && damageType === "energy")  propNotes.push("Проводящая: без AP от Энергии");
    if (pfNote.noImpact && damageType === "impact")  propNotes.push("Мягкая: без AP от Удара");
    if (pfNote.doubleBlast && damageType === "blast") propNotes.push("Флак: AP брони ×2");
    if (pfNote.noRanged && !melee)                    propNotes.push("Стержни: без AP от стрелковой атаки");
    if (pfNote.noJointCalled && hitLocation === "Сочленение / Шея") propNotes.push("Стержни: без AP в Сочленение");
    if (pfNote.noEyeCalled  && hitLocation === "Глаз (Голова)")     propNotes.push("Открытый шлем: без AP в Глаз");
    if (!pfNote.noJointCalled && hitLocation === "Сочленение / Шея")
      propNotes.push(pfNote.noJointReduction ? "Мягкая: без сочленений, полный AP" : "Сочленение: AP÷3");
    if (!pfNote.noEyeCalled && hitLocation === "Глаз (Голова)")
      propNotes.push(pfNote.isPowerArmor ? "Силовой шлем: 4 AP на глаза" : "Глаз: AP шлема проигнорирован");
    if (primitive && pfNote.blocksPrimitiveDouble)    propNotes.push("Примитивная броня: без бонуса AP примитивного оружия");
    if (runesBonus > 0) propNotes.push(`Защитные Руны: +${runesBonus} AP (см. бросок выше)`);
  }

  const reductionNote = incomingReduction > 0
    ? `<div class="dmg-tb-note">Доп. снижение входящего урона: <b>−${incomingReduction}</b></div>`
    : "";
  const ablativeShieldNote = ablativeShieldBefore > 0
    ? `<div class="dmg-tb-note">Аблативный AP-щит: +${ablativeShieldBefore} (остаток после попадания: ${ablativeApAfterHit(ablativeShieldBefore)})</div>`
    : "";

  const armorBreakdown = warpSoak
    ? `<div class="dmg-absorption-detail">
        ${rollIcon("warp","#c98bff")}Варп-Оружие: игнор брони/T.b — поглощение = W.b <b>${totalAbsorption}</b>
        ${reductionNote}
        ${ablativeShieldNote}
      </div>`
    : `<div class="dmg-absorption-detail">
        AP брони: <b>${armorAP}</b>
        ${penetration > 0
          ? `− Pen <b>${penetration}</b> = <b>${effArmorAP}</b>`
          : ""}
        + T.b: <b>${tb}</b>
        = Поглощение: <b>${totalAbsorption}</b>
        ${penetration > 0
          ? `<span class="dmg-tb-note">(T.b не игнорируется пробитием)</span>`
          : ""}
        ${propNotes.length ? `<div class="dmg-tb-note">${propNotes.join(" · ")}</div>` : ""}
        ${reductionNote}
        ${ablativeShieldNote}
      </div>`;

  const woundsLine = netDamage > 0
    ? `Раны: <b>${currentWounds}</b> → <b>${newWounds}</b>${
        ablated ? ` <span class="dmg-tb-note">(Аблативное Бронирование: ${rawNet} → 1)</span>` : ""}`
    : `Урон поглощён полностью`;

  // wdbc-xql6: типовые фразы крит-строки («Оглушена на NdX Раундов» и т.п.)
  // распознаются в кликабельные пилюли — актор цели уже известен здесь.
  const critPills = critEffect ? parseCritEffectPills(critEffect) : [];
  const critLine = gotCritical ? `
    <div class="dmg-critical-block">
      <b>Критический урон</b> · отрицательные раны: <b>${newCritical}</b>
      ${critEffect ? `<div class="roll-crit-effect">${critEffect}</div>` : ""}
      ${critPillsHtml(critPills, actor.uuid)}
    </div>` : "";

  // Пометка — щит не сработал (для информации в сообщении)
  const shieldFailNote = (shieldResult && !shieldResult.blocked) ? `
    <div class="roll-threshold" style="color:#c07000;">
      Щит не сработал — урон применён
    </div>` : "";

  // Выстрел Насквозь (wdbc-wlwf): AP+T.b цели < Pen×2 — пробило, кнопка ищет
  // геометрию «следующей цели по линии огня» (findThroughShotTarget,
  // hooks.mjs). Сам новый бросок урона (со снижением по throughShotReductionDie)
  // и продолжение цепочки — вручную, как и раньше. warpSoak не участвует:
  // варп-оружие уже обходит броню целиком, тест «AP+T.b» для него не имеет смысла.
  const throughShotBtn = (throughShot && !warpSoak && throughShotPierces(armorAP, tb, penetration)) ? `
    <button class="wh-through-shot-btn" type="button"
      data-attacker-uuid="${attackerUuid}" data-target-uuid="${actor.uuid}"
      data-weapon-name="${esc(weaponName || "")}">
      🎯 Пробило насквозь — найти следующую цель по линии огня (${throughShotReductionDie(1) ? `−${throughShotReductionDie(1)}` : "флэт −1"} к урону)
    </button>` : "";

  const messageData = ChatMessage.applyRollMode({
    speaker: { alias: "Система" },
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">Урон → ${esc(actor.name)}</div>
        <div class="roll-damage-meta">
          Источник: <b>${attackerName || "?"}</b>${weaponName ? ` (${weaponName})` : ""}
          · Место: <b>${hitLocation}</b> · Тип: <b>${dtLabel}</b> · Урон: <b>${rawDamage}</b>
        </div>
        ${armorBreakdown}
        ${shieldFailNote}
        <div class="roll-damage-section">
          <div class="roll-section-head">Итог</div>
          ${netDamage > 0
            ? `<div class="roll-hit-line">
                 <span class="roll-hit-idx">Непоглощённый урон</span>
                 <span class="roll-hit-dmg roll-hit-dmg-bad">${netDamage}</span>
               </div>`
            : `<div class="roll-outcome"><span class="roll-success">Урон поглощён (${rawDamage} ≤ ${totalAbsorption + incomingReduction})</span></div>`
          }
          <div class="roll-damage-meta">${woundsLine}</div>
        </div>
        ${critLine}
        ${propEffectNotes.join("")}
        ${throughShotBtn}
      </div>`
  }, rollMode);

  await ChatMessage.create(messageData);
}

/**
 * Моносеть (Monofilament X, wdbc-tejb): после провала теста на освобождение
 * цель получает (X×3)+Провалы R урона с Pen X — ЧЕРЕЗ обычное поглощение
 * брони (в отличие от Bane/Vibro книга не называет этот урон непоглощаемым),
 * плюс −1 AP брони цели ВО ВСЕХ частях тела (тот же накопитель, что у
 * Corrosive/armorCorrosion, просто сразу по всем локациям одним update), и
 * до урона — бросок 1d5: ≤X означает попадание в Сочленение/Шею, иначе Торс
 * (тот же дефолт локации, что у промаха/безадресного урона в движке — книга
 * не называет исход при "не Сочленение"). Постит СВОЮ карточку через
 * applyDamageToActor — вызывающая сторона (hooks.mjs, _applyWeaponPropEffect)
 * не строит для этого удара отдельный dmgNote с числом урона.
 */
export async function applyMonofilamentHit(actor, { rating, damage, weaponName = "" }) {
  const corrosion = actor.system.armorCorrosion || {};
  const armorUpdate = {};
  for (const key of Object.keys(corrosion)) {
    armorUpdate[`system.armorCorrosion.${key}`] = (Number(corrosion[key]) || 0) + 1;
  }
  if (Object.keys(armorUpdate).length) await actor.update(armorUpdate);

  const jointRoll = await new Roll("1d5").evaluate();
  const isJoint = jointRoll.total <= rating;
  const hitLocation = isJoint ? "Сочленение / Шея" : "Торс";

  await applyDamageToActor(actor, {
    rawDamage: damage, penetration: rating, damageType: "rending",
    hitLocation, weaponName, melee: false
  });

  return { jointRoll, isJoint, hitLocation };
}

// ─── Диалог применения урона ──────────────────────────────────────────────────
export async function showApplyDamageDialog(damageData) {
  const targets  = [...(game.user.targets ?? [])];
  const selected = canvas.tokens?.controlled ?? [];

  // Собираем токены-кандидаты (сначала цели, потом выделенные)
  const candidates = targets.length > 0 ? targets : selected;

  if (candidates.length === 0) {
    ui.notifications.warn("⚠️ Выберите или отметьте токен цели!");
    return;
  }

  // Геометрия передней дуги (Cloak/Плащ, wdbc-p5el) — атакующий один на всю
  // карточку, резолвится один раз; у каждого защищающегося своя дуга.
  const attackerToken = await resolveAttackerToken(damageData.attackerUuid);
  const withFacing = defenderToken => ({
    ...damageData,
    frontArcHit: attackerToken ? isFrontArcHit(defenderToken, attackerToken) : false
  });

  // Один токен — применяем без диалога
  if (candidates.length === 1) {
    const actor = candidates[0].actor ?? candidates[0].document?.actor;
    if (actor) await applyDamageToActor(actor, withFacing(candidates[0]));
    return;
  }

  // Несколько токенов — диалог выбора
  const options = candidates.map((t, i) => {
    const name = t.name ?? t.document?.name ?? `Токен ${i}`;
    return `<option value="${i}">${name}</option>`;
  }).join("");

  new Dialog({
    title: "Применить урон к...",
    content: `
      <form style="padding:8px;">
        <div style="margin-bottom:6px;font-size:0.9em;">
          Урон: <b>${damageData.rawDamage}</b> |
          Место: <b>${damageData.hitLocation}</b> |
          Тип: <b>${DAMAGE_TYPES[damageData.damageType] || damageData.damageType}</b>
        </div>
        <select id="dmg-target" style="width:100%;padding:4px;">
          ${options}
        </select>
      </form>`,
    buttons: {
      apply: {
        icon: '<i class="fas fa-heart-broken"></i>',
        label: "Применить",
        callback: async html => {
          const idx   = parseInt(html.find("#dmg-target").val()) || 0;
          const token = candidates[idx];
          const actor = token.actor ?? token.document?.actor;
          if (actor) await applyDamageToActor(actor, withFacing(token));
        }
      },
      all: {
        icon: '<i class="fas fa-users"></i>',
        label: "Всем",
        callback: async () => {
          for (const token of candidates) {
            const actor = token.actor ?? token.document?.actor;
            if (actor) await applyDamageToActor(actor, withFacing(token));
          }
        }
      },
      cancel: { label: "Отмена" }
    },
    default: "apply"
  }, { classes: ["dialog","wh-damage-dialog"], width: 340 }).render(true);
}