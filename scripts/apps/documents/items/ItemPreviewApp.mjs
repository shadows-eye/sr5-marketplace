import { BasketService } from "../../../services/basketService.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A standalone, read-only preview window for an Item that mimics the SR5 system's sheet style.
 * @param {const} ApplicationV2 - Provided by foundry API foundry.applications.api
 * @returns {object} render - Provides the object for render.
 */
export class ItemPreviewApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(itemUuid, options = {}) {
        super(options);
        this.itemUuid = itemUuid;
        this.basketService = new BasketService();
        this.purchasingActor = null;
    }

    /** @override */
    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            // UPDATED: This now sets the exact classes for a native SR5 sheet look
            id: "ItemPreviewApp",
            classes: ["app", "window-app", "sr5", "sheet", "item", "ItemPreviewApp", "themed", "theme-light"],
            position: { width: 735, height: 484, top: 266, left: 157 },
            actions: {
                copyUuid: this.#onCopyUuid,
                addToCart: this.#onAddToCart,
                addToItemBuilder: this.#onAddToItemBuilder
            }
        });
    }

    /** @override */
    static PARTS = {
        main: { template: "modules/sr5-marketplace/templates/documents/items/itemPreviewApp/item-preview.html" }
    };

    /** @override */
    async _prepareContext(options) {
        // 1. Fetch the full item document using its UUID, as you suggested.
        const item = await fromUuid(this.itemUuid);
        if (!item) {
            ui.notifications.error(`Could not find item with UUID: ${this.itemUuid}`);
            this.close();
            return {};
        }
        const itemData = item.toObject(false);
        itemData.uuid = item.uuid;

        const selectedActorUuid = game.user.getFlag("sr5-marketplace", "selectedActorUuid");
        this.purchasingActor = selectedActorUuid ? await fromUuid(selectedActorUuid) : (game.user.character || null);

        return {
            item: itemData,
            purchasingActor: this.purchasingActor
        };
    }

    // --- ACTION HANDLERS ---

    static async #onAddToCart(event, target) {
        if (!this.purchasingActor) {
            ui.notifications.warn("Please select a character to purchase items.", { localize: true });
            // Optionally, we could try to open the main marketplace to force a selection.
            // For now, a simple warning is enough.
            return;
        }

        const itemUuid = target.dataset.itemId;

        // Call the existing service with the correct data.
        await BasketService.addToBasket(itemUuid, this.purchasingActor.uuid);
        
        // Close the preview window for a smooth user experience.
        this.close();
    }

    static #onCopyUuid(event, target) {
        const uuid = target.dataset.uuid;
        if (uuid) {
            navigator.clipboard.writeText(uuid).then(() => {
                ui.notifications.info("Item UUID copied to clipboard.");
            });
        }
    }

    static #onAddToItemBuilder(event, target) {
        ui.notifications.warn("The Item Builder feature is not yet implemented.");
    }
}