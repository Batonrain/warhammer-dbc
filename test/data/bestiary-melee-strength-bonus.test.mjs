// test/data/bestiary-melee-strength-bonus.test.mjs
//
// Сторож wdbc-jh8no: рукопашное оружие бестиария не должно нести в
// "system.damage" книжный ИТОГ, уже посчитанный с S.b владельца — атака
// (module/combat/attack.mjs::meleeStrengthBonus, вызывается на каждый бросок
// урона рукопашной атаки) прибавляет S.b САМА, и книжный итог удваивался бы.
//
// Замер 22.09.2026 нашёл 77 таких оружий у 26 существ (Демоны Хаоса Нургла/
// Тзинча/Кхорна/Слаанеш/Неделимый + их скакуны и Герольды) — книжный
// статблок даёт, например, "1d10+29" у Кровожада (это S.b 22 + оружие 7), а
// пак хранил "1d10+29" целиком вместо "1d10+7". Исправлено вычитанием S.b (и
// +PR Психосилового у force-оружия псайкеров) из плоского бонуса; Крушащий
// Удар (½WS.b) система не считает сама — он остаётся зашитым в остаток, и
// это ожидаемо (см. notes соответствующих предметов).
//
// Тест из двух частей:
//  1. Список исправленных пар «существо/оружие» ниже — их формула не должна
//     СНОВА подняться до прежнего книжного итога (проверяем «строго меньше
//     старого значения», а не точное совпадение — дальнейшая правка урона
//     по другой причине не обязана держать именно эту цифру).
//  2. Общая эвристика «плоский бонус кратно больше S.b владельца» — ищет
//     НОВЫЕ экземпляры того же бага у ещё не аудированных существ. Порог
//     сознательно строже, чем «>= S.b» замера (тот шумит на самих
//     исправленных записях — маленький неотъемлемый бонус оружия у существ
//     с маленьким S.b случайно равен или чуть больше S.b, это не баг): здесь
//     триггер только на "плоский бонус >= 2×S.b" — при обычном бое книжный
//     компонент самого оружия редко перевешивает S.b целиком, а двойной счёт
//     всегда даёт минимум 2×S.b формально (S.b из атаки + S.b, зашитый в
//     число). Ложные срабатывания — сверять со статблоком книги, не
//     вычитать вслепую (см. отчёт wdbc-jh8no), настоящее исключение
//     заносится в KNOWN_EXCEPTIONS с книжной цитатой.
import { describe, it, expect } from "vitest";
import { PACK_SCAN_TIMEOUT, allPackDocuments } from "../support/pack-docs.mjs";

function parseDamage(str) {
  const m = String(str ?? "").trim().match(/^(\d*d\d+)\s*([+-]\s*\d+)?/i);
  if (!m) return null;
  const flat = m[2] ? parseInt(m[2].replace(/\s+/g, ""), 10) : 0;
  return { dice: m[1], flat };
}

/** Эффективный S.b существа: сохранённый бонус + Unnatural S и прочие
 * charBonuses(stat:"s") от трейтов/талантов/имплантов/происхождения — тот
 * же набор типов предметов, что rules/character.mjs учитывает в traitMod. */
function sbTotalFor(actorDoc) {
  const base = Number(actorDoc.system?.characteristics?.s?.bonus) || 0;
  let traitAdd = 0;
  for (const it of actorDoc.items ?? []) {
    if (!["trait", "talent", "implant", "homeworld"].includes(it.type)) continue;
    const e = it.system?.effects;
    if (!e) continue;
    if (e.charBonusStat === "s") traitAdd += Number(e.charBonusValue) || 0;
    if (Array.isArray(e.charBonuses)) {
      for (const cb of e.charBonuses) if (cb?.stat === "s") traitAdd += Number(cb.value) || 0;
    }
  }
  return base + traitAdd;
}

/**
 * Пары «файл (относительно packs-src) / имя оружия / зафиксированная после
 * правки формула» — снимок правки wdbc-jh8no (77 записей, см. отчёт с
 * таблицей «существо/оружие/было/стало»). Проверяем не точное совпадение
 * формулы (дальнейшие находки могут двигать её и дальше), а то, что она не
 * вернулась к прежнему, книжному, удвоенному значению.
 */
