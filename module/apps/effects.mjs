// module/apps/effects.mjs
// ════════════════════════════════════════════════════════════════════════
//  Вкладка «Эффекты» на листе предмета — общая для всех типов.
//  Каждый эффект — стандартный embedded ActiveEffect Foundry; вкладка
//  создаёт/удаляет/переключает их (компендиум-библиотека warhammer-dbc.
//  effects, из которой раньше был готовый пикер, — удалена: всё авторится
//  через единый Конструктор, см. module/apps/mechanics.mjs).
// ════════════════════════════════════════════════════════════════════════

import { toggleParentId, isToggleOn } from "../rules/toggle-abilities.mjs";
import { activeRunicWeaveId, siblingRunicWeaves } from "../rules/runic-weave.mjs";

/**
 * Активен ли предмет прямо сейчас (по его собственным полям состояния) —
 * т.е. должны ли его эффекты (и связанные выдачи — см. syncGrantedEquipment
 * в mechanics.mjs) действовать. Разные типы «активны» по-разному: оружие/
 * броня — когда снаряжены, мод — когда установлен на носитель (и, если он
 * включаемый, ещё и включён), психосила/сила навигатора — пока поддержи-
 * вается (или пассивна), имплант — когда хирургически установлен И не
 * неисправен (flags.warhammer-dbc.installed/disabled — те же флаги, что
 * читает gate в module/documents/actor.mjs для старой системы эффектов, и
 * что ставит Хирургеон). Прочие типы
 * (таланты, черты и т.п.) эффектов не выключают в принципе — там нет
 * отдельного «активен ли предмет», эффект действует всегда, пока предмет
 * на акторе. Исключение — подспособность переключаемой способности: у неё
 * своё «включена/выключена» независимо от типа (см. ниже).
 */
/**
 * Требует ли это снаряжение, чтобы его НАДЕЛИ, прежде чем оно заработает
 * (wdbc-9h7g). Признак — заполненное system.worn, то есть книга сказала, КУДА
 * предмет надевается: противогаз («Голова (И)»), хамелеолиновый плащ, откатная
 * перчатка («Кисть»). Снаряжение без такой пометки — хим-лаборатория,
 * анализатор химии — работает от применения, а не от ношения, и тумблера
 * «надето» не получает: спрашивать «надел ли ты лабораторию» бессмысленно.
 *
 * Почему не «всё снаряжение подряд»: тогда каждая мелочь в рюкзаке требовала бы
 * галочки, а забытая галочка молча гасила бы бонус. Пустое worn — вещь работает
 * как раньше (отказ в безопасную сторону).
 */
export function gearRequiresWearing(sys) {
  return !!String(sys?.worn ?? "").trim();
}

