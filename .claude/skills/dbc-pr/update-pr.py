# .claude/skills/dbc-pr/update-pr.py
# ════════════════════════════════════════════════════════════════════════
#  Обновление описания пул-реквеста без gh CLI.
#
#  Токен берётся у Git Credential Manager — того же, которым ходит push,
#  поэтому отдельный секрет заводить не нужно и в командную строку он не
#  попадает. Репозиторий читается из origin, номер PR — по текущей ветке.
#
#  Раздел находится по своему заголовку и ЗАМЕНЯЕТСЯ, а не дублируется:
#  повторный запуск после новой порции работы обновляет тот же блок.
#
#  Использование:
#    python .claude/skills/dbc-pr/update-pr.py --title "Книга «Машины»" --file раздел.md
#    python .claude/skills/dbc-pr/update-pr.py --title "…" --file -        # текст со stdin
#    python .claude/skills/dbc-pr/update-pr.py --show                      # показать описание
#  Необязательное: --pr 30, --repo Batonrain/warhammer-dbc, --branch Derbius
# ════════════════════════════════════════════════════════════════════════
import argparse, glob, json, os, re, subprocess, sys, urllib.error, urllib.request

API = "https://api.github.com"


def git_exe():
    """git из PATH, иначе — тот, что приходит с GUI-клиентом Fork."""
    try:
        subprocess.run(["git", "--version"], capture_output=True, check=True)
        return "git"
    except (OSError, subprocess.CalledProcessError):
        pass
    pattern = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Fork", "gitInstance", "*", "cmd", "git.exe")
    found = sorted(glob.glob(pattern))
    if not found:
        sys.exit("git не найден ни в PATH, ни в установке Fork")
    return found[-1]


GIT = git_exe()


def git(*args):
    r = subprocess.run([GIT, *args], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout.strip()


def token():
    """PAT из Git Credential Manager: тот же, которым ходит push."""
    out = subprocess.run([GIT, "credential", "fill"],
                         input="protocol=https\nhost=github.com\n\n",
                         capture_output=True, text=True).stdout
    pairs = dict(line.split("=", 1) for line in out.splitlines() if "=" in line)
    if "password" not in pairs:
        sys.exit("Git Credential Manager не отдал токен — залогиньтесь через push или Fork")
    return pairs["password"]


def api(path, tok, data=None, method="GET"):
    req = urllib.request.Request(
        API + path,
        data=json.dumps(data).encode() if data else None,
        method=method,
        headers={"Authorization": f"token {tok}",
                 "Accept": "application/vnd.github+json",
                 "User-Agent": "dbc-pr-skill",
                 "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"GitHub API {e.code}: {e.read().decode(errors='replace')[:300]}")


def repo_slug():
    url = git("remote", "get-url", "origin")
    m = re.search(r"github\.com[:/](.+?)(?:\.git)?$", url)
    if not m:
        sys.exit(f"origin не похож на GitHub: {url}")
    return m.group(1)


def find_pr(repo, branch, tok):
    owner = repo.split("/")[0]
    prs = api(f"/repos/{repo}/pulls?state=open&head={owner}:{branch}", tok)
    if not prs:
        sys.exit(f"нет открытого PR для ветки {branch}")
    return prs[0]["number"]


def replace_section(body, title, text):
    """Свой раздел заменяется целиком; чужой текст описания не трогается."""
    heading = f"## {title}"
    block = f"{heading}\n\n{text.strip()}\n"
    if heading in body:
        # до следующего заголовка того же уровня или до конца
        pattern = re.compile(rf"^{re.escape(heading)}\s*$.*?(?=^## |\Z)", re.M | re.S)
        return pattern.sub(block, body, count=1).rstrip() + "\n"
    return (body.rstrip() + "\n\n" + block) if body.strip() else block


def main():
    ap = argparse.ArgumentParser(description="Обновить описание пул-реквеста")
    ap.add_argument("--title", help="заголовок раздела в описании PR")
    ap.add_argument("--file", help="файл с текстом раздела ('-' — читать stdin)")
    ap.add_argument("--pr", type=int, help="номер PR (по умолчанию — открытый PR текущей ветки)")
    ap.add_argument("--repo", help="owner/repo (по умолчанию — из origin)")
    ap.add_argument("--branch", help="ветка (по умолчанию — текущая)")
    ap.add_argument("--show", action="store_true", help="показать описание и выйти")
    # Заголовок самого PR — не то же, что заголовок раздела в описании. Нужен
    # редко, но нужен: долгоживущий PR обрастает темами, и имя, данное ему в
    # первый день, к десятой теме врёт.
    ap.add_argument("--pr-title", help="новый заголовок самого пул-реквеста")
    a = ap.parse_args()

    tok = token()
    repo = a.repo or repo_slug()
    branch = a.branch or git("rev-parse", "--abbrev-ref", "HEAD")
    number = a.pr or find_pr(repo, branch, tok)

    pr = api(f"/repos/{repo}/pulls/{number}", tok)
    body = pr.get("body") or ""

    if a.show:
        print(f"PR #{number} «{pr['title']}» — {pr['html_url']}\n")
        print(body)
        return

    # Заголовок правится отдельным запросом и сам по себе: менять его вместе с
    # разделом необязательно, а вот переименовать PR, ничего не дописывая, —
    # обычное дело.
    if a.pr_title and a.pr_title != pr.get("title"):
        res = api(f"/repos/{repo}/pulls/{number}", tok, {"title": a.pr_title}, "PATCH")
        print(f"заголовок PR #{number}: «{res['title']}»")
    elif a.pr_title:
        print("заголовок уже такой — запрос не отправлялся")

    if not (a.title or a.file):
        if a.pr_title:
            return
        sys.exit("нужны --title и --file (или --show, или --pr-title)")

    if not (a.title and a.file):
        sys.exit("нужны --title и --file (или --show)")

    text = sys.stdin.read() if a.file == "-" else open(a.file, encoding="utf-8").read()
    new_body = replace_section(body, a.title, text)
    if new_body == body:
        print("описание уже совпадает — запрос не отправлялся")
        return

    res = api(f"/repos/{repo}/pulls/{number}", tok, {"body": new_body}, "PATCH")
    action = "обновлён" if f"## {a.title}" in body else "добавлен"
    print(f"раздел «{a.title}» {action}; PR #{number}: {res['html_url']}")


if __name__ == "__main__":
    main()