const FIXED_MELEE_WEAPONS = [
  ["bestiary/Демоны_Хаоса/Нургл/Beast_of_Nurgle___Тварь_Нургла_WjmbTQIBGqdXcOyc.json", "Putrid Embrace / Гнилостные Объятья", "2d10"],
  ["bestiary/Демоны_Хаоса/Нургл/Palanquin_of_Nurgle___Паланкин_Нургла_nCMcUrHwHLTtS58r.json", "Wave of Nurglings / Волна Нурглингов", "1d10+1"],
  ["bestiary/Демоны_Хаоса/Нургл/Nurglings___Нурглинги_cOAwocv9yqhLhBUE.json", "Claws / Когти", "1d10+1"],
  ["bestiary/Демоны_Хаоса/Нургл/Nurglings___Нурглинги_cOAwocv9yqhLhBUE.json", "Bite / Укус", "1d10"],
  ["bestiary/Демоны_Хаоса/Нургл/Rot_Fly___Гнильная_Муха_2a1yZTT9BPu6jEig.json", "Proboscis / Хоботок", "1d10"],
  ["bestiary/Демоны_Хаоса/Нургл/Plague_Toad___Чумная_Жаба_gvE72vKs126kkVfu.json", "Bite / Укус", "2d10+1"],
  ["bestiary/Демоны_Хаоса/Нургл/Plague_Toad___Чумная_Жаба_gvE72vKs126kkVfu.json", "Rotting Horn / Гниющий Рог", "2d10+7"],
  ["bestiary/Демоны_Хаоса/Нургл/Great_Unclean_One___Великий_Нечистый_rcyewJ59CogO7t1N.json", "Fists / Кулаки (×2)", "1d10+4"],
  ["bestiary/Демоны_Хаоса/Нургл/Great_Unclean_One___Великий_Нечистый_rcyewJ59CogO7t1N.json", "Kick / Пинок", "1d10+5"],
  ["bestiary/Демоны_Хаоса/Нургл/Great_Unclean_One___Великий_Нечистый_rcyewJ59CogO7t1N.json", "Bile Sword / Желчный Меч", "2d10+6"],
  ["bestiary/Демоны_Хаоса/Нургл/Herald_of_Nurgle___Герольд_Нургла_dLIvLAa1Rnuwv0Uu.json", "Claws / Когти", "1d10+3"],
  ["bestiary/Демоны_Хаоса/Нургл/Herald_of_Nurgle___Герольд_Нургла_dLIvLAa1Rnuwv0Uu.json", "Bite / Укус", "1d5+3"],
  ["bestiary/Демоны_Хаоса/Нургл/Herald_of_Nurgle___Герольд_Нургла_dLIvLAa1Rnuwv0Uu.json", "Rotting Horn / Гниющий Рог", "2d10+3"],
  ["bestiary/Демоны_Хаоса/Нургл/Herald_of_Nurgle___Герольд_Нургла_dLIvLAa1Rnuwv0Uu.json", "Plague Sword / Чумной Меч", "1d10+4"],
  ["bestiary/Демоны_Хаоса/Нургл/Plaguebearer___Чумонос_xbOpfugnjpitK6yv.json", "Claws / Когти", "1d10+1"],
  ["bestiary/Демоны_Хаоса/Нургл/Plaguebearer___Чумонос_xbOpfugnjpitK6yv.json", "Bite / Укус", "1d5+1"],
  ["bestiary/Демоны_Хаоса/Нургл/Plaguebearer___Чумонос_xbOpfugnjpitK6yv.json", "Rotting Horn / Гниющий Рог", "2d10+1"],
  ["bestiary/Демоны_Хаоса/Нургл/Plaguebearer___Чумонос_xbOpfugnjpitK6yv.json", "Plague Sword / Чумной Меч", "1d10+3"],
  ["bestiary/Демоны_Хаоса/Тзинч/Herald_of_Tzeentch___Герольд_Тзинча_v1SP264vr6sA5A8M.json", "Claws / Когти", "1d10+2"],
  ["bestiary/Демоны_Хаоса/Тзинч/Herald_of_Tzeentch___Герольд_Тзинча_v1SP264vr6sA5A8M.json", "Bite / Укус", "1d10+2"],
  ["bestiary/Демоны_Хаоса/Тзинч/Herald_of_Tzeentch___Герольд_Тзинча_v1SP264vr6sA5A8M.json", "Athame / Атам", "1d5+1"],
  ["bestiary/Демоны_Хаоса/Тзинч/Herald_of_Tzeentch___Герольд_Тзинча_v1SP264vr6sA5A8M.json", "Force Staff / Психосиловой Посох", "1d10+1"],
  ["bestiary/Демоны_Хаоса/Тзинч/Disc_of_Tzeentch___Диск_Тзинча_BoSawYMtDC4dWsE5.json", "Razor Spikes / Бритвенные Шипы", "1d10+1"],
  ["bestiary/Демоны_Хаоса/Тзинч/Brimstone_Horror___Серный_Ужас_miDYVDIZjThxljjg.json", "Bite / Укус", "1d5+1"],
  ["bestiary/Демоны_Хаоса/Тзинч/Pink_Horror___Розовый_Ужас_irMvHXtsVKS7YJzR.json", "Claws / Когти", "1d10+2"],
  ["bestiary/Демоны_Хаоса/Тзинч/Pink_Horror___Розовый_Ужас_irMvHXtsVKS7YJzR.json", "Bite / Укус", "1d10+2"],
  ["bestiary/Демоны_Хаоса/Тзинч/Pink_Horror___Розовый_Ужас_irMvHXtsVKS7YJzR.json", "Athame / Атам", "1d5+1"],
  ["bestiary/Демоны_Хаоса/Тзинч/Lord_of_Change___Повелитель_Перемен_bd3z31GJEBmoCyqj.json", "Claws / Когти (×2)", "1d10+3"],
  ["bestiary/Демоны_Хаоса/Тзинч/Lord_of_Change___Повелитель_Перемен_bd3z31GJEBmoCyqj.json", "Bite / Укус", "2d10+3"],
  ["bestiary/Демоны_Хаоса/Тзинч/Lord_of_Change___Повелитель_Перемен_bd3z31GJEBmoCyqj.json", "Bird Claws / Птичьи Лапы", "1d10+4"],
  ["bestiary/Демоны_Хаоса/Тзинч/Lord_of_Change___Повелитель_Перемен_bd3z31GJEBmoCyqj.json", "Staff of Tzeentch / Посох Тзинча", "2d10+1"],
  ["bestiary/Демоны_Хаоса/Тзинч/Screamer___Крикун_QLid3QzalEQ1ldhp.json", "Spikes / Шипы", "1d10+2"],
  ["bestiary/Демоны_Хаоса/Тзинч/Screamer___Крикун_QLid3QzalEQ1ldhp.json", "Warp-Maw / Варп-Пасть", "2d10+5"],
  ["bestiary/Демоны_Хаоса/Кхорн/Bloodthirster___Кровожад_j1Cndu2qjp1K0obt.json", "Claws / Когти (×2)", "1d10+7"],
  ["bestiary/Демоны_Хаоса/Кхорн/Bloodthirster___Кровожад_j1Cndu2qjp1K0obt.json", "Bite / Укус", "2d10+4"],
  ["bestiary/Демоны_Хаоса/Кхорн/Bloodthirster___Кровожад_j1Cndu2qjp1K0obt.json", "Horns / Рога", "3d10+7"],
  ["bestiary/Демоны_Хаоса/Кхорн/Bloodthirster___Кровожад_j1Cndu2qjp1K0obt.json", "Hooves / Копыта", "1d10+8"],
  ["bestiary/Демоны_Хаоса/Кхорн/Bloodthirster___Кровожад_j1Cndu2qjp1K0obt.json", "Wings / Крылья (×2)", "1d10+5"],
  ["bestiary/Демоны_Хаоса/Кхорн/Bloodthirster___Кровожад_j1Cndu2qjp1K0obt.json", "Axe of Khorne / Топор Кхорна", "3d10+8"],
  ["bestiary/Демоны_Хаоса/Кхорн/Bloodthirster___Кровожад_j1Cndu2qjp1K0obt.json", "Whip of Khorne / Плеть Кхорна", "1d10+5"],
  ["bestiary/Демоны_Хаоса/Кхорн/Flesh_Hound___Гончая_Плоти_3DeWr1tzf04OrQ5d.json", "Claws / Когти", "1d10+4"],
  ["bestiary/Демоны_Хаоса/Кхорн/Flesh_Hound___Гончая_Плоти_3DeWr1tzf04OrQ5d.json", "Bite / Укус", "1d10+4"],
  ["bestiary/Демоны_Хаоса/Кхорн/Flesh_Hound___Гончая_Плоти_3DeWr1tzf04OrQ5d.json", "Tail / Хвост", "1d10"],
  ["bestiary/Демоны_Хаоса/Кхорн/Herald_of_Khorne___Герольд_Кхорна_fgby2TYIKPuGUfqh.json", "Claws / Когти", "1d10+8"],
  ["bestiary/Демоны_Хаоса/Кхорн/Herald_of_Khorne___Герольд_Кхорна_fgby2TYIKPuGUfqh.json", "Kick / Пинок", "1d10+4"],
  ["bestiary/Демоны_Хаоса/Кхорн/Herald_of_Khorne___Герольд_Кхорна_fgby2TYIKPuGUfqh.json", "Bite / Укус", "1d10+8"],
  ["bestiary/Демоны_Хаоса/Кхорн/Herald_of_Khorne___Герольд_Кхорна_fgby2TYIKPuGUfqh.json", "Horns / Рога", "2d10+8"],
  ["bestiary/Демоны_Хаоса/Кхорн/Herald_of_Khorne___Герольд_Кхорна_fgby2TYIKPuGUfqh.json", "Hell Blade / Адский Клинок", "1d10+9"],
  ["bestiary/Демоны_Хаоса/Кхорн/Juggernaut___Джаггернаут_jcbnJn8KhVboxptb.json", "Bite / Укус", "1d10"],
  ["bestiary/Демоны_Хаоса/Кхорн/Juggernaut___Джаггернаут_jcbnJn8KhVboxptb.json", "Hooves / Копыта", "1d10"],
  ["bestiary/Демоны_Хаоса/Неделимый/Kathart___Катарт_KqYWz0gwzz6HMhOy.json", "Claws / Когти (×2)", "1d10+1"],
  ["bestiary/Демоны_Хаоса/Неделимый/Kathart___Катарт_KqYWz0gwzz6HMhOy.json", "Bite / Укус", "1d5+1"],
  ["bestiary/Демоны_Хаоса/Неделимый/Kathart___Катарт_KqYWz0gwzz6HMhOy.json", "Sword / Меч (×2)", "1d10+3"],
  ["bestiary/Демоны_Хаоса/Неделимый/Ghost___Призрак_C9VPD8S9Q5croh3J.json", "Claws / Когти", "1d5+2"],
  ["bestiary/Демоны_Хаоса/Неделимый/Ghost___Призрак_C9VPD8S9Q5croh3J.json", "Bite / Укус", "1d5+2"],
  ["bestiary/Демоны_Хаоса/Неделимый/Fury___Фурия_xGoZAJllemLC6z1Z.json", "Claws / Когти", "1d10+1"],
  ["bestiary/Демоны_Хаоса/Неделимый/Fury___Фурия_xGoZAJllemLC6z1Z.json", "Bite / Укус", "1d10+1"],
  ["bestiary/Демоны_Хаоса/Неделимый/Herald_of_Pantheon___Герольд_Пантеона_7AOK4HjycSOeLqua.json", "Claws / Когти (×4)", "1d10+3"],
  ["bestiary/Демоны_Хаоса/Неделимый/Herald_of_Pantheon___Герольд_Пантеона_7AOK4HjycSOeLqua.json", "Bite / Укус", "1d5+2"],
  ["bestiary/Демоны_Хаоса/Неделимый/Herald_of_Pantheon___Герольд_Пантеона_7AOK4HjycSOeLqua.json", "Sword / Меч (×4)", "1d10+4"],
  ["bestiary/Демоны_Хаоса/Неделимый/Phantom___Фантом_0jnCKB7qN7kcflqa.json", "Spectral Claws / Спектральные Когти", "1d10+1"],
  ["bestiary/Демоны_Хаоса/Слаанеш/Keeper_of_Secrets___Хранитель_Секретов_BgwRB2LlKpRaW8np.json", "Pincer Claws / Клешни (×2)", "2d10+1"],
  ["bestiary/Демоны_Хаоса/Слаанеш/Keeper_of_Secrets___Хранитель_Секретов_BgwRB2LlKpRaW8np.json", "Claws / Когти (×2)", "1d10+1"],
  ["bestiary/Демоны_Хаоса/Слаанеш/Keeper_of_Secrets___Хранитель_Секретов_BgwRB2LlKpRaW8np.json", "Hooves / Копыта", "1d10+2"],
  ["bestiary/Демоны_Хаоса/Слаанеш/Keeper_of_Secrets___Хранитель_Секретов_BgwRB2LlKpRaW8np.json", "Longsword / Длинный Меч", "2d10+7"],
  ["bestiary/Демоны_Хаоса/Слаанеш/Steed_of_Slaanesh___Скакун_Слаанеш_cR3iocuPp8rd20Ai.json", "Claws / Когти", "1d10+2"],
  ["bestiary/Демоны_Хаоса/Слаанеш/Steed_of_Slaanesh___Скакун_Слаанеш_cR3iocuPp8rd20Ai.json", "Tail / Хвост", "1d10+2"],
  ["bestiary/Демоны_Хаоса/Слаанеш/Steed_of_Slaanesh___Скакун_Слаанеш_cR3iocuPp8rd20Ai.json", "Lashing Tongue / Хлещущий Язык", "1d5+2"],
  ["bestiary/Демоны_Хаоса/Слаанеш/Herald_of_Slaanesh___Герольд_Слаанеш_KcmpC0hggnCO0ASS.json", "Pincer Claws / Клешни (×2)", "1d10+3"],
  ["bestiary/Демоны_Хаоса/Слаанеш/Herald_of_Slaanesh___Герольд_Слаанеш_KcmpC0hggnCO0ASS.json", "Piercing Blades / Пронзающие Клинки (×2)", "1d10+5"],
  ["bestiary/Демоны_Хаоса/Слаанеш/Herald_of_Slaanesh___Герольд_Слаанеш_KcmpC0hggnCO0ASS.json", "Kick / Пинок", "1d10+2"],
  ["bestiary/Демоны_Хаоса/Слаанеш/Fiend_of_Slaanesh___Изверг_Слаанеш_onMBPgc7evPY5y42.json", "Pincer Claws / Клешни (×2)", "1d10+3"],
  ["bestiary/Демоны_Хаоса/Слаанеш/Fiend_of_Slaanesh___Изверг_Слаанеш_onMBPgc7evPY5y42.json", "Tail-Stinger / Хвост-Жало", "1d10+2"],
  ["bestiary/Демоны_Хаоса/Слаанеш/Fiend_of_Slaanesh___Изверг_Слаанеш_onMBPgc7evPY5y42.json", "Lashing Tongue / Хлещущий Язык", "1d5+2"],
  ["bestiary/Демоны_Хаоса/Слаанеш/Daemonette___Демонетка_Jx6orGZGIj1iSLb1.json", "Pincer Claws / Клешни (×2)", "1d10+1"],
  ["bestiary/Демоны_Хаоса/Слаанеш/Daemonette___Демонетка_Jx6orGZGIj1iSLb1.json", "Piercing Blades / Пронзающие Клинки (×2)", "1d10+3"],
  ["bestiary/Демоны_Хаоса/Слаанеш/Daemonette___Демонетка_Jx6orGZGIj1iSLb1.json", "Kick / Пинок", "1d10"]
];

