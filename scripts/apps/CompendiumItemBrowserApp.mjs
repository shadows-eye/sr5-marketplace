import { ThemeService } from "../services/themeService.mjs";
import { InventoryRules } from "../services/_module.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A themed mini compendium browser for GMs to browse compendiums and batch add
 * folders/items directly to a Shop Actor's inventory in one transaction.
 */
export class CompendiumItemBrowserApp extends HandlebarsApplicationMixin(ApplicationV2) {
    /**
     * @param {ShopActor} shopActor The Shop Actor document instance.
     * @param {ShopActorSheet} shopActorSheet The sheet class rendering this shop.
     * @param {object} options ApplicationV2 options.
     */
    constructor(shopActor, shopActorSheet, options = {}) {
        options.classes = [...(options.classes || []), "sr5", "themed", "sr5-marketplace", "compendium-browser-app-window"];
        super(options);

        this.shopActor = shopActor;
        this.shopActorSheet = shopActorSheet;

        // Find default active item compendium pack
        const itemPacks = game.packs.filter(p => p.metadata.type === "Item" && p.visible);
        this.activeCompendiumId = itemPacks[0]?.collection || null;
    }

    /** @override */
    static PARTS = {
        main: {
            id: "body",
            template: "modules/sr5-marketplace/templates/apps/compendiumItemBrowser/browser.html"
        }
    };

