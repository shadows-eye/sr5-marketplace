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
We use NPM scripts to manage the build pipeline:

* **`npm run dev`**: Starts the Vite development server for rapid iteration.
* **`npm run build`**: Compiles and bundles the code, outputting the final production-ready module into the `dist/` directory. 

*(Note: Never modify files directly inside the `dist/` folder, as they will be overwritten on the next build).*

## 🏗️ Architecture & Build Process

After the first build link the dist folder as sr5-marketplace into the modules folder of your foundry instance.

The build pipeline is managed by `vite.config.js`:

1.  **JavaScript Bundling**: The primary entry point for the module is `scripts/marketHooks.js`. Vite compiles this as an ES module and outputs it to `dist/scripts/marketHooks.js`.
2.  **Tailwind v4 Integration**: The project uses `@tailwindcss/vite`. Because this is Tailwind v4, there is no `tailwind.config.js`. Instead, Tailwind scans the templates and scripts automatically based on `@source` directives located in `styles/marketplace.css`, compiling the used classes into `dist/styles/marketplace.css`.
3.  **Static Copying**: The `vite-plugin-static-copy` automatically moves raw source folders and files into the `dist/` directory during the build. This includes:
    * `module.json`
    * `languages/`
    * `templates/`
    * `assets/`

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