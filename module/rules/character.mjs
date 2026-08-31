// module/rules/character.mjs
// ════════════════════════════════════════════════════════════════════════════
//  АГРЕГАЦИЯ ПЕРСОНАЖА/NPC (Персонаж/Демон/Принц Демона/Миньон) — Характеристики
//  (total/bonus/breakdown), Навыки, Броня (по локациям, свойства, поля), Вес/
//  Ношение, Опыт, Движение/Инициатива, Пси-Рейтинг, а также авто-эффекты от
//  Черт/Талантов/Имплантов/Наркотиков/Одержимости/Путей Аэльдари/Гемункула.
//  Вызывается напрямую из documents/actor.mjs (prepareDerivedData, ветка после
//  Корабля/Техники/Звёздной системы/Орды/Отряда/Формирования — не через
//  this._prepareXData, как те пять: часть тестов вызывает prepareDerivedData
//  через .call({ type, system, items, … }) на голом объекте без цепочки
//  прототипов). Вынесена из монолита prepareDerivedData (wdbc-yo4n продолжение:
//  пять структурных типов уже были вынесены, этот — самый крупный и последний).
// ════════════════════════════════════════════════════════════════════════════

import { IMPROVEMENT_BONUS, IMPROVEMENTS, SKILL_RANKS } from "../constants/characteristics.mjs";
import { HAEM_STAGES, isHaemonculus } from "../constants/haemonculus.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF }   from "../constants/skills.mjs";
import { carryRow }                        from "../helpers/utils.mjs";
import { getArmorModEffects, armorModApForLocation, armorAgilityCap,
         disabledArmourOverloadTier, disabledArmourWeight } from "../combat/armor-mods.mjs";
import { shieldArmorByLocation } from "../combat/hand-shield.mjs";
import { resolveArmorProps, aggregateArmorAuto, mergeArmorLocFlags, emptyArmorLocFlags } from "../combat/armor-properties.mjs";
import { qualityEffects } from "../constants/quality.mjs";
import { fieldModeEffects } from "../constants/drukhari-armor-fields.mjs";
import { cloneFieldTier } from "../constants/drukhari-gear.mjs";
import { classifyImplant } from "../constants/body-map.mjs";
import { implantMech, ironModForQuality } from "../constants/implant-mechanics.mjs";
import { readEnvForScene } from "../constants/scene-nexus.mjs";
import { computePathPassives } from "../constants/aeldari-paths.mjs";
import { manifestProfile } from "../constants/possession.mjs";
import { vitalCharMods } from "../constants/vitals.mjs";
import { isFeatureEnabled } from "../constants/features.mjs";
import { HOMEWORLD_BY_KEY } from "../constants/homeworlds.mjs";
import { PA_TABLES } from "../constants/power-armour-lore.mjs";
import { sanityMax, madnessLevels } from "./dreadnought.mjs";
import { psyRatingFromTalents } from "./psyker.mjs";
import { hasRuleFlag } from "./flags.mjs";
import { woundLevel } from "./wound-tier.mjs";
import { calcMovement } from "./movement.mjs";

/**
 * Именованный вклад предметов-носителей Механики (Архетип/Раса/Субраса/
 * Элитный архетип/Предсказание/Происхождение и любой другой предмет со
 * вкладкой МЕХАНИКА) в ЗНАЧЕНИЕ характеристики — по предмету, а не общей
 * суммой totalFx: тултип ИТОГО (см. блок «Характеристики» ниже) обязан
 * показывать источник, а не только итоговую цифру. Читает то же самое поле
 * (fx.system.changes на embedded ActiveEffect предмета-носителя), что и
 * сводка вкладки «Эффекты» самого предмета (item-sheet.mjs, summarizeEffectChanges).
 * kind:"characteristic" пишет только "add"/"subtract" (см. OP_OPTIONS в
 * apps/mechanics.mjs — умножение там бессмысленно, надбавка копится с нуля).
 */
function characteristicMechContrib(actor, charKey) {
  const targetKey = `system.characteristics.${charKey}.totalFx`;
  const out = [];
  for (const item of actor.items) {
    let sum = 0;
    for (const fx of item.effects ?? []) {
      if (fx.disabled) continue;
      for (const c of fx.system?.changes ?? []) {
        if (c.key !== targetKey) continue;
        sum += c.type === "subtract" ? -(Number(c.value) || 0) : (Number(c.value) || 0);
      }
    }
    if (sum) out.push({ label: item.name, value: sum });
  }
  return out;
}

/**
 * Производные данные Персонажа/NPC. Мутирует system.* (характеристики,
 * навыки, броня, движение, опыт, пси и т.д.) по данным actor.items.
 *
 * @param {object} actor  сам актор (для actor.items/actor.type/actor.getFlag/actor.token)
 * @param {object} system system актора (мутируется)
 */
