// module/combat/armor-mods.mjs
// ─────────────────────────────────────────────────────────────────────────────
//  Модификации брони (включая Системы Силовой брони).
//  armorMod.system.installedOn = id брони. Системы (category="powerSystem")
//  работают только с силовой бронёй — «Силовая» (power) или «Аспектная» (aspect,
//  считается силовой для модификаций/систем).
// ─────────────────────────────────────────────────────────────────────────────

import { carryRow, esc } from "../helpers/utils.mjs";
import { hasDisabledPowerArmour, disabledArmourWeight, disabledArmourPenalty,
         disabledArmourOverloadTier } from "../rules/armour-penalty.mjs";
import { SECONDS_PER_HOUR } from "../constants/imperial-calendar.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { addFatigue } from "../sheets/tabs/conditions.mjs";
import { worldTimeRemaining, markWorldTimeCooldownUsed } from "../rules/cooldown.mjs";

const FLAG = "warhammer-dbc";
const OVERLOAD_TEST_AT_FLAG = "disabledArmourOverloadTestAt";
const MAX_AGILITY_FORCED_FLAG = "disabledArmourMaxAgilityForced10";

// Типы брони, считающиеся «силовыми» для систем силовой брони.
const POWER_ARMOR_TYPES = new Set(["power", "aspect"]);

/**
 * Система стоит в шлеме? Слот берётся из modGroup библиотеки систем.
 * Вокс-линк — исключение: он работает через горжет и со снятым шлемом,
 * пусть и только на передачу звука. Имя проверяется, а не флаг, чтобы
 * правило действовало и на предметы, заведённые до этого расширения.
 */
export function isHelmetMod(mod) {
  if (mod?.system?.modGroup !== "helmet") return false;
  return !/вокс|vox/i.test(mod.name || "");
}

/** Шлем снят и правило включено? */
function helmetIsOff(actor) {
  if (!actor?.system?.helmetOff) return false;
  try { return game.settings.get("warhammer-dbc", "helmetless") !== false; }
  catch (e) { return true; }
}

/**
 * Все модификации, установленные на данную броню.
 *
 * wdbc-vwfk (Reformation Song/Разрушение — «доп. AP от других модов/
 * талантов на эту броню до конца боя нивелируются»): если у брони стоит
 * флаг reformationSongSuppressMods, все ЧУЖИЕ моды глушатся — остаются
 * только собственные моды Reformation Song (отмечены флагом
 * reformationSongMod на самом моде, см. combat/reformation-song.mjs),
 * иначе глушился бы и только что созданный мод «Разрушение» вместе со
 * всеми остальными. Флаг снимается clearReformationSongBuffs по концу боя.
 */
export function getInstalledArmorMods(actor, armor) {
  if (!actor || !armor) return [];
  const helmetOff = helmetIsOff(actor);
  const suppressed = !!armor.getFlag?.("warhammer-dbc", "reformationSongSuppressMods");
  return actor.items.filter(i =>
    i.type === "armorMod" && i.system.installedOn === armor.id &&
    // Системы силовой брони действуют только на силовую/аспектную броню
    !(i.system.category === "powerSystem" && !POWER_ARMOR_TYPES.has(armor.system.armorType)) &&
    // Включаемые системы дают бонусы только когда активны
    !(i.system.activatable && !i.system.active) &&
    // Со снятым шлемом всё, что стоит в шлеме, не работает — кроме вокс-линка
    !(helmetOff && isHelmetMod(i)) &&
    (!suppressed || i.getFlag?.("warhammer-dbc", "reformationSongMod"))
  );
}

/**
 * Подавители Отдачи (wdbc-cnju, стр. 243) — перчатки силовой/аспектной брони,
 * снимающие гейт Отдачи (Recoil) у винтовки/длинной винтовки (weaponClass
 * "basic" — своей категории «длинная винтовка» в схеме нет, обе лежат тут же).
 * Ключа/флага у armorMod нет (в отличие от weaponProps), поэтому — по имени,
 * как isHelmetMod рядом; "не активируемый" мод (activatable:false) уже
 * пропускает гейт активности в getInstalledArmorMods.
 */
