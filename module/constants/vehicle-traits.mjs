// module/constants/vehicle-traits.mjs
// Умолчание поля `system.effects` в схеме типа vehicleTrait (module/data/
// item/vehicle-trait.mjs). Сам контент Черт техники живёт в packs-src/
// vehicle-traits/ (компендиум), а не здесь — раньше в этом файле рядом лежал
// экспорт VEHICLE_TRAITS (полный дубликат пака), но у него не нашлось ни
// одного потребителя нигде в module/ (проверено grep, wdbc-m38e, 29.08.2026);
// удалён вместе с фабрикой T()/IMG, которые существовали только ради него.
export const VEHICLE_TRAIT_EFFECTS = {
  openTopped: false, manoeuvreMod: 0, spdMod: 0, spdDamageReduce: 0, noMove: false,
  swerveDisabled: false, fullMoveSpdMult: 0, smallMoveOnly: false, ignoreDifficultTerrain: false,
  critHalved: false, trackHitsToHull: false, siege: false, reloadRapid: false,
  commandBonus: 0, repairBonus: 0,
  // Щит-дефлектор 1-X (значение X = рейтинг черты). deflectorDaemonic — колдовской
  // (обходится атаками, игнорирующими Daemonic). ignoreCrewCrits — иммунитет к
  // крит-эффектам, действующим на экипаж (демоническая машина).
  deflectorShield: false, deflectorDaemonic: false, ignoreCrewCrits: false,
  // Автопилот: рейтинги черты = Operate(X)/BS(Y)/Awareness(Z). Заменяет экипаж.
  autonomous: false,
  // Друкхари: мерцающее поле (−20 стрелкам издали, Size −2 для попаданий по ней).
  flickerfield: false,
  // Амфибия: не считает неглубокую воду Трудным Ландшафтом (машина-скидка в
  // диалоге Трудного Ландшафта, combat/vehicle.mjs).
  amphibious: false,
  // Керамитовая Броня: АР удваивается против урона со свойством Flame
  // (combat/vehicle.mjs::applyDamageToVehicle). Иммунитет к Melta НЕ
  // автоматизирован — свойство Melta пере-считывает Проб. до того, как
  // известна цель (combat/attack-outcome.mjs), автоматизация потребовала бы
  // протаскивать флаг через весь конвейер атаки; оставлено вручную ГМу.
  ceramitePlating: false,
  // Коляска (X): X читается из рейтинга Черты на предмете, как у
  // deflectorShield/autonomous выше — добавляется к system.structure.max байка
  // (rules/vehicle.mjs, wdbc-8nz6).
  sidecarStructure: false,
  // Пустотные Щиты (X): X = число щитов, каждый АР 30 + 20 Структуры,
  // персистентный массив system.voidShields (wdbc-y33b).
  voidShields: false,
  // Взрывоопасная: внутренняя детонация при Пожаре случается на 6+, а не 10+
  // (combat/vehicle.mjs::showFireDetonationDialog, wdbc-y33b).
  volatile: false,
  // Тормоза Падения: 1 раз за бой/сцену превращает Крушение с Низкой высоты
  // в Крушение с Приземной (combat/vehicle.mjs::showSkimmerCrashDialog, wdbc-y33b).
  fallBreaks: false,
  // Орбитальная высадка: 2-Ходовой сценарий десантирования
  // (combat/vehicle.mjs::showOrbitalDeployTurn1/2, wdbc-y33b).
  orbitalDeployment: false,
  // Штурм: стрельба во время Натиска — с Боевой дистанции (галочка в
  // диалоге стрельбы техники, vehicle-sheet.mjs::_showVehicleFireDialog).
  onslaught: false,
  // Мультиприцел / Продвинутые Прицельные Системы / Продвинутые Системы
  // Управления: только информационная заметка в том же диалоге — экономика
  // действий стрельбы техники (сколько орудий/выстрелов на одно действие)
  // нигде в системе не автоматизирована, автоматизировать нечего сверх текста
  // (см. doombc-mount-ranged-penalty-dead-parameters — тот же класс пробела).
  multiTargeter: false,
  advancedTargeting: false,
  advancedControls: false,
  // Боковые Двери / Штурмовая Рампа: выгрузка полным действием + Бег
  // (Рампа — ещё и Натиск), вместо обычного полудействия без движения
  // (combat/vehicle.mjs::showDisembarkDialog).
  sideHatches: false,
  assaultRamp: false,
  // Закрытая / Герметичная: укрытие/защита экипажа внутри машины — нужна
  // система «атака по экипажу через броню», которой в проекте нет вообще ни в
  // каком виде (не только у этих двух Черт — см. Open Topped(X), чей рейтинг
  // 0/½/1/E тоже не читается сверх булева флага). Только флаг для чипа/
  // документации, без потребителя — тот же класс, что Voidcraft/Aquatic.
  enclosed: false,
  sealed: false,
  // Демонический (X): +X к поглощению (АР) машины, обнуляется против
  // Force/Sanctified/Warp Weapon — combat/vehicle.mjs::applyDamageToVehicle
  // (wdbc-8nz6). Иммунитет к ядам/болезням/радиации не автоматизирован — у
  // техники в системе нет самой механики яда/болезни, нечем прикрывать.
  daemonicAbsorb: false
};
