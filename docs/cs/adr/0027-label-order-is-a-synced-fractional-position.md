# 0027 - Pořadí štítků je synchronizovaná zlomková pozice

- Stav: přijato
- Datum: 2026-10-22

## Kontext

Štítky neměly žádné pořadí.
Každé čtení je vypsalo v pořadí primárního klíče a identifikátory jsou náhodné, takže boční panel, filtry, výběr štítku i štítky na kartě vypadaly zamíchaně.
První uživatelský test si vyžádal vlastní pořadí přetahováním a k tomu řazení podle názvu a podle data.
Aplikace, které štítky pevně řadí od A do Z, vedou lidi k tomu, aby názvům přidávali předponu „1-“ nebo emoji, takže samotné pevné řazení nestačí.

## Rozhodnutí

**Štítek nese volitelnou synchronizovanou `position`, klíč zlomkového indexu, a jeden komparátor řadí štítky všude.**

- Pořadí je `lib/label-order.ts`: nejdřív štítky s pozicí, podle klíče v pořadí kódových jednotek a pak podle id; ostatní od A do Z podle kolace jazyka aplikace (`Intl.Collator`, číselně).
  `useTags` i `TagPills` řadí přes něj, takže se všechny seznamy štítků shodují.
- Dokud žádný štítek nemá pozici, seznam je od A do Z a nový nebo přejmenovaný štítek prostě přistane na svém abecedním místě.
- První přetažení dá jedním zápisem pozici všem štítkům v pořadí na obrazovce; každé další zapíše jen přesunutý štítek s klíčem mezi jeho novými sousedy (`fractional-indexing`).
- Nový štítek ve vlastním pořadí dostane klíč před prvním štítkem, jehož název se řadí až za ním, takže pořadí, které je stále abecední, abecedním zůstane.
- Seřazení (A až Z, Z až A, od nejnovějších, od nejstarších) jednou přepíše všechny pozice a nabídne Zpět, které vrátí předchozí pozice včetně žádných.
- Není žádná předvolba řazení ani režim řazení: je jedno pořadí, a to je to na obrazovce.
- Při přenosu chybějící `position` ponechá tu na serveru a `null` ji smaže, takže klient z doby před touto změnou pořadí nikdy nesmaže, když štítek přejmenuje.
  Lokálně se smazaná pozice drží jako `null`, dokud se neodešle, a každý čtenář bere `null` jako žádnou pozici.

## Zvažované možnosti

- **Jen od A do Z.**
  Zamítnuto: právě toto pořadí vede lidi k předponám v názvech.
- **Předvolba řazení (název, datum, vlastní).**
  Zamítnuto: předvolba je další věc k vysvětlování a pořadí by se v bočním panelu a na stránce Štítky lišilo, kdykoli by nebyla „vlastní“.
- **Celočíselný index u každého štítku.**
  Zamítnuto: přetažení by přepsalo každý štítek za přesunutým a dvě zařízení přetahující současně by se střetla na každém řádku.
- **Předvolba zařízení místo synchronizovaného pole.**
  Zamítnuto: pořadí jsou data uživatele a má být stejné na každém zařízení.

## Důsledky

- Přetažení zapíše jeden řádek; první přetažení a seřazení zapíšou všechny štítky v jedné transakci.
- Kontrakt serveru získá nové pole, takže backend vychází první; frontend nasazený proti staršímu serveru by pole potichu ztratil.
- Souběžná přetažení se řeší po řádcích jako každá úprava štítku; dva štítky, které skončí se stejným klíčem, drží stálé pořadí podle id a další přetažení mezi ně celý seznam přečísluje.
- Klíče se nevyvažují: limit serveru 1024 znaků klíč přeroste až po zhruba tisíci vloženích do stejné mezery.
- Řazení od A do Z se řídí jazykem aplikace na každém zařízení, takže dvě zařízení v různých jazycích mohou nikdy nepřetažený seznam ukázat různě; po prvním přetažení nebo seřazení ukazují všechna zařízení stejné pořadí.
