# 0002 - Oddělené repozitáře frontendu a backendu

- Stav: přijato
- Datum: 2026-06-15

## Kontext

Projekt má dva výstupy: tuto React SPA/PWA a vlastní synchronizační server s REST/HATEOAS API.
Mají odlišná běhová prostředí, cíle nasazení i tempo vydávání.
Kdo si server hostuje sám, musí mít možnost spustit backend (přes Docker Compose), aniž by nutně sahal na frontend.

## Rozhodnutí

Frontend a backend zůstanou ve **dvou samostatných git repozitářích**.
Tento repozitář obsahuje pouze frontend.
Na kontrakt API backendu se zde odkazuje, ale nenavrhuje se tu; frontend plánuje pouze **klientskou stranu** synchronizace (API klient, cache, fronta offline změn, řešení konfliktů).

## Důsledky

- Nezávislé verzování a nasazování; kdo hostuje sám, může spustit image backendu bez zdrojového kódu frontendu.
- Kontrakt REST/HATEOAS je sdílená hranice, kterou je nutné koordinovat napříč repozitáři; změna kontraktu se dotkne obou.
- PLAN a ADR tohoto repozitáře záměrně končí na hranici sítě - návrh endpointů a link relations patří do repozitáře backendu.
- Lokální end-to-end testování synchronizace vyžaduje, aby oba repozitáře (nebo mock server) běžely současně.