/**
 * Обоснованные исключения из общей эвристики ниже (часть 2), встреченные
 * при аудите wdbc-jh8no, для которых объяснение «снаряжение»/«contained» не
 * подходит — пусто на 25.09.2026 (весь тогдашний список закрылся общими
 * правилами). Новую строку сюда добавлять только с книжной цитатой рядом.
 */
const KNOWN_EXCEPTIONS = new Set([
  // "Существо / Оружие" — формат ключа.
]);

describe("рукопашное оружие бестиария не дублирует S.b владельца (wdbc-jh8no)", () => {
  it("исправленные пары существо/оружие не вернулись к прежнему книжному итогу", () => {
    let checked = 0;
    for (const [file, weapon, fixedDamage] of FIXED_MELEE_WEAPONS) {
      const { doc } = allPackDocuments("bestiary").find(d => d.file === file) ?? {};
      expect(doc, `${file}: файл не найден среди актёров bestiary`).toBeTruthy();
      const item = doc.items.find(it => it.name === weapon && it.type === "weapon");
      expect(item, `${file}: оружие «${weapon}» не найдено`).toBeTruthy();

      const sbTotal = sbTotalFor(doc);
      const cur = parseDamage(item.system.damage);
      const fixed = parseDamage(fixedDamage);
      expect(cur, `${file} | ${weapon}: не разобрана текущая формула «${item.system.damage}»`).toBeTruthy();

      // Не требуем точного совпадения (правка урона по другой причине не
      // обязана держать именно эту цифру) — только что не вернулись к
      // ПРЕЖНЕМУ книжному итогу: тот всегда >= fixed.flat + sbTotal.
      const bakedAgainThreshold = fixed.flat + sbTotal;
      expect(cur.flat, `${file} | ${weapon}: похоже, S.b (${sbTotal}) снова зашит в урон (${item.system.damage})`).toBeLessThan(bakedAgainThreshold);
      checked++;
    }
    expect(checked).toBe(FIXED_MELEE_WEAPONS.length);
  }, PACK_SCAN_TIMEOUT);

  it("нет новых рукопашных оружий с плоским бонусом >= 2×S.b владельца", () => {
    // Уже проверенные записи (тест выше) исключаются: их окончательное
    // значение — маленький неотъемлемый бонус самого оружия — может
    // случайно попасть под общий порог "2×S.b" у существ с маленьким S.b
    // (Ghost/Призрак: S.b 1, "1d5+2" — оба Claws и Bite, книга подтверждает
    // именно эту цифру), и это не повод их снова урезать.
    const alreadyFixed = new Set(FIXED_MELEE_WEAPONS.map(([file, weapon]) => `${file}\u0000${weapon}`));
    // Индекс стандартного снаряжения: имя (любая половина "En/Ru", в нижнем
    // регистре) -> список плоских бонусов урона встреченных предметов.
    const equipIndex = new Map();
    for (const { doc } of allPackDocuments("weapons")) {
      const dmg = parseDamage(doc.system?.damage);
      if (!dmg || !doc.name) continue;
      for (const part of doc.name.split("/")) {
        const key = part.trim().toLowerCase();
        if (!key) continue;
        if (!equipIndex.has(key)) equipIndex.set(key, []);
        equipIndex.get(key).push(dmg.flat);
      }
    }

    const bad = [];
    let creatures = 0;
    let meleeWeapons = 0;
    for (const { file, doc } of allPackDocuments("bestiary")) {
      if (!doc.type || doc.type === "base" || !Array.isArray(doc.items)) continue;
      creatures++;
      const sbTotal = sbTotalFor(doc);
      if (sbTotal <= 0) continue;
      const pr = Number(doc.system?.psyker?.currentRating) || 0;
      const isPsyker = !!doc.system?.isPsyker;

      for (const it of doc.items) {
        if (it.type !== "weapon" || it.system?.weaponClass !== "melee") continue;
        meleeWeapons++;
        if (alreadyFixed.has(`${file}\u0000${it.name}`)) continue;
        const dmg = parseDamage(it.system?.damage);
        if (!dmg) continue;

        const hasContained = (it.system?.weaponProps ?? []).some(p => p.key === "contained");
        if (hasContained) continue; // не получает S.b вообще — совпадение безопасно

        const hasForce = (it.system?.weaponProps ?? []).some(p => p.key === "force");
        const forceBonus = (hasForce && isPsyker) ? Math.min(pr, 10) : 0;
        const bakedTotal = sbTotal + forceBonus;
        if (dmg.flat < bakedTotal * 2) continue; // ниже удвоенного порога — не похоже на двойной счёт

        let equipFlats = [];
        for (const part of it.name.split("/")) {
          const key = part.trim().toLowerCase();
          if (equipIndex.has(key)) equipFlats = equipFlats.concat(equipIndex.get(key));
        }
        if (equipFlats.includes(dmg.flat)) continue; // совпадает с базовым уроном предмета-снаряжения

        const label = `${doc.name} / ${it.name}`;
        if (KNOWN_EXCEPTIONS.has(label)) continue;

        bad.push(`${file} | ${doc.name} | ${it.name} | damage:${it.system.damage} (flat ${dmg.flat}) >= 2×S.b_итог ${bakedTotal * 2} (S.b ${sbTotal}${forceBonus ? `+PR ${forceBonus}` : ""})`);
      }
    }

    // Сторож не пустой: проверка реально проходит по существам и оружию.
    expect(creatures).toBeGreaterThan(50);
    expect(meleeWeapons).toBeGreaterThan(100);
    expect(bad).toEqual([]);
  }, PACK_SCAN_TIMEOUT);
});
