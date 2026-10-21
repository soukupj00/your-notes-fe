# 0005 - Biome nahrazuje ESLint + Prettier

- Stav: přijato
- Datum: 2026-06-15

## Kontext

Projekt se lintuje ESLintem 9 (flat config) a formátuje Prettierem + `prettier-plugin-tailwindcss`, které se spouštějí při commitu přes husky + lint-staged.
Má to tři problémy:

- Commit hook spouští jen `prettier --write` - při commitu **neprobíhá žádná automatická oprava lintu**, takže konzistence stylu a lintu se bez ručního zásahu ve skutečnosti nevynucuje.
- `eslint.config.ts` nezapojuje `eslint-plugin-react-hooks` / `eslint-plugin-react-refresh`, přestože jsou nainstalované - pravidla pro hooky se nevynucují.
- Dva nástroje, více konfigurací a pomalejší pipeline.

Cílem je automatická konzistence stylu a lintu bez ručních zásahů (hlavně při commitu) s minimem nástrojů.

## Rozhodnutí

Jako jediný nástroj pro lint **i** formátování se přijímá **Biome**, který nahradí ESLint i Prettier.
Biome se nekombinuje s Prettierem (oba formátují a překrývaly by se).

- Konfigurace: jediný `biome.json` (doporučená pravidla + `organizeImports` + formátovač).
- Řazení tříd Tailwindu přechází na pravidlo `useSortedClasses` z nursery Biome, nastavené pro `className` a pomocníky `cn`/`clsx`/`cva`.
- Pre-commit (husky + lint-staged) spouští na staged souborech `biome check --write`: aplikuje **bezpečné** opravy (formátování, řazení importů, bezpečné opravy lintu) a znovu je přidá do stage; zbývající chyby commit zablokují.
  **Nebezpečné** opravy se nikdy neaplikují automaticky (mohou změnit chování) - ukážou se v CI nebo při ručním spuštění.
- CI spouští `biome ci .` jako kontrolu, která nic nemění.
- Odstraněno: `eslint`, `typescript-eslint`, všechny `eslint-plugin-*`, `eslint-config-prettier`, `prettier`, `prettier-plugin-tailwindcss`, `eslint.config.ts` a položka Prettieru v lint-staged.

## Důsledky

- Jeden rychlý nástroj, jedna konfigurace, jeden příkaz v CI; automatická oprava lintu teď při commitu opravdu běží a pravidla pro React hooky vynucuje Biome (`useExhaustiveDependencies`, `useHookAtTopLevel`).
- **Kompromis:** `useSortedClasses` v Biome je ve fázi nursery a je méně úplné než `prettier-plugin-tailwindcss` (zejména kolem Tailwindu v4) - řazení tříd nemusí být dokonalé.
  Přijato výměnou za konsolidaci nástrojů.
- Biome **neformátuje** Markdown ani YAML; tyto soubory prostě zůstávají neformátované.
- Vratné, ale ne triviálně: návrat k ESLintu/Prettieru znamená obnovit konfigurace a závislosti.
  Proto je rozhodnutí zaznamenáno zde.
