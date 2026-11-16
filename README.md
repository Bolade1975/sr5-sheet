# SR5 Runner Sheet

Offline character sheet til **Shadowrun 5th Edition** — optimeret til tablet (fx Samsung Galaxy Tab S11) i portrait og landscape. Ingen backend, login eller cloud: alt gemmes lokalt i browserens IndexedDB. PDF til GM genereres på enheden.

> Brugerfladen er på engelsk med officielle SR5-termer. Kun SR5-regler. Appen er et karakterark til eksisterende karakterer — ikke en character builder.

## Funktioner (kort)

- Flere karakterer: opret, omdøb, duplikér, slet. Autosave med synlig status og fejlbesked.
- Moduler der kan slås til/fra uden at slette data: Rigger, Decker/Matrix, Magic/Adept, Technomancer.
- Play-dashboard: initiative, Edge, condition monitors + wound modifiers, favorit-pools, aktive våben + ammo, rustning, midlertidige modifiers, aktive enheder/foci/spirits/sprites.
- Skills med søgning, sortering, kategorier, favoritter, skill groups, specializations (vist separat, +2 kun når relevant) og defaulting.
- General Dice Pools + egne pools bygget af strukturerede dele (ingen tekst-formler).
- Navngivne modifiers: permanent / situational (toggle) / conditional (kun påmindelse). Manuelle overrides markeres tydeligt og kan nulstilles.
- JSON-eksport af én karakter, fuld backup og gendannelse med validering og valg mellem kopi/erstatning.
- PDF (Full Character Sheet eller Play Summary), lyst A4-layout, sidetal, navn og eksportdato på hver side.

## Regelgrundlag

Automatiske beregninger er kontrolleret mod teksten i SR5 Core Rulebook (CAT27000). Sidehenvisninger ligger i `src/rules/references.ts` og vises ved hver beregning (tryk på en værdi). Hvor bogen ikke angiver en regel entydigt (fx afrunding af Matrix condition monitor ved ulige Device Rating), kræver appen en manuel værdi frem for at gætte.

## Lokal udvikling

Kræver Node.js 24+.

```bash
npm install
npm run dev        # udviklingsserver
npm run test       # Vitest (regler, modifiers, overrides, import/eksport, migrering, PDF)
npm run typecheck
npm run lint
npm run build      # production build i dist/
npm run preview    # server den byggede app lokalt (PWA/service worker aktiv)
```

## Deploy til GitHub Pages

1. Opret et nyt repository på GitHub (fx `sr5-sheet`) og push `master`.
2. På GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Hvert push til `master` kører typecheck, lint, format-check, tests og build og deployer derefter (`.github/workflows/deploy.yml`).

Appen bruger relativ `base`, så den virker under `https://<bruger>.github.io/<repo>/` uden konfiguration.

**Karakterdata kommer aldrig i repositoryet**: data ligger kun i browseren. `.gitignore` udelukker desuden typiske eksportfiler (`*.sr5.json`, `sr5-backup-*.json`). Læg ikke dine egne JSON-filer i projektmappen.

## Installér som app (PWA) på tablet

1. Åbn GitHub Pages-adressen i Chrome eller Samsung Internet.
2. Vent til siden er indlæst én gang (så bliver alt — inkl. PDF-motor og fonte — gemt til offline brug).
3. Menu → **Installer app** / **Føj til startskærm**.
4. Test: slå flytilstand til, åbn appen fra startskærmen, og eksportér en PDF.

## Backup og flytning mellem enheder

- **Roster → Download full backup** gemmer alle karakterer i én JSON-fil.
- **Import / restore…** validerer filen før noget skrives. Findes en karakter allerede, vælger du _Add as copy_ (standard), _Replace existing_ eller _Skip_.
- Enkelte karakterer: **Export JSON** på roster eller under fanen **Export**.
- Tag backup jævnligt — browserdata kan slettes, hvis man rydder webstedsdata.

## PDF-eksport

Fanen **Export**: vælg _Full Character Sheet_ eller _Play Summary_, og om noter og Karma/nuyen-historik skal med. Listen viser præcis hvilke sektioner der kommer med. Inaktive eller tomme moduler udelades. Manuelle overrides markeres "OVR" og listes. Filen downloades lokalt; du sender den selv til GM.

## Struktur

```
src/domain   datamodel (zod), migrering, import/eksport, eksempelkarakter
src/rules    ren beregningsmotor (ingen UI), regelreferencer, skill-katalog
src/db       IndexedDB via Dexie
src/state    autosave-store
src/screens  roster, karakterskærm og faner
src/pdf      PDF-dokumentbygger (pdfmake) — separat lyst layout
```

Datamodellen er versioneret (`CHARACTER_SCHEMA_VERSION`). Ældre data migreres ved indlæsning; nye felter får standardværdier, så eksisterende data bevares.
