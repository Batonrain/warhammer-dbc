// tools/_natural-weapon-mutations.mjs — интегральные атаки для мутаций
// «Общие мутации»: Devourer/Пожиратель, Tail/Хвост, Wail/Вопль,
// Ranged Attack/Стрелковая Атака. Создаёт новые предметы-оружие в
// packs-src/weapons/Интегральные_атаки и связывает их с Мутациями через
// kind:"integralAttack" (Wail/Ranged Attack — несколько записей,
// gated по when.submutations, т.к. профиль полностью определяется
// выпавшей строкой). Burning Head обработана отдельно (капабилити +
// альт-профиль на общем Headbutt, не новый предмет) — см. чат/память.
//
// СОЗНАТЕЛЬНО НЕ АВТОМАТИЗИРОВАНО (см. bd для Tentacle/Hand of Death,
// а для самих Tail/Wail — только часть субмутаций закодирована числом,
// остальные ситуативны/меняют не боевой профиль):
//  - Tail: только базовый профиль (как у Пинка). Субмутации 1(Булава заменяет
//    профиль)/2-3/4-5/6(бонусы на тесты ВНЕ атаки)/7(реакция-облако, не атака
//    хвостом)/8(бандл трейтов)/9(хват предметов)/10(утроение) — не закодированы.
//  - Wail: базовый профиль (без урона) + субмутации 4-5(Shocking) и
//    10(реальный урон) — единственные, что меняют боевую статистику числом.
//    Остальные (1,2-3,6,7,8,9) — эффекты на ЦЕЛИ после попадания, не смена
//    оружия — не закодированы (ситуативны, нет системного места).
//  - Ranged Attack: все 10 профилей — вся мутация только из них и состоит.
//    Linger(Cor.b)/Flame(2d10, 3d10 vs псайкер) — формула/условие не
//    поддерживаются полем weaponProps.rating (плоское число, прецедент —
//    Daemonic Breath в этой же папке); взято фиксированное приближение,
//    задокументировано в notes.
import "../test/support/foundry-stub.mjs";
import fs from "node:fs";
import path from "node:path";
import { blankMechEntry, blankMechGroup } from "../module/apps/mechanics.mjs";

const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const randomID = (length = 16) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");
globalThis.foundry.utils.randomID = randomID;

const WEAPONS_FOLDER = "mCeNfRO1LB6dGxU3"; // packs-src/weapons/Интегральные_атаки
const WEAPONS_DIR = "packs-src/weapons/Интегральные_атаки";

function weaponBase({ name, weaponClass, weaponType, grips = "", meleeCategory = "",
                       range, balance = 0, damage, damageType, penetration,
                       rof_single = 0, rof_semi = 0, rof_full = 0,
                       weaponProps = [], special = "", notes = "", equipped = false }) {
  return {
    name, type: "weapon",
    system: {
      description: "", notes,
      grips, profileLabel: "", profiles: [],
      reload: "–", magazineCur: 0, magazineMax: 0,
      rof_single, rof_semi, rof_full,
      quality: "common", availability: 0, weight: 0, attackBonus: 0,
      special, equipped, loadedAmmoId: "",
      weaponProps, needsRecharge: false, legacyWeapon: false, sacred: false,
      daemonWeapon: { bound: false, god: "", demonName: "", binding: 0, demonWb: 0, demonInf: 0,
                      subdued: false, runic: false, properties: [], preProps: [], preDamage: "", prePen: 0 },
      vehicleMount: { isMounted: false, operator: "gunner", stationId: "", mount: "turret",
                      hArc: "360°", vArc: "", standard: false, reloads: 10 },
      bookSource: "", weaponClass, weaponType, range, balance,
      damage, damageType, penetration, meleeCategory
    },
    img: weaponClass === "melee" ? "systems/warhammer-dbc/assets/item-icons/weapon-melee.svg"
                                  : "systems/warhammer-dbc/assets/item-icons/weapon-ranged.svg",
    effects: [], sort: 0, ownership: { default: 0 }, flags: {},
    _stats: { compendiumSource: null, duplicateSource: null, exportSource: null,
              coreVersion: "14.365", systemId: "warhammer-dbc", systemVersion: "0.1.0",
              createdTime: null, modifiedTime: null, lastModifiedBy: null },
    folder: WEAPONS_FOLDER
  };
}