export function isItemActive(item) {
  const sys = item.system || {};
  // Подспособность переключаемой способности (Локус Герольда и подобные,
  // module/rules/toggle-abilities.mjs) активна ровно тогда, когда её включили
  // кнопкой на листе. Проверка идёт ДО switch по типу: подспособность обычно
  // Черта или Талант, а они в switch попадают в default «активен всегда» —
  // выключатель там бы утонул.
  if (toggleParentId(item)) return isToggleOn(item);
  switch (item.type) {
    case "weapon": case "armor": return !!sys.equipped;
    // Снаряжение (wdbc-9h7g): носимое — по своему тумблеру «надето», прочее —
    // как раньше, активно фактом владения. См. gearRequiresWearing выше.
    case "gear": return gearRequiresWearing(sys) ? !!sys.equipped : true;
    case "armorMod": case "weaponMod": {
      if (!sys.installedOn || (sys.activatable && !sys.active)) return false;
      // Носитель в рюкзаке механику не даёт: так считал старый расчёт
      // модификаций брони (getInstalledArmorMods в combat/armor-mods.mjs), и
      // эффекты, забравшие эту механику, обязаны считать так же.
      // Потолок: снятый шлем и требование силовой брони у систем сюда не
      // заведены — их по-прежнему знает только getInstalledArmorMods, то есть
      // старое поле. Заводить, когда такая механика уедет в эффект.
      const host = item.parent?.items?.get(sys.installedOn);
      if (host) return !!host.system?.equipped;
      // Носителя по ссылке нет — и это два разных случая (wdbc-z6em):
      //   • предмет вообще не на акторе (компендиум, боковая панель) —
      //     носителя там и не может быть, судим по своим полям, как раньше;
      //   • предмет НА АКТОРЕ, а носителя с таким id нет — значит вещь, в
      //     которую мод вставлен, удалили. Мод осиротел, и его бонусы обязаны
      //     погаснуть вместе с носителем, а не остаться висеть на персонаже.
      // Так же — «нет носителя на акторе, значит неактивна» — этот случай уже
      // считает module/rules/character.mjs (isActiveArmorMod).
      return !item.parent;
    }
    case "psychicPower": return !!sys.isSustained;
    case "techPower": {
      if (sys.sustained || sys.miracleType === "passive") return true;
      // Славословие (X): по книге скомпилированное Славословие «считается как
      // Процесс с Ценой ½X Когниции, пока его не используют» — т.е. активно
      // ровно пока держится компиляция, тем же смыслом, что sustained у
      // остальных техночудес (см. wdbc-yu32). Компенсатор/Манипула/Анима/
      // Доктрина/Императив тут ни при чём — они не про удерживаемое
      // состояние предмета-источника (см. разбор в тикете).
      const isSlavo = sys.miracleType === "slavoslovie" || (sys.extraTypes || []).some(e => e.type === "slavoslovie");
      return isSlavo && !!sys.compiled;
    }
    case "navigatorPower": return !!sys.isSustained;
    case "implant":
      return !!item.getFlag("warhammer-dbc", "installed") && !item.getFlag("warhammer-dbc", "disabled");
    case "runicWeave": {
      // "region" (помещение/стены) — не читается отсюда вовсе: живой пересчёт
      // там клонирует предмет-источник тем, чей токен стоит в Region (см.
      // module/regions/runic-weave-zone.mjs), а сам клон сюда попадает уже
      // БЕЗ installedOnType (toObject снимает флаг привязки, не поле схемы —
      // достаточно оставить его "активным всегда", как трейт/талант).
      if (sys.installedOnType === "region") return true;
      // "vehicle" — сама вязь embedded-предметом на акторе техники: сам факт
      // владения ей И есть нанесение, отдельного «носителя» нет.
      if (sys.installedOnType === "vehicle") return true;
      // "carrier" (по умолчанию, включая старые/непроставленные данные) —
      // на конкретном предмете (броне/оружии/держателе) того же актора.
      if (!sys.installedOn) return false;
      const host = item.parent?.items?.get(sys.installedOn);
      if (!host) return true; // предмет пака/битая ссылка — судим по своим полям
      if (!isItemActive(host)) return false;
      if (host.type === "armorMod") return !!sys.active; // держатель (Загадка Маата) — ручной тумблер
      // Правило «кто из вязей действует» живёт одно — в rules/runic-weave.mjs
      // (Collection.filter отдаёт массив, спред-копия всех предметов не нужна).
      const siblings = siblingRunicWeaves(item.parent?.items, item)
        .map(i => ({ id: i.id, wornPosition: i.system?.wornPosition || "" }));
      return activeRunicWeaveId(siblings) === item.id;
    }
    // Мутация/Дар (wdbc-egll) — по умолчанию действует всегда, как Талант/
    // Черта (activatable:false у подавляющего большинства). Часть даёт
    // эффект только «активированным» книжным действием на время (Живое
    // Оружие — полудействие+1 Бесчестия, до конца боя/сцены) — у таких
    // activatable:true, и тогда решает ручной тумблер system.active (тот же
    // паттерн, что у armorMod/weaponMod выше, без требования носителя).
    //
    // Кроме того, мутация/Дар Бога может быть подавлена Чистой Формой
    // (rules/mutation-suppression.mjs, wdbc-1rno: «1 час концентрации
    // подавляет все мутации, теряя их эффекты») — flags.warhammer-dbc.
    // suppressed, тот же общий рубильник, что у прочих «выключаемых» типов
    // выше, просто источник переключения другой (не toggleParentId, а сама
    // Чистая Форма извне). Проверяется раньше activatable: подавленная
    // мутация неактивна независимо от собственного тумблера. `?.` —
    // item-rules.mjs::rulesFromItemMechanics вызывает isActive() на КАЖДОМ
    // типе предмета актора без разбора (в т.ч. лёгкие тестовые моки чужих
    // наборов правил, напр. test/rules/weapon-training.test.mjs, у которых
    // нет getFlag) — без страховки любой не-mutation-специфичный мок с
    // type:"mutation" ронял бы весь сбор правил TypeError'ом, а не только
    // про суть теста.
    case "mutation":
      if (item.getFlag?.("warhammer-dbc", "suppressed")) return false;
      if (sys.activatable) return !!sys.active;
      return true;
    default: return true;
  }
}

/**
 * Синхронизирует `disabled` у ВСЕХ эффектов предмета с его текущим активным
 * состоянием (экипировка/установка/sustain — см. isItemActive). Вызывается
 * после любого update, меняющего это состояние. Явный override нужен там, где
 * состояние ставится не флагом предмета, а вызывающим кодом.
 */
export async function syncItemEffectsDisabled(item, activeOverride) {
  const active = activeOverride !== undefined ? activeOverride : isItemActive(item);
  // item.effects.contents ?? item.effects ?? [] (wdbc-s9dj): настоящая
  // Foundry-коллекция и часть тестовых фикстур дают .contents, другая часть
  // (module/apps/mechanics.mjs::syncMechanicsEffects и его тесты) читает
  // item.effects как простой массив без .contents вовсе — оба варианта
  // должны отработать одинаково.
  const updates = (item.effects?.contents ?? item.effects ?? [])
    .filter(fx => fx.disabled === active)
    .map(fx => ({ _id: fx.id, disabled: !active }));
  if (updates.length) await item.updateEmbeddedDocuments("ActiveEffect", updates);
}

/**
 * Создаёт на предмете новый пустой ActiveEffect (одна строка changes,
 * фаза сразу "final" — иначе GM, забывший переключить фазу в редакторе,
 * получит эффект, который «не работает») и открывает его штатный лист.
 */
export async function createBlankEffect(item) {
  const [fx] = await item.createEmbeddedDocuments("ActiveEffect", [{
    name: "Новый эффект", img: item.img,
    system: { changes: [{ key: "", type: "add", value: "", phase: "final", priority: 0 }] }
  }]);
  fx?.sheet?.render(true);
  return fx;
}