const RECOIL_SUPPRESSOR_RE = /подавител[а-я]*\s*отдач|recoil\s*suppressor/i;
export function hasRecoilSuppressor(actor) {
  if (!actor?.items) return false;
  for (const armor of actor.items) {
    if (armor.type !== "armor" || !armor.system?.equipped) continue;
    if (getInstalledArmorMods(actor, armor).some(m => RECOIL_SUPPRESSOR_RE.test(m.name || "")))
      return true;
  }
  return false;
}

/** Свёрнутые эффекты всех модификаций данной брони. */
export function getArmorModEffects(actor, armor) {
  const fx = {
    apAll: 0, apHead: 0, apBody: 0, apArms: 0, apLegs: 0,
    vs: { energy: 0, impact: 0, rending: 0, blast: 0 },
    maxAgilityMod: 0, charBonuses: [], names: []
  };
  for (const mod of getInstalledArmorMods(actor, armor)) {
    // Мигрированные моды несут эти же AP (и AP против типа урона) как embedded
    // ActiveEffect (см. migrations/item-effects.mjs) — не считаем дважды.
    // maxAgilityMod сюда не относится: ключа эффекта у него нет, и миграция
    // мод с ним не помечает (LEGACY_ONLY_KEYS).
    const e = mod.getFlag("warhammer-dbc", "migratedEffect") ? {} : (mod.system.effects || {});
    // wdbc-bxw6: аблативная модификация («Аблативная», стр. 166) отдаёт свой
    // ЖИВОЙ остаток заряда вместо статичного apAll — на 0 заряда бездействует,
    // хотя предмет остаётся установленным (см. rules/ablative-ap.mjs).
    fx.apAll  += mod.system.ablative ? (Number(mod.system.ablativeCharge) || 0) : (e.apAll || 0);
    fx.apHead += e.apHead || 0;
    fx.apBody += e.apBody || 0;
    fx.apArms += e.apArms || 0;
    fx.apLegs += e.apLegs || 0;
    fx.vs.energy  += e.apVsEnergy  || 0;
    fx.vs.impact  += e.apVsImpact  || 0;
    fx.vs.rending += e.apVsRending || 0;
    fx.vs.blast   += e.apVsBlast   || 0;
    fx.maxAgilityMod += e.maxAgilityMod || 0;
    for (const cb of (e.charBonuses || [])) fx.charBonuses.push(cb);
    fx.names.push(mod.name);
  }
  return fx;
}

// Выключенная силовая броня получает ровно Max.A 35 (стр. 233), независимо
// от того, что для НЕЁ ЖЕ включённой прописано в system.maxAgility (обычная
// силовая — без потолка вовсе, Терминаторская/Катафракт держат его ниже) —
// книга не оговаривает, что модификации/собственный потолок брони его ещё
// двигают в выключенном состоянии, поэтому здесь он берётся плоским числом,
// без getArmorModEffects.
const DISABLED_POWER_ARMOUR_MAX_AGILITY = 35;

/**
 * Потолок Ловкости от надетой брони (корбук, Max Agility) либо null, если
 * потолка нет. У брони это `system.maxAgility` (обычной проставлено 100),
 * модификации его поднимают своим maxAgilityMod — «Открытые Сочленения» дают
 * +10 той броне, на которую поставлены. У силовой брони (armorType "power")
 * это условно: пока она `system.active` (включена) — действует её
 * собственный потолок как обычно; выключенная — всегда Max.A 35 (стр. 233,
 * «Выключенная Силовая Броня»), даже если включённой у неё потолка не было.
 *
 * Надето несколько — действует самый строгий: снять ограничение терминаторского
 * доспеха, накинув поверх мантию, нельзя.
 *
 * Модификации считаются через getArmorModEffects, поэтому потолок двигает
 * только то, что реально работает: установленное на эту самую броню,
 * включённое и не в снятом шлеме.
 *
 * Провал теста-развилки «в начале Хода или при отключении» (стр. 233,
 * useDisabledArmourForkTest ниже) роняет Max.A выключенной силовой брони с
 * 35 до 10 — держится флагом актора disabledArmourMaxAgilityForced10, а не
 * отдельно на каждой единице брони: развилка одна на актора, как и весь
 * остальной каскад перевеса.
 */