function writeWeapon(fileBase, data) {
  const id = randomID(16);
  data._id = id;
  data._key = `!items!${id}`;
  const file = path.join(WEAPONS_DIR, `${fileBase}_${id}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log("weapon OK:", file);
  return { uuid: `Compendium.warhammer-dbc.weapons.Item.${id}`, name: data.name, img: data.img };
}

function integralAttackEntry({ id, weapon, when = null }) {
  const e = blankMechEntry("integralAttack");
  e.id = id;
  e.equipSourceUuid = weapon.uuid;
  e.equipSourceName = weapon.name;
  e.equipSourceImg = weapon.img;
  if (when) e.when = when;
  return e;
}

function appendMechanicsGroups(mutationFile, entries) {
  const doc = JSON.parse(fs.readFileSync(mutationFile, "utf8"));
  doc.flags ??= {};
  doc.flags["warhammer-dbc"] ??= {};
  doc.flags["warhammer-dbc"].mechanics ??= [];
  for (const entry of entries) {
    const group = blankMechGroup("AND");
    group.entries = [entry];
    doc.flags["warhammer-dbc"].mechanics.push(group);
  }
  fs.writeFileSync(mutationFile, JSON.stringify(doc, null, 2) + "\n");
  console.log("mutation OK:", mutationFile);
}

// ── Devourer / Пожиратель (d100 89, без субмутаций) ────────────────────────
{
  const bite = writeWeapon("Devourer___Пожиратель", weaponBase({
    name: "Devourer / Пожиратель",
    weaponClass: "melee", weaponType: "primitive", grips: "Зуб", meleeCategory: "Природное",
    range: 0, damage: "1d5", damageType: "rending", penetration: 20,
    weaponProps: [{ key: "felling", rating: 10 }],
    special: "Атака Укусом (Общие мутации, d100 89). Если персонаж не проглотит откушенное, "
      + "эффект попадания теряется до следующего проглатывания обычной еды — вне полей Конструктора."
  }));
  appendMechanicsGroups(
    "packs-src/mutations/Общие_мутации/Devourer___Пожиратель_JRFzM8VPy6L5IX7K.json",
    [integralAttackEntry({ id: "devourer-bite", weapon: bite })]
  );
}

// ── Tail / Хвост (d100 86…88) — только базовый профиль (как у Пинка) ──────
{
  const tail = writeWeapon("Tail___Хвост", weaponBase({
    name: "Tail / Хвост",
    weaponClass: "melee", weaponType: "primitive", grips: "Хвост", meleeCategory: "Природное",
    range: 5, damage: "1d5-1", damageType: "impact", penetration: 0,
    weaponProps: [{ key: "cheapShot" }, { key: "imprecise" }, { key: "primitive" }],
    special: "Атака Хвостом, профиль как у Пинка, Rng 0-5 (Общие мутации, d100 86…88). Считается "
      + "ногой для Избирательных атак — вне полей Конструктора. Субмутации (Булава/Плавательный/"
      + "Цепкий/Балансир/Мушиное Брюхо/Скорпионий Хвост/Хвост-Рука/Многохвостый) меняют профиль "
      + "или дают иные способности — не автоматизированы, см. текст Мутации."
  }));
  appendMechanicsGroups(
    "packs-src/mutations/Общие_мутации/Tail___Хвост_F7iMcjy64r5w52bz.json",
    [integralAttackEntry({ id: "tail-kick", weapon: tail })]
  );
}

// ── Wail / Вопль (d100 71) — база (без урона) + субмутации 4-5/10 ─────────
{
  const base = writeWeapon("Wail___Вопль", weaponBase({
    name: "Wail / Вопль",
    weaponClass: "pistol", weaponType: "exotic", range: 30, damage: "0", damageType: "energy",
    penetration: 0, rof_single: 1, equipped: true,
    weaponProps: [{ key: "independent" }, { key: "recharge" }, { key: "spray" }],
    special: "Стрелковая атака взамен речи (Общие мутации, d100 71). Без выбранной субмутации "
      + "попадание не наносит урона — эффект целиком определяется строкой субмутации. Строки "
      + "1/2-3/6/7/8/9 (эффекты на цели после попадания) не автоматизированы — см. текст Мутации."
  }));
  const shock = writeWeapon("Wail_Shocking___Вопль__Оглушительный_Р_в_", weaponBase({
    name: "Wail (Оглушительный Рёв) / Вопль",
    weaponClass: "pistol", weaponType: "exotic", range: 30, damage: "0", damageType: "energy",
    penetration: 0, rof_single: 1, equipped: true,
    weaponProps: [{ key: "independent" }, { key: "recharge" }, { key: "spray" }, { key: "shocking" }],
    special: "Субмутация «Оглушительный Рёв»: свойство Shocking (считается пробившим броню). "
      + "Дополнительно Оглушённые им также Глохнут до конца сцены/боя — не автоматизировано."
  }));
  const tear = writeWeapon("Wail_Tearing___Вопль__Разрывающий_Вопль_", weaponBase({
    name: "Wail (Разрывающий Вопль) / Вопль",
    weaponClass: "pistol", weaponType: "exotic", range: 30, damage: "2d10", damageType: "blast",
    penetration: 0, rof_single: 1, equipped: true,
    weaponProps: [{ key: "independent" }, { key: "recharge" }, { key: "spray" }, { key: "concussive", rating: 2 }],
    special: "Субмутация «Разрывающий Вопль»: реальный урон 2d10 X, Pen 0, Concussive (2). "
      + "Удваивает урон по постройкам/предметам из дерева, стекла, камня, рокрита — не автоматизировано."
  }));
  appendMechanicsGroups(
    "packs-src/mutations/Общие_мутации/Wail___Вопль_ZWnXt7hRt3G1GGYr.json",
    [
      integralAttackEntry({ id: "wail-base", weapon: base,
        when: { negate: false, conditions: [], submutations: ["4-5", "10"], negateSub: true } }),
      integralAttackEntry({ id: "wail-shocking", weapon: shock,
        when: { negate: false, conditions: [], submutations: ["4-5"], negateSub: false } }),
      integralAttackEntry({ id: "wail-tearing", weapon: tear,
        when: { negate: false, conditions: [], submutations: ["10"], negateSub: false } })
    ]
  );
}

// ── Ranged Attack / Стрелковая Атака (d100 74…75) — все 10 строк ──────────
{
  const rangedBase = { weaponClass: "pistol", weaponType: "exotic", equipped: true };
  const profiles = [
    { sub: "1", file: "Neurodetonation___Нейровзрыв_", name: "Neurodetonation / Нейровзрыв",
      range: 20, rof_single: 1, damage: "1d10+5", damageType: "impact", penetration: 0,
      weaponProps: [{ key: "blast", rating: 3 }],
      special: "Все Размера 1 и меньше в попадании проходят тест S+0 или их отбрасывает/сбивает с "
        + "ног; засекается Пси-чутьём/Ноосферным Сканированием несмотря на незримость — не автоматизировано." },
    { sub: "2-3", file: "Black_Smoke___Ч_рный_Дым_", name: "Black Smoke / Чёрный Дым",
      range: 10, rof_single: 1, damage: "1d10+5", damageType: "chemical", penetration: 3,
      weaponProps: [{ key: "smoke" }, { key: "spray" }, { key: "linger", rating: 4 }],
      notes: "Linger в книге дан как Cor.b (рейтинг Порчи получателя) — движок weaponProps "
        + "поддерживает только фиксированное число; взято приближение (4). См. Daemonic Breath "
        + "в этой же папке — тот же компромисс для d5.",
      special: "Шаблон дыма также считается Душащим и Слезоточивым Газом, пока не развеется; сам "
        + "персонаж иммунен — не автоматизировано." },
    { sub: "4-5", file: "Death_Rays___Лучи_Смерти_", name: "Death Rays / Лучи Смерти",
      range: 40, rof_single: 1, damage: "3d10", damageType: "energy", penetration: 7,
      weaponProps: [{ key: "twinLinked" }],
      special: "Выстрел уничтожает визоры персонажа — попадание Blinding(0) по себе — не автоматизировано." },
    { sub: "6", file: "Cutting_Stream___Режущий_Поток_", name: "Cutting Stream / Режущий Поток",
      range: 30, rof_full: 6, damage: "1d10+6", damageType: "rending", penetration: 3,
      weaponProps: [{ key: "razorSharp" }, { key: "shocking" }] },
    { sub: "7", file: "Acid_Vomit___Кислотная_Рвота_", name: "Acid Vomit / Кислотная Рвота",
      range: 15, rof_single: 1, damage: "1d10+2", damageType: "chemical", penetration: 3,
      weaponProps: [{ key: "corrosive", rating: 3 }, { key: "toxic", rating: 3 }],
      special: "Успешное Уклонение требует 2 Успеха (4, если тратить Успехи с уклонения от "
        + "предыдущей атаки) — вне полей Конструктора, не автоматизировано." },
    { sub: "8", file: "Dragons_Breath___Дыхание_Дракона_", name: "Dragon's Breath / Дыхание Дракона",
      range: 20, rof_single: 1, damage: "2d10+2", damageType: "energy", penetration: 2,
      weaponProps: [{ key: "flame" }, { key: "spray" }, { key: "linger", rating: 3 }],
      notes: "Linger в книге дан как 1d5 (раунды) — фиксированное приближение (3), как у Daemonic "
        + "Breath в этой же папке. «3d10 против псайкеров» (вместо 2d10+2) не поддерживается "
        + "числовым полем урона — не автоматизировано." },
    { sub: "9", file: "Eye_of_Flame___Око_Пламени_", name: "Eye of Flame / Око Пламени",
      range: 40, rof_single: 1, rof_semi: 2, rof_full: 4, damage: "1d10+5", damageType: "energy", penetration: 0,
      weaponProps: [{ key: "warpWeapon" }] },
    { sub: "10", file: "Ropes___Верёвки_", name: "Ropes / Верёвки",
      range: 15, rof_single: 1, damage: "1d10", damageType: "rending", penetration: 0,
      weaponProps: [{ key: "snare", rating: 3 }],
      special: "Успешное Уклонение требует 3 Успеха (6 при трате с предыдущего уклонения); "
        + "свободное действие снимает Опутывание; нельзя использовать атаку повторно, пока держится "
        + "предыдущее Опутывание — вне полей Конструктора, не автоматизировано." }
  ];

  const entries = profiles.map(p => {
    const w = writeWeapon(p.file, weaponBase({
      name: p.name, ...rangedBase,
      range: p.range, damage: p.damage, damageType: p.damageType, penetration: p.penetration,
      rof_single: p.rof_single || 0, rof_semi: p.rof_semi || 0, rof_full: p.rof_full || 0,
      weaponProps: p.weaponProps, special: p.special || "", notes: p.notes || ""
    }));
    return integralAttackEntry({ id: `ranged-${p.sub}`, weapon: w,
      when: { negate: false, conditions: [], submutations: [p.sub], negateSub: false } });
  });

  appendMechanicsGroups(
    "packs-src/mutations/Общие_мутации/Ranged_Attack___Стрелковая_Атака_7k8oYNLPdOI52qzx.json",
    entries
  );
}

// ── Burning Head / Горящая Голова (d100 43) — не новый предмет: капабилити
// mutation.burningHead открывает альт-профиль на общем Headbutt (правки уже
// внесены вручную в module/constants/capabilities.mjs и
// packs-src/weapons/Интегральные_атаки/Headbutt___Удар_головой_....json).
{
  const e = blankMechEntry("capability");
  e.id = "burning-head-capability";
  e.capabilityKey = "mutation.burningHead";
  appendMechanicsGroups(
    "packs-src/mutations/Общие_мутации/Burning_Head___Горящая_Голова_WYg8hcvLjsTxGQHb.json",
    [e]
  );
}
