# Changelog

All notable changes to the **SR5 Marketplace** module will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [14.004.1] - 2026-09-05

### Improved
- **World Load Performance**: Drastically reduced initial loading times when entering a game world, ensuring smooth startup even in worlds with extensive item compendiums and large item catalogs (#102).
- **Instant Interface Availability**: The Marketplace search bar and top-bar UI controls now load and display immediately upon joining the game, allowing players and GMs to interact with the interface right away while background caching completes seamlessly.
- **Responsive Shop Caching**: Optimized catalog indexing and shop item processing for faster responsiveness when browsing inventory collections.
- **Module & API Documentation Expansion**: Comprehensive update across all module documentation pages to align with version 14.004.1 capabilities, including a dedicated [`credstick.md`](./documentation/credstick.md) guide and updated developer guides linked from the [Documentation Main Overview](./documentation/main.md).

---

## [14.004.0] - 2026-08-28

### Added
- **Marketplace Equipment Sheet Extension & Credstick Integration**:
  - Implemented `MarketplaceEquipmentSheet` extending system `SR5ItemSheet` registered on `ready` hook.
  - Added Credstick header and footer partial templates with "Is Credstick" toggle, type selector (Standard, Silver, Gold, Platinum, Ebony), and balance tracker widget.
  - Automatic synchronization of item cost, rating, and availability when credstick configuration updates.
  - Integrated `CredstickService` for deducting funds from credsticks in inventory during marketplace checkout with dynamic red over-capacity balance warning indicator.
- **Payment Source Localisation & UI Refinement**:
  - Added missing `PaymentSource` and `NuyenCash` localization keys (`Konto` / `Account`).
  - Icon-only wallet label with native `title` attribute.
  - Custom theme-aware styling for `<select>` and `<option>` popup lists for Dark and Light modes.
- **Order Review GM Editing & Calculation Improvements**:
  - User ID dataset fallback (`{{#if this.user.id}}...`) and change event listener delegation preventing input resets.
  - Automatic dynamic recalculation of pending request totals and minimum floor (`effectiveRating >= 1`) for rating 0 items.
  - Bypassed money overrule setting requirements when GM approval workflow is disabled.
- **NPC Actor Creation & Archetype Smart-Default**:
  - Added a dedicated "Is NPC" (`isNpc`) toggle under the Actor Type selector for character actors.
  - Selecting any quick-build archetype automatically defaults `isNpc = true` (checked), while blank actor creation defaults to `false`.
  - Sets `system.is_npc: true|false` on the created Actor document for both standard creation and archetype imports.
- **Corporate Flavoring & NPC Generator**:
  - Support for selecting a Corporate Flavor across 10 Megacorps (Ares, Aztechnology, Evo, Horizon, Mitsuhama, NeoNET, Renraku, Saeder-Krupp, Shiawase, Wuxing) when creating NPCs.
  - Spells, weapons, armors, and gear adapt dynamically to match corporate paradigms and preferences.
- **Professional Level & Cyberware Scaling**:
  - Introduced Professional Rating Level scaling (Levels 1 through 6).
  - Cyberware and bioware automatically scale in grade (`standard`, `alpha`, `beta`, `delta`) with dynamic essence and cost multipliers.
- **NPC Datasets & Templates**:
  - Integrated `NPCTemplate.enc.mjs` and `chummer-corp-mapping.enc.mjs` for template parsing and item mapping.
- **MarketShouter Extension API & Readiness Hook**:
  - Added `MarketplaceAPI.registerShouterButton(id, config)` and `game.sr5marketplace.api.registerShouterButton` allowing third-party modules and custom macros to inject action buttons into the MarketShouter capsule bar.
  - Emits the `sr5marketplaceReady` hook when the module API and item index initialization complete.
- **GM Whisper Chat Setting for Quick Build**:
  - Registered `quickBuildWhisperGM` world setting in module settings (default `false`) with English and German localizations.
  - When enabled, character quick build sends whispered summary cards directly to GM users only.
- **Shop Actor Sheet Factory / Workshop Settings**:
  - Added factory toggle (`system.shop.isFactory`) and factory rating input (1-6) directly to the Shop Actor sheet management UI.
- **Handlebars Partial Templates**:
  - Extracted HTML string construction from JavaScript into dedicated Handlebars partial templates (`character-description.html` and `character-chat-card.html`).

### Changed
- **CSS Utility Collision Protection**:
  - Added CSS protection rule (`.sr5v2 .list-item { display: flex !important; }`) in `styles/marketplace.css` to prevent Tailwind CSS utility collision.
  - Hidden cost and availability scaling checkboxes in Edit Mode specifically on credstick item sheets.
- **Active Effects Alignment (Shadowrun 5e System 0.37.0+)**:
  - Aligned all active effects across the builder and marketplace applications with the latest system active effects architecture (multi-target routing, filters, dynamic change values).
- **ApplicationV2 Refactoring**:
  - Fully migrated `SR5CreateActorApp` to modern Foundry `ApplicationV2` with declarative static actions and form event delegation.
- **UI & Typography Polish**:
  - Removed all forced `text-transform: uppercase` rules across the actor creator, preserving natural title and sentence casing.
  - Refined `.checkbox-custom` to exact 14x14px dimensions matching Compendium Browser styling (crisp dark unchecked square, gold-filled checked square with checkmark).

### Fixed
- **Foundry VTT v14 Sheet Initialization Lifecycle**:
  - Fixed `CONFIG.Item.sheetClasses` timing issue by moving equipment sheet registration to `Hooks.on("ready")`.
  - Added strict `this.item?.type === "equipment"` type checks.
- **Archetype Importer Skills Metadata**:
  - Resolved `TypeError: Cannot read properties of undefined (reading 'trim')` by establishing comprehensive `SKILL_METADATA` map in `constants.mjs` ensuring attributes, English attribute names, and skill categories are always populated for character import.
- **Localization Resolution**:
  - Fixed missing localization keys (`SR5Marketplace.Factory.Workshop`, `SR5Marketplace.Marketplace.Shop.MatrixHost`, `SR5Marketplace.Marketplace.Shop.Employees`, and `OutOfStockWarning`).

---

## [14.003.0] - 2026-08-24

### Added
- Initial 14.003 release foundation.

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