export function prepareCharacterDerived(actor, system) {
    const chars  = system.characteristics;

    // Астартес бывают только мужчинами — Телосложение у них принудительно
    // мужское (блок выбора на вкладке «Записи» для этой расы скрыт).
    if (actor.type === "character" && system.race === "astartes") system.bodyType = "male";

    // Защита: списки должны быть массивами (могли стать объектом из-за старого бага ввода)
    if (system.aptitudes && !Array.isArray(system.aptitudes)) {
      system.aptitudes = Object.values(system.aptitudes);
    }
    if (system.advanceTalents && !Array.isArray(system.advanceTalents)) {
      system.advanceTalents = Object.values(system.advanceTalents);
    }
    if (system.paths && !Array.isArray(system.paths)) {
      system.paths = Object.values(system.paths);
    }

    // ── Модификаторы от активных препаратов ────────────────────────────────
    // Пока препарат активен, его модификаторы характеристик применяются прямо
    // к total/bonus (а значит — и к навыкам, боевым порогам, защите).
    // Если запущен пост-эффект — вместо основных применяются модификаторы
    // пост-эффекта.
    const drugCharMods = {};
    for (const item of actor.items) {
      if (item.type !== "drug") continue;
      const ae = item.system.activeEffect;
      if (!ae?.isActive) continue;
      const mods = ae.isAfterEffect
        ? (item.system.afterEffectStatMods || {})
        : (item.system.statMods || {});
      for (const [k, v] of Object.entries(mods)) {
        if (typeof v === "number" && v !== 0) {
          drugCharMods[k] = (drugCharMods[k] || 0) + v;
        }
      }

      // Урон в характеристику пост-эффекта: брошен один раз при запуске
      // пост-эффекта (см. _triggerAfterEffect) и держится, пока он активен.
      if (ae.isAfterEffect && ae.charDamageStat && (ae.charDamageAmount || 0) > 0) {
        const stat = ae.charDamageStat;
        drugCharMods[stat] = (drugCharMods[stat] || 0) - ae.charDamageAmount;
      }

      // «Снижает урон попадания» (specialEffects.reduceDamageOnHit): пока
      // основной эффект активен, плюсуется к system.incomingDamageReduction —
      // тому же полю, что читает конвейер урона (combat/damage.mjs). У
      // пост-эффекта такого поля нет.
      if (!ae.isAfterEffect) {
        const red = Number(item.system.specialEffects?.reduceDamageOnHit) || 0;
        if (red > 0) {
          system.incomingDamageReduction =
            (Number(system.incomingDamageReduction) || 0) + red;
        }
      }
    }
    system.drugCharMods = drugCharMods;

    // ── Эффекты от черт (трейтов) ──────────────────────────────────────────
    // Ядро автоматизации: +X к бонусу характеристики (Unnatural), естественная
    // броня (+AP везде), рейтинг Страха, модификатор Размера.
    const traitCharBonus = {};
    const traitCharValueBonus = {}; // обычные плюсы к ЗНАЧЕНИЮ характеристики (не Unnatural)
    let traitArmourAll = 0;
    // Пер-локационная броня от имплантов/черт (напр. Боевые Латы Скитарии 6/7/7/5/5)
    const traitArmorLoc = { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 };
    // Чёрный Панцирь (импланты Астартес): «БЕЗ БРОНИ считается как нагрудник
    // с АР 4» — это ЗАМЕНА при отсутствии брони на торсе, а не складываемая
    // надбавка (в отличие от обычной Естественной Брони выше). Раньше был
    // заведён как складываемая запись Конструктора (kind:"armour") и давал
    // +4 АР в торс ПОВЕРХ силовой брони (wdbc bug-report 2026-08-22). Флаг
    // участвует ниже в best("body") — том же «лучшее из», что и у брони/щита,
    // не в сумме traitArmorLoc/fxArmor.
    let hasBlackCarapaceBackup = false;
    let traitFearRating = 0;
    let traitSizeMod = 0;
    let traitInitMod = 0;
    let traitSpeedMod = 0;
    // Навыки, у которых Черта/Талант/Имплант ополовинивает штрафы (Конструктор
    // МЕХАНИКА, kind:"testMod" + modValueMode:"halvePenalty") — сам штраф теста
    // остаётся галочкой в диалоге (item-rules.mjs), а вот штраф необученности
    // здесь же, derived-полем skill.total, отдельного диалога для него нет.
    const skillPenaltyHalved = new Set();
    // ── Кибернетика Механикум: авто-автоматизация Техночудес ────────────────
    let implantEnergyMax   = 0;   // +N к максимуму Катушки Потенции (Manipulus и т.п.)
    let implantCompBonus   = 0;   // лучший бонус к тесту Компенсатора среди имплантов
    const techFocusInstalled = []; // Технофокусы (Железо): {name, quality, mod}
    // Черты, импланты и таланты дают авто-эффекты всегда; психосилы — пока
    // поддерживаются; техночудеса — пока поддерживаются либо пассивные.
    for (const item of actor.items) {
      const t = item.type;
      const isActivePower =
        (t === "psychicPower" && item.system.isSustained) ||
        (t === "techPower" && (item.system.sustained || item.system.miracleType === "passive"));
      // Модификация брони даёт бонусы, если установлена на надетую броню
      const isActiveArmorMod = t === "armorMod" && item.system.installedOn &&
        actor.items.get(item.system.installedOn)?.system?.equipped;
      // Предмет-Родной мир несёт модификаторы Характеристик своего мира.
      if (t !== "trait" && t !== "implant" && t !== "talent" && t !== "homeworld"
          && !isActivePower && !isActiveArmorMod) continue;
      // Импланты дают эффекты ТОЛЬКО когда хирургически установлены (флаг из окна Хирургеона).
      if (t === "implant" && !item.getFlag("warhammer-dbc", "installed")) continue;
      // «Не работает» — орган на месте (виден на карте тела), но неисправен:
      // его эффекты не считаются, пока GM/игрок не переключит статус обратно.
      if (t === "implant" && item.getFlag("warhammer-dbc", "disabled")) continue;
      if (t === "implant" && /Чёрный Панцирь|Black Carapace/i.test(item.name)) {
        hasBlackCarapaceBackup = true;
      }
      // Бионические конечности: +2 к эффективному Поглощению этой частью тела.
      // Сторона не выбрана (флаг снят) — бонус никуда не начислять: раньше
      // невыбранная сторона молча уходила в "rightArm"/"rightLeg" через
      // тернарник по умолчанию, и снятие галочки Л/П не убирало бонус.
      if (t === "implant" && item.system.category === "bionic") {
        const k = classifyImplant(item.name, item.system.installed, item.system.category)?.kind;
        const side = item.getFlag("warhammer-dbc", "bodySide");
        if (side === "left" || side === "right") {
          if (k === "arm") traitArmorLoc[side === "left" ? "leftArm" : "rightArm"] += 2;
          else if (k === "leg") traitArmorLoc[side === "left" ? "leftLeg" : "rightLeg"] += 2;
        }
      }
      // Роспись механик Техночудес. Числовое (un/val/ap) отсюда ушло: его
      // складывали по ИМЕНИ предмета, мимо эффектов и Конструктора, так что на
      // листе импланта не было ни значения, ни способа поправить (wdbc-cy2).
      // Теперь эти числа лежат в самом предмете (packs-src → system.effects →
      // эффект миграцией, см. migrations/item-effects.mjs) и приходят сюда
      // общей дорогой ниже. У трёх имплантов пака та же надбавка лежала в обоих
      // местах разом, и бонус выходил двойным: Крукс Механикус давал S.b +4.
      if (t === "implant") {
        const mech = implantMech(item.name);
        if (mech) {
          const q = item.system.quality || "common";
          // energyMax — число (флат) либо {poor,common,good,best}, когда сама
          // надбавка зависит от Качества импланта (базовая Катушка Потенции).
          if (mech.energyMax) {
            implantEnergyMax += typeof mech.energyMax === "object"
              ? (mech.energyMax[q] ?? 0)
              : mech.energyMax;
          }
          if (mech.compensator && (mech.compensator[q] ?? 0) > implantCompBonus)
            implantCompBonus = mech.compensator[q] ?? 0;
          if (mech.ironFocus)
            techFocusInstalled.push({ name: item.name, quality: q, mod: ironModForQuality(q) });
        }
      }
      // Мигрированные предметы несут ту же механику как embedded ActiveEffect
      // (см. migrations/item-effects.mjs) — читать старое поле тоже
      // означало бы посчитать бонус дважды.
      const e = item.getFlag("warhammer-dbc", "migratedEffect") ? {} : (item.system.effects || {});
      // Одиночный бонус (legacy)
      if (e.charBonusStat && (e.charBonusValue || 0) !== 0) {
        traitCharBonus[e.charBonusStat] = (traitCharBonus[e.charBonusStat] || 0) + e.charBonusValue;
      }
      // Множественные бонусы характеристик (к бонусу, Unnatural)
      if (Array.isArray(e.charBonuses)) {
        for (const cb of e.charBonuses) {
          if (cb?.stat && (cb.value || 0) !== 0) {
            traitCharBonus[cb.stat] = (traitCharBonus[cb.stat] || 0) + cb.value;
          }
        }
      }
      // Обычные бонусы к ЗНАЧЕНИЮ характеристики (как +S/+W от брони)
      if (Array.isArray(e.charValueBonuses)) {
        for (const cb of e.charValueBonuses) {
          if (cb?.stat && (cb.value || 0) !== 0) {
            traitCharValueBonus[cb.stat] = (traitCharValueBonus[cb.stat] || 0) + cb.value;
          }
        }
      }
      if (e.armourAll)  traitArmourAll  += e.armourAll;
      // Пер-локационная броня (apAll/apHead/apBody/apArms/apLegs) — как у Боевых Лат.
      // ВАЖНО: AP модификаций брони (armorMod) сюда НЕ добавляем — они уже учтены
      // в armorFromItems через getArmorModEffects (иначе AP считался бы дважды,
      // напр. «Гребень» +1 к шлему давал +2).
      if (t !== "armorMod") {
        if (e.apAll)  { for (const k of Object.keys(traitArmorLoc)) traitArmorLoc[k] += e.apAll; }
        if (e.apHead) traitArmorLoc.head += e.apHead;
        if (e.apBody) traitArmorLoc.body += e.apBody;
        if (e.apArms) { traitArmorLoc.leftArm += e.apArms; traitArmorLoc.rightArm += e.apArms; }
        if (e.apLegs) { traitArmorLoc.leftLeg += e.apLegs; traitArmorLoc.rightLeg += e.apLegs; }
      }
      if (e.fearRating) traitFearRating  = Math.max(traitFearRating, e.fearRating);
      if (e.sizeMod)    traitSizeMod    += e.sizeMod;
      if (e.initMod)    traitInitMod    += e.initMod;
      if (e.speedMod)   traitSpeedMod   += e.speedMod;
      // Ключ — как в SKILLS_DEF/GROUP_SKILLS_DEF (sleightOfHand, techUse…):
      // .toLowerCase() здесь ломал бы camelCase-навыки. Вложенные И-подгруппы
      // обходим тоже; ИЛИ-группы пропускаются — их выбор кладёт запись напрямую.
      const collectHalved = (list) => {
        for (const me of list ?? []) {
          if (!me) continue;
          if (me.kind === "group") {
            const sub = me.group ?? me;
            if ((sub.operator ?? "AND") !== "OR") collectHalved(sub.entries);
            continue;
          }
          if (me.kind === "testMod" && me.modScope === "skill" && me.modValueMode === "halvePenalty" && me.skillKey) {
            skillPenaltyHalved.add(String(me.skillKey));
          }
        }
      };
      for (const g of item.flags?.["warhammer-dbc"]?.mechanics ?? []) {
        if (g.operator === "OR") continue;
        collectHalved(g.entries);
      }
    }
    // ── Одержимый: авто-эффекты Проявления (DoomBC 129-132) ─────────────────
    // Пока демон проявлен, профиль (по Cor) даёт Unnatural S, Daemonic (→T.b),
    // Fear; активные Дары-предметы («Дар: …») добавляют свои числовые эффекты.
    // Всё вливается в общий конвейер трейтов — снимается автоматически при
    // заключении демона. Синхронизировано с Cor и составом Даров на акторе.
    system.possessionActive = null;
    if (system.possessed && system.possession?.manifested && system.alignment === "heretic") {
      const cor  = system.corruption?.value ?? 0;
      const corB = Math.floor(cor / 10);
      const prof = manifestProfile(cor);
      const applied = [];
      // База Проявления
      traitCharBonus.s = (traitCharBonus.s || 0) + prof.unnaturalS;   // Unnatural S
      traitCharBonus.t = (traitCharBonus.t || 0) + prof.daemonic;     // Daemonic → T.b (соглашение бестиария)
      traitFearRating  = Math.max(traitFearRating, prof.fear);        // Fear
      applied.push(`Unnatural S +${prof.unnaturalS}`, `Daemonic ${prof.daemonic} (T.b)`, `Fear ${prof.fear}`);
      // Активные Дары (предметы-таланты с именем «Дар: …») с числовыми эффектами
      const giftNames = new Set(actor.items.filter(i => i.type === "talent").map(i => i.name));
      const hasGift = (n) => giftNames.has(`Дар: ${n}`);
      if (hasGift("Панцирь"))               { traitArmourAll += corB; applied.push(`Панцирь: Natural Armour ${corB}`); }
      if (hasGift("Гигант"))                { traitSizeMod += 1; traitCharValueBonus.s = (traitCharValueBonus.s || 0) + 10; applied.push("Гигант: +1 Размер, +10 S"); }
      if (hasGift("Демоническая Скорость")) { const a = Math.floor(corB / 2); traitCharBonus.ag = (traitCharBonus.ag || 0) + a; applied.push(`Демон. Скорость: Unnatural A +${a}`); }
      system.possessionActive = { prof, corB, applied };
    }

    // ── Гемункул: прибавки открытых ступеней (0–5) ────────────────────────
    // Unnatural I и Fear даются самими ступенями и от I.b не зависят, поэтому
    // применяются здесь, до пересчёта характеристик.
    if (actor.type === "character" && isHaemonculus(actor)) {
      const hStage = Math.max(0, Math.min(5, Number(system.haemonculus?.stage) || 0));
      let hUnI = 0, hFear = 0;
      for (const st of HAEM_STAGES) {
        if (st.stage > hStage) break;
        hUnI  += st.grants.unnaturalI || 0;
        hFear += st.grants.fear       || 0;
      }
      traitCharBonus.int = (traitCharBonus.int || 0) + hUnI;
      traitFearRating    = Math.max(traitFearRating, hFear);
      system.haemActive  = { stage: hStage, unnaturalI: hUnI, fear: hFear, woundBonus: 0, regen: 0 };
    } else {
      system.haemActive = null;
    }

    // ── Клонирующее Поле: сила строго по редкости надетого поля ───────────
    // Голографическая защита, а не силовая: не поглощает попадания, а срывает
    // их. Носителю — бонус на избегание и Stealth, противнику — штраф на атаки.
    {
      const cf = actor.items.find(i => /Clone Field|Клонирующее Поле/i.test(i.name)
                                   && i.system?.worn !== false);
      system.cloneField = cf
        ? cloneFieldTier(cf.system?.availability ?? 2, cf.system?.quality)
        : null;
    }

    system.traitCharBonus      = traitCharBonus;
    system.traitCharValueBonus = traitCharValueBonus;
    system.fearRating     = traitFearRating;
    system.talentInitMod  = traitInitMod;
    system.traitSpeedMod  = traitSpeedMod;

    // ── Пассивные авто-бонусы от Путей Аэльдари ─────────────────────────────
    // Unnatural характеристики и лимит Порчи (кумулятивно по достигнутым
    // градациям, без двойного учёта). Ситуативные боевые эффекты не авто.
    const pathPassives = computePathPassives(system.paths);
    system.pathCharBonus = pathPassives.charBonus;

    // ── Бонусы от надетой брони к характеристикам ───────────────────────────
    // Силовая броня → +S; Аспектная броня Аэльдари → +S и +W (Сила Воли).
    // Прибавляются к значению характеристики (total), пока броня надета.
    const armorCharBonus = { s: 0, wp: 0 };
    for (const item of actor.items) {
      if (item.type !== "armor" || !item.system.equipped) continue;
      armorCharBonus.s  += item.system.strengthBonus || 0;
      armorCharBonus.wp += item.system.wpBonus       || 0;
    }
    system.armorCharBonus = armorCharBonus;

    // Потолок Ловкости надетой брони (корбук, Max Agility): терминаторский
    // доспех держит Ловкость не выше 25, Катафракт — 35. Считается ДО
    // характеристик, чтобы Бонус взялся уже от ограниченного значения.
    // null — потолка нет, и тогда ничего не ограничивается вовсе.
    const agilityCap = armorAgilityCap(actor);
    // На лист выносим только тот потолок, который что-то значит: у обычной
    // брони в данных стоит 100, и показывать его игроку незачем.
    system.maxAgilityCap = (agilityCap !== null && agilityCap < 100) ? agilityCap : null;

    // ── Характеристики ────────────────────────────────────────────────────
    const charDamage = system.charDamage || {};
    // Авто-дебафф от потребностей (Голод/Жажда) — отдельно от ручного charDamage.
    const vitalMods = (actor.type === "character") ? vitalCharMods(system.vitals) : {};
    for (const [key, char] of Object.entries(chars)) {
      const impBonus  = IMPROVEMENT_BONUS[char.improvement] || 0;
      const drugMod   = drugCharMods[key]   || 0;
      const traitMod  = traitCharBonus[key] || 0; // Unnatural — добавляется к бонусу
      const pathMod   = pathPassives.charBonus[key] || 0; // Unnatural от Путей
      const armorMod  = armorCharBonus[key] || 0; // +S/+W от брони (к значению)
      const valueMod  = traitCharValueBonus[key] || 0; // импланты/черты — к значению
      const dmgMod    = charDamage[key]     || 0; // ручной Мод. к Итогу (знаковый: + прибавляет, − вычитает)
      const vitalMod  = vitalMods[key]      || 0; // Голод/Жажда — авто-дебафф
      char.drugMod    = drugMod;
      char.charDamage = dmgMod;
      char.vitalMod   = vitalMod;
      // База не трогается; Мод. и потребности — отдельные временные модификаторы.
      // totalFx — надбавка к ЗНАЧЕНИЮ от эффектов, парная к bonusFx ниже:
      // хранимое поле, фаза "initial", входит в расчёт ДО вывода Бонуса,
      // потолка Ловкости и навыков.
      char.total   = (char.base || 0) + (char.advance || 0) + impBonus + drugMod + armorMod + valueMod
                   + (char.totalFx || 0) + dmgMod - vitalMod;
      // Потолок брони режет готовое значение Ловкости — и Бонус ниже считается
      // уже от урезанного. Сверхъестественная Ловкость потолком не ограничена:
      // она прибавляется к Бонусу отдельным слагаемым, а не к значению.
      const cappedByArmor = key === "ag" && agilityCap !== null && char.total > agilityCap;
      if (cappedByArmor) char.total = Math.min(char.total, agilityCap);

      // Разборка Итого для всплывашки на листе (вкладка ПРОДВИЖЕНИЕ): откуда
      // взялось число — по тем же слагаемым, что и формула выше. «Механика
      // предметов» — не общая цифра totalFx, а вклад каждого предмета-носителя
      // (Архетип/Раса/Субраса/Элитный архетип/Предсказание/Происхождение и
      // т.п.) по отдельности, см. characteristicMechContrib.
      const breakdown = [{ label: "База", value: char.base || 0 }];
      if (char.advance) breakdown.push({ label: "Продвижение", value: char.advance });
      if (impBonus) breakdown.push({ label: `Улучшение (${IMPROVEMENTS[char.improvement] || char.improvement})`, value: impBonus });
      if (armorMod) breakdown.push({ label: "Броня (надета)", value: armorMod });
      if (drugMod) breakdown.push({ label: "Наркотики/лекарства", value: drugMod });
      if (valueMod) breakdown.push({ label: "Черты/импланты", value: valueMod });
      breakdown.push(...characteristicMechContrib(actor, key));
      if (dmgMod) breakdown.push({ label: "Мод. (ручной)", value: dmgMod });
      if (vitalMod) breakdown.push({ label: "Голод/Жажда", value: -vitalMod });
      if (cappedByArmor) breakdown.push({ label: "Потолок Ловкости (броня)", value: null, cap: agilityCap });
      char.totalBreakdown = breakdown;

      // bonusFx — надбавка от эффектов (Конструктор, миграция легаси). Хранимое
      // поле, эффекты целятся в него в фазе "initial", то есть попадают сюда до
      // расчёта: иначе число меняло бы лист, но не доходило бы до брони, навыков
      // и перемещений, которые считаются ниже по этому же проходу.
      char.bonus   = Math.floor(char.total / 10) + (char.supernatural || 0) + (char.bonusFx || 0)
                   + traitMod + pathMod;
    }

    // Гемункул, Стадия 1 (Идеал Плоти): +I.b к максимуму Ран и Regeneration
    // (+½ I.b, окр. ▲). Считается уже по итоговому I.b — с Unnatural I ступеней.
    if (system.haemActive?.stage >= 1) {
      const ib = chars.int?.bonus || 0;
      system.haemActive.woundBonus = ib;
      system.haemActive.regen      = Math.ceil(ib / 2);
    }

    // Лимит Порчи: база 100 + бонус от Путей (Путь Проклятия и т.п.)
    if (system.corruption) {
      system.corruption.limit = 100 + (pathPassives.corLimit || 0);
    }

    system.insanityBonus   = Math.floor((system.insanity?.value   || 0) / 10);
    system.corruptionBonus = Math.floor((system.corruption?.value || 0) / 10);

    // Порог Усталости = T.b + W.b (потеря сознания при превышении).
    if (system.fatigue) {
      system.fatigue.max = (chars.t?.bonus ?? 0) + (chars.wp?.bonus ?? 0);
    }

    // Тег «Усталость» в СОСТОЯНИЯХ — не отдельное поле, а зеркало настоящего
    // счётчика Усталости (вкладка ТЕЛО). Раньше их правили независимо (кнопки
    // ТЕЛА addFatigue/removeFatigue не трогали conditions.fatigued вовсе),
    // из-за чего тег мог показывать «Усталость 3», когда реальная Усталость
    // давно снята. Считаем здесь заново на каждый прогон — источник истины
    // один, отдельно писать в conditions.fatigued/-Level больше не нужно.
    if (system.conditions && system.fatigue) {
      const fatVal = Math.max(0, Number(system.fatigue.value) || 0);
      system.conditions.fatiguedLevel = fatVal;
      system.conditions.fatigued = fatVal > 0;
    }

    // Мёртвое Могущество (Иннари): максимум = W.b × 3
    if (system.deadMight) {
      system.deadMight.max = (chars.wp?.bonus ?? 0) * 3;
      if ((system.deadMight.value ?? 0) > system.deadMight.max)
        system.deadMight.value = system.deadMight.max;
    }

    // ── Очки Боли (Друкхари) ───────────────────────────────────────────────
    // Друкхари вместо Судьбы/Бесчестья используют Очки Боли (расовые Трейты
    // «Через Боль» и «Безбожник»). Максимум = W.b × (1 + «Бездонная Душа», до 3 раз).
    // Пул «Судьба» на листе друкхари уже подписан «Очки Боли» (см. fateTerm).
    system.painActive  = false;
    system.fateMaxAuto = false;
    if (system.race === "drukhari" && system.fate) {
      const wb = chars.wp?.bonus ?? 0;
      const bottomless = Math.min(3, actor.items.filter(i =>
        i.type === "talent" && /Bottomless Soul|Бездонная Душа/i.test(i.name)).length);
      system.fate.max = wb * (1 + bottomless);
      if ((system.fate.value ?? 0) > system.fate.max) system.fate.value = system.fate.max;
      system.painActive  = true;
      system.fateMaxAuto = true;
    }

    // ── Здравомыслие пилота Дредноута (Книга Машин, стр. 57) ────────────────
    // Максимум зависит только от локальных данных (W.b и число взятых «Ядро
    // Воспоминаний» — тот же приём подсчёта повторяемого Таланта, что и у
    // «Бездонной Души» выше), поэтому считается для КАЖДОГО персонажа, не
    // только пилотов: дёшево, и не требует обращения к миру. Кто именно сейчас
    // пилот — знает только сам Дредноут (место экипажа с ролью pilot хранит его
    // uuid), и это спрашивается на уровне листа (sheets/tabs/dreadnought-panel.mjs),
    // а не здесь: prepareDerivedData обязан работать и без game.actors (см.
    // module/rules/dreadnought.mjs).
    if (system.sanity) {
      const coreMemories = actor.items.filter(i =>
        i.type === "talent" && /Core Memories|Ядро Воспоминаний/i.test(i.name)).length;
      system.sanity.max = sanityMax(chars.wp?.bonus ?? 0, coreMemories);
      system.sanity.value = Math.max(0, Math.min(system.sanity.max, Number(system.sanity.value) || 0));
      system.sanity.thresholds = madnessLevels(system.sanity.value);
    }

    const tb = chars.t?.bonus ?? 0;

    // Уровень Ранения (корбук, «Уровни Ранения» — стр. книги): определяет
    // скорость лечения (уже читал sheets/tabs/healing.mjs через woundLevel) и
    // теперь ещё подпись/цвет блока РАНЫ на листе (tab-combat.hbs). Кладём
    // прямо на system.wounds — тот же приём, что у corruption.limit/sanity.max
    // чуть выше: поле не объявлено в схеме, но prepareDerivedData бесплатно
    // добавляет производные свойства поверх схемных.
    if (system.wounds) {
      const wLvl = woundLevel(system);
      system.wounds.tier = wLvl.displayKey;
      system.wounds.tierLabel = wLvl.displayLabel;
      system.wounds.tierLost = wLvl.lost;
    }

    // ── Броня ─────────────────────────────────────────────────────────────
    const armorFromItems = {
      head: 0, body: 0,
      leftArm: 0, rightArm: 0,
      leftLeg: 0, rightLeg: 0
    };

    // Бонусы AP против типов урона от модов брони (всегда складываются)
    const armorVsType = { energy: 0, impact: 0, rending: 0, blast: 0 };
    // Флаги свойств брони (Conductive/Flak/Soft/Rods/Open/Primitive) по
    // локациям — OR всех надетых предметов, чьё AP в этой локации > 0 (тот же
    // уровень точности, что и у armorVsType выше: не отслеживаем, какой именно
    // предмет «выиграл» Math.max в этой локации). См. module/combat/damage.mjs.
    const propFlagsByLoc = {
      head: emptyArmorLocFlags(), body: emptyArmorLocFlags(),
      leftArm: emptyArmorLocFlags(), rightArm: emptyArmorLocFlags(),
      leftLeg: emptyArmorLocFlags(), rightLeg: emptyArmorLocFlags()
    };

    for (const item of actor.items) {
      if (item.type !== "armor" || !item.system.equipped) continue;
      const s = item.system;
      // Эффективная броня этого предмета с учётом установленных модификаций
      const aFx = getArmorModEffects(actor, item);
      const ap = {
        head:     (s.head     || 0) + armorModApForLocation(aFx, "head"),
        body:     (s.body     || 0) + armorModApForLocation(aFx, "body"),
        leftArm:  (s.leftArm  || 0) + armorModApForLocation(aFx, "leftArm"),
        rightArm: (s.rightArm || 0) + armorModApForLocation(aFx, "rightArm"),
        leftLeg:  (s.leftLeg  || 0) + armorModApForLocation(aFx, "leftLeg"),
        rightLeg: (s.rightLeg || 0) + armorModApForLocation(aFx, "rightLeg")
      };
      // Свойства этого предмета брони (Conductive/Flak/Soft/Rods/Open/Primitive)
      // — распространяются на все локации, куда он реально даёт AP (ap[k] > 0).
      // isPowerArmor — не свойство из properties[], а сам armorType предмета:
      // силовой шлем даёт 4 AP на глаза даже при Избирательном в Глаз (стр. 34).
      const propAuto = aggregateArmorAuto(resolveArmorProps(item));
      propAuto.isPowerArmor = s.armorType === "power";
      for (const k of Object.keys(ap)) {
        if (ap[k] > 0) propFlagsByLoc[k] = mergeArmorLocFlags(propFlagsByLoc[k], propAuto);
      }

      // Качество брони: Best.Q даёт +1 AP всем частям (сочленения +2 — напоминание).
      const qArmor = qualityEffects(item).auto;
      if (qArmor.apAll) { for (const k of Object.keys(ap)) ap[k] += qArmor.apAll; }
      // Активный режим поля друкхарийской брони: Амортизирующее даёт Protective,
      // Подавляющее — Blunted и штраф чужим психотестам, Рассеивающее — Nimble.
      const fld = fieldModeEffects(item);
      if (fld.protective)      system.fieldProtective = fld.protective;
      if (fld.nimble != null)  system.fieldNimble  = fld.nimble;
      if (fld.blunted != null) system.fieldBlunted = fld.blunted;
      if (fld.psyMod)          system.fieldPsyMod  = fld.psyMod;
      if (fld.shield)          system.fieldShield  = fld.shield;

      armorVsType.energy  += aFx.vs.energy;
      armorVsType.impact  += aFx.vs.impact;
      armorVsType.rending += aFx.vs.rending;
      armorVsType.blast   += aFx.vs.blast;

      // Особенность комплекта (истории силовой брони): «Под взглядом богов»
      // даёт +1 ОБ всем зонам, «Уничтоженный и восстановленный» — ±1 по зонам.
      const hist = s.history;
      if (hist?.table && isFeatureEnabled("armourHistories")) {
        const def = PA_TABLES[hist.table]?.entries.find(e => e.name === hist.name);
        if (def?.apAll) for (const k of Object.keys(ap)) ap[k] += def.apAll;
        for (const [k, v] of Object.entries(hist.zones || {})) {
          if (k in ap) ap[k] += Number(v) || 0;
        }
      }

      if (s.stacks) {
        for (const k of Object.keys(ap)) armorFromItems[k] += ap[k];
      } else {
        for (const k of Object.keys(ap)) armorFromItems[k] = Math.max(armorFromItems[k], ap[k]);
      }
    }

    // ── Снятый шлем ────────────────────────────────────────────────────────
    // Показатель «сколько ОБ на голову даёт снаряжение» считается ДО снятия:
    // иначе галочка исчезла бы вместе с бронёй и шлем нельзя было бы надеть.
    system.gearHeadAP = armorFromItems.head;
    const helmetOff = !!system.helmetOff && isFeatureEnabled("helmetless");
    system.helmetlessActive = helmetOff && armorFromItems.head > 0;
    // Теряются все ОБ на голове от носимой брони (естественная броня остаётся).
    if (system.helmetlessActive) armorFromItems.head = 0;

    const armorManual = system.armor || {};
    // Ручные щиты (стр. 215): прикрывают зоны своим AP. Щит держат ПОВЕРХ брони,
    // поэтому не суммируем, а берём лучшее по каждой зоне — как и прочие AP.
    const shieldAP = shieldArmorByLocation(actor);
    system.shieldArmor = shieldAP;
    const best = (k) => Math.max(
      armorFromItems[k], armorManual[k] || 0, shieldAP[k] || 0,
      (k === "body" && hasBlackCarapaceBackup) ? 4 : 0
    );
    // Складываемая надбавка AP от эффектов (естественная броня Черт, броня
    // имплантов, что угодно ещё). Хранимое поле схемы — эффекты целятся в него
    // в фазе "initial", то есть ДО этого расчёта, тем же приёмом, что и
    // encumbrance.indexBonus. Ложится рядом с traitArmourAll: после снятия
    // шлема, поэтому естественная броня головы вместе с ним не теряется.
    const fxArmor = system.armorBonus || {};
    // Свойство оружия Corrosive (wdbc-plsf): стойкая потеря AP в месте
    // попадания, пока броню не починят (combat/damage.mjs пишет сюда).
    const corrosion = system.armorCorrosion || {};
    const corroded = (k) => Math.max(0, (Number(corrosion[k]) || 0));
    // Естественная броня (трейты) + пер-локационная от имплантов складываются с носимой/ручной
    const armorAP = {
      head:     Math.max(0, best("head")     + traitArmourAll + traitArmorLoc.head     + (fxArmor.head     || 0) - corroded("head")),
      body:     Math.max(0, best("body")     + traitArmourAll + traitArmorLoc.body     + (fxArmor.body     || 0) - corroded("body")),
      leftArm:  Math.max(0, best("leftArm")  + traitArmourAll + traitArmorLoc.leftArm  + (fxArmor.leftArm  || 0) - corroded("leftArm")),
      rightArm: Math.max(0, best("rightArm") + traitArmourAll + traitArmorLoc.rightArm + (fxArmor.rightArm || 0) - corroded("rightArm")),
      leftLeg:  Math.max(0, best("leftLeg")  + traitArmourAll + traitArmorLoc.leftLeg  + (fxArmor.leftLeg  || 0) - corroded("leftLeg")),
      rightLeg: Math.max(0, best("rightLeg") + traitArmourAll + traitArmorLoc.rightLeg + (fxArmor.rightLeg || 0) - corroded("rightLeg")),
    };

    // Только носимое/ручное/щит, без естественной брони Черт и имплантов:
    // попадание в Глаз игнорирует AP шлема, а не всей головы (стр. 34).
    // Минус коррозия: она разъедает носимое, и разность armorAP − wornOnly
    // (естественная броня для правила Глаза) не должна плыть от Corrosive.
    const wornOnly = Object.fromEntries(Object.keys(armorAP).map(k => [k, Math.max(0, best(k) - corroded(k))]));

    system.absorption = {
      head:           armorAP.head     + tb,
      body:           armorAP.body     + tb,
      leftArm:        armorAP.leftArm  + tb,
      rightArm:       armorAP.rightArm + tb,
      leftLeg:        armorAP.leftLeg  + tb,
      rightLeg:       armorAP.rightLeg + tb,
      toughnessBonus: tb,
      armorOnly:      armorAP,
      wornOnly,
      vsType:         armorVsType,
      propFlags:      propFlagsByLoc
    };

    // ── Навыки ────────────────────────────────────────────────────────────
    const skills = system.skills || {};
    for (const [key, sk] of Object.entries(skills)) {
      const def     = SKILLS_DEF[key];
      const charVal = def ? (chars[def.char]?.total ?? 0) : 0;
      let rankBonus = SKILL_RANKS[sk.rank]?.bonus ?? -20;
      if (rankBonus < 0 && skillPenaltyHalved.has(key)) rankBonus = Math.ceil(rankBonus / 2);
      sk.total = charVal + rankBonus;
    }

    // ── Групповые навыки ──────────────────────────────────────────────────
    const groupSkills = system.groupSkills || {};
    for (const [groupKey, entries] of Object.entries(groupSkills)) {
      if (!Array.isArray(entries)) continue;
      const def     = GROUP_SKILLS_DEF[groupKey];
      for (const entry of entries) {
        // Спец-навык может иметь свою базовую характеристику (entry.char),
        // иначе берётся характеристика группы по умолчанию.
        const entryChar = entry.char || def?.char;
        const charVal   = entryChar ? (chars[entryChar]?.total ?? 0) : 0;
        let gRankBonus  = SKILL_RANKS[entry.rank]?.bonus ?? -20;
        if (gRankBonus < 0 && skillPenaltyHalved.has(groupKey)) gRankBonus = Math.ceil(gRankBonus / 2);
        entry.total = charVal + gRankBonus;
      }
    }

    // ── Вес ───────────────────────────────────────────────────────────────
    // «Нейтрализует собственный вес в расчёте переносимого веса» (стр. 233,
    // «СИЛОВАЯ БРОНЯ») — прочитано ещё раз по картинке страницы (текстовый
    // слой PDF был обманчив: двухколоночная вёрстка визуально ставит общий
    // список свойств рядом с ПЕРВОЙ таблицей модели — Лёгкой Силовой — из-за
    // чего предыдущее чтение приняло общее правило за особенность только этой
    // модели). На самом деле абзац «Вся силовая броня, имеет свойства Hard,
    // Heavy и Sealed…» и список ниже — общее описание ВСЕЙ силовой брони,
    // ДО таблиц конкретных моделей; ни в одном из блоков самих моделей (Light/
    // Sabbat/Power Armour/Dragon Scale/Vrantine) вес отдельно не оговаривается
    // — только отличия от этого общего правила. Аспектная броня Аэльдари
    // (armorType "aspect") к этой главе не относится, её не трогаем.
    // Книга также разделяет ВКЛЮЧЕННУЮ и ВЫКЛЮЧЕННУЮ силовую броню — «Она
    // более не подавляет свой вес» в выключенном состоянии. Учитываем через
    // system.active (те же имя/семантика, что у armorMod.activatable/active,
    // см. комментарий у поля в data/item/armor.mjs) — по умолчанию true, так
    // что существующие предметы паков ведут себя как раньше, пока игрок сам
    // не выключит броню тумблером на листе предмета. Другие последствия
    // выключенной брони (Max.A 35, штрафы −10/−40 на действия) книга
    // описывает тоже, но здесь не реализованы — отдельная, более крупная
    // задача, не часть этой правки.
    let totalWeight = 0;
    for (const item of actor.items) {
      const s = item.system;
      const w = parseFloat(s.weight) || 0;
      if (item.type === "armor" && s.equipped && ((s.armorType === "power" && s.active) || s.weightless)) {
        continue; // несёт свой вес сама
      }
      if (["gear","drug","tool","ammo","weapon"].includes(item.type)) {
        totalWeight += w * (parseInt(s.quantity) || 1);
      } else {
        totalWeight += w;
      }
    }
    system.encumbrance.current = Math.round(totalWeight * 100) / 100;

    // ── Гравитация сцены (виджет «Окружающая Среда») ────────────────────────
    // Вес снаряжения ×G (стр. 483-484) — берём сцену конкретного токена
    // (важно для несвязанных токенов одного актёра на разных сценах),
    // иначе текущую сцену канвы/её замену. Ёмкость (carry/lift/push ниже)
    // не трогаем — она посчитана как «ёмкость при 1G», штраф/бонус
    // гравитации применяется к текущему весу снаряжения, а не к ней.
    const envScene = actor.token?.parent ?? canvas?.scene ?? game.scenes?.current ?? null;
    const gravity  = envScene ? (Number(readEnvForScene(envScene).gravity) || 1) : 1;
    system.encumbrance.gravity          = gravity;
    system.encumbrance.effectiveCurrent = Math.round(totalWeight * gravity * 100) / 100;

    const sb = chars.s?.bonus ?? 0;
    // Феодальный мир, «Житие тяжкое»: +1 к S.b именно для грузоподъёмности.
    const hwCarry = HOMEWORLD_BY_KEY[actor.items.find(i => i.type === "homeworld")?.system?.key]?.carryBonus || 0;
    // ── Ношение/Подъём/Толкание (стр. 27) ───────────────────────────────────
    // Все три числа берутся из ОДНОЙ строки таблицы Максимального Веса
    // (helpers/utils.mjs, carryRow): у книги это три отдельных столбца, и
    // прежний вывод Подъёма/Толкания сдвигом строки на +1/+2 совпадал с ней
    // только у слабых персонажей.
    // indexBonus.all сдвигает БАЗОВЫЙ индекс — значит влияет на все три сразу,
    // тогда как indexBonus.carry/.lift/.push бьёт только по своей категории
    // поверх базы: так Конструктор («Механика», запись kind:"weight")
    // реализует и «Общее», и точечные категории одним механизмом.
    // indexBonus.* — обычные ХРАНИМЫЕ поля, безопасные целью для ActiveEffect
    // в фазе "initial" (СТАВИТСЯ ДО этого расчёта, не после — в отличие от
    // .carry/.lift/.push/.max, которые сами производные и берут "final").
    const ib = system.encumbrance.indexBonus || {};
    const baseIdx = sb + tb + hwCarry + (ib.all || 0);
    system.encumbrance.carry = carryRow(baseIdx + (ib.carry || 0)).carry;
    system.encumbrance.lift  = carryRow(baseIdx + (ib.lift  || 0)).lift;
    system.encumbrance.push  = carryRow(baseIdx + (ib.push  || 0)).push;
    system.encumbrance.max = system.encumbrance.carry;
    system.homeworldCarryBonus = hwCarry;

        // ── Опыт ──────────────────────────────────────────────────────────────
    // Ловит на Лету / Fast Learner (X): +X% к стартовому опыту и опыту за
    // сессию (ГМ округляет вверх), X = рейтинг Черты, разный у рас (10/15/20/25).
    // Готового derived-поля под «+X% к прибавляемому опыту» нет — начисление
    // разовое (диалог module/apps/stat-log.mjs), а не пересчитываемое каждый
    // prepareData(), поэтому ActiveEffect тут не работает (некуда бить: сумма
    // не хранится, а вводится). Здесь только живой процент с Черты — читает его
    // тот же диалог в момент прибавления опыта.
    const fastLearner = actor.items.find(i => i.type === "trait"
                                           && /Fast Learner|Ловит на Лету/i.test(i.name));
    system.fastLearnerBonus = fastLearner ? (Number(fastLearner.system?.rating) || 0) : 0;

    // Автосумма цен характеристик
    let autoCharCost = 0;
    for (const char of Object.values(chars)) {
      autoCharCost += (char.cost || 0);
    }
    system.experience.spentChar = autoCharCost;

    let autoSkillCost = 0;
    for (const sk of Object.values(skills)) autoSkillCost += (sk.cost || 0);
    for (const group of Object.values(groupSkills)) {
      if (Array.isArray(group)) {
        for (const entry of group) autoSkillCost += (entry.cost || 0);
      }
    }
    system.experience.spentSkills = autoSkillCost;

    // Автосумма цен талантов: ручной список «Развития» + купленные таланты-предметы
    // (через пикер; стартовые с генерации имеют cost 0 и не учитываются, стр. 23-24).
    let autoTalentCost = 0;
    if (Array.isArray(system.advanceTalents)) {
      for (const t of system.advanceTalents) autoTalentCost += (parseInt(t?.cost) || 0);
    }
    // Психосилы/Техночудеса (item.system.cost) — синхронно с вкладками «ПСИ»/
    // «Техно», каждая идёт в свою строку Опыта. Элитные архетипы (стр. 114):
    // цена лежит на самом предмете и уже посчитана с множителем за предыдущие —
    // сумма по предметам, а не отдельный счётчик, снятый с листа архетип обязан
    // вернуть опыт сам, без ручной правки. Стоимость поддержания психосил
    // (sustainedCost, читается ниже в блоке system.psyker) — тот же
    // psychicPower, что и autoPsyCost, поэтому считается в том же проходе.
    // Независимые аккумуляторы, один проход по actor.items вместо четырёх.
    let autoPsyCost = 0, autoTechCost = 0, autoEliteCost = 0, sustainedCost = 0;
    for (const it of actor.items) {
      switch (it.type) {
        case "talent": autoTalentCost += (parseInt(it.system?.cost) || 0); break;
        case "psychicPower":
          autoPsyCost += (parseInt(it.system?.cost) || 0);
          if (it.system?.isSustained) sustainedCost += (it.system?.sustainCost ?? 1);
          break;
        case "techPower": autoTechCost += (parseInt(it.system?.cost) || 0); break;
        case "eliteArchetype": autoEliteCost += (parseInt(it.system?.paidCost) || 0); break;
      }
    }
    system.experience.spentTalents = autoTalentCost;
    system.experience.spentPsy = autoPsyCost;
    system.experience.spentTech = autoTechCost;
    system.experience.spentElite = autoEliteCost;

    const spentTotal =
      (system.experience.spentChar    || 0) +
      (system.experience.spentSkills  || 0) +
      (system.experience.spentTalents || 0) +
      (system.experience.spentPsy     || 0) +
      (system.experience.spentTech    || 0) +
      (system.experience.spentElite   || 0) +
      (system.experience.spentOther   || 0);

    system.experience.spent   = spentTotal;
    system.experience.current = (system.experience.total || 0) - spentTotal;

    // ── Движение (авторасчёт) ─────────────────────────────────────────────
    const agBonus = chars.ag?.bonus ?? 0;
    // 0 = Человек; трейт Размера сдвигает SPD (прямой мод). Трейт «Size/Hulking»
    // выдаётся как embedded ActiveEffect с ключом system.sizeMod, фаза "initial"
    // (см. packs-src/traits) — на этом месте он уже применён (Foundry вызывает
    // applyActiveEffects("initial") ДО prepareDerivedData), поэтому traitSizeMod
    // (легаси-петля выше, которая нарочно пропускает migratedEffect-предметы,
    // чтобы не посчитать их дважды) складывается С этим значением, а не
    // затирает его — иначе SPD/Инициатива персонажа с расовым Размером считались
    // бы без него, при этом бейдж «Размер» на листе показывал бы верное число
    // (было найдено на живых данных: sizeMod=1, sizeTotal=0 у всех Астартес).
    traitSizeMod += Number(system.sizeMod) || 0;
    const size    = (system.size ?? 0) + traitSizeMod;
    system.sizeMod   = traitSizeMod;          // вклад Черт в Размер
    system.sizeTotal = size;                  // итоговый Размер (база + Черты)
    const stance  = system.meleeStance || "standard";

    let { spd, halfMove, move, charge, run } = calcMovement(agBonus, size);

    // Бонус к базовой скорости (SPD) от Черт/имплантов/талантов/психосил, плюс
    // system.movement.spdBonus — входное поле для kind:"movement" (Конструктор,
    // цель "SPD"), ставится ActiveEffect'ом в фазе "initial" (см. mechanics.mjs),
    // т.е. уже на месте к этому моменту расчёта.
    const spdBonus = Number(system.movement.spdBonus) || 0;
    // Перевес выключенной силовой брони (стр. 233) — SPD −1 с тира 1 и выше;
    // остальные последствия каскада (штраф теста, только Полное действие на
    // движение, Беспомощность) — не расчёт, а игровое событие, выведены
    // read-only на лист (system.disabledArmourOverload) для ручного учёта,
    // не блокируются здесь. См. wdbc-rdd.
    const overload = disabledArmourOverloadTier(actor, disabledArmourWeight(actor));
    system.disabledArmourOverload = overload;
    const overloadSpdMod = overload?.spdMod || 0;
    // Свойство оружия Piercing (wdbc-plsf): снаряд в ране торса/ноги — плоский
    // −1 SPD, пока не извлечён (не складывается за несколько таких ран —
    // книга не описывает накопление, см. combat/damage.mjs, где рана ставится).
    const pw = system.piercingWounds || {};
    const piercingSpdMod = (pw.body || pw.leftLeg || pw.rightLeg) ? -1 : 0;
    if (traitSpeedMod || spdBonus || overloadSpdMod || piercingSpdMod) {
      spd = Math.max(0.5, spd + traitSpeedMod + spdBonus + overloadSpdMod + piercingSpdMod);
      halfMove = spd;  move = spd * 2;  charge = spd * 3;  run = spd * 6;
    }

    // Пружинящая стойка: SPD −2 для движения
    if (stance === "springing") {
      const spdMod = Math.max(0.5, spd - 2);
      halfMove = spdMod;
      move     = spdMod * 2;
      charge   = spdMod * 3;
      run      = spdMod * 6;
    }

    system.movement.halfMove = halfMove;
    system.movement.move     = move;
    system.movement.charge   = charge;
    system.movement.run      = run;

    // ── Инициатива ────────────────────────────────────────────────────────
    // Хранит Ag.bonus + модификаторы Талантов (Combat Formation, Paranoia).
    // Сам бросок = 1d10 + system.initiative.
    system.initiative = agBonus + (traitInitMod || 0);

    // ── Когниция (Техножрец) ───────────────────────────────────────────────
    // Пул Когниции = Int.bonus; в начале Хода восстанавливается ½ Int.b.
    if (system.cognition) {
      const ib = chars.int?.bonus ?? 0;
      system.cognition.max   = ib;
      system.cognition.regen = Math.ceil(ib / 2);
    }

    // ── Энергия (Катушка Потенции) + Техночудеса Кибернетики Механикум ──────
    // energy.max — база (ручной ввод); maxTotal = база + бонусы имплантов
    // (Мотивные Банки +5 и т.п.). Активация/зарядка используют maxTotal.
    if (system.energy) {
      system.energy.bonusMax = implantEnergyMax;
      system.energy.maxTotal = Math.max(0, (system.energy.max || 0) + implantEnergyMax);
      if ((system.energy.value || 0) > system.energy.maxTotal)
        system.energy.value = system.energy.maxTotal;
    }
    // Бонус к тесту Компенсатора (лучший среди имплантов) и установленные
    // Технофокусы (Железо) — для активации Техночудес и показа на листе.
    system.techCompBonus   = implantCompBonus;
    system.techFocus       = techFocusInstalled;

    // ── Пси-Рейтинг ────────────────────────────────────────────────────────
    // Базовый PR — по умолчанию хранимое поле (бестиарий/NPC задают его прямо
    // статблоком, без Таланта). Если на акторе есть Талант «Psy Rating /
    // Пси-Рейтинг» — он замещает хранимое значение, предмет становится
    // источником истины (psyRatingFromTalents в module/rules/psyker.mjs).
    if (system.psyker) {
      const derivedPR = psyRatingFromTalents(actor.items);
      system.psyker.ratingFromTalent = derivedPR !== null;
      if (derivedPR !== null) system.psyker.rating = derivedPR;

      // sustainedCost уже посчитан выше, в общем проходе по actor.items
      // (вместе с autoPsyCost) — тот же item.type "psychicPower".
      // Руническая Вязь «Стальной Гриммуар» (wdbc-unku): снимает штраф −1 эPR
      // за поддержание одной силы. Схема не различает, какая именно сила
      // «вписана» в Гриммуар — прощаем 1 очко суммарной стоимости поддержания
      // в целом (только если что-то вообще поддерживается).
      if (sustainedCost > 0 && hasRuleFlag(actor, "runicWeave.steelGrimoire")) {
        sustainedCost = Math.max(0, sustainedCost - 1);
      }
      system.psyker.sustain       = sustainedCost;
      system.psyker.currentRating = Math.max(0, (system.psyker.rating || 0) - sustainedCost);
      // «Независимо от обстоятельств всегда считается Связанным» (Серый
      // Человек, wdbc-gzuf) — Природа Дара выставляется один раз в чаргене
      // (дропдаун), но здесь пересчитывается каждый цикл, так что ручная
      // смена значения на листе тут же откатывается обратно.
      if (hasRuleFlag(actor, "psyker.alwaysBound")) system.psyker.class = "bound";
    }
}
