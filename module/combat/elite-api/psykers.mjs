// module/combat/elite-api/psykers.mjs
// Помощники скриптов кнопок Талантов/Черт элитных архетипов (пачка «psykers»).
// Всё, что экспортировано в API, видно коду kind:"script"-записей Конструктора
// по имени ключа (module/apps/item-script.mjs → ELITE_SCRIPT_API). Свой файл на
// пачку, чтобы параллельные правки не сталкивались в длинных списках
// item-script.mjs. Имена ключей не должны повторять имена из item-script.mjs.

import { WILD_PSYKER_API } from "../wild-psyker.mjs";

export const API = { ...WILD_PSYKER_API };
