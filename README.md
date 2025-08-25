<!--- Downloads @ Latest Badge -->
<!--- replace <user>/<repo> with your shadows-eye/sr5-marketplace -->
<!--- ![Latest Release Download Count](https://img.shields.io/github/downloads/shadows-eye/sr5-marketplace/latest/module.zip) -->

<!--- Forge Bazaar Install % Badge -->
<!--- replace <your-module-name> with the `name` in your manifest -->
<!--- ![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2F<your-module-name>&colorB=4aa94a) -->


# Shadowrun 5e Marketplace

![Foundry Version](https://img.shields.io/badge/Foundry-v13-informational)
![Shadowrun 5e System](https://img.shields.io/badge/System-Shadowrun%205e-green)

## Overview

The Shadowrun 5e Marketplace is a module for Foundry Virtual Tabletop (Foundry VTT) that brings an immersive marketplace experience to your Shadowrun 5th Edition games. It allows players and game masters (GMs) to manage in-game purchases seamlessly, integrating item browsing, purchasing, and inventory management directly into the game interface.
![image](https://github.com/user-attachments/assets/c07f6b53-0231-4949-80db-910b9041f3fd)


## Features

- **In-Game Shop Interface**: Browse through a catalog of items categorized by type, such as Weapons, Armor, Cyberware, and more, all within a dedicated marketplace window.
![image](https://github.com/user-attachments/assets/c7608d7d-c5bf-44ec-bc1f-f9ec6e438a5b)


- **Shopping Basket and Order Review**: Add items to a virtual basket, adjust quantities and item ratings, and review your order before finalizing purchases.
- **Automatic Cost Calculations**: Calculates Karma and Nuyen costs for items, factoring in item ratings, availability, and any custom modifiers.
- **Actor Inventory Integration**: Purchased items are automatically added to the selected actor's inventory, whether it's your character or a selected token in the scene.
- **GM Approval Workflow**: Optionally enable a purchase approval system where GMs can review and approve player purchase requests before items are added to inventories.
- **Customizable Shop Actor**: GMs can designate any actor as the shop, allowing full control over the items available in the marketplace.
- **Language Support**: Includes localization files for English and German, with the ability to add more languages.

## Installation

### Dependencies

This module requires the following:
- Foundry VTT version 13
- Shadowrun 5e game system

### Installing the Module

1. Open the **Add-on Modules** tab in the Foundry VTT Setup screen.
2. Click on **Install Module**.
3. Enter the following manifest URL:
4. Click **Install** and wait for the installation to complete.
5. Activate the **Shadowrun 5e Marketplace** module in your world by navigating to **Configure Settings > Manage Modules** within your game session.

## Usage

### For Players

#### Accessing the Marketplace:
- Click on the marketplace icon in the scene controls, or use a macro/hotkey provided by the GM to open the Purchase Screen.

#### Browsing and Searching Items:
- Navigate through different item categories using tabs.
- Use the search bar and filters to find specific items.

#### Adding Items to Basket:
- Click on **Add to Basket** for items you wish to purchase.
- Adjust item ratings and quantities as needed.

#### Reviewing Orders:
- Go to the **Order Review** tab to see all items in your basket.
- Make any necessary changes before finalizing the order.

#### Sending Purchase Requests:
- Click on **Send Request** to submit your order to the GM for approval (if enabled).

#### Receiving Items:
- Once approved by the GM, items will be automatically added to your character's inventory.

### For Game Masters

#### Setting Up the Shop Actor:
- Drag and drop an actor onto the Shop Actor Dropzone in the Purchase Screen to designate it as the marketplace inventory.

#### Managing Available Items:
- Add or remove items from the Shop Actor's inventory to control what's available for purchase.

#### Reviewing Purchase Requests:
- Receive notifications when players send purchase requests.
- Approve or deny requests through the provided interface.

#### Configuring Module Settings:
- Access **Module Settings** to enable or disable features like GM approvals, reset item data, or adjust other preferences.


## Localization

This module supports multiple languages:
- English (en)
- German (de)

To add more languages, include additional localization files in the `languages` directory.

## License

This module is distributed under the terms specified in the LICENSE file included with the repository.

## Support and Contributions

- **GitHub Repository**: [shadows-eye/sr5-marketplace](https://github.com/shadows-eye/sr5-marketplace)
- **Author**: Shadow
- **Discord**: shadows_plays

Contributions, issues, and feature requests are welcome! Please submit them through the GitHub repository.

## Acknowledgements

- The Foundry VTT community for their continuous support and contributions.
