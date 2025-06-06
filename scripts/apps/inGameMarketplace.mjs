// Import required components from Foundry VTT
import ItemDataServices from '../services/ItemDataServices.mjs';
import { BasketService } from '../services/basketService.mjs';
// other imports as needed...

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class inGameMarketplace extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.itemData = new ItemDataServices();
        this.tabGroups = { main: options.tab || "shop" };
        this.basketService = new BasketService();
    }

    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "purchase-screen",
            title: game.i18n.localize("SR5.PurchaseScreen"),
            classes: ["sr5-marketplace"],
            position: { width: 910, height: 800, top: 50, left: 120 },
            // Add this to prevent the app from re-rendering on every data change,
            // as we handle rendering manually with this.render()
            reactive: false
        });
    }

    static PARTS = {
        main: {
            template: "modules/sr5-marketplace/templates/apps/inGameMarketplace/inGameMarketplace.hbs",
        },
    };

    async _prepareContext(options = {}) {
        await this.itemData.fetchItems();
        const selectedKey = options.selectedKey || this.selectedKey || "rangedWeapons";
        this.selectedKey = selectedKey;
        const selectedItems = this.itemData.itemsByType[selectedKey]?.items || [];

        const tabs = [{
            id: "shop",
            label: game.i18n.localize("SR5.Marketplace.Tab.Shop"),
            cssClass: this.tabGroups.main === "shop" ? "active" : "",
        }, {
            id: "orderReview",
            label: game.i18n.localize("SR5.Marketplace.Tab.OrderReview"),
            cssClass: this.tabGroups.main === "orderReview" ? "active" : "",
        }];

        let tabContent;
        if (this.tabGroups.main === "shop") {
            tabContent = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shop.hbs", {
                itemsByType: this.itemData.itemsByType,
                selectedKey,
                selectedItems
            });
        } else if (this.tabGroups.main === "orderReview") {
            // Placeholder for order review content
            tabContent = `<h2>${game.i18n.localize("SR5.Marketplace.OrderReview")}</h2><p>Order review content goes here.</p>`;
        }

        return { tabs, tabContent, selectedKey, selectedItems, isGM: game.user.isGM };
    }

    async changeTab(group, tab) {
        if (this.tabGroups[group] === tab) return;
        this.tabGroups[group] = tab;
        await this.render(false);
    }
    
    /**
     * @override
     * This is the ideal place in ApplicationV2 to add event listeners.
     */
    _onRender(context, options) {
        // We explicitly bind `this` to ensure the context is correct in the handler methods.
        this.element.addEventListener("click", this._onClick.bind(this));
        
        const dropdown = this.element.querySelector("#item-type-selector");
        if (dropdown) {
            dropdown.addEventListener("change", this._onCategoryChange.bind(this));
        }
    }

    /**
     * Handles all delegated click events inside the application.
     * @param {PointerEvent} event - The originating click event.
     * @private
     */
    _onClick(event) {
        const cartButton = event.target.closest("button.add-to-cart");
        if (cartButton) {
            event.preventDefault();
            const itemUuid = cartButton.dataset.itemId;
            if (itemUuid) {
                this.basketService.addToBasket(itemUuid);
            }
            return;
        }

        const tabButton = event.target.closest(".marketplace-tab");
        if (tabButton) {
            event.preventDefault();
            const nav = tabButton.closest(".marketplace-tabs");
            const group = nav?.dataset.group;
            const tabId = tabButton.dataset.tab;
            if (group && tabId) {
                this.changeTab(group, tabId);
            }
            return;
        }
    }

    /**
     * Handles changing the item category dropdown.
     * @param {Event} event - The originating change event.
     * @private
     */
    async _onCategoryChange(event) {
        this.selectedKey = event.target.value;
        await this.render(false);
    }
    
    async _onDrop(event) {
        const data = TextEditor.getDragEventData(event);
        if (data.type === "Actor") {
            this.selectedActor = game.actors.get(data.id);
            this.render();
        }
    }
}