// module/combat/elite-api/psykers.mjs
// Помощники скриптов кнопок Талантов/Черт элитных архетипов (пачка «psykers»).
// Всё, что экспортировано в API, видно коду kind:"script"-записей Конструктора
// по имени ключа (module/apps/item-script.mjs → ELITE_SCRIPT_API). Свой файл на
// пачку, чтобы параллельные правки не сталкивались в длинных списках
// item-script.mjs. Имена ключей не должны повторять имена из item-script.mjs.

import { WILD_PSYKER_API } from "../wild-psyker.mjs";
import { ARCHMAGUS_API } from "../archmagus.mjs";
import { INSORCIST_API } from "../insorcist.mjs";
import { WARLOCK_API } from "../warlock.mjs";

export const API = { ...WILD_PSYKER_API, ...ARCHMAGUS_API, ...WARLOCK_API, ...INSORCIST_API };
