# Server

Backend žije v samostatném repozitáři (`ni-dip-be`), ale jeho architektura byla rozhodnuta zde, protože omezuje kód tohoto repozitáře: [ADR 0018](../adr/0018-the-server-serves-the-pwa.md).

## Ústřední rozhodnutí: synchronizační server poskytuje PWA

Standardní podoba self-hostingu - frontend nasazený někde, backend jinde a textové pole „zadejte adresu serveru“ - je místo, kde to podstatná část netechnických uživatelů vzdá.
Tři fakta o prohlížečích omezují víc než preference:

1. **Adresa v LAN není zabezpečený kontext.** Na `http://192.168.x.x` prohlížeč odmítne service worker, instalaci, `storage.persist()` i `getUserMedia` - to není degradovaná PWA, to není žádná PWA, a znemožní to záznam z mikrofonu a kamery. Kvalifikují se jen HTTPS a `localhost` a pro privátní IP neexistuje důvěryhodný certifikát bez konfigurace.
2. **Cookies napříč originy vyžadují `SameSite=None; Secure`**, takže samostatně hostovaný frontend nemůže přes čisté HTTP v LAN cookie autentizaci použít vůbec; náhradní řešení (bearer token v IndexedDB) je čitelné skriptem a bez serverového blocklistu ho nelze odvolat - to je tabulka relací s kroky navíc.
3. **„Odhlásit můj ztracený telefon“ je skutečný požadavek** a ten si žádá relace na straně serveru.

Rozhodnutí: **jeden container, jeden origin, jedna věc ke spuštění** - server poskytuje sestavenou PWA.
Vše ostatní z toho vyplývá:

- Žádná obrazovka s adresou serveru: aplikace je vždy už u svého serveru, protože ji prohlížeči předal právě server. Dva servery = dva originy = dvě instalace a dvě izolované databáze IndexedDB, což je správná izolace, ne omezení.
- Autentizace je **session cookie `HttpOnly`, `SameSite=Lax`**, jeden řádek relace na zařízení, odvolatelný z Nastavení. JavaScript se jí nikdy nedotkne; na otázku „jsem přihlášený“ se odpovídá jedním dotazem na server při startu, ne prohlížením úložiště. Cookie se navíc zdarma veze na `EventSource` proudu signálů, který hlavičku `Authorization` poslat neumí.
- **TLS má na starosti Caddy** ve stacku compose, ve třech zdokumentovaných režimech: **Tailscale** (doporučená cesta: skutečný důvěryhodný certifikát, žádná doména, žádné přesměrování portů, funguje i mimo domov), **DNS-01** s vlastní doménou a **interní CA** Caddy pro zcela offline provoz. Aplikační kód nikdy neví, který z nich běží. `http://localhost` zůstává plnohodnotnou volbou pro server na stejném stroji.

## Účty

- První návštěva nového serveru vytvoří **vlastníka**; registrace se pak uzavře; další lokální účty vznikají uplatněním jednorázové **pozvánky**.
- Účty jsou **soukromá sila**: poznámku nelze předat jinému účtu; dva lidé sdílejí stroj, ne své poznámky.
- **Žádný e-mail, žádné SMTP** nikde v projektu, a tedy ani samoobslužný reset hesla: vlastník resetuje heslo člena v Nastavení; vlastní heslo vlastníka se resetuje jedním příkazem proti containeru.
- Synchronizace je **volitelná**: aplikace je plně použitelná, včetně průvodce, úplně bez účtu. Přihlášení je vylepšení, nikdy brána. (Sémantika převzetí při přihlášení a vymazání při odhlášení: [04-sync.md](./04-sync.md).)

## Stack

