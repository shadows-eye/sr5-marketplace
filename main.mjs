console.debug("SR5 Marketplace | Loading module into FoundryVTT");
import { BasketModel } from "./models/basketModel.mjs";
import { BasketItemSheet } from "./sheets/BasketItemSheet.mjs";
import { ShopActorSheet } from './sheets/ShopActorSheet.mjs';
import { shopSchema } from './scripts/actors/shopActor.mjs';

// --- CONSTANTS ---
const SHOP_ACTOR_TYPE = "sr5-marketplace.shop";
const BASKET_ITEM_TYPE = "sr5-marketplace.basket";

// --- REGISTRATION FUNCTIONS ---

/**
 * Function to register custom Item types and their data models.
 */
const registerItemTypes = () => {
    console.log("SR5 Marketplace | Registering custom Item Data Models...");
    CONFIG.Item.dataModels[BASKET_ITEM_TYPE] = BasketModel;
};

/**
 * Function to register all custom document sheets.
 */
const registerSheets = () => {
    console.log("SR5 Marketplace | Registering Document Sheets...");
    
    // Register the custom sheet for the Shop actor type
    Actors.registerSheet("sr5-marketplace", ShopActorSheet, {
        types: [SHOP_ACTOR_TYPE],
        makeDefault: true,
        label: "SR5.Marketplace.Shop.SheetName"
    });

    // Register the custom sheet for the Basket item type
    Items.registerSheet("sr5-marketplace", BasketItemSheet, {
        types: [BASKET_ITEM_TYPE],
        makeDefault: true,
        label: "SR5.Marketplace.Basket.SheetName"
    });
};

// --- HOOK-BASED LOGIC ---

/**
 * Main initialization hook. Runs once when the module is initialized.
 */
const onInit = () => {
    console.log("SR5 Marketplace | Initializing Module...");
};

/**
 * Main ready hook. Runs once when the game is ready.
 */
const onReady = () => {
    console.log("SR5 Marketplace | Module is ready!");
    registerItemTypes();
    registerSheets();
};

/**
 * THE BAIT: Runs BEFORE any actor is created.
 * We trick the system into thinking our "shop" is a "character".
 */
Hooks.on("preCreateActor", (document, data, options, userId) => {
    if (data.type !== SHOP_ACTOR_TYPE) return;
    
    console.log(`SR5 Marketplace | BAIT: Intercepting creation of "${data.name}".`);
    
    // Flag this creation so we can identify it in the next hook.
    options.isMarketplaceShop = true; 
    
    // Temporarily change the type to "character".
    document.updateSource({ type: "character" });
});

/**
 * THE SWITCH: Runs AFTER an actor has been created.
 * We switch the type back and add our custom data.
 */
Hooks.on("createActor", async (actor, options, userId) => {
    if (!options.isMarketplaceShop) return;

    console.log(`SR5 Marketplace | SWITCH: Finalizing "${actor.name}".`);

    // Create the default data for our custom 'shop' section.
    const shopDefaults = {};
    for (const [name, field] of Object.entries(shopSchema)) {
        shopDefaults[name] = field.getInitialValue();
    }
    
    // Update the actor to its final state.
    await actor.update({
        "type": SHOP_ACTOR_TYPE,
        "system.shop": shopDefaults
    });
});

// Register the main lifecycle hooks
Hooks.once("init", onInit);
Hooks.once("ready", onReady);