export function armorAgilityCap(actor) {
  let cap = null;
  const forced10 = actor?.getFlag?.(FLAG, MAX_AGILITY_FORCED_FLAG);
  for (const item of actor?.items ?? []) {
    if (item.type !== "armor" || !item.system?.equipped) continue;
    // === false, не !active: пропавшее поле (старые/тестовые данные без
    // схемы Foundry, где initial:true не подставляется сам) — это «включена»,
    // а не «выключена».
    const value = (item.system.armorType === "power" && item.system.active === false)
      ? (forced10 ? 10 : DISABLED_POWER_ARMOUR_MAX_AGILITY)
      : (Number.isFinite(Number(item.system.maxAgility)) ? Number(item.system.maxAgility) : 100)
        + getArmorModEffects(actor, item).maxAgilityMod;
    cap = cap === null ? value : Math.min(cap, value);
  }
  return cap;
}

// Штраф выключенной силовой брони переехал в module/rules/armour-penalty.mjs
// (wdbc-n17t): его спрашивает реестр правил, а этот файл тянет за собой лист
// и через него сам реестр — получался круг импортов. Реэкспорт оставлен,
// чтобы прежние импорты из combat/armor-mods.mjs работали как работали.
export { PHYSICAL_CHARS, REACTION_SKILLS, hasDisabledPowerArmour,
         disabledArmourWeight, disabledArmourPenalty,
         disabledArmourOverloadTier } from "../rules/armour-penalty.mjs";

/**
 * Периодический тест «раз в T.b часов перевеса» (стр. 233) — секунд до
 * следующего теста (0 — доступен прямо сейчас), тем же общим примитивом
 * worldTimeRemaining (module/rules/cooldown.mjs), что и susAnHealCooldownRemaining
 * (apps/sus-an-heal.mjs). tb≤0 (нет Т.b — вырожденный случай, не встречается
 * в живой игре) — интервал делить не на что, кнопка остаётся доступна
 * всегда, а не виснет заблокированной навечно: 0 часов — не «никогда», а
 * «постоянно».
 */
export function disabledArmourPeriodicTestRemaining(testAt, worldTime, tb) {
  return worldTimeRemaining(testAt, worldTime, (Number(tb) || 0) * SECONDS_PER_HOUR);
}

/**
 * Держит флаг актора `disabledArmourOverloadTestAt` в согласии с текущим
 * тиром перевеса (`system.disabledArmourOverload`, посчитан в
 * actor.mjs/prepareDerivedData к моменту, когда стреляет любой из хуков
 * ниже). Не отслеживает переход null→не-null явно (тир — производное поле,
 * «предыдущего» значения хуку update* не видно) — вместо этого идемпотентно
 * сверяет текущее состояние с флагом при каждом updateActor/updateItem:
 * тир появился, а флага ещё нет — перевес начался только что, ставим
 * worldTime; тир пропал — перевес кончился, снимаем флаг, чтобы следующий
 * заход начинал отсчёт заново, а не с точки многолетней давности. Заодно
 * снимает disabledArmourMaxAgilityForced10 (провал теста-развилки, ниже) —
 * пока перевеса нет, потолку Ловкости неоткуда быть искусственно занижен.
 */
export async function syncDisabledArmourOverloadTimer(actor) {
  if (!game.user.isGM || !actor) return;
  const overload = actor.system?.disabledArmourOverload;
  const testAt = actor.getFlag(FLAG, OVERLOAD_TEST_AT_FLAG);
  // Один actor.update() вместо до двух последовательных setFlag/unsetFlag —
  // этот хук стреляет на КАЖДЫЙ updateActor в игре, лишний круг до сервера
  // на каждый из них давал накопительную задержку в бою.
  const upd = {};
  if (overload && testAt == null) {
    upd[`flags.${FLAG}.${OVERLOAD_TEST_AT_FLAG}`] = game.time.worldTime;
  } else if (!overload && testAt != null) {
    upd[`flags.${FLAG}.-=${OVERLOAD_TEST_AT_FLAG}`] = null;
  }
  if (!overload && actor.getFlag(FLAG, MAX_AGILITY_FORCED_FLAG)) {
    upd[`flags.${FLAG}.-=${MAX_AGILITY_FORCED_FLAG}`] = null;
  }
  if (Object.keys(upd).length) await actor.update(upd);
}

