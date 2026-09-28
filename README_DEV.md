# 🛠️ Shadowrun 5e Marketplace - Developer Guide

**Shadowrun 5e Marketplace** is a comprehensive Foundry VTT module designed to enhance the Shadowrun 5e system with a fully integrated, interactive marketplace feature.

This guide outlines the development environment, build pipeline, and project architecture for developers looking to contribute or modify the module.

## 💻 Tech Stack

This module uses a modern, lightweight frontend stack:
* **Foundry VTT**: Minimum compatibility v13.
* **Vite (v8)**: Used as the primary build tool and dev server.
* **Tailwind CSS (v4)**: Modern utility-first CSS framework integrated directly via Vite.
* **Handlebars**: Standard Foundry VTT templating engine.

## 🚀 Getting Started

### Prerequisites
* Node.js installed on your development machine.
* The repository cloned directly into your Foundry VTT user data path: `Data/modules/sr5-marketplace`.

### Installation
Navigate to the module folder and install the necessary dependencies:
```bash
npm install
```

### Available Scripts
We use NPM scripts to manage the build pipeline and test suites:

* **`npm run dev`**: Starts the Vite development server for rapid iteration.
* **`npm run build`**: Compiles and bundles the code, outputting the final production-ready module into the `dist/` directory. *(Never modify files directly inside `dist/`, as they are generated on each build).*
* **`npm test`**: Verifies CSS specificity standards (guarantees zero `!important` flags).
* **`npm run test:colors`**: Checks CSS color compliance against the theme palette.
* **`npm run quench`** (or **`npm run test:quench`**): Executes the complete API test suite against a live Foundry VTT instance via Quench.

## 🏗️ Architecture & Services Design

After the first build, link the `dist/` folder as `sr5-marketplace` into the `Data/modules/` directory of your Foundry VTT user data path.

### 1. Namespaced Services (`scripts/services/_module.mjs`)
All services, singleton managers, and utility classes are centralized in `scripts/services/_module.mjs` and imported as a namespace:

```javascript
/**
 * @services Holds all services in a folder namespaced imported.
 * @example services.basketService
 */
import * as services from './services/_module.mjs';
```

- **Singletons**: `services.basketService`, `services.buildService`, `services.actorItemServices`, `services.itemDataServices`, `services.factoryFlow`, `services.deliveryTimeService`, `services.themeService`, etc.
- **Classes & Models**: `services.SystemDataModel`, `services.PurchaseService`, `services.BasketService`, `services.MarketplaceSettingsService`, etc.

### 2. Dynamic System DataModel Layer (`services.systemDataModel`)
Rather than hardcoding field locations (e.g. `system.technology.cost` vs `system.cost`), the module uses `services.systemDataModel` to dynamically inspect `CONFIG.Item.dataModels` and `CONFIG.Actor.dataModels`. This guarantees full compatibility with system data schema changes across Shadowrun 5e versions.

### 3. API Container (`game.sr5marketplace.api`)
Public and inter-module APIs are unified under `game.sr5marketplace.api`:
- `game.sr5marketplace.api.marketplace`: Basket, checkout, availability calculations, and shop interactions.
- `game.sr5marketplace.api.factory`: Vehicle virtual modifications, workshop stock verification, and builder state.
- `game.sr5marketplace.api.itemBuilder`: Custom item and vehicle build sessions.
- `game.sr5marketplace.api.systemDataModel`: Authoritative schema and field introspection.
- `game.sr5marketplace.api.itemData`: Item cache, indexing, and compendium lookups.
- `game.sr5marketplace.api.settings`: Module settings and compendium source management.

## 🧪 Testing with Quench (`deploymentTests/`)

The module integrates with the Foundry VTT [Quench](https://github.com/Ethaks/FVTT-Quench) test framework to test all APIs in a live Foundry environment.

### Test Separation Policy
To keep the production release lean, all test suites live in `deploymentTests/quench/` and are **excluded from the build pipeline**:
- `deploymentTests/quench/marketplace.spec.mjs`: Tests `game.sr5marketplace.api.marketplace`.
- `deploymentTests/quench/factory.spec.mjs`: Tests `game.sr5marketplace.api.factory`.
- `deploymentTests/quench/itemBuilder.spec.mjs`: Tests `game.sr5marketplace.api.itemBuilder`.
- `deploymentTests/quench/systemDataModel.spec.mjs`: Tests `game.sr5marketplace.api.systemDataModel`.
- `deploymentTests/quench/itemData.spec.mjs`: Tests `game.sr5marketplace.api.itemData`.
- `deploymentTests/quench/settings.spec.mjs`: Tests `game.sr5marketplace.api.settings`.

### Running Quench Tests
1. Ensure your Foundry VTT development instance is running with the `sr5-marketplace` and `quench` modules enabled.
2. Configure `.env.local` with your local Foundry connection details:
   ```bash
   FOUNDRY_URL=http://localhost:30014
   FOUNDRY_USER=Gamemaster
   ```
3. Run the automated CLI runner:
   ```bash
   npm run quench
   ```
The runner (`scripts/quench.mjs`) connects via Playwright, bundles `deploymentTests/quench/` in-memory on the fly, injects the tests into the browser session, executes the `sr5marketplace.**` batches, and outputs live test results directly to your terminal.

## 📂 Project Structure

When the project is built, the `dist/` folder will mirror this structured hierarchy:

```text
dist/
├── assets/                  # Static media, UI frames, and item/weapon icons
├── languages/               # i18n localization files (de.json, en.json)
├── scripts/                 # Compiled JavaScript (marketHooks.js and chunks)
├── styles/                  # Compiled Tailwind CSS (marketplace.css)
└── templates/               # Handlebars HTML templates
    ├── apps/                # Standalone UI Applications
    │   ├── inGameMarketplace/   # Shopping, Basket, and Order Review UI
    │   ├── itemBuilder/         # Custom Item creation interfaces
    │   └── marketplace-settings/# Module settings UI
    ├── chat/                # Chat message templates
    └── documents/           # Overrides for core Foundry documents
        ├── actor/           # Custom Shop Actor sheets and partials
        ├── items/           # Item preview and library templates
        ├── journal/         # Journal formatting overrides
        └── tests/           # SR5 Test Dialog overlays (Availability, Resist, etc.)
```

## 🌍 Localization (i18n)
The module supports both English (`en.json`) and German (`de.json`). 
Translations are deeply nested to keep the UI, Item Builder, and Actor Sheet strings organized. When adding new features, ensure keys are added to the source JSON files in the `languages/` folder before building.