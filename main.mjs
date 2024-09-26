console.debug('SR5 Markeplace | Loading module into FoundryVTT');

import { ShopModel } from "./models/ShopModel.mjs";
import { MarketplaceActorSheet } from "./sheets/ShopActorSheet.mjs";

/**
 * Register module sub-types and sheets for them.
 */
const onInit = () => {
    console.debug('SR5 Marketplace | Initializing module');

    Object.assign(CONFIG.Actor.dataModels, {
        "sr5-marketplace.mapShop": ShopModel,
    });

    DocumentSheetConfig.registerSheet(
        Actor,
        "sr5-marketplace",
        MarketplaceActorSheet,
        {
            types: ["sr5-marketplace.mapShop"],
            makeDefault: true,
        }
    );
};

/**
 * Register module Shadowrun5e tests.
 */
const onReady = async () => {
    console.debug('SR5 Shop | Readying module');

    // Register tests witin own esmmodule to assure tests imports happens when FoundryVTT calls 'ready'.
    // For this reason the import can´t happen at the top of the file but must be a dynamic import.
    const tests = await import('./utils/tests.mjs');
    tests.registerTests();
};

Hooks.on('init', onInit);
Hooks.on('ready', onReady);