/**
 * Тест Т(+0) «раз в T.b часов перевеса»: провал — 1 Усталость (addFatigue,
 * sheets/tabs/conditions.mjs — тот же путь, что и обычные источники
 * Усталости). Таймер сбрасывается на текущий worldTime в любом исходе —
 * успех тоже тратит интервал, тест не откладывается до провала.
 */
export async function useDisabledArmourPeriodicTest(actor) {
  const testAt = actor.getFlag(FLAG, OVERLOAD_TEST_AT_FLAG);
  const tb = Number(actor.system?.characteristics?.t?.bonus) || 0;
  const remaining = disabledArmourPeriodicTestRemaining(testAt, game.time.worldTime, tb);
  if (remaining > 0) {
    return ui.notifications.warn("Перевес выключенной силовой брони ещё не накопился на новый тест.");
  }

  const t = actor.system.characteristics?.t?.total ?? 0;
  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= t;
  if (!success) await addFatigue(actor, 1);
  await markWorldTimeCooldownUsed(actor, OVERLOAD_TEST_AT_FLAG);

  const rollMode = game.settings.get("core", "rollMode");
  const dice = await roll.render();
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("warn", "#ff6b6b")}Перевес выключенной брони — ${esc(actor.name)}</div>
        <div class="roll-threshold">Т: <b>${t}</b></div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${success
          ? `<span class="roll-success">Успех</span>`
          : `<span class="roll-failure">Провал — +1 Усталость</span>`}</div>
        <div class="roll-threshold" style="font-size:.85em;opacity:.8;">Раз в T.b часов перевеса (стр. 233).</div>
        <details class="roll-dice-details"><summary>${rollIcon("chart", "#8fd0ff")}Показать кубы</summary>${dice}</details>
      </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, rollMode));
}

/**
 * Тест-развилка «в начале Хода или при отключении брони» (стр. 233): S+0
 * или Athletics(S)+10, на выбор игрока (skillKey: "s" | "athletics").
 * Порог берёт тот же armourPenalty, что обычные тесты характеристик/навыков
 * (disabledArmourPenalty — S физическая, значит уже -10 плоских −10 каскада),
 * плюс testPenalty тира (0 на тире 1, −20 на тире 2 — «Тесты… для движения в
 * броне получают штраф −20», книга).
 *
 * Тир 1: провал — Max.A брони падает до 10 (флаг disabledArmourMaxAgilityForced10,
 * читает armorAgilityCap выше). Тир 2: «Успех считается как Провал при
 * предыдущем уровне перевеса» — тот же флаг Max.A→10 на успехе; настоящий
 * провал — «Беспомощен до начала следующего Хода», но это состояние в
 * проекте нигде не блокируется механически (как и helpless тира 3, см.
 * disabledArmourOverloadTier) — только сообщение в чат, за столом ведёт ГМ.
 * Тир 3 теста не имеет вовсе — уже безусловно Беспомощен.
 */
