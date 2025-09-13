import { ItemPreviewApp } from "../apps/documents/items/ItemPreviewApp.mjs";
import { SearchService as itemSearchService } from '../services/searchTag.mjs';
import { BuilderStateService } from "../services/builderStateService.mjs";
// We will create this service later to handle the builder logic.
// import { BuilderService } from '../services/builderService.mjs'; 

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The main application window for the Item Builder feature.
 * This app allows users to select a base item and apply modifications to it.
 */
export class ItemBuilderApp extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(options = {}) {
        // Apply theme classes just like in the marketplace app
        const currentTheme = ItemBuilderApp._getThemeFromSetting();
        options.classes = [
            ...(options.classes || []),
            "sr5-marketplace",
            "itemBuilder", // A unique class for this app
            "themed",
            currentTheme
        ];
        super(options);

        // --- State and Services ---
        this.itemData = game.sr5marketplace.itemData; // Use the global item data service
        this.purchasingActor = null;
        this.itemSearchService = null;
        this.modSearchService = null;
        // this.builderService = new BuilderService(); // To be added later
        this.builderData = {
            baseItem: null,
            modifications: []
        };
        this.tabGroups = { main: "builder" }; // Default to the 'builder' tab

        // --- Item & Category Selection State ---
        this.selectedKey = null;

