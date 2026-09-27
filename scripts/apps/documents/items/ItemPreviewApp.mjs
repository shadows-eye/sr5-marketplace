import { BasketService } from "../../../services/basketService.mjs";
import { ActorSelectionService } from "../../../services/ActorSelectionService.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A standalone, read-only preview window for an Item that mimics the SR5 system's sheet style.
 */
export class ItemPreviewApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(itemUuid, options = {}) {
        super(options);
        this.itemUuid = itemUuid;
        this.customItemData = options.itemData || null;
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
        }, { inplace: false });
    }

    /** @override */
    static PARTS = {
        main: { template: "modules/sr5-marketplace/templates/documents/items/itemPreviewApp/item-preview.html" }
    };

    /** @override */
    async _prepareContext(options) {
        let itemData = null;
        if (this.customItemData) {
            itemData = foundry.utils.deepClone(this.customItemData);
        } else {
            const item = await fromUuid(this.itemUuid);
            if (!item) {
                ui.notifications.error(`Could not find item with UUID: ${this.itemUuid}`);
                this.close();
                return {};
            }
            itemData = item.toObject(false);
            itemData.uuid = item.uuid;
        }

        // Normalize technology stats in case they are objects
        if (itemData.system?.technology) {
            if (typeof itemData.system.technology.cost === "object" && itemData.system.technology.cost !== null) {
                itemData.system.technology.cost = itemData.system.technology.cost.value ?? itemData.system.technology.cost.base ?? 0;
            }
            if (typeof itemData.system.technology.availability === "object" && itemData.system.technology.availability !== null) {
                const availObj = itemData.system.technology.availability;
                const v = availObj.value ?? availObj.base ?? "";
                const t = availObj.type ?? "";
                itemData.system.technology.availability = (t && !String(v).includes(t)) ? `${v}${t}` : (v || "0");
            }
            if (typeof itemData.system.technology.rating === "object" && itemData.system.technology.rating !== null) {
                itemData.system.technology.rating = itemData.system.technology.rating.value ?? itemData.system.technology.rating.base ?? 0;
            }
        }
        if (typeof itemData.system?.cost === "object" && itemData.system?.cost !== null) {
            itemData.system.cost = itemData.system.cost.value ?? itemData.system.cost.base ?? 0;
        }
        if (typeof itemData.system?.availability === "object" && itemData.system?.availability !== null) {
            const availObj = itemData.system.availability;
            const v = availObj.value ?? availObj.base ?? "";
            const t = availObj.type ?? "";
            itemData.system.availability = (t && !String(v).includes(t)) ? `${v}${t}` : (v || "0");
        }

        this.purchasingActor = await ActorSelectionService.getSelectedActor();

        //options.window.title = itemData.name;

        // --- THIS IS THE FIX ---
        // We now nest the item's data inside an 'item' property.
        // This makes the template paths like 'item.system.technology.cost' work correctly.
        return {
            item: itemData,
            purchasingActor: this.purchasingActor
        };
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);

        // Calculate auto-scroll properties if this is a tooltip preview
        if (this.element.classList.contains("item-preview-tooltip")) {
            setTimeout(() => {
                const desc = this.element.querySelector(".description");
                const content = this.element.querySelector(".editor-content");
                if (desc && content) {
                    const descHeight = desc.clientHeight;
                    const contentHeight = content.scrollHeight;
                    if (contentHeight > descHeight) {
                        const scrollDist = -(contentHeight - descHeight + 15);
                        content.style.setProperty("--scroll-dist", `${scrollDist}px`);
                        content.classList.add("auto-scroll");
                    } else {
                        content.style.setProperty("--scroll-dist", "0px");
                        content.classList.remove("auto-scroll");
                    }
                }
            }, 100);
        }
    }

    // --- ACTION HANDLERS ---

    static async #onAddToCart(event, target) {
        if (!this.purchasingActor) {
            ui.notifications.warn("Please select a character to purchase items.", { localize: true });
            return;
        }

        if (this.customItemData) {
            const customData = foundry.utils.deepClone(this.customItemData);
            const totals = {
                cost: typeof customData.system?.technology?.cost === "object" ? customData.system.technology.cost.value : (customData.system?.technology?.cost ?? customData.system?.cost ?? 0),
                availability: typeof customData.system?.technology?.availability === "object" ? customData.system.technology.availability.value : (customData.system?.technology?.availability ?? customData.system?.availability ?? "0"),
                essence: customData.system?.essence ?? 0
            };
            await this.basketService.addCustomToBasket(customData, this.purchasingActor.uuid, totals);
        } else {
            const itemUuid = target.dataset.itemId || this.itemUuid;
            await this.basketService.addToBasket(itemUuid, this.purchasingActor.uuid);
        }
        
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