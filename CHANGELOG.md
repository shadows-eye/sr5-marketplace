# Changelog

All notable changes to the **SR5 Marketplace** module will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [14.003.1] - 2026-08-24

### Added
- **NPC Actor Creation Toggle**:
  - Added a dedicated "Is NPC" (`isNpc`) checkbox under the Actor Type selector for character actors.
  - Automatically defaults to `true` when any archetype quick-build option is selected, and `false` for blank actors, while supporting full manual toggling.
  - Sets `system.is_npc: true|false` on the created actor across both blank character creation and archetype imports.
- **GM Whisper Chat Setting for Quick Build**:
  - Registered `quickBuildWhisperGM` world setting in module settings (default `false`) with English and German localizations.
  - When enabled, character quick build sends whispered summary cards directly to GM users only.
- **Shop Actor Sheet Factory / Workshop Settings**:
  - Added factory toggle (`system.shop.isFactory`) and factory rating input (1-6) directly to the Shop Actor sheet management UI.
- **Handlebars Partial Templates**:
  - Extracted HTML string construction from JavaScript into dedicated Handlebars partial templates (`character-description.html` and `character-chat-card.html`).

### Changed
- **Active Effects Alignment (Shadowrun 5e System 0.37.0+)**:
  - Aligned all active effects across the builder and marketplace applications with the latest system active effects architecture (multi-target routing, filters, and dynamic change values).
- **ApplicationV2 Refactoring**:
  - Fully migrated `SR5CreateActorApp` to modern Foundry `ApplicationV2` with declarative static actions and form event delegation.
- **UI & Typography Polish**:
  - Removed all forced `text-transform: uppercase` rules across the actor creator, preserving natural title and sentence casing.
  - Refined `.checkbox-custom` to exact 14x14px dimensions matching Compendium Browser styling (crisp dark unchecked square, gold-filled checked square with checkmark).

### Fixed
- **Archetype Importer Skills Metadata**:
  - Resolved `TypeError: Cannot read properties of undefined (reading 'trim')` by establishing comprehensive `SKILL_METADATA` map in `constants.mjs` ensuring attributes, English attribute names, and skill categories are always populated for character import.

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
