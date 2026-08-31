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
  ceramitePlating: false
};
