# tools/art-link.py
# ════════════════════════════════════════════════════════════════════════
#  Привязка извлечённых артов книги к документам паков: арт становится
#  аватаркой (img) актора или предмета с тем же названием.
#
#  Файлы артов названы по закладкам PDF (см. tools/pdf-art.py), поэтому имя
#  документа достаточно транслитерировать и сравнить. Сначала ищется точное
#  совпадение, затем — совпадение без служебных слов («Шасси», «Кузница»)
#  и по английской половине названия «Рус. / Eng».
#
#  Использование:
#    python tools/art-link.py <папка-пака> <slug-артов> [--dry] [--token]
# ════════════════════════════════════════════════════════════════════════
import sys, os, re, json, glob

TRANSLIT = {c: l for c, l in zip("абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
    ["a","b","v","g","d","e","e","zh","z","i","y","k","l","m","n","o","p","r","s","t",
     "u","f","h","c","ch","sh","sch","","y","","e","yu","ya"])}


def translit(s):
    out = []
    for ch in s.lower():
        out.append(TRANSLIT.get(ch, ch if ch.isalnum() else "-"))
    return re.sub(r"-+", "-", "".join(out)).strip("-")


def keys(name):
    """Ключи поиска для названия документа, от точного к более общему."""
    out = []
    parts = [p.strip() for p in name.split("/")]
    for p in parts + [name]:
        p = re.sub(r"^(Шасси|Кузница)\s+", "", p.strip())
        k = translit(p)
        if k and k not in out:
            out.append(k)
    return out


pack, slug = sys.argv[1], sys.argv[2]
opts = {a[2:] for a in sys.argv if a.startswith("--")}
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
artdir = os.path.join(root, "assets", "art", slug)
arts = {os.path.splitext(os.path.basename(f))[0]: os.path.basename(f)
        for f in glob.glob(os.path.join(artdir, "*.webp"))}

hit = miss = 0
for f in sorted(glob.glob(os.path.join(pack, "**", "*.json"), recursive=True)):
    if os.path.basename(f) == "_Folder.json":
        continue
    doc = json.load(open(f, encoding="utf-8"))
    name = doc.get("name")
    if not name:
        continue
    ks = keys(name)
    found = next((arts[k] for k in ks if k in arts), None)
    if not found:
        # «Онагр Дюнокрав» -> onagr.webp, «СТэГ» -> steg-4.webp: имя файла и ключ
        # совпадают началом — этого хватает, пока начало достаточно длинное
        for k in ks:
            if len(k) < 5:
                continue
            near = [a for n, a in arts.items() if n.startswith(k) or k.startswith(n) and len(n) >= 5]
            if len(near) == 1:
                found = near[0]
                break
    if not found:
        miss += 1
        print(f"  — без арта: {name}")
        continue
    path = f"systems/warhammer-dbc/assets/art/{slug}/{found}"
    hit += 1
    print(f"  + {name}  ->  {found}")
    if "dry" in opts:
        continue
    doc["img"] = path
    if "token" in opts:
        doc.setdefault("prototypeToken", {}).setdefault("texture", {})["src"] = path
    with open(f, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

print(f"\nнайден арт: {hit}, без арта: {miss}" + ("  (черновой прогон)" if "dry" in opts else ""))
