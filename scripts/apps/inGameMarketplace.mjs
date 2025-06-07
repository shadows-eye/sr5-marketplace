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

        // Bind event handlers to `this` and store them so they can be added and removed.
        this._onClick = this._onClick.bind(this);
        this._onChange = this._onChange.bind(this);
    }

    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "purchase-screen",
            title: game.i18n.localize("SR5.PurchaseScreen"),
            classes: ["sr5-marketplace"],
            position: { width: 910, height: 800, top: 50, left: 120 },
            reactive: false
        });
    }

    static PARTS = {
        main: {
            template: "modules/sr5-marketplace/templates/apps/inGameMarketplace/inGameMarketplace.html",
        },
    };

    async _prepareContext(options = {}) {
        await this.itemData.fetchItems();
        const basket = await this.basketService.getBasket();
        const basketItemCount = basket.basketItems.length;

        const selectedKey = this.selectedKey || "rangedWeapons";
        this.selectedKey = selectedKey;
        const selectedItems = this.itemData.itemsByType[selectedKey]?.items || [];

        const tabs = [{
            id: "shop",
            label: game.i18n.localize("SR5.Marketplace.Tab.Shop"),
            icon: "fa-store",
            cssClass: this.tabGroups.main === "shop" ? "active" : ""
        }, {
            id: "orderReview",
            label: game.i18n.localize("SR5.Marketplace.Tab.OrderReview"),
            icon: "fa-list-check",
            cssClass: this.tabGroups.main === "orderReview" ? "active" : ""
        }];

        // Only add the Shopping Cart tab if the basket is not empty
        if (basketItemCount > 0) {
            tabs.push({
                id: "shoppingCart",
                label: ` (${basketItemCount})`,
                icon: "fa-shopping-cart",
                cssClass: this.tabGroups.main === "shoppingCart" ? "active" : "",
                count: basketItemCount
            });
        }
        
        // If the cart becomes empty while the user is viewing it, switch back to the shop tab
        if (this.tabGroups.main === "shoppingCart" && basketItemCount === 0) {
            this.tabGroups.main = "shop";
        }

        const partialContext = { basket, itemsByType: this.itemData.itemsByType, selectedKey, selectedItems, isGM: game.user.isGM };
        let tabContent;

        if (this.tabGroups.main === "shoppingCart") {
            partialContext.items = basket.basketItems;
            tabContent = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shoppingCart.html", partialContext);
        } else if (this.tabGroups.main === "orderReview") {
            tabContent = `<h2>${game.i18n.localize("SR5.Marketplace.OrderReview")}</h2><p>Order review content goes here.</p>`;
        } else {
            tabContent = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shop.html", partialContext);
        }

        return { tabs, tabContent, tabGroups: this.tabGroups, isGM: game.user.isGM };
    }

    async changeTab(group, tab) {
        if (this.tabGroups[group] === tab) return;
        this.tabGroups[group] = tab;
        await this.render(false);
    }
    
    /**
     * @override
     * Clean up and re-apply event listeners on every render.
     */
    _onRender(context, options) {
        const html = this.element;
        
        // --- THIS IS THE FIX ---
        // Remove any listeners from the previous render to prevent duplication.
        html.removeEventListener("click", this._onClick);
        html.removeEventListener("change", this._onChange);

        // Add the fresh listeners.
        html.addEventListener("click", this._onClick);
        html.addEventListener("change", this._onChange);
    }

    /**
     * Handles all delegated click events inside the application.
     * @private
     */
    async _onClick(event) {
      // Item Link Click Handler ---
        const itemLink = event.target.closest("a[data-entity-link='Item']");
        if (itemLink) {
            event.preventDefault();
            const uuid = itemLink.dataset.uuid;
            if (uuid) {
                const item = await fromUuid(uuid);
                item?.sheet.render(true);
            }
            return;
        }
        const target = event.target;
        
        const cartButton = target.closest("button.add-to-cart");
        const removeButton = target.closest(".remove-from-basket-btn");
        const plusButton = target.closest(".plus");
        const minusButton = target.closest(".minus");
        const tabButton = target.closest(".marketplace-tab");

        if (cartButton) {
            event.preventDefault();
            await this.basketService.addToBasket(cartButton.dataset.itemId);
        } else if (removeButton) {
            event.preventDefault();
            const basketItemId = removeButton.closest("[data-basket-item-id]")?.dataset.basketItemId;
            if (basketItemId) await this.basketService.removeFromBasket(basketItemId);
        } else if (plusButton) {
            event.preventDefault();
            const basketItemId = plusButton.closest("[data-basket-item-id]")?.dataset.basketItemId;
            if(basketItemId) await this.basketService.updateItemQuantity(basketItemId, 1);
        } else if (minusButton) {
            event.preventDefault();
            const basketItemId = minusButton.closest("[data-basket-item-id]")?.dataset.basketItemId;
            if(basketItemId) await this.basketService.updateItemQuantity(basketItemId, -1);
        } else if (tabButton) {
            event.preventDefault();
            const nav = tabButton.closest(".marketplace-tabs");
            if (nav) this.changeTab(nav.dataset.group, tabButton.dataset.tab);
            return;
        } else {
            return;
        }
        
        // Re-render the application after any basket-modifying action
        this.render(false);
    }

    /**
     * Handles all delegated change events inside the application.
     * @private
     */
    async _onChange(event) {
        const target = event.target;
        if (target.matches(".item-rating-select")) {
            const basketItemId = target.dataset.basketItemId;
            const newRating = parseInt(target.value, 10);
            if (basketItemId) {
                await this.basketService.updateItemRating(basketItemId, newRating);
            }
        } else if (target.matches("#item-type-selector")) {
            this.selectedKey = target.value;
        } else {
            return; // Exit if no relevant element was changed
        }

        // Re-render after any change
        this.render(false);
    }
    
    async _onDrop(event) {
        const data = TextEditor.getDragEventData(event);
        if (data.type === "Actor") {
            this.selectedActor = game.actors.get(data.id);
            this.render();
        }
    }
}