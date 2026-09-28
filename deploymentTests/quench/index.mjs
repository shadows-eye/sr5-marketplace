/**
 * @fileoverview Central entry point for Quench unittests in SR5 Marketplace.
 * Connects to Quench to register batches testing the entire Marketplace API surface.
 */

import { registerMarketplaceBatch } from "./marketplace.spec.mjs";
import { registerFactoryBatch } from "./factory.spec.mjs";
import { registerItemBuilderBatch } from "./itemBuilder.spec.mjs";
import { registerSystemDataModelBatch } from "./systemDataModel.spec.mjs";
import { registerItemDataBatch } from "./itemData.spec.mjs";
import { registerSettingsBatch } from "./settings.spec.mjs";

/**
 * Registers all SR5 Marketplace Quench test batches.
 * @param {object} quench - The Quench module instance.
 */
export function registerMarketplaceQuenchBatches(quench) {
    if (!quench) return;

    console.info("SR5 Marketplace | Registering Quench test batches...");

    registerMarketplaceBatch(quench);
    registerFactoryBatch(quench);
    registerItemBuilderBatch(quench);
    registerSystemDataModelBatch(quench);
    registerItemDataBatch(quench);
    registerSettingsBatch(quench);

    console.info("SR5 Marketplace | Successfully registered all Quench test batches.");
}
