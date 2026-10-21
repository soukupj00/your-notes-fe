# 0018 - Synchronizační server servíruje PWA, a to určuje autentizaci, párování i TLS

- Stav: přijato
- Datum: 2026-08-12

## Kontext

Zadání požaduje vlastní server, který zvládne nastavit běžný člověk, a PWA, která se s ním synchronizuje napříč jeho zařízeními.
Obvyklé uspořádání - frontend nasazený někde, backend nasazený jinde a textové pole, do kterého uživatel napíše adresu svého serveru - používá většina self-hosted aplikací na poznámky a média, a právě na něm podstatná část netechnických uživatelů to vzdá.

Návrh omezují tři fakta silněji než jakékoli preference.

**Adresa v lokální síti není zabezpečený kontext.**
Na `http://192.168.1.20:3000` prohlížeč odmítne zaregistrovat service worker, odmítne aplikaci nainstalovat, odmítne `navigator.storage.persist()` a odmítne `getUserMedia`.
To není omezená PWA, to není PWA vůbec - a navíc to vyřadí záznam z mikrofonu a kamery, který už vyšel v M3.
Vyhovují jen HTTPS a `localhost` a pro privátní IP adresu neexistuje důvěryhodný certifikát bez jakékoli konfigurace.

**Cookies mezi různými originy vyžadují `SameSite=None; Secure`.**
Odděleně hostovaný frontend tedy přes čisté HTTP v lokální síti nemůže cookie autentizaci použít vůbec, a náhradní řešení - bearer token v IndexedDB - může přečíst jakýkoli skript na stránce a nelze ho odvolat bez blocklistu na serveru, což je jen tabulka relací s pár kroky navíc.

**„Odhlásit můj ztracený telefon“ je skutečný požadavek** na osobní server s poznámkami a vyžaduje relace na straně serveru.

## Rozhodnutí

**Synchronizační server servíruje sestavenou PWA ze svého vlastního originu.** Jeden kontejner, jedna adresa, jedna věc ke spuštění.

Vše ostatní z toho plyne, místo aby se to volilo zvlášť:

- **Neexistuje obrazovka „zadejte adresu svého serveru“.** Aplikace je vždy už u svého serveru, protože právě ten server ji prohlížeči předal. Dva servery znamenají dva originy, dvě instalace a dvě izolované databáze, což je správná izolace, ne omezení.
- **Autentizaci zajišťuje session cookie s `HttpOnly` a `SameSite=Lax`**, jeden řádek na zařízení, odvolatelná z Nastavení. JavaScript na ni nikdy nesáhne. Zadarmo dorazí i s budoucím `EventSource`, který hlavičku `Authorization` poslat nemůže.
- **TLS je práce Caddy, ne naše.** Caddy je součástí compose stacku a nabízí tři zdokumentované režimy - Tailscale (doporučená přímá cesta: skutečný důvěryhodný certifikát, žádná doména, žádné přesměrování portů, funguje i mimo domov), DNS-01 s doménou, kterou uživatel vlastní, a vlastní interní CA pro zcela offline provoz. Žádný kód aplikace neví, který režim byl zvolen. `http://localhost` zůstává plnohodnotnou cestou pro server běžící na počítači, který se právě používá, což je přesně nastavení, jaké potřebuje řízený uživatelský test na desktopu.
- **Účty jsou soukromá sila.** První návštěva nového serveru vytvoří vlastníka; registrace se pak uzavře a další lokální účty vznikají uplatněním pozvánky. V celém projektu není žádný e-mail ani SMTP, takže neexistuje samoobslužný reset hesla: vlastník resetuje heslo člena domácnosti z Nastavení a své vlastní heslo resetuje jedním příkazem proti kontejneru.
- **Přihlášení přebírá, odhlášení maže.** Zařízení, které nikdy nebylo připojeno k účtu, při prvním přihlášení nahraje své stávající poznámky (id jsou UUIDv4, takže nic nekoliduje). Jakmile je připojeno, odhlášení vymaže lokální databázi - server drží všechno, a právě to brání tomu, aby další člověk, který se přihlásí na sdíleném notebooku, převzal cizí poznámky do svého účtu. Odhlášení je zablokované, dokud fronta není prázdná, a nejprve nabídne zip zálohu z M4.
- **Synchronizace je volitelná.** Aplikace zůstává plně použitelná zcela bez účtu, včetně průvodce. Přihlášení je vylepšení, nikdy brána.

## Důsledky

- **Container image frontendu publikovaný podle [ADR 0006](./0006-ci-cd-and-container-image-distribution.md) mění účel.** Už to není způsob, jak si aplikaci provozuje self-hoster; backendový image obsahuje sestavené soubory. Frontendový image zůstává užitečný pro servírování PWA za vlastním reverse proxy, což je nyní pokročilá cesta a vyžaduje HTTPS a CORS.
- **End-to-end šifrování je mimo rozsah M5** a místo něj je zdokumentován model hrozeb. E2EE by zde chránilo disk serveru, zatímco IndexedDB na zařízeních i zip záloha by zůstaly v otevřené podobě, takže by bránilo jen útočníkovi, který má server, ale žádné zařízení - úzký případ u stroje v uživatelově vlastní domácnosti. Jeho cenou není kryptografie, ale obnova: bez e-mailu a bez resetu by zapomenuté heslo znamenalo trvalou a úplnou ztrátu a vlastníkův „reset hesla člena“ by se stal aktem zničení. Zaznamenáno jako budoucí práce, s výhradou pro domácnost jasně uvedenou v návodu k nastavení: kdo provozuje server, může číst databázi.
- **Self-hoster, který nechce instalovat Docker, má cestu**, protože server v TypeScriptu lze dodat jako jeden spustitelný soubor. V M5 to postaveno není, ale cesta zůstává otevřená.
- **Certifikáty zůstávají jediným těžkým krokem.** Toto rozhodnutí odstraňuje obrazovku s ručně psanou IP adresou a celou třídu chyb s CORS; TLS v domácí síti tím ale zadarmo není. Dokumentace nabízí jednu přímou cestu, místo aby předstírala, že na výběr není.

## Přehodnoceno 2026-08-30

V přehodnocení synchronizace ([`docs/sync-evaluation.md`](https://github.com/soukupj00/your-notes-fe/blob/main/docs/sync-evaluation.md)) bráno jako daný předpoklad, vůči kterému se hodnotilo; hotoví kandidáti ho spíše posílili, než oslabili.
Cookie relace v CouchDB jsou bezstavové a nedají se odvolat pro jednotlivé zařízení, PocketBase používá bearer token bez relací a bez odhlášení a jediný backend „v krabici“ se skutečnými relacemi `HttpOnly` (Appwrite) stojí 15-20 kontejnerů.
Relace jsou proto tabulka, jeden řádek na zařízení, a bezstavová šifrovaná cookie byla zvážena a ze stejného důvodu zamítnuta.
