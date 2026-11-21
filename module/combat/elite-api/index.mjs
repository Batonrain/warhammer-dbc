// module/combat/elite-api/index.mjs
// Сборка помощников скриптов элитных архетипов из файлов-пачек (см. шапки).

import { API as psykers } from "./psykers.mjs";
import { API as mech1 } from "./mech1.mjs";
import { API as mech2 } from "./mech2.mjs";
import { API as astartes } from "./astartes.mjs";
import { API as duelists } from "./duelists.mjs";
import { API as cults } from "./cults.mjs";
import { API as nullZonesBody } from "./null-zones-body.mjs";

export const ELITE_SCRIPT_API = { ...psykers, ...mech1, ...mech2, ...astartes, ...duelists, ...cults, ...nullZonesBody };
