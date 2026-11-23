// module/combat/elite-api/cults.mjs
// Помощники скриптов кнопок Талантов/Черт элитных архетипов (пачка «cults»).
// Всё, что экспортировано в API, видно коду kind:"script"-записей Конструктора
// по имени ключа (module/apps/item-script.mjs → ELITE_SCRIPT_API). Свой файл на
// пачку, чтобы параллельные правки не сталкивались в длинных списках
// item-script.mjs. Имена ключей не должны повторять имена из item-script.mjs.

import { useFeveredSpeed, devourCorpse, useFeverStance, useTrueRotRad, cutWormPouch, eatWormPouch, showFeverWallet } from "../plague-monk.mjs";
import { releaseSwarm, markWithMaggot, pupateShellGuard, useWormwalker, useHandOfPlenty } from "../worm-king.mjs";
import { useFleshmolding, useInsanelyMalleable, malleableHour, malleableRedistribute, eidolonAbsorb, eidolonHeal, makeSculpturite, redistributeSculpturite } from "../flesh-sculptor.mjs";
import { useHypnoProgramming, setHypnoAdvance, eightSpokesVision, eightSpokesSacrifice, usePerfectMask, calibratePerfectMask, useProxyVeil, useThousandPapercuts, useVeilOfLiesProxy } from "../cognitae.mjs";
import { synthLifeVirus, injectLifeVirus, lifeVirusRounds, harvestFrom, useProjector, maesterRevive, maesterAura } from "../maester.mjs";
import { useSoulDrinker, heartOfStoneInsight } from "../pact-traits.mjs";
import { useGrandAgitator, useHail, useLivingTide, useMobJustice, useZealousMasses } from "../hierophant.mjs";

export const API = {
  // Иерофант
  useGrandAgitator, useHail, useLivingTide, useMobJustice, useZealousMasses,
  // Чумной Монах
  useFeveredSpeed, devourCorpse, useFeverStance, useTrueRotRad, cutWormPouch, eatWormPouch, showFeverWallet,
  // Король Червей
  releaseSwarm, markWithMaggot, pupateShellGuard, useWormwalker, useHandOfPlenty,
  // Скульптор Плоти
  useFleshmolding, useInsanelyMalleable, malleableHour, malleableRedistribute, eidolonAbsorb, eidolonHeal, makeSculpturite, redistributeSculpturite,
  // Когнитэ
  useHypnoProgramming, setHypnoAdvance, eightSpokesVision, eightSpokesSacrifice, usePerfectMask, calibratePerfectMask, useProxyVeil, useThousandPapercuts, useVeilOfLiesProxy,
  // Мейстер
  synthLifeVirus, injectLifeVirus, lifeVirusRounds, harvestFrom, useProjector, maesterRevive, maesterAura,
  // Вампир, Когитор (Черты Пакта)
  useSoulDrinker, heartOfStoneInsight
};