Voleno společně, každá volba omezuje tu další (viz [`PLAN.md`](https://github.com/soukupj00/your-notes-fe/blob/main/PLAN.md) M5):

| Vrstva | Volba | Zdůvodnění |
|---|---|---|
| Jazyk | TypeScript | Kontrakt komunikace se stane jedním sdíleným souborem Zod místo dvou definic, které se rozcházejí |
| HTTP | Fastify | Rychlý, schema-first, `@fastify/static` poskytuje PWA |
| Databáze | SQLite (`better-sqlite3`) + Drizzle | Záloha u self-hostingu má být „zkopírujte jeden soubor“; PostgreSQL a úložiště blobů kompatibilní s S3 jsou od přestavby úložiště volitelné backendy (repozitář backendu, `docs/setup-backends.md`) |
| TLS / okraj | Caddy | Tři výše uvedené režimy bez zapojení aplikace |
| Balení | Jeden container přes `compose.yml` | Cesta nastavení pro neprogramátory; build do jednoho spustitelného souboru je možná pozdější cesta, ne vyloučená |

## Styl API: REST s HAL

Zadání se zavazuje k REST + HATEOAS a právě ADR 0017 udržuje tento závazek poctivý: nic v modelu synchronizace nepotřebuje trvalý socket.

- Odpovědi jsou `application/hal+json`; proud změn (change feed) synchronizace je hypermediální kolekce, kde si zařízení jako kurzor ukládá neprůhlednou URL `_links.next` a nikdy si nesestavuje query string.
- Stránky změn nesou silný `ETag` nad svým tělem a server odpovídá `304`, takže revalidace je levná; stránka není neměnná, protože znovu upravený řádek se přesune na nové pořadové číslo (Sequence).
- **Kontrakt vlastní repozitář backendu** a sem je vendorovaný jako jeden commitnutý soubor (`pnpm contract:pull`); každá odpověď se na hranici validuje pomocí Zod, což zároveň slouží jako alarm na rozcházení repozitářů.
- Endpoint signálů SSE je součástí API (přehodnoceno 2026-08-30, [04-sync.md](./04-sync.md)): `text/event-stream`, `id` události = pořadové číslo změn účtu, žádný payload; Caddy ho propouští bez konfigurace a session cookie se na něm veze.
- Dávkový push hlásí výsledek po řádcích; `PUT` po jednotlivých zdrojích s `If-Match` je pozdější práce.
- Pro Node neexistuje udržovaná knihovna pro HAL, takže `_links` / `_embedded` jsou ručně psané pro každý zdroj.
- Relace jsou tabulka (jeden řádek na zařízení), protože odvolání po zařízeních potřebuje stav na straně serveru, který bezstavová šifrovaná cookie poskytnout nemůže.

## Co tento repozitář drží pro spojení

- `AccountProvider`: stav přihlášení a aktuální zařízení, bez tokenu k držení a bez URL ke konfiguraci.
- `SyncProvider`, který spouští smyčku ([04-sync.md](./04-sync.md)); síťová logika zůstává mimo komponenty.
- Klient HAL (`src/data/http/`), který validuje každou odpověď proti vendorovanému kontraktu.
- Nastavení: přihlášení na úvodní stránce Nastavení; stránka Účet s odhlášením, párovacími odkazy, seznamem zařízení s odvoláním, sdílenými poznámkami a pro vlastníka členy a pozvánkami; a „Synchronizace a záloha“, která odpovídá na otázku „jsou tu moje data v bezpečí“ (perzistence úložiště, poslední synchronizace, čekající změny).
- `/pair`, kde párovací odkaz přihlásí nové zařízení, a `/share/$token`, stránka odkazu pro sdílení jen pro čtení.
- Image frontendu ([ADR 0006](../adr/0006-ci-cd-and-container-image-distribution.md)): image backendu se staví z něj a poskytuje jeho soubory.

## Bezpečnostní postoj (pro model hrozeb v práci)

- **V rozsahu**: odvolání relace po zařízeních, cookies `HttpOnly` (žádné přihlašovací údaje čitelné skriptem), uzavřená registrace + pozvánky, izolace originů mezi servery, TLS ve všech třech režimech.
- **Mimo rozsah, zdokumentováno místo zamlžení**: end-to-end šifrování. E2EE by zde chránilo disk serveru, zatímco IndexedDB zařízení i záloha do zipu zůstávají v otevřeném textu - bránilo by jen proti útočníkovi, který má server, ale žádné zařízení, a to na krabici u uživatele doma. Jeho skutečnou cenou je obnova: bez e-mailu a bez resetu znamená zapomenuté heslo trvalou úplnou ztrátu a reset hesla člena vlastníkem se stává aktem zničení. Zaznamenáno jako budoucí práce; návod k nastavení výhradu pro domácnost uvádí přímo: *kdo provozuje server, může číst databázi*.
- Certifikáty zůstávají jediným poctivě těžkým krokem; návrh odstraňuje obrazovku pro zadání IP a celou třídu selhání CORS, ne fyziku TLS v domácí síti.

## Pro text práce

- Tato kapitola je případovou studií toho, jak *topologie nasazení řídí architekturu aplikace*: návrh s jedním originem vynucují pravidla zabezpečeného kontextu a sémantika cookies, ne vkus.
- Diskuse o autentizaci (cookie vs. bearer v IndexedDB) i kompromis kolem E2EE jsou obhajitelná zdokumentovaná rozhodnutí s jasnými modely protivníka.
- Kurzor HAL („URL je kurzor“) je konkrétní a poctivý přínos HATEOAS - v reálných systémech natolik vzácný, že si zaslouží odstavec.