    /** @override */
    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "sr5-marketplace-compendium-browser",
            position: { width: 850, height: 600 },
            window: {
                title: "SR5Marketplace.UI.AddItem",
                resizable: true,
                minimizable: true
            }
        }, { inplace: false });
    }

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        // Get all visible Item compendiums
        context.compendiums = game.packs.filter(p => p.metadata.type === "Item" && p.visible).map(p => ({
            id: p.collection,
            title: p.metadata.label
        }));

        context.activeCompendiumId = this.activeCompendiumId;

        if (this.activeCompendiumId) {
            const pack = game.packs.get(this.activeCompendiumId);

            // Get all folders in the compendium
            context.folders = pack.folders ? Array.from(pack.folders.values()).map(f => ({
                id: f.id,
                name: f.name
            })) : [];

            // Fetch indexed items using system CompendiumBrowser static search for high performance
            let searchResults = [];
            if (game.shadowrun5e?.CompendiumBrowser?.search) {
                searchResults = await game.shadowrun5e.CompendiumBrowser.search("Item", {
                    packs: [this.activeCompendiumId]
                });
            } else {
                // Fallback if system method not found
                const index = await pack.getIndex({ fields: ["img", "folder", "system.rating", "type"] });
                searchResults = Array.from(index.values());
            }

            // Clean, localize, and sort items
            context.items = searchResults.map(entry => {
                let rating = entry.system?.rating;
                if (rating && typeof rating === "object") rating = rating.value;
                if (!rating) rating = entry.system?.technology?.rating;
                if (rating && typeof rating === "object") rating = rating.value;

                return {
                    id: entry.id || entry._id,
                    name: entry.name,
                    img: entry.img || "icons/svg/item-bag.svg",
                    type: game.i18n.localize(`TYPES.Item.${entry.type}`) || entry.type,
                    rating: rating || "",
                    folderId: entry.folder,
                    uuid: entry.uuid || `Compendium.${this.activeCompendiumId}.Item.${entry.id || entry._id}`
                };
            }).sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
        }

        return context;
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);
        ThemeService.applyTheme("#actors", this.element, this.shopActor);

        // Listeners for Sidebar
        const sidebar = this.element.querySelector(".compendium-list");
        if (sidebar) {
            sidebar.addEventListener("click", this._onCompendiumSelect.bind(this));
        }

        // Listeners for Controls
        const searchInput = this.element.querySelector(".search-input");
        if (searchInput) {
            searchInput.addEventListener("input", this._onSearchInput.bind(this));
        }

        const selectAll = this.element.querySelector(".select-all-btn");
        if (selectAll) selectAll.addEventListener("click", this._onSelectAll.bind(this));

        const deselectAll = this.element.querySelector(".deselect-all-btn");
        if (deselectAll) deselectAll.addEventListener("click", this._onDeselectAll.bind(this));

        // Listeners for checkboxes
        this.element.addEventListener("change", this._onCheckboxChange.bind(this));

        // Footer Actions
        const cancelBtn = this.element.querySelector(".cancel-btn");
        if (cancelBtn) cancelBtn.addEventListener("click", () => this.close());

        const submitBtn = this.element.querySelector(".submit-btn");
        if (submitBtn) submitBtn.addEventListener("click", this._onSubmit.bind(this));
    }

    /**
     * Change active compendium and refresh view.
     */
    _onCompendiumSelect(event) {
        const btn = event.target.closest(".compendium-tab-btn");
        if (!btn) return;
        event.preventDefault();

        this.activeCompendiumId = btn.dataset.packId;
        this.render(false);
    }

    /**
     * Handle search filtering.
     */
    _onSearchInput(event) {
        const query = event.target.value.toLowerCase().trim();
        const rows = this.element.querySelectorAll(".item-row");
        for (const row of rows) {
            const name = row.dataset.itemName?.toLowerCase() || "";
            const type = row.dataset.itemType?.toLowerCase() || "";
            if (name.includes(query) || type.includes(query)) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        }
    }

    /**
     * Select all visible folders and items.
     */
    _onSelectAll() {
        const visibleItemRows = this.element.querySelectorAll(".item-row");
        for (const row of visibleItemRows) {
            if (row.style.display !== "none") {
                const cb = row.querySelector(".item-checkbox");
                if (cb) cb.checked = true;
            }
        }

        const visibleFolderRows = this.element.querySelectorAll(".folder-row");
        for (const row of visibleFolderRows) {
            if (row.style.display !== "none") {
                const cb = row.querySelector(".folder-checkbox");
                if (cb) cb.checked = true;
            }
        }

        this._updateSelectedCount();
    }

    /**
     * Deselect all folders and items.
     */
    _onDeselectAll() {
        const checkboxes = this.element.querySelectorAll(".item-checkbox, .folder-checkbox");
        for (const cb of checkboxes) {
            cb.checked = false;
        }
        this._updateSelectedCount();
    }

    /**
     * Handle changes in checkboxes (folder sync & count update).
     */
    _onCheckboxChange(event) {
        const target = event.target;

        if (target.classList.contains("folder-checkbox")) {
            const folderId = target.dataset.folderId;
            const isChecked = target.checked;

            // Sync all items belonging to this folder
            const itemCbs = this.element.querySelectorAll(`.item-checkbox[data-folder-id="${folderId}"]`);
            for (const cb of itemCbs) {
                cb.checked = isChecked;
            }
        }

        this._updateSelectedCount();
    }

    /**
     * Update visual counter in footer.
     */
    _updateSelectedCount() {
        const checkedCount = this.element.querySelectorAll(".item-checkbox:checked").length;
        const countSpan = this.element.querySelector(".selected-items-count");
        if (countSpan) {
            countSpan.textContent = checkedCount;
        }
    }

    /**
     * Submit and batch add items in a single update transaction.
     */
    async _onSubmit() {
        const checkedCbs = this.element.querySelectorAll(".item-checkbox:checked");
        const itemIds = Array.from(checkedCbs).map(cb => cb.dataset.itemId);

        if (!itemIds.length) {
            ui.notifications.warn("No items selected.");
            return;
        }

        // Fetch documents
        const items = [];
        for (const itemId of itemIds) {
            const uuid = `Compendium.${this.activeCompendiumId}.Item.${itemId}`;
            const doc = await fromUuid(uuid);
            if (doc && doc.type !== "skill" && doc.type !== "contact") {
                items.push(doc);
            }
        }

        if (!items.length) {
            ui.notifications.warn("No valid inventory items found in selection.");
            this.close();
            return;
        }

        // High performance single transaction batch update
        let addedCount = 0;
        const updates = {};
        const markup = this.shopActor.system.shop?.itemMarkup || 0;
        for (const item of items) {
            if (this.shopActor.findInventoryItem(item.uuid)) continue;

            const newItemId = foundry.utils.randomID();
            const calculatedData = await InventoryRules.getCalculatedItemData(this.shopActor, item);

            const itemPriceVal = calculatedData.itemPrice?.value ?? calculatedData.itemPrice ?? 0;
            const sellPriceVal = calculatedData.sellPrice?.value ?? calculatedData.sellPrice ?? 0;
            const buyPriceVal = calculatedData.buyPrice?.value ?? calculatedData.buyPrice ?? 0;
            const availVal = calculatedData.availability?.value ?? calculatedData.availability ?? "1R";

            // Apply markup to sell price
            const markedUpSellPrice = Math.round(sellPriceVal * (1 + markup / 100));

            updates[`system.shop.inventory.${newItemId}`] = {
                itemUuid: item.uuid,
                qty: calculatedData.qty ?? 1,
                itemPrice: { value: itemPriceVal, base: itemPriceVal },
                sellPrice: { value: markedUpSellPrice, base: sellPriceVal },
                buyPrice: { value: buyPriceVal, base: buyPriceVal },
                availability: { value: availVal, base: availVal },
                buyTime: calculatedData.buyTime ?? { value: 24, unit: "hours" },
                comments: ""
            };
            addedCount++;
        }

        if (addedCount > 0) {
            await this.shopActor.update(updates);
            ui.notifications.info(`Successfully added ${addedCount} items to shop inventory.`);
            this.shopActorSheet.render();
        } else {
            ui.notifications.warn("All selected items are already in the shop's inventory.");
        }

        this.close();
    }
}
