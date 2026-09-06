// module/rules/character/armour.mjs
// ════════════════════════════════════════════════════════════════════════════
//  БРОНЯ ЛИСТА: очки брони по локациям, свойства брони, покрытие герметичностью
//  и защита против типов урона (wdbc-neez).
//
//  Третий раздел, вынесенный из prepareCharacterDerived. В отличие от Движения
//  он ничего не принимает из накопителей выше — считает всё сам по надетым
//  предметам, — но ОТДАЁТ четыре величины разделам ниже: их читают Снятый шлем,
//  Вес и Ношение. Поэтому возвращает объект, а не правит только system.
// ════════════════════════════════════════════════════════════════════════════

import { getArmorModEffects, armorModApForLocation } from "../../combat/armor-mods.mjs";
import { resolveArmorProps, aggregateArmorAuto, mergeArmorLocFlags, emptyArmorLocFlags }
  from "../../combat/armor-properties.mjs";
import { qualityEffects } from "../../constants/quality.mjs";
import { fieldModeEffects } from "../../constants/drukhari-armor-fields.mjs";
import { isFeatureEnabled } from "../../constants/features.mjs";
import { PA_TABLES } from "../../constants/power-armour-lore.mjs";

/**
 * @param {object} actor  актор — для надетых предметов
 * @param {object} system system актора, правится на месте
 * @returns {{armorFromItems: object, armorVsType: object, propFlagsByLoc: object,
 *           sealedCoverage: object}} величины, которые читают разделы ниже
 */
export function prepareArmourDerived(actor, system) {
  // ── Броня ─────────────────────────────────────────────────────────────
  const armorFromItems = {
    head: 0, body: 0,
    leftArm: 0, rightArm: 0,
    leftLeg: 0, rightLeg: 0
  };

  // Бонусы AP против типов урона от модов брони (всегда складываются) —
  // chemical добавлен для Protective (wdbc-8b5, «+X AP против урона от
  // среды», DAMAGE_TYPES.chemical), суммируется ниже вместе с остальными.
  const armorVsType = { energy: 0, impact: 0, rending: 0, blast: 0, chemical: 0 };
  // «Полный комплект» Sealed (стр. 228, wdbc-8b5): иммунитет к химическому
  // урону, пока не пробита ни одна из 6 закрывающих локаций. По локации —
  // true, если её покрывает (ap[k]>0) хотя бы один надетый непробитый
  // Sealed-предмет; итог — AND по всем шести (нет непокрытой/пробитой
  // локации), считается после цикла ниже.
  const sealedCoverage = {
    head: false, body: false, leftArm: false, rightArm: false, leftLeg: false, rightLeg: false
  };
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
    const propAuto = aggregateArmorAuto(resolveArmorProps(item), s.propRatings);
    propAuto.isPowerArmor = s.armorType === "power";
    for (const k of Object.keys(ap)) {
      if (ap[k] > 0) propFlagsByLoc[k] = mergeArmorLocFlags(propFlagsByLoc[k], propAuto);
    }
    // Protective (wdbc-8b5): +X AP против DAMAGE_TYPES.chemical, суммируется
    // с остальными vsType-бонусами ниже (та же неточность по локации, что и
    // у остальных armorVsType — см. комментарий у объявления armorVsType).
    for (const [t, x] of Object.entries(propAuto.apBonusByType)) {
      armorVsType[t] = (armorVsType[t] || 0) + x;
    }
    // Sealed «полным комплектом» (wdbc-8b5): локация закрыта непробитым
    // Sealed-предметом — считаем это ниже AND'ом по всем 6 локациям.
    // Wraithbone Regeneration в руках псайкера (aeldari.json) не теряет
    // Sealed при пробитии — та же оговорка, что у Void (rules/void-air.mjs).
    // system.isPsyker — актора, который сейчас в prepareDerivedData (не
    // item.parent.system: тот же документ, но ещё не факт, что уже
    // проставлен во встроенном предмете на подставных тестовых акторах).
    const armorIgnoresBreach = s.breached
      && (s.properties || []).includes("wraithboneRegen") && !!system.isPsyker;
    if ((s.properties || []).includes("sealed") && (!s.breached || armorIgnoresBreach)) {
      for (const k of Object.keys(ap)) { if (ap[k] > 0) sealedCoverage[k] = true; }
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

  return { armorFromItems, armorVsType, propFlagsByLoc, sealedCoverage };
}
