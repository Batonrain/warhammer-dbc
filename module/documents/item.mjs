import { factionKeyFromName, getFactionIndex } from "../rules/factions.mjs";
import { legionUpgrade } from "../rules/legion-upgrade.mjs";

const NS = "warhammer-dbc";
/** Во флаге лежит профиль ДО переделки под Легион — по нему же идёт откат. */
const LEGION_FLAG = "legionUpgrade";

const hasLegion = list => (list || []).some(p => (typeof p === "string" ? p : p?.key) === "legion");

export class WarhammerItem extends Item {
  prepareData() { super.prepareData(); }

  /**
   * Ключ Фракции выдаётся при создании и дальше не меняется.
   *
   * Руками его не пишут: на ключ ссылаются `parentKey` других Фракций и цели
   * Талантов, и правка ключа втихую разрывает эти ссылки. Поэтому поле на
   * листе только показывает результат, а заполняется он здесь — на любом пути
   * создания, включая импорт и создание прямо в компендиуме.
   *
   * Уже заданный ключ не трогаем: у копии и у импорта он свой и осмысленный.
   */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    if (this.type !== "faction" || String(this.system?.key ?? "").trim()) return;
    this.updateSource({
      "system.key": factionKeyFromName(this.name, getFactionIndex().keys())
    });
  }

  /**
   * Свойство Legion переделывает и сам профиль оружия: Легион-вариант тяжелее,
   * реже и бьёт сильнее (rules/legion-upgrade.mjs). Правка одноразовая, поэтому
   * прежние значения кладём во флаг: снял свойство — профиль вернулся, а
   * повторное добавление не удвоит прибавки.
   *
   * Оружие, что идёт с Legion из книги, ничего не пересчитывает: его профиль
   * уже легионный, а сюда мы попадаем только на СМЕНЕ свойства.
   */
  async _preUpdate(changed, options, user) {
    const allowed = await super._preUpdate(changed, options, user);
    if (allowed === false) return false;
    if (this.type !== "weapon") return;

    const nextProps = changed.system?.weaponProps;
    if (!nextProps) return;
    const was = hasLegion(this.system.weaponProps);
    const now = hasLegion(nextProps);
    if (was === now) return;

    const saved = this.getFlag(NS, LEGION_FLAG);
    changed.system ??= {};

    // Свойство сняли — возвращаем сохранённый профиль.
    if (!now) {
      if (!saved) return;
      Object.assign(changed.system, saved.before);
      changed.flags = foundry.utils.mergeObject(changed.flags ?? {},
        { [NS]: { [`-=${LEGION_FLAG}`]: null } });
      return;
    }

    if (saved) return;                       // уже переделано — второй раз не считаем
    const upgrade = legionUpgrade({ ...this.system, weaponProps: nextProps });
    if (!upgrade) return;                    // для этого рода оружия варианта нет

    const before = Object.fromEntries(
      Object.keys(upgrade.changes).map(key => [key, this.system[key]]));
    if (upgrade.note) {
      before.special = this.system.special ?? "";
      changed.system.special = [this.system.special, upgrade.note].filter(Boolean).join(" ");
    }
    Object.assign(changed.system, upgrade.changes);
    changed.flags = foundry.utils.mergeObject(changed.flags ?? {},
      { [NS]: { [LEGION_FLAG]: { before } } });
  }
}
