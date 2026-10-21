# 0006 - GitLab CI/CD a distribuce container image

- Stav: přijato
- Datum: 2026-06-15
- Implementováno 2026-09-28: `build:image`, `test:smoke` a `publish:*` v `.gitlab-ci.yml`, po vzoru pipeline backendu.

## Kontext

`.gitlab-ci.yml` zatím obsahuje jen šablony GitLabu `Security/SAST` a `Security/Secret-Detection` - chybí automatizace buildu, lintu, testů i vydávání.
Aplikace je PWA k vlastnímu hostování: koncoví uživatelé ji provozují ve své vlastní síti ([ADR 0002](./0002-separate-frontend-backend-repositories.md)) a repozitář už obsahuje vícefázový `Dockerfile` (build → nginx) a k tomu `docker-compose.yml`.
Potřebujeme pipeline, která vynucuje kvalitu a dodá těm, kdo si aplikaci hostují sami, spustitelný artefakt.

## Rozhodnutí

Pipeline v GitLabu se rozšíří při zachování stávajících bezpečnostních šablon o fáze **`quality → test → build → publish`** (plus stávající `secret-detection`):

- **quality** - `biome ci .` ([ADR 0005](./0005-biome-replaces-eslint-prettier.md)) + typová kontrola `tsc`; pnpm store je v cache; pnpm běží přes `corepack` ve verzi zafixované polem `packageManager`.
- **test** - unit/komponentové/datové testy ve Vitestu a E2E testy v Playwrightu (zapínají se postupně, jak přibývají testovací sady v M1; viz kořenový `PLAN.md`).
- **build** - `pnpm build`, který publikuje `dist/` jako artefakt.
- **publish** - sestavení stávajícího `Dockerfile` pomocí **Kaniko** a push do **GitLab Container Registry** (`$CI_REGISTRY_IMAGE`) s tagem podle SHA commitu, navíc s `latest` na výchozí větvi a s git tagem u vydání.
  Pomocí `rules` je omezeno na výchozí větev a tagy.

Distribucí pro ty, kdo hostují sami, je **publikovaný container image**: místo sestavování ze zdrojů si udělají `docker pull` / spustí compose proti image z registry.

## Důsledky

- Kontroly kvality běží v každé pipeline; vydání produkují verzovaný spustitelný image.
- **Kaniko** sestavuje image bez privilegovaného runneru Docker-in-Docker, což sedí na sdílené GitLab runnery.
- Ti, kdo hostují sami, potřebují přístup k image v registry (veřejný projekt nebo poskytnuté přihlašovací údaje); kdo dává přednost sestavení ze zdrojů, stále může použít `Dockerfile` - image je doporučená cesta, ne jediná.
- **Kompromis:** distribuce přes image přidává závislost na registry a vyžaduje disciplínu při tagování image, ale ušetří uživatelům sestavovací toolchain Node/pnpm - což odpovídá cíli „vlastní hostování zvládnou i neprogramátoři“.
- Vyžaduje zapnutou Container Registry v projektu GitLabu; konvenci tagování vydání je nutné definovat, až začne verzování.
