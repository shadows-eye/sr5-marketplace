![](https://img.shields.io/badge/Foundry-v12-informational)
<!--- Downloads @ Latest Badge -->
<!--- replace <user>/<repo> with your shadows-eye/sr5-marketplace -->
<!--- ![Latest Release Download Count](https://img.shields.io/github/downloads/<user>/<repo>/latest/module.zip) -->

<!--- Forge Bazaar Install % Badge -->
<!--- replace <sr5-marketplace> with the `name` in your manifest -->
<!--- ![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2F<sr5-marketplace>&colorB=4aa94a) -->

# SR5 Marketplace

A Foundry Virtual Tabletop (VTT) module for **Shadowrun 5e** that introduces a **Purchase Screen**. This module is designed to enhance in-game transactions by allowing characters to purchase items, and review their orders in a seamless interface. These items can be Nuyen Based or Karma based.

## Features

- **Purchase Screen**: A specialized interface where players can browse and purchase items from the current world Items. 
- **Order Review Workflow**: In-game order reviews that support paused gameplay during purchases, adding more depth to in-game transactions.
- **Item Enhancement**: All Items that should have a Karma Value now Have one. On Initial Load of the module the world and Compendium Itmes need to be updated.

## Future Features
- **New Actor Class**: A Merchant Actor Class that will allow a test Workflow for recieving items and allow to use game mechanics to track the ammount of time needed to purchase the selected Items.
- **Availability Test Implementation**: When Purchasing Items an Availability test will be asked for in the corresponding chat to check when the items will arrive. Threshhold beeing the total Availability of an Order.
- **Limit Marketplace by Actor Items**: Link an Actor to the purchase screen and limit the items shown in the purchase screen to the items in the Merchant Actor. Link 1 Connection to the Merchant Actor for tests arround Availability. Options on the Actor to remove Availability test for items in the Merchant Actor, representing regular Shops.
- **Item Creator**: An Easy Way to create Armor and Weapons that have many embeded items with modifications, moving all Active Effects to the main Weapon Item, creating a new Item. Possibility to check modification Slots.
## Installation

To install the module:

1. Open your FoundryVTT application.
2. Navigate to the "Add-On Modules" section under **Configuration and Setup**.
3. Click the "Install Module" button.
4. In the "Manifest URL" field, input the following URL: 

## Changelog
### Version 12.01.00
- Initial Release Supports all Version 12 releases of **Shadowrun 5E**