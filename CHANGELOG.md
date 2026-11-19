# Changelog

Versioner følger [Semantic Versioning](https://semver.org/). Datamodellens version (`CHARACTER_SCHEMA_VERSION`) står separat.

## 0.2.0 — 2026-11-19

Datamodel v1 → v2 (automatisk migrering ved indlæsning og import; eksisterende værdier ændres ikke).

### Tilføjet

- **Carried**-markering (touchvenlig) på ranged/melee weapons, armor, gear, vehicles/drones, commlinks/cyberdecks, foci og RCC. Gemmes pr. genstand og karakter og indgår i JSON-eksport og backup. Markeringen aktiverer aldrig rustning, våben eller bonusser.
- Fanen **Current Loadout**: defense- og Full Defense-pools, Damage Resistance, initiative for relevante tilstande, Edge, condition monitors og wound modifier, limits, favorit- og generelle pools samt alle medbragte genstande med stats, pools og tilknyttede modifiers. Advarer, hvis båret rustning eller aktive våben ikke er markeret carried.
- Drone-/køretøjsoverblik pr. enhed med pools pr. styringsform og sidehenvisninger: autonomous (Pilot + Clearsight [Sensor], Pilot + Targeting [Accuracy], s. 183/270), jumped in (Vehicle skill + Reaction [Handling] og Gunnery + Logic [Accuracy] med control rig-bonus, Perception + Intuition [Sensor], s. 183/199/266/452) og remote control (Control Device, laveste af normal limit og Data Processing, s. 238). Manglende grundlag vises som "needs …" i stedet for et tal.
- **Export Current Loadout PDF** (også som PDF-type på Export-fanen): separat, lyst A4-dokument med sidetal, navn og eksportdato.
- Fanen **Karma History**: manuel log (dato, kategori, navn, before/after som tal eller tekst, Karma Spent, "New purchase"/"Earlier purchase", kommentar, kilde) med redigering, sletning med bekræftelse og sortering. Afstemning: Total Karma Earned, Total Karma Spent, Unspent Karma, Expected Unspent, Difference og Balanced/Mismatch. Loggen ændrer aldrig karakterens værdier eller karmasaldi.
- Nye valgfrie referencer: ranged weapon → "Mounted on vehicle/drone", vehicle → "Your Pilot skill", autosoft → type og våben (Targeting), modifier → "Linked item".
- Versionsnummer vises i appen; ny version tjekkes, når appen kommer i forgrunden.

### Ændret

- Migrering v1 → v2 flytter (kopierer ikke) negative Karma-poster fra Karma & ¥-historikken til Karma History som "Earlier purchase", så de ikke tælles dobbelt. Positive Karma-poster og nuyen-poster bliver i Karma & ¥.
- Karma History og afstemning kan medtages i Full Character Sheet-PDF'en via historik-valget.
- `.gitignore` udelukker nu også `*.pdf`.

### Rettet

- Faner med stort bogstav i adressen (fx `#/c/…/karmaLog`) åbnede den forkerte fane efter genindlæsning.

## 0.1.0 — 2026-11-16

- Første udgivelse: offline SR5-karakterark (PWA) med flere karakterer, moduler, skills, pools, modifiers/overrides, Play-dashboard, JSON-backup og PDF-eksport.
