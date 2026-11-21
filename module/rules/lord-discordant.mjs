// module/rules/lord-discordant.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Лорд Дискордант (Элитные архетипы) — чистая часть без Foundry. Кнопки и
//  обход сцены — combat/lord-discordant.mjs; цена Техночудес и Процессов во
//  вражеской Порченной Ноосфере — sheets/tabs/tech.mjs.
// ════════════════════════════════════════════════════════════════════════════

import { hasItemNamed } from "./req-atom.mjs";

export const hasCorruptedNoosphere = actor => hasItemNamed(actor, "Corrupted Noosphere", ["trait"]);
export const hasDaemonicUplink = actor => hasItemNamed(actor, "Daemonic Uplink", ["trait"]);
export const hasMachineSpiritThief = actor => hasItemNamed(actor, "Machine Spirit Thief", ["trait"]);
export const hasDiscordantDuo = actor => hasItemNamed(actor, "Discordant Duo", ["talent"]);
export const hasHellbound = actor => hasItemNamed(actor, "Hellbound", ["talent"]);
export const hasTorturedSpirit = actor => hasItemNamed(actor, "Tortured Spirit", ["talent"]);

/** Порченная Ноосфера: Процессы во вражеской ауре дороже на 2 ⚙. */
export const CORRUPTED_NOOSPHERE_PROCESS = 2;
/** Демоническое Подключение: цена — 2 Когниции. */
export const UPLINK_COST = 2;
export const HELLBOUND_FLAG = "hellboundMachines";

const intBonus = actor => Math.max(0, Number(actor?.system?.characteristics?.int?.bonus) || 0);

/** Верхом (на Адском Сталкере — книга; система видит любого скакуна). */
export const isMounted = actor => !!actor?.system?.mount?.uuid;

/** Радиус ауры Порченной Ноосферы и Демонического Подключения — I.b м. */
export const noosphereRadius = lord => intBonus(lord);

/** Техножрец: у актора есть Техночудеса. */
export const isTechPriest = actor => [...(actor?.items ?? [])].some(i => i?.type === "techPower");

/** Аура Лорда работает: Черта, верхом. */
export const noosphereAuraOn = lord => hasCorruptedNoosphere(lord) && isMounted(lord);

/**
 * Вор Духов Машины: «1 украденный дух за каждый пункт Размера цели или каждые
 * 3 пункта его I.b (что больше)».
 */
export function stolenSpirits({ size = 0, intB = 0 } = {}) {
  return Math.max(0, Math.trunc(Number(size) || 0), Math.floor((Number(intB) || 0) / 3));
}

/** Радиус эффектов Вора Духов — I×0,5 м. */
export const spiritThiefRange = lord => Math.floor((Number(lord?.system?.characteristics?.int?.total) || 0) * 0.5);

/** Эффекты одного украденного духа. */
export const SPIRIT_EFFECTS = {
  corona: "Актиническая корона: одержимая/демоническая машина чинит 1 поломку или 5 Структуры",
  beam: "Луч по технике в прямой видимости: 2d5 непоглощаемого урона",
  scrapcode: "Взрыв скрапкода Blast(3): техножрецы W+0 (против психосил) или прекращают по Процессу за каждый нечётный Провал",
  haywire: "Шаблон Haywire(3), от которого можно Избегать (+30 воспринимающим Ноосферу)"
};

/** Адосвязанный: не больше ½W.b (окр.▲) машин с рунами. */
export const hellboundLimit = actor => Math.ceil(Math.max(0, Number(actor?.system?.characteristics?.wp?.bonus) || 0) / 2);

/**
 * Нанести руны на машину: новая — в конец списка; сверх предела самая старая
 * теряет силу. Уже отмеченная — без изменений.
 * @returns {{list:object[], dropped:object|null}}
 */
export function hellboundMark(list = [], machine, limit = 1) {
  const cur = (list ?? []).filter(m => m?.uuid);
  if (!machine?.uuid || cur.some(m => m.uuid === machine.uuid)) return { list: cur, dropped: null };
  const next = [...cur, { uuid: machine.uuid, name: machine.name ?? "" }];
  const dropped = next.length > Math.max(0, limit) ? next.shift() : null;
  return { list: next, dropped };
}
