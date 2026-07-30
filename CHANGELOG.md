# Changelog

All notable changes to the **SR5 Marketplace** module will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [14.003.0] - 2026-07-30

### Added
- **NPC Actor Creation & Corporate Flavoring**:
  - Support for selecting a Corporate Flavor (Ares, Aztechnology, Evo, Horizon, Mitsuhama, NeoNET, Renraku, Saeder-Krupp, Shiawase, Wuxing) when creating NPCs.
  - Spells, weapons, armors, and gear adapt dynamically to match corporate paradigms and preferences.
- **Professional Level & Cyberware Scaling**:
  - Introduced Professional Rating Level scaling (Levels 1 through 6).
  - Cyberware and bioware automatically scale in grade (`standard`, `alpha`, `beta`, `delta`) with dynamic essence and cost multipliers.
- **NPC Datasets & Templates**:
  - Integrated `NPCTemplate.enc.mjs` and `chummer-corp-mapping.enc.mjs` for template parsing and item mapping.
- **MarketShouter Extension API**:
  - Added `MarketplaceAPI.registerShouterButton(id, config)` and `game.sr5marketplace.api.registerShouterButton` allowing third-party modules and custom macros to inject buttons into the MarketShouter capsule bar.
  - Config options support custom FontAwesome icons or inline HTML, tooltips (`title`), dynamic visibility checks (`visible`), click callbacks (`onClick`), and display ordering (`order`).
- **Readiness Hook**:
  - Emits the `sr5marketplaceReady` hook when the module API and item index initialization complete.

### Changed
- Updated `SR5CreateActorApp.mjs` to handle corporate spell paradigms, school filtering, duplicate spell prevention, and scaled equipment integration.
- Updated `create-actor.html` template with corporate flavor and professional level selection controls.
- Added comprehensive developer documentation under `documentation/marketShouter.md` and updated `documentation/sr5CreateActorApp.md`.

---

## [14.002.0] - 2026-07-28

### Added
- **MarketShouter Floating Action Capsule Bar**: Floating UI component providing quick access to shop opening, shopping cart, item builder, and GM approvals.
- **Item Builder & Custom Item Workflows**: Interactive workspace for assembling custom Shadowrun items with cost, availability, and essence calculations.

---

## [14.000.0] - 2026-07-25

### Added
- **Foundry VTT v12/v14 Compatibility Update**: Refactored application sheets to `ApplicationV2` architecture.
- **In-Game Marketplace Core**: Shop Actor integration, matrix host linking, customer cart management, and GM approval workflows.