export async function useDisabledArmourForkTest(actor, { skillKey } = {}) {
  const overload = actor.system?.disabledArmourOverload;
  if (!overload) return ui.notifications.warn("Перевеса выключенной брони нет — тест-развилка не нужна.");
  if (overload.tier === 3) return ui.notifications.warn("Тир 3 — персонаж уже безусловно Беспомощен, тест не нужен.");

  const isAthletics = skillKey === "athletics";
  const base  = isAthletics ? Number(actor.system?.skills?.athletics?.total) || 0
                             : Number(actor.system?.characteristics?.s?.total) || 0;
  const bonus = isAthletics ? 10 : 0;
  const armourPenalty = disabledArmourPenalty(actor, { charKey: "s" });
  const eff = base + bonus + armourPenalty + overload.testPenalty;

  const roll = await new Roll("1d100").evaluate();
  const rv = roll.total;
  const success = rv <= eff;

  let resultNote;
  if (overload.tier === 2) {
    if (success) {
      await actor.setFlag(FLAG, MAX_AGILITY_FORCED_FLAG, true);
      resultNote = `<span class="roll-success">Успех — засчитан как Провал тира 1: Max.A брони падает до 10</span>`;
    } else {
      resultNote = `<span class="roll-failure">Провал — Беспомощен до начала следующего Хода (ведите вручную)</span>`;
    }
  } else {
    if (success) {
      resultNote = `<span class="roll-success">Успех</span>`;
    } else {
      await actor.setFlag(FLAG, MAX_AGILITY_FORCED_FLAG, true);
      resultNote = `<span class="roll-failure">Провал — Max.A брони падает до 10</span>`;
    }
  }

  const rollMode = game.settings.get("core", "rollMode");
  const dice = await roll.render();
  const testLabel = isAthletics ? "Athletics(S)+10" : "S+0";
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("warn", "#ff8a5c")}Тест-развилка перевеса (${testLabel}) — ${esc(actor.name)}</div>
        <div class="roll-threshold">Порог: <b>${eff}</b> (${base}${bonus ? ` +${bonus}` : ""}${armourPenalty ? ` ${armourPenalty}` : ""}${overload.testPenalty ? ` ${overload.testPenalty}` : ""})</div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${resultNote}</div>
        <div class="roll-threshold" style="font-size:.85em;opacity:.8;">В начале Хода или при отключении брони (стр. 233).</div>
        <details class="roll-dice-details"><summary>${rollIcon("chart", "#8fd0ff")}Показать кубы</summary>${dice}</details>
      </div>`,
    rolls: [roll],
    sound: CONFIG.sounds.dice
  }, rollMode));
}

/**
 * Диалог выбора S+0 / Athletics(S)+10 для useDisabledArmourForkTest —
 * дёргается автоматически при отключении брони (hooks.mjs) и вручную
 * кнопкой на листе. Молча выходит, если перевеса нет или он уже тир 3
 * (см. useDisabledArmourForkTest) — не показывает диалог зря.
 */
export async function promptDisabledArmourForkTest(actor) {
  const overload = actor.system?.disabledArmourOverload;
  if (!overload || overload.tier === 3) return;

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: "Перевес выключенной брони — тест" },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<p>Броня отключена, а вес превышает Ношение (тир ${overload.tier}). Выберите тест — провал (на тире 2 успех тоже) уронит Max.A брони до 10.</p>`,
    buttons: [
      { action: "s", label: "S+0", callback: () => "s" },
      { action: "athletics", label: "Athletics(S)+10", callback: () => "athletics" }
    ],
    rejectClose: false
  });
  if (!choice) return; // закрыли без выбора — не пропускаем тест насильно, кнопка на листе останется
  await useDisabledArmourForkTest(actor, { skillKey: choice });
}

/**
 * Все установленные и работающие (getInstalledArmorMods) аблативные моды со
 * счётчиком > 0, по всем надетым доспехам актора разом — apAll действует на
 * ВСЕ зоны сразу, поэтому счётчик один на предмет и списывается с ЛЮБОГО
 * попадания по владельцу, а не по локации конкретного попадания
 * (module/rules/ablative-ap.mjs, combat/damage.mjs::applyDamageToActor).
 */
export function activeAblativeArmorMods(actor) {
  const mods = [];
  for (const armor of actor?.items ?? []) {
    if (armor.type !== "armor" || !armor.system?.equipped) continue;
    for (const mod of getInstalledArmorMods(actor, armor)) {
      if (mod.system?.ablative && (Number(mod.system?.ablativeCharge) || 0) > 0) mods.push(mod);
    }
  }
  return mods;
}

/** AP-надбавка модификаций по локации (ключ поля брони). */
export function armorModApForLocation(fx, key) {
  switch (key) {
    case "head":               return fx.apAll + fx.apHead;
    case "body":               return fx.apAll + fx.apBody;
    case "leftArm": case "rightArm": return fx.apAll + fx.apArms;
    case "leftLeg": case "rightLeg": return fx.apAll + fx.apLegs;
    default:                   return fx.apAll;
  }
}
