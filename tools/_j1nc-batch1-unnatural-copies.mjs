// tools/_j1nc-batch1-unnatural-copies.mjs — wdbc-j1nc, партия 1: 44 «голых»
// копий семейства Unnatural (root + Элитные_архетипы/Элитные_архетипы_Эльдар),
// у которых benefit — только число без формулы степеней успеха (см. память
// doombc-talents-traits-audit: «~30 голых рейтинговых заглушек... не пропуск
// конкретно у них»). Полная мехнизация через существующий legacy-конвертер —
// то же самое, что уже сделано для родовых шаблонов-эталонов. Одноразовый.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import { legacyEffectsToChanges } from "../module/constants/effect-keys.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
globalThis.foundry.utils.randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");

function addLegacyEffect(file) {
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const changes = legacyEffectsToChanges(doc.system.effects);
  if (!changes.length) {
    console.log("ПРОПУСК (нет legacy-эффектов):", file);
    return false;
  }
  const effId = foundry.utils.randomID();
  doc.effects = doc.effects || [];
  doc.effects.push({
    name: `${doc.name} (перенесено)`,
    system: { changes },
    _id: effId,
    img: doc.img,
    type: "base",
    disabled: false,
    start: null,
    duration: { value: null, units: "seconds", expiry: null, expired: false },
    description: "",
    origin: null,
    tint: "#ffffff",
    transfer: true,
    statuses: [],
    showIcon: 1,
    folder: null,
    sort: 0,
    flags: {},
    _stats: {
      coreVersion: "14.365", systemId: "warhammer-dbc", systemVersion: "0.1.0",
      createdTime: Date.now(), modifiedTime: Date.now(), lastModifiedBy: null,
      compendiumSource: null, duplicateSource: null, exportSource: null
    },
    _key: `!items.effects!${doc._id}.${effId}`
  });
  doc.flags ??= {};
  doc.flags["warhammer-dbc"] ??= {};
  doc.flags["warhammer-dbc"].migratedEffect = true;
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  console.log("OK:", doc.name, "->", changes.map(c => `${c.key}:${c.value}`).join(", "));
  return true;
}

