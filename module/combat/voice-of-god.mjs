// module/combat/voice-of-god.mjs
// ════════════════════════════════════════════════════════════════════════
//  Voice of God / Глас Божий (Талант Лидерства, wdbc-sk8s):
//  «До ½Inf.b (окр.▲) раз за бой, имея Риск 4+ и успешно отдавая Личную
//  Команду, получатель также получает Очко Бесчестия, которое можно
//  потратить только на Переброс/Усиление/Успех для выполнения этой
//  Команды (теряется в конце действия Команды).»
//
//  Гейт — счётчик «до N раз за бой» из module/rules/cooldown.mjs
//  (unit:"battle", max = ½Inf.b Командира, округление вверх), сама выдача —
//  module/rules/temp-infamy.mjs (ограниченная валюта, не system.fate).
//  Подключено в module/sheets/squad-sheet.mjs::_executeCommand (kind:"short",
//  ключ "personal", успех) — получатель теперь структурная ссылка
//  (system.shortCommand.recipientUuid), не только текст в note.
// ════════════════════════════════════════════════════════════════════════

import { itemHasName } from "../rules/predicates.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";
import { isThrottleCountAvailable, incrementThrottleCount } from "../rules/cooldown.mjs";
import { grantTempInfamy } from "../rules/temp-infamy.mjs";

const FLAG = "voiceOfGod";

/** Владеет ли актор Талантом Voice of God / Глас Божий. */
export function hasVoiceOfGod(actor) {
  return hasAbility(actor, "ability.voiceOfGod", "Voice of God", "talent");
}

/** Максимум использований за бой — ½Inf.b Командира, округление вверх. */
export function voiceOfGodMax(commanderActor) {
  const infBonus = Number(commanderActor?.system?.characteristics?.inf?.bonus) || 0;
  return Math.ceil(infBonus / 2);
}

/** Применимо ли прямо сейчас: Талант, Риск 4+, лимит за бой не исчерпан. */
export function voiceOfGodAvailable(commanderActor, squadRisk) {
  if (!hasVoiceOfGod(commanderActor)) return false;
  if ((Number(squadRisk) || 0) < 4) return false;
  const max = voiceOfGodMax(commanderActor);
  if (max <= 0) return false;
  return isThrottleCountAvailable(commanderActor, FLAG, "battle", max);
}

/** Списывает использование Командира и выдаёт временное Очко Бесчестия получателю. */
export async function applyVoiceOfGod(commanderActor, recipientActor) {
  if (!recipientActor) return;
  await incrementThrottleCount(commanderActor, FLAG, "battle", voiceOfGodMax(commanderActor));
  await grantTempInfamy(recipientActor, 1, {
    source: "Voice of God / Глас Божий",
    restriction: "Только Переброс/Усиление/Успех для выполнения этой Личной Команды — теряется по её окончании"
  });
}
