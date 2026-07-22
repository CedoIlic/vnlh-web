# Naputak: spremanje VNLH repozitorija na GitHub

Cilj: dodati GitHub kao (privatnu) kopiju repozitorija, uz postojeći lokalni backup `arhiva`.

## 0. Trenutno stanje (kontekst)

- Lokalni repo: `d:\vnlh-web`, radna grana **`master`**
- Postojeći remote: **`arhiva`** → lokalni bare backup `E:\00-vnlh-web-backup\git\vnlh-web.git`
- Lozinka baze je u `php/vnlh_db_connect.php` koji je **gitignoran** → **NE šalje se** na GitHub ✅

Sve naredbe pokreni u **Git Bash** iz `d:\vnlh-web`.

---

## 1. Preduvjeti

- GitHub račun (besplatan; privatni repo je besplatan i dovoljan)
- Git (već instaliran)

## 2. Kreiraj prazan repo na GitHubu

1. GitHub → **New repository**
2. Ime: `vnlh-web` (ili po želji)
3. **Private** (preporuka)
4. **Ne** dodavaj README / .gitignore / licencu (da izbjegneš konflikt pri prvom pushu)
5. **Create repository**

Zapamti URL koji ti GitHub ponudi (SSH: `git@github.com:KORISNIK/vnlh-web.git` ili HTTPS: `https://github.com/KORISNIK/vnlh-web.git`).

## 3. Autentikacija — odaberi JEDNO

### A) SSH ključ (preporuka — već koristiš SSH za produkciju)

```bash
# provjeri imaš li ključ; ako nemaš, generiraj:
ls ~/.ssh/id_ed25519.pub 2>/dev/null || ssh-keygen -t ed25519 -C "cilic@digital.hr"
# ispiši javni ključ i zalijepi ga na GitHub → Settings → SSH and GPG keys → New SSH key:
cat ~/.ssh/id_ed25519.pub
# test veze:
ssh -T git@github.com
```
Remote URL koristiš u SSH obliku: `git@github.com:KORISNIK/vnlh-web.git`

### B) HTTPS + Personal Access Token (PAT)

1. GitHub → Settings → Developer settings → **Personal access tokens** → *Fine-grained* → daj pristup repou `vnlh-web` (Contents: Read/Write).
2. Git for Windows dolazi s **Git Credential Manager** koji token spremi na prvi push (pita te za korisnika/token).
3. Remote URL u HTTPS obliku: `https://github.com/KORISNIK/vnlh-web.git`

---

## 4. Dodaj GitHub remote — odaberi strategiju

### Opcija 1 (jednostavnija): zaseban remote `github`

```bash
git remote add github git@github.com:KORISNIK/vnlh-web.git
git push -u github master
```
Ubuduće na GitHub šalješ eksplicitno: `git push github master` (a na lokalnu arhivu i dalje `git push arhiva`).

### Opcija 2: da `git push arhiva` šalje na OBOJE (lokalna arhiva + GitHub)

Postojeći remote `arhiva` dobiva dva **push** URL-a. Bitno: kad dodaš prvi push-URL, implicitni (fetch) push se gubi, pa moraš dodati OBA:

```bash
git remote set-url --add --push arhiva "E:/00-vnlh-web-backup/git/vnlh-web.git"
git remote set-url --add --push arhiva "git@github.com:KORISNIK/vnlh-web.git"
git remote -v          # pod (push) moraju biti OBA URL-a
git push arhiva master # ide na lokalnu arhivu I na GitHub
```
Time se tvoj postojeći „git" tok (push na `arhiva`) automatski slije i na GitHub.

---

## 5. Grana `master` vs `main`

GitHub-ova zadana grana je `main`, tvoja lokalna je `master`. Push `master`-a radi normalno — GitHub će samo prikazati granu `master`. Ako želiš `main`:

```bash
git branch -m master main
git push -u github main     # ili: git push arhiva main
```
Pa na GitHubu postavi `main` kao *default branch*. (Nije nužno.)

---

## 6. Sigurnosne provjere prije prvog pusha

- `php/vnlh_db_connect.php` (lozinka baze) je gitignoran → **ne ide** na GitHub ✅
- Brzi pregled što će se poslati:
  ```bash
  git ls-files | grep -iE "config|\.cnf|\.env|secret|password|lozink" 
  ```
  (očekivano: ništa osjetljivo; `vnlh_password_policy.php` je samo pravila, ne tajne)
- I na privatnom repou vrijedi pravilo: **nikad ne commit-aj lozinke/ključeve**.

---

## 7. Svakodnevni workflow (nakon postavljanja)

- Commit kao i dosad.
- Push:
  - Opcija 1 → `git push github master` (i `git push arhiva` za lokalnu kopiju)
  - Opcija 2 → `git push arhiva master` (ide na oboje)

## Napomene

- GitHub **ne zamjenjuje** lokalni `arhiva` bare repo — možeš (i preporučeno je) imati oba za dvostruku sigurnost.
- Izbjegavaj datoteke **> 100 MB** (GitHub limit); za velike binarne datoteke ide Git LFS.