const files = [
"packs-src/traits/Unnatural_A__4____Сверхъест__Ловкость_trkueTi2yu0m4CAb.json",
"packs-src/traits/Unnatural_A___2____Сверхъест__Ловкость_0zmGhvlJeH3sYKEY.json",
"packs-src/traits/Unnatural_I__4____Сверхъест__Интеллект_K8omv4m9pGUSwNfV.json",
"packs-src/traits/Unnatural_I___2____Сверхъест__Интеллект_Ne4X1iPnnZwo17f0.json",
"packs-src/traits/Unnatural_I___4____Сверхъест__Интеллект_Q1LV2uBQSTxwCatl.json",
"packs-src/traits/Unnatural_P__4____Сверхъест__Восприятие_kQrf3VXgiXlPUjYd.json",
"packs-src/traits/Unnatural_P___2____Сверхъест__Восприятие_37zW5J3HJlqhs4Dg.json",
"packs-src/traits/Unnatural_S__4____Сверхъест__Сила_jRAPHbIufYAu030e.json",
"packs-src/traits/Unnatural_S__6____Сверхъест__Сила_ErN0QdoVzi68jXZi.json",
"packs-src/traits/Unnatural_T__4____Сверхъест__Стойкость_0lmXXFGAoQlffxGQ.json",
"packs-src/traits/Unnatural_T__6____Сверхъест__Стойкость_YwFps6VQIJM2Plgx.json",
"packs-src/traits/Unnatural_T___2____Сверхъест__Стойкость_j0Xv1MHT9vPrGRXc.json",
"packs-src/traits/Unnatural_WP___2____Сверхъест__Воля_0A12TcD79wynam9l.json",
"packs-src/traits/Unnatural_WS___2____Сверхъест__Оружейное_bgXYz6Up4dFeBiiP.json",
"packs-src/traits/Элитные_архетипы/Архонт/Unnatural_F__I__W___2____Сверхъест__Общи_Zap139RGsnph6jRM.json",
"packs-src/traits/Элитные_архетипы/Ведьма/Unnatural_Agility___2____Сверхъест__Ловк_5h51jVZRWDlHTsKQ.json",
"packs-src/traits/Элитные_архетипы/Ведьма/Unnatural_WS__4____Сверхъест__Оружейное__nBAHoiBS8pwgn5qV.json",
"packs-src/traits/Элитные_архетипы/Иерарх/Unnatural_Fellowship___2____Сверхъест__О_qfDJtzpKamiIIgXU.json",
"packs-src/traits/Элитные_архетипы/Избиратель_Плоти/Unnatural_Intelligence___4____Сверхъест__vUeVFGXXlF45D2eW.json",
"packs-src/traits/Элитные_архетипы/Инкуб/Unnatural_WS___4____Сверхъест__Оружейное_UHM8j2v3GLOrg64V.json",
"packs-src/traits/Элитные_архетипы/Инкуб/Unnatural_WS___4____Сверхъест__Оружейное_umswXwG0CHDjCOQO.json",
"packs-src/traits/Элитные_архетипы/Ламия/Unnatural_Intelligence___2____Сверхъест__D7lvQxReu4rL9VSB.json",
"packs-src/traits/Элитные_архетипы/Ламия/Unnatural_Intelligence___2____Сверхъест__nd4zM5rLZoaFnwaw.json",
"packs-src/traits/Элитные_архетипы/Медуза/Unnatural_Willpower___4____Сверхъест__Во_cJlH8ftjFinNJyrj.json",
"packs-src/traits/Элитные_архетипы/Суккуб/Unnatural_WS__A___2____Сверхъест__WS_и_Л_8FBGjxL5juZSNJPu.json",
"packs-src/traits/Элитные_архетипы/Укротитель/Unnatural_Perception___2____Сверхъест__В_i5hePpcvHqg0jAO1.json",
"packs-src/traits/Элитные_архетипы_Эльдар/Авангард_Связанных_Душами/Unnatural_WS__4____Сверхъест__Оружейное__SEInkeqUE54ZMv7O.json",
"packs-src/traits/Элитные_архетипы_Эльдар/Агент_Кабала/Unnatural_F__4____Сверхъест__Товариществ_JJM2fsa38hxqTelU.json",
"packs-src/traits/Элитные_архетипы_Эльдар/Аребенниан/Unnatural_WS__BS__A__2____Сверхъест__Ору_SQwdsLVLVCwKIPBQ.json",
"packs-src/traits/Элитные_архетипы_Эльдар/Атхаир/Unnatural_F__I__4____Сверхъест__Товарище_DPr0pV4kSSWIro0D.json",
"packs-src/traits/Элитные_архетипы_Эльдар/Аутарх/Unnatural_F__2____Сверхъест__Товариществ_nLtsojWdgdZzKnol.json",
"packs-src/traits/Элитные_архетипы_Эльдар/Барон_Корсаров/Unnatural_F__4____Сверхъест__Товариществ_KH6nCdd2GkV58KOT.json",
"packs-src/traits/Элитные_архетипы_Эльдар/Высший_Провидец/Unnatural_WP__4____Сверхъест__Воля_VdUmGZovbiU1tIXN.json",
"packs-src/traits/Элитные_архетипы_Эльдар/Клинковое_Воинство/Unnatural_WS__4____Сверхъест__Оружейное__xUXD0ld0VkR4jDVK.json",
"packs-src/traits/Элитные_архетипы_Эльдар/Кузнец_Ваула/Unnatural_I__6____Сверхъест__Интеллект_sXE4f2SX0IcR1IR7.json",
"packs-src/traits/Элитные_архетипы_Эльдар/Маргорах/Unnatural_BS__4____Сверхъест__Стрелковое_zly6qDWdMcKq44Qz.json",
"packs-src/traits/Элитные_архетипы_Эльдар/Охотник_Курноуса/Unnatural_BS__WS__1____Сверхъест__Стрелк_5UU23fe1mBWbZlLO.json",
"packs-src/traits/Элитные_архетипы_Эльдар/Принц_Кхейна/Unnatural_BS__2____Сверхъест__Стрелковое_maNOJer2RkhYzhkz.json",
"packs-src/traits/Элитные_архетипы_Эльдар/Принц_Кхейна/Unnatural_S__2____Сверхъест__Сила_UbdHGdlZ4rKTIhAF.json",
"packs-src/traits/Элитные_архетипы_Эльдар/Присягнувшие_Клинки/Unnatural_WS__BS__2____Сверхъест__Оружей_tcQVoTjpF2ReAc3d.json",
"packs-src/traits/Элитные_архетипы_Эльдар/Следопыт/Unnatural_P__BS__2____Сверхъест__Восприя_rQRCy6CQJjjPtXs3.json",
"packs-src/traits/Элитные_архетипы_Эльдар/Танцор_Войны/Unnatural_A__2____Сверхъест__Ловкость__Т_PE8zhKVCDXBXaQAG.json",
"packs-src/traits/Элитные_архетипы_Эльдар/Эсдаинн/Unnatural_P__WP__4____Сверхъест__Восприя_XBbLkJDJfcaeIXDU.json",
];

let ok = 0;
for (const f of files) if (addLegacyEffect(f)) ok++;
console.log(`\nИтого применено: ${ok}/${files.length}`);
