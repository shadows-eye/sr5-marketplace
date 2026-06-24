<!--- Downloads @ Latest Badge -->
<!--- replace <user>/<repo> with your shadows-eye/sr5-marketplace -->
<!--- ![Latest Release Download Count](https://img.shields.io/github/downloads/shadows-eye/sr5-marketplace/latest/module.zip) -->

<!--- Forge Bazaar Install % Badge -->
<!--- replace <your-module-name> with the `name` in your manifest -->
<!--- ![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2F<your-module-name>&colorB=4aa94a) -->


# Shadowrun 5e Marketplace

![Foundry Version](https://img.shields.io/badge/Foundry-v14-informational)
![Shadowrun 5e System](https://img.shields.io/badge/System-Shadowrun%205e-green)

## Overview

The Shadowrun 5e Marketplace is a module for Foundry Virtual Tabletop (Foundry VTT) that brings an immersive marketplace experience to your Shadowrun 5th Edition games. It allows players and game masters (GMs) to manage in-game purchases seamlessly, integrating item browsing, purchasing, and inventory management directly into the game interface.
![image](https://github.com/user-attachments/assets/cae5fec8-96e4-4b38-a897-8cd4dc0cc19f)


## Features

- **Interactive MarketShouter Bar**: A floating, sidebar-aware capsule bar UI on the canvas that provides instant quick-search, one-click access to the shop or cart, build workshops, and displays notification badges for pending GM reviews.
- **In-Game Shop Interface**: Browse through a catalog of items categorized by type (Weapons, Armor, Cyberware, Spells, etc.) with support for multiple shop instances.
- **Shopping Basket and Order Review**: Add items to a virtual basket, adjust quantities, rating levels, and review your order before checking out.
- **Automatic Cost & Test Calculations**: Automatically calculates Karma and Nuyen costs, taking into account availability, item ratings, and custom shop markup modifiers.
- **Actor Inventory & Employee Integration**: Automatically add purchased items to character inventories. Link employee Actors to Shop Actors to automatically sync character attributes, legacy skills, and equip devices onto Matrix Hosts.
- **Factory & Item Builder Workshop**: Enable Factory mode on shop actors to allow players and GMs to plan vehicle modifications, run build tests, and purchase/install modifications directly.
- **GM Approval Workflow**: Optionally enable purchase review where players submit requests to the GM, who can approve or deny them in real-time.
- **Shop Regions**: Configure drawing/scene regions to automatically trigger active shop contexts when tokens enter them.
- **Language Support**: Deeply localized interface for English (en) and German (de).


## Installation

### Dependencies

This module requires the following:
- Foundry VTT version 13 or 14
- Shadowrun 5e game system (v0.30.0+)

### Installing the Module

1. Open the **Add-on Modules** tab in the Foundry VTT Setup screen.
2. Click on **Install Module**.
3. Enter the following manifest URL:
   ```
   https://shadowplays.de/api/sr5-marketplace/latest/module.json
   ```
4. Click **Install** and wait for the installation to complete.
5. Activate the **Shadowrun 5e Marketplace** module in your world by navigating to **Configure Settings > Manage Modules** within your game session.


## Usage

### For Players

#### Accessing the Marketplace
- **MarketShouter Bar**: The primary way to access the module is via the floating **MarketShouter** capsule bar located at the top-right of your screen, next to the sidebar.
  - **Quick Search**: Type 2 or more characters into the search bar to search the active shop's items (or all items if no shop is active). Clicking a search result launches the Marketplace window directly to that item.
  - **Shop Button (Store Icon)**: Opens the main marketplace window to browse all items.
  - **Basket/Cart Button (Shopping Basket)**: Opens the Shopping Cart/Basket directly.
  - **Workshop Button (Wrench/Car Icon)**: Appears if a Factory is present in the scene, allowing you to access the Custom Item Builder workshop.
- **Token Double-Click**: Double-click any Shop Actor token on the canvas to open the marketplace. Double-click a Factory Actor token to open the Item Builder workshop.

#### Shop Regions
- Move your character token into a GM-defined shop region. The MarketShouter will automatically lock on to that Shop Actor, showing its custom inventory, name, and image indicator in your search bar.

#### Browsing, Basket & Purchases
- Navigate through item categories using tabs inside the Shop window.
- Click **Add to Basket** to stage items.
- In the **Shopping Cart** (opened via the MarketShouter or the Cart tab), adjust item ratings, custom modifiers, and quantities.
- Click **Send Request** to submit your basket for GM approval, or click **Purchase** if GM approval is disabled. Once processed, items are placed directly into your character sheet's inventory.

---

### For Game Masters

#### Setting Up Shop Actors & Employees
1. Create a new Actor of type **Shop Actor** using the overridden Actor Creation dialog.
2. Configure shop details like **Item Markup (%)**, **Shop Radius**, and toggle **Is Factory** (with a factory rating of 1 to 6).
3. Under **Host & Employees**, associate the shop with a **Matrix Host** in the world and choose **Employees** from the list:
   - Selecting a *serving employee* automatically syncs their attributes and legacy skills to the Shop Actor.
   - All employees' equipped devices are automatically synced to the Matrix Host.
4. Use the **Populate Inventory** wizard to bulk-seed items into the shop. You can filter by compendium or world sources, item types, name queries, or max rating limits, selecting the matches you wish to import.
5. Alternatively, GMs can load and upgrade legacy actors using the import function inside the dialog.

#### Reviewing Requests & Configuring Settings
- **GM Megaphone Button**: The megaphone icon in the MarketShouter bar displays a red badge with the count of pending purchase requests. Click it to open the GM Order Review tab.
- **Approving/Denying Requests**: In the Order Review tab, GMs can inspect, approve, or deny purchase requests submitted by players.
- **Item Builder & Effects**: GMs can access the full **Item Builder** via the Wrench/Car icon in the MarketShouter to configure item properties, vehicle rules, and active effects.
- **Module Settings**: Access Foundry's **Configure Settings** menu and click **Open Settings Menu** in the Shadowrun 5e Marketplace section to adjust themes (Neon, Neon Light, Silicon), behavior tags (Single, Stacking, Unique items), or reset item caches.


## Localization

This module supports multiple languages:
- English (en)
- German (de)

To add more languages, include additional localization files in the `languages` directory.

## License

This module is distributed under the terms specified in the LICENSE file included with the repository.

## Support and Contributions

- **GitHub Repository**: [shadows-eye/sr5-marketplace](https://shadowplays.de/module/sr5-marketplace)
- **Author**: Shadow
- **Discord**: shadows_plays

Contributions, issues, and feature requests are welcome! Please submit them through the GitHub repository.

## Acknowledgements

- The Foundry VTT community for their continuous support and contributions.
