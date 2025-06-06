import ItemDataServices from '../services/ItemDataServices.mjs';
import { BasketService } from '../services/basketService.mjs';

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
        const basket = await this.basketService.getBasket();

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
        }, {
            id: "shoppingCart",
            label: game.i18n.localize("SR5.Marketplace.ShoppingBasket"),
            icon: "fa-shopping-cart",
            cssClass: this.tabGroups.main === "shoppingCart" ? "active" : "",
            count: basket.basketItems.length
        }];
        
        const partialContext = { basket, itemsByType: this.itemData.itemsByType, selectedKey, selectedItems, isGM: game.user.isGM };

        let tabContent;
        if (this.tabGroups.main === "shop") {
            tabContent = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shop.hbs", partialContext);
        } else if (this.tabGroups.main === "shoppingCart") {
            partialContext.items = basket.basketItems; // Pass basket items to the cart template
            tabContent = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shoppingCart.hbs", partialContext);
        } else if (this.tabGroups.main === "orderReview") {
            tabContent = `<h2>${game.i18n.localize("SR5.Marketplace.OrderReview")}</h2><p>Order review content goes here.</p>`;
        }

        return { tabs, tabContent, tabGroups: this.tabGroups, isGM: game.user.isGM };
    }

    async changeTab(group, tab) {
        if (this.tabGroups[group] === tab) return;
        this.tabGroups[group] = tab;
        await this.render(false);
    }
    
    _onRender(context, options) {
        this.element.addEventListener("click", this._onClick.bind(this));
        this.element.addEventListener("change", this._onChange.bind(this));
    }

    async _onClick(event) {
        const target = event.target;
        
        // --- Find closest button/element for delegation ---
        const cartButton = target.closest("button.add-to-cart");
        const removeButton = target.closest(".remove-from-basket-btn");
        const plusButton = target.closest(".plus");
        const minusButton = target.closest(".minus");
        const tabButton = target.closest(".marketplace-tab");

        // --- Handle events ---
        if (cartButton) {
            event.preventDefault();
            await this.basketService.addToBasket(cartButton.dataset.itemId);
            this.render(false);
        } else if (removeButton) {
            event.preventDefault();
            const basketItemId = removeButton.closest("[data-basket-item-id]")?.dataset.basketItemId;
            if (basketItemId) {
                await this.basketService.removeFromBasket(basketItemId);
                this.render(false);
            }
        } else if (plusButton) {
            event.preventDefault();
            const basketItemId = plusButton.closest("[data-basket-item-id]")?.dataset.basketItemId;
            if(basketItemId) {
                await this.basketService.updateItemQuantity(basketItemId, 1);
                this.render(false);
            }
        } else if (minusButton) {
            event.preventDefault();
            const basketItemId = minusButton.closest("[data-basket-item-id]")?.dataset.basketItemId;
            if(basketItemId) {
                await this.basketService.updateItemQuantity(basketItemId, -1);
                this.render(false);
            }
        } else if (tabButton) {
            event.preventDefault();
            const nav = tabButton.closest(".marketplace-tabs");
            if (nav) this.changeTab(nav.dataset.group, tabButton.dataset.tab);
        }
    }

    async _onChange(event) {
        const target = event.target;
        if (target.matches(".item-rating-select")) {
            const basketItemId = target.dataset.basketItemId;
            const newRating = parseInt(target.value, 10);
            if (basketItemId) {
                await this.basketService.updateItemRating(basketItemId, newRating);
                this.render(false);
            }
        } else if (target.matches("#item-type-selector")) {
            this.selectedKey = target.value;
            await this.render(false);
        }
    }
    
    async _onDrop(event) {
        const data = TextEditor.getDragEventData(event);
        if (data.type === "Actor") {
            this.selectedActor = game.actors.get(data.id);
            this.render();
        }
    }
}