        // Find a default item category to display on first load
        const itemsByType = this.itemData.itemsByType ?? {};
        let defaultKey = null;
        if (itemsByType.rangedWeapons && itemsByType.rangedWeapons.items.length > 0) {
            defaultKey = "rangedWeapons";
        } else {
            const firstAvailableCategory = Object.entries(itemsByType).find(([, data]) => data.items.length > 0);
            if (firstAvailableCategory) {
                defaultKey = firstAvailableCategory[0];
            }
        }
        this.selectedKey = defaultKey;
    }

    /** @override */
    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "itemBuilder",
            position: { width: 1600, height: 800 },
            window: { title: "Item Builder", resizable: true },
            actions: {
                // Core App Actions
                changeTab: this.#onChangeTab,
                clickItemName: this.#onClickItemName,
                buildItem: this.#onBuildItem,
                // Item & Mod Selection Actions
                selectBaseItem: this.#onSelectBaseItem
                // We will add drag-and-drop handlers later
            }
        });
    }

    /**
     * To use direct-path partials `{{> ...}}`, we ONLY define the main template here.
     * @override
     */
    static PARTS = {
        main: { template: "modules/sr5-marketplace/templates/apps/itemBuilder/item-builder.html" }
    };

    /** 
     * @override
     * @param {object} context - The context object on render
     * @param {[options]}  options - The Options from the main app passed down.
     * */
    _onRender(context, options) {
        super._onRender(context, options);

        if (this.tabGroups.main === "builder") {
            // --- Item Search ---
            this.itemSearchService = new itemSearchService(this.element);
            this.itemSearchService.initialize({
                searchBox: 'input[name="itemSearch"]',
                itemsGrid: '.item-selector-section .item-content-grid',
                nameSelector: ".item-name" // <-- ADD THIS LINE
            }); // No tagsContainer needed
            
            // --- Mod Search ---
            this.modSearchService = new itemSearchService(this.element);
            this.modSearchService.initialize({
                searchBox: 'input[name="modSearch"]',
                itemsGrid: '.mod-selector-section .item-content-grid',
                nameSelector: ".item-name" // <-- ADD THIS LINE
            }); // No tagsContainer needed

            const categorySelector = this.element.querySelector("#item-type-selector");
            if (categorySelector) {
                categorySelector.addEventListener("change", this.onChangeCategory.bind(this));
            }
        } else {
            this.itemSearchService = null;
            this.modSearchService = null;
        }
    }

    /** @override */
    async _prepareContext(options) {
        // At the start of every render, get the latest state from the flag.
        const builderData = await BuilderStateService.getState();

        const selectedActorUuid = game.user.getFlag("sr5-marketplace", "selectedActorUuid");
        this.purchasingActor = selectedActorUuid ? await fromUuid(selectedActorUuid) : (game.user.character || null);
        
        let tabContent = null;
        const render = foundry.applications.handlebars.renderTemplate;
        const partialContext = { 
            purchasingActor: this.purchasingActor,
            hasBaseItem: !!builderData.baseItem, // Use the state we just fetched
            builderData: builderData             // Pass it to the partial
        };

        switch (this.tabGroups.main) {
            case "effects":
                tabContent = `<div class="placeholder">Active Effects Configuration will be here.</div>`;
                break;
            case "dialog":
                tabContent = `<div class="placeholder">The final Creation Dialog will be here.</div>`;
                break;
            default: // "builder" tab
                this.tabGroups.main = "builder";
                // --- THIS IS THE UPDATE ---
                // Fetch the specific data sets we need for the builder.
                const baseItemsByType = this.itemData.baseItemsByType ?? {};
                const modsByType = this.itemData.modificationsByType ?? {};
                
                // Update context for the item selector (now only shows base items)
                partialContext.itemsByType = baseItemsByType;
                if (!this.selectedKey || !baseItemsByType[this.selectedKey]) {
                    this.selectedKey = Object.keys(baseItemsByType).find(k => baseItemsByType[k].items.length > 0) || null;
                }
                partialContext.selectedKey = this.selectedKey;
                partialContext.selectedItems = this.selectedKey ? (baseItemsByType[this.selectedKey]?.items || []) : [];
                
                // Update context for the mod selector (now shows categorized mods)
                 // Instead of relying on a single key, we'll combine the 'items' array
                // from every category within modsByType (weaponMods, armorMods, etc.).
                // This is a much more robust way to get all modifications.
                partialContext.mods = Object.values(modsByType).flatMap(category => category.items || []);
                
                console.log (partialContext)
                // Render the single, all-in-one template for the builder tab.
                tabContent = await render("modules/sr5-marketplace/templates/apps/itemBuilder/partials/Builder.html", partialContext);
                break;
        }

        const builderContext = {
            title: this.builderData.baseItem ? `Building: ${this.builderData.baseItem.name}` : "Select a Base Item",
            itemType: { img: "icons/svg/anvil.svg" }
        };

        return { 
            tabContent, // We now pass the single content variable to the main template.
            purchasingActor: this.purchasingActor,
            builder: builderContext
        };
    }

    // --- Static Helpers ---

    static _getThemeFromSetting() {
        const uiConfig = game.settings.get("core", "uiConfig");
        const themeValue = uiConfig?.colorScheme.applications;
        return themeValue === "dark" ? "theme-dark" : "theme-light";
    }

    // --- Event Listeners (Bound in _onRender) ---

    async onChangeCategory(event) {
        this.selectedKey = event.currentTarget.value;
        this.itemSearchService?.clearAllFilters(); // Clear search when changing category
        await this.render();
    }

    // --- Action Handlers (from DEFAULT_OPTIONS) ---

    static #onChangeTab(event, target) {
        const tabId = target.dataset.tab;
        if (this.tabGroups.main !== tabId) {
            this.tabGroups.main = tabId;
            this.render();
        }
    }

    static #onClickItemName(event, target) {
        const itemUuid = target.dataset.itemUuid;
        if (itemUuid) new ItemPreviewApp(itemUuid).render(true);
    }
    
    // ... inside the ItemBuilderApp class ...

    /**
     * Handles selecting a base item from the sidebar.
     * It saves the selected item to the state flag and triggers a re-render.
     * @private
     */
    static async #onSelectBaseItem(event, target) {
        const itemUuid = target.dataset.itemUuid;
        if (!itemUuid) return;

        // 1. Fetch the full item document from its UUID.
        const item = await fromUuid(itemUuid);
        if (!item) {
            return ui.notifications.warn("Could not find the selected item.");
        }
        const cleanItemData = {
            uuid: item.uuid,
            name: item.name,
            img: item.img,
            type: item.type,
            system: item.system,
            technology: item.technology
        };
        // 2. Use our service to set this item as the new base item.
        //    This also clears any previous modifications from the state.
        //    We use .toObject(false) to get a clean data object for storage.
        await BuilderStateService.setBaseItem(cleanItemData);
        
        // 3. Re-render the application to reflect the new state.
        //    The UI will now switch from the blank placeholder to the builder view.
        this.render();
    }
    
    static #onBuildItem(event, target) {
        ui.notifications.warn("The Item Builder feature is not yet implemented.");
    }
}