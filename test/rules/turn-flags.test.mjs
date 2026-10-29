// test/rules/turn-flags.test.mjs
//
// wdbc-5uae.1: срок жизни метки «до начала следующего своего Хода» переехал из
// перечисления по имени в combat/action-economy.mjs в реестр данных.
//
// Второй тест здесь — сторож, и он важнее первых: он падает, если кто-нибудь
// снова впишет флаг прямо в сброс, минуя реестр. Без него правка развалилась бы
// обратно первым же новым флагом, и ровно так и было бы, потому что дописать
// одну строку в сброс дешевле, чем найти реестр.

import { COUNTENANCE_FLAG } from "../../module/rules/countenance-of-gods.mjs";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { turnStartFlagClears, TURN_SCOPED_FLAGS, TURN_SCOPED_FLAG_KEYS }
  from "../../module/rules/turn-flags.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Актор с поднятыми флагами — и в виде документа, и в виде сырых данных. */
function actorWithFlags(keys = []) {
  const flags = Object.fromEntries(keys.map(k => [k, true]));
  return {
    flags: { "warhammer-dbc": flags },
    getFlag: (_ns, key) => flags[key]
  };
}

describe("turnStartFlagClears: гашение флагов такта (wdbc-5uae.1)", () => {
  it("нечего гасить — пустой патч, лишнего update не будет", () => {
    expect(turnStartFlagClears(actorWithFlags())).toEqual({});
  });

  it("поднятый флаг гасится штатным «-=», а не записью false", () => {
    // false оставило бы в данных мусор, неотличимый от «никогда не ставили».
    expect(turnStartFlagClears(actorWithFlags(["running"])))
      .toEqual({ "flags.warhammer-dbc.-=running": null });
  });

  it("несколько флагов разом — один патч на все", () => {
    const upd = turnStartFlagClears(actorWithFlags(["running", "exposedAggressive", "recoilPool"]));
    expect(Object.keys(upd).sort()).toEqual([
      "flags.warhammer-dbc.-=exposedAggressive",
      "flags.warhammer-dbc.-=recoilPool",
      "flags.warhammer-dbc.-=running"
    ]);
  });

  it("каждый флаг реестра действительно гасится", () => {
    const upd = turnStartFlagClears(actorWithFlags(TURN_SCOPED_FLAG_KEYS));
    expect(Object.keys(upd).length).toBe(TURN_SCOPED_FLAG_KEYS.length);
  });

  it("чужой флаг актора не трогается — реестр закрытый", () => {
    expect(turnStartFlagClears(actorWithFlags(["marchKind", "disengageActive"]))).toEqual({});
  });

  it("у каждой записи реестра есть объяснение, зачем она здесь", () => {
    for (const [key, why] of Object.entries(TURN_SCOPED_FLAGS)) {
      expect(String(why).trim(), key).not.toBe("");
    }
  });
});

