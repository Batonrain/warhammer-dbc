// module/combat/elite-api/psykers.mjs
// Помощники скриптов кнопок Талантов/Черт элитных архетипов (пачка «psykers»).
// Всё, что экспортировано в API, видно коду kind:"script"-записей Конструктора
// по имени ключа (module/apps/item-script.mjs → ELITE_SCRIPT_API). Свой файл на
// пачку, чтобы параллельные правки не сталкивались в длинных списках
// item-script.mjs. Имена ключей не должны повторять имена из item-script.mjs.
//
// Модули кнопок грузятся лениво, в момент нажатия (как пачка astartes):
// статический импорт замыкал цикл combat/<модуль> → … → apps/mechanics.mjs →
// item-script.mjs → сюда → combat/<модуль>, и первый импорт модуля падал
// «Cannot access 'WILD_PSYKER_API' before initialization».

const lazy = (load, api, name) => async (...args) => (await load())[api][name](...args);
const group = (load, api, names) => Object.fromEntries(names.map(n => [n, lazy(load, api, n)]));

export const API = {
  ...group(() => import("../wild-psyker.mjs"), "WILD_PSYKER_API",
    ["useHeartFire", "usePowerOverwhelming", "useWitheringCharge", "useChainsOfAlacrity", "useDeathEater"]),
  ...group(() => import("../archmagus.mjs"), "ARCHMAGUS_API",
    ["useWizardStaff", "useMagusSupreme", "useMasteryOfForm", "useExemptus", "useInnerEye", "useMirrorSoul",
      "useMysticFeint", "useSavantImmaterial", "useUnlimitedPower"]),
  ...group(() => import("../warlock.mjs"), "WARLOCK_API",
    ["useCannibalMage", "useTranscription", "useListener", "useSilentStudent"]),
  ...group(() => import("../insorcist.mjs"), "INSORCIST_API",
    ["useNameSeal", "useInsorcism", "useBlackHand", "useMarkOfSubjugator"]),
  ...group(() => import("../kenetai.mjs"), "KENETAI_API", ["useOccultBlade", "useSharedConsciousness"]),
  ...group(() => import("../medusa.mjs"), "MEDUSA_API",
    ["useMedusae", "useEmotionalExplosion", "useExtremeSensations", "useEmotionalVision"])
};
