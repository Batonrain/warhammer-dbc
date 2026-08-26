// module/combat/damage.mjs

import { HIT_LOCATIONS }  from "../constants/combat.mjs";
import { DAMAGE_TYPES }   from "../constants/items.mjs";
import { _degWord, esc }       from "../helpers/utils.mjs";
import { getCriticalEffect } from "../../critical-tables.mjs";
import { SHIELD_STATUS }  from "../constants/shields.mjs";
import { applyDamageToVehicle } from "./vehicle.mjs";
import { applyDamageToHorde }   from "./horde-damage.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { ablativeDamage } from "../rules/mount.mjs";
import { resolveArmorAbsorptionAP } from "./armor-properties.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";

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

// ─── Применить урон к актору ──────────────────────────────────────────────────
export async function applyDamageToActor(actor, damageData) {
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

  const {
    rawDamage,       // число — урон до поглощения
    penetration,     // число — бронепробитие
    damageType,      // строка — "impact", "rending" и т.д.
    hitLocation,     // строка — "Голова", "Торс" и т.д.
    attackerName,    // строка
    weaponName,      // строка
    felling = 0,     // Разящее (X): −X к Сверхъест. Стойкости цели
    primitive = false, // Примитивное: броня цели ×2 (макс +6)
    ignoreShield = false, // Омывание (Flush) / Варп-Оружие: игнор щита
    warpSoak = false,  // Варп-Оружие: поглощение по W.b вместо AP+T.b
    lance = false,     // Копьё/Пика: AP цели капается до 20 (до вычета Pen)
    sanctified = false, // Освящённое: игнорирует чародейские (варп) щиты
    melee = false      // Рукопашная атака — нужно свойству брони Rods (Стержни)
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

  let tb, armorAP, effArmorAP, totalAbsorption;

  if (warpSoak) {
    // Варп-Оружие: игнорирует броню и обычную Стойкость — поглощает только W.b
    tb         = 0;
    armorAP    = 0;
    effArmorAP = 0;
    totalAbsorption = system.characteristics?.wp?.bonus ?? 0;
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
      damageType, melee, hitLocation, primitive,
      flags: absorption.propFlags?.[armorKey]
    });
    // Копьё/Пика (Lance): если AP цели > 20 — снижается до 20 в расчёте
    // поглощения, ДО вычета пробития (стр. 168).
    if (lance && armorAP > 20) armorAP = 20;
    // Эффективный AP брони после пробития (мин. 0)
    effArmorAP = Math.max(0, armorAP - (penetration || 0));
    // Итоговое поглощение = эффективный AP + T.b (всегда)
    totalAbsorption = effArmorAP + tb;
  }
  // Точка расширения (wdbc-ls9d): плоское снижение входящего урона от эффектов
  // (system.incomingDamageReduction, суммируется — см. _creature.mjs) —
  // отдельно от AP/T.b, пробитием не уменьшается.
  const incomingReduction = Number(system.incomingDamageReduction) || 0;

  // Непоглощённый урон. Аблативное Бронирование скакуна (стр. 478) срезает
  // его до 1, пока запас Ран полон, — первый же удар снимает слой, и дальше
  // Черта молчит до полного восстановления.
  const rawNet = Math.max(0, rawDamage - totalAbsorption - incomingReduction);
  const netDamage = ablativeDamage(rawNet, actor);
  const ablated = netDamage !== rawNet;

  const { currentWounds, newWounds, newCritical, gotCritical } =
    await applyWoundLoss(actor, netDamage);

  // Критический эффект по таблице — только при уходе в Критические.
  const critEffect = gotCritical ? getCriticalEffect(damageType, hitLocation, newCritical) : null;

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
  }

  const reductionNote = incomingReduction > 0
    ? `<div class="dmg-tb-note">Доп. снижение входящего урона: <b>−${incomingReduction}</b></div>`
    : "";

  const armorBreakdown = warpSoak
    ? `<div class="dmg-absorption-detail">
        ${rollIcon("warp","#c98bff")}Варп-Оружие: игнор брони/T.b — поглощение = W.b <b>${totalAbsorption}</b>
        ${reductionNote}
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
      </div>`;

  const woundsLine = netDamage > 0
    ? `Раны: <b>${currentWounds}</b> → <b>${newWounds}</b>${
        ablated ? ` <span class="dmg-tb-note">(Аблативное Бронирование: ${rawNet} → 1)</span>` : ""}`
    : `Урон поглощён полностью`;

  const critLine = gotCritical ? `
    <div class="dmg-critical-block">
      <b>Критический урон</b> · отрицательные раны: <b>${newCritical}</b>
      ${critEffect ? `<div class="roll-crit-effect">${critEffect}</div>` : ""}
    </div>` : "";

  // Пометка — щит не сработал (для информации в сообщении)
  const shieldFailNote = (shieldResult && !shieldResult.blocked) ? `
    <div class="roll-threshold" style="color:#c07000;">
      Щит не сработал — урон применён
    </div>` : "";

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
      </div>`
  }, rollMode);

  await ChatMessage.create(messageData);
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

  // Один токен — применяем без диалога
  if (candidates.length === 1) {
    const actor = candidates[0].actor ?? candidates[0].document?.actor;
    if (actor) await applyDamageToActor(actor, damageData);
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
          if (actor) await applyDamageToActor(actor, damageData);
        }
      },
      all: {
        icon: '<i class="fas fa-users"></i>',
        label: "Всем",
        callback: async () => {
          for (const token of candidates) {
            const actor = token.actor ?? token.document?.actor;
            if (actor) await applyDamageToActor(actor, damageData);
          }
        }
      },
      cancel: { label: "Отмена" }
    },
    default: "apply"
  }, { classes: ["dialog","wh-damage-dialog"], width: 340 }).render(true);
}