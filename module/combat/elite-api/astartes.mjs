// module/combat/elite-api/astartes.mjs
// Помощники скриптов кнопок Талантов/Черт элитных архетипов (пачка «astartes»).
// Всё, что экспортировано в API, видно коду kind:"script"-записей Конструктора
// по имени ключа (module/apps/item-script.mjs → ELITE_SCRIPT_API). Свой файл на
// пачку, чтобы параллельные правки не сталкивались в длинных списках
// item-script.mjs. Имена ключей не должны повторять имена из item-script.mjs.
//
// Модули кнопок грузятся лениво, в момент нажатия: статический импорт тянул
// весь боевой граф (damage.mjs, gm-relay.mjs …) в item-script.mjs и замыкал
// циклы импорта — моки тестов переставали срабатывать.

const lazy = (load, name) => async (...args) => (await load())[name](...args);
const bronenosets = () => import("../bronenosets-talents.mjs");
const gerold = () => import("../gerold-talents.mjs");
const warpTalon = () => import("../warp-talon-talents.mjs");
const moritat = () => import("../moritat-talents.mjs");
const terminator = () => import("../terminator-talents.mjs");
const obliterator = () => import("../obliterator-talents.mjs");
const bloodSmith = () => import("../blood-smith-talents.mjs");

const group = (load, names) => Object.fromEntries(names.map(n => [n, lazy(load, n)]));

export const API = {
  // Броненосец
  ...group(bronenosets, ["useChaosGreatbow", "useDivineShield", "dedicateChaosSteed", "useSinEater"]),
  // Герольд
  ...group(gerold, ["ancientBannerLost", "useGreaterHerald", "useStandYourGround", "useVillainousHonour", "useDelegate", "noblesseObligeSlip"]),
  // Коготь Варпа
  ...group(warpTalon, ["useVeilRender", "useRift", "useSpeedOfThought", "useWarpTrail"]),
  // Моритат
  ...group(moritat, ["useBeltFeed", "useFlyBy"]),
  // Чемпион Терминатор
  ...group(terminator, ["useAnointed", "useAtramentar", "useDeathShroud"]),
  // Облитератор
  ...group(obliterator, ["useLivingArsenal", "useBulletEater", "useMutilator", "useSelfForging", "useShredder", "useToTheTeeth"]),
  // Кузнец Крови
  ...group(bloodSmith, ["useRingOfBlood", "useDaemonPlate", "useUnforge"])
};