describe("сторож: сброс Хода не гасит флаги по имени в обход реестра", () => {
  it("в resetActionEconomy не осталось построчных «flags.warhammer-dbc.-=»", () => {
    const src = fs.readFileSync(path.join(ROOT, "module/combat/action-economy.mjs"), "utf8");
    const reset = src.slice(src.indexOf("export async function resetActionEconomy"));
    const body  = reset.slice(0, reset.indexOf("\n}\n"));
    const inline = body.split(/\r?\n/)
      .map((line, i) => [line, i + 1])
      .filter(([line]) => /upd\[["'`]flags\.warhammer-dbc\.-=/.test(line))
      .map(([line, n]) => `${n}: ${line.trim()}`);
    expect(inline, [
      "Флаг такта вписан прямо в сброс, мимо реестра rules/turn-flags.mjs.",
      "Так срок жизни метки снова оказывается не при метке, а списком в чужом",
      "файле — и следующую забудут туда дописать. Добавьте строку в",
      "TURN_SCOPED_FLAGS, гашение подхватится само."
    ].join("\n")).toEqual([]);
  });
});

// Сторож связи «реестр ↔ код» по образцу test/combat/card-once.test.mjs.
// Раньше каждая метка Хода проверялась отдельным `toContain` в своём файле
// (дюжина копий); здесь — все разом. Ловятся три поломки, каждая молчаливая:
// метка в коде переименована, а реестр гасит старое имя (метка висит вечно);
// строку реестра удалили; новую метку «…ThisTurn» завели, а в реестр не вписали.
describe("сторож: метки Хода в коде и в реестре сходятся", () => {
  const CODE = fs.readdirSync(path.join(ROOT, "module"), { recursive: true })
    .filter(f => String(f).endsWith(".mjs") && !String(f).endsWith("turn-flags.mjs"))
    .map(f => fs.readFileSync(path.join(ROOT, "module", f), "utf8"))
    .join("\n");

  /** Метки «…ThisTurn», которые снимает свой код, а не общий сброс, — и почему. */
  const OWN_CLEAR = {
    attackedThisTurn: "перекладывается в attackedPrevTurn (rules/turn-flags.mjs::turnStartAttackCarryOver), а не гасится",
    bladeJugglerUsedThisTurn: "гасит rules/rogue-talents.mjs::clearBladeJuggler в начале Хода носителя",
    blindsideUsedThisTurn: "гасит rules/unseen-talents.mjs::clearBlindsideUse в начале Хода носителя"
  };

  it("каждую метку реестра код где-то называет — имя не разошлось", () => {
    // Литерал в кавычках: значение константы, setFlag(NS, "…") или путь «flags.warhammer-dbc.…».
    const orphans = TURN_SCOPED_FLAG_KEYS.filter(k => !new RegExp(`["'\`.]${k}["'\`]`).test(CODE));
    expect(orphans, "реестр гасит метку, которую код больше так не зовёт — переименуйте строку реестра").toEqual([]);
  });

  it("реестр не сжимается молча: не меньше 59 строк", () => {
    // Удалённая строка — метка, которая больше не гаснет. Порог снижается
    // только вместе с объяснением, куда делась метка.
    expect(TURN_SCOPED_FLAG_KEYS.length).toBeGreaterThanOrEqual(59);
  });

  it("каждая метка «…ThisTurn» в коде есть в реестре, кроме снимаемых своим кодом", () => {
    const named = new Set([...CODE.matchAll(/["'`]([a-z]\w*ThisTurn)["'`]/g)].map(m => m[1]));
    expect(named.size).toBeGreaterThan(10);
    const missing = [...named].filter(k => !TURN_SCOPED_FLAG_KEYS.includes(k) && !Object.hasOwn(OWN_CLEAR, k));
    expect(missing, "метка «этого Хода» не гаснет в начале следующего — впишите её в TURN_SCOPED_FLAGS").toEqual([]);
  });

  it("метки без суффикса «ThisTurn» — в реестре", () => {
    // Сторож суффикса выше их не видит; раньше каждую стерёг свой файл.
    const NON_SUFFIX = ["bladeBindingOwner", COUNTENANCE_FLAG, "fastWeavingAp", "firedBracedHeavy",
      "meleeDamageAppliedMsg", "pinDownHold", "rageExitTried", "reaperInitialTarget", "warpLockActive"];
    expect(TURN_SCOPED_FLAG_KEYS).toEqual(expect.arrayContaining(NON_SUFFIX));
  });

  it("исключение OWN_CLEAR не устарело", () => {
    const stale = Object.keys(OWN_CLEAR).filter(k => TURN_SCOPED_FLAG_KEYS.includes(k) || !CODE.includes(`"${k}"`));
    expect(stale).toEqual([]);
  });
});

// wdbc-4umq (4): «Лик <Бога>» — рейтинг Страха 3 «до начала своего следующего
// Хода» (книга), а метка не снималась никогда.
describe("Лик Бога: метка Страха гаснет в начале следующего своего Хода", () => {
  it("countenanceOfGods — в реестре и гасится сбросом", () => {
    const upd = turnStartFlagClears(actorWithFlags([COUNTENANCE_FLAG]));
    expect(Object.keys(upd)).toEqual([`flags.warhammer-dbc.-=${COUNTENANCE_FLAG}`]);
  });
});
