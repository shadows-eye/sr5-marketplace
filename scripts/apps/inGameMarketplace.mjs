import { BasketService } from '../services/basketService.mjs';
import { PurchaseService } from '../services/purchaseService.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class inGameMarketplace extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.itemData = game.sr5marketplace.itemData;
        this.tabGroups = { main: "shop" };
        this.basketService = new BasketService();
        this.selectedContactId = null;
        this.purchasingActor = null;
        
        this._onClick = this._onClick.bind(this);
        this._onChange = this._onChange.bind(this);
        this._onDrop = this._onDrop.bind(this);
    }

    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "purchase-screen",
            title: game.i18n.localize("SR5.Marketplace.Title"),
            classes: ["sr5-marketplace", "sr5-market"],
            position: { width: 910, height: 800, top: 50, left: 120 },
            resizable: true, // Make window resizable
            reactive: false
        });
    }

    static PARTS = {
        main: { template: "modules/sr5-marketplace/templates/apps/inGameMarketplace/inGameMarketplace.html" },
    };

    async _prepareContext(options = {}) {
        const itemsByType = this.itemData.itemsByType;
        // The basket service now correctly gets only the active, non-pending cart.
        const basket = await this.basketService.getBasket();
        const basketItemCount = basket.basketItems?.length ?? 0;

        // --- Complete Tab Generation Logic ---
        const tabs = [{ 
            id: "shop", 
            label: game.i18n.localize("SR5.Marketplace.Tab.Shop"), 
            icon: "fa-store", 
            cssClass: this.tabGroups.main === "shop" ? "active" : "" 
        }];

        if (game.user.isGM) {
            // The count now comes from our service, which correctly checks all users' pending requests.
            const pendingCount = PurchaseService.getPendingRequestCount();
            tabs.push({ 
                id: "orderReview", 
                label: game.i18n.localize("SR5.Marketplace.Tab.OrderReview"), 
                icon: "fa-list-check", 
                cssClass: this.tabGroups.main === "orderReview" ? "active" : "",
                count: pendingCount 
            });
        }

        // This logic now correctly shows the cart tab ONLY if the player has an active cart.
        if (basketItemCount > 0) {
            tabs.push({ 
                id: "shoppingCart", 
                label: game.i18n.localize("SR5.Marketplace.ShoppingBasket"), 
                icon: "fa-shopping-cart", 
                cssClass: this.tabGroups.main === "shoppingCart" ? "active" : "", 
                count: basketItemCount 
            });
        }
        
        if (this.tabGroups.main === "shoppingCart" && basketItemCount === 0) {
            this.tabGroups.main = "shop";
        }

        // --- Tab Content Rendering ---
        let tabContent;
        const partialContext = { basket, isGM: game.user.isGM };

        if (this.tabGroups.main === "shoppingCart") {
            partialContext.items = basket.basketItems;
            const actor = basket.createdForActor ? await fromUuid(basket.createdForActor) : null;
            if (actor) {
                this.purchasingActor = partialContext.purchasingActor = {
                    doc: actor, name: actor.name, img: actor.img, uuid: actor.uuid,
                    nuyen: actor.system.nuyen, karma: actor.system.karma.value,
                    nuyenAfterPurchase: actor.system.nuyen - basket.totalCost,
                    karmaAfterPurchase: actor.system.karma.value - basket.totalKarma
                };
                partialContext.contacts = actor.items.filter(i => i.type === "contact").map(c => ({...c.toObject(false), isSelected: c.id === this.selectedContactId}));
            }
            tabContent = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shoppingCart.html", partialContext);
        
        } else if (this.tabGroups.main === "orderReview" && game.user.isGM) {
            // This logic now correctly iterates through all users and their pendingRequests array.
            const pendingRequests = [];
            for (const user of game.users) {
                const state = user.getFlag("sr5-marketplace", "marketplaceState");
                if (state?.pendingRequests?.length > 0) {
                    for (const request of state.pendingRequests) {
                        const actor = request.createdForActor ? await fromUuid(request.createdForActor) : null;
                        pendingRequests.push({ 
                            user: user.toJSON(), 
                            basket: request, // Pass the specific pending basket
                            actor: actor ? { name: actor.name, nuyen: actor.system.nuyen, karma: actor.system.karma.value } : null 
                        });
                    }
                }
            }
            partialContext.pendingRequests = pendingRequests;
            tabContent = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/orderReview.html", partialContext);
        
        } else {
            this.tabGroups.main = "shop";
            partialContext.itemsByType = itemsByType;
            partialContext.selectedKey = this.selectedKey || "rangedWeapons";
            this.selectedKey = partialContext.selectedKey;
            partialContext.selectedItems = itemsByType[this.selectedKey]?.items || [];
            tabContent = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shop.html", partialContext);
        }

        return { tabs, tabContent, tabGroups: this.tabGroups };
    }

    async changeTab(group, tab) {
        this.tabGroups[group] = tab;
        await this.render(false);
    }
    
    _onRender(context, options) {
        const html = this.element;
        html.removeEventListener("click", this._onClick);
        html.removeEventListener("change", this._onChange);
        html.addEventListener("click", this._onClick);
        html.addEventListener("change", this._onChange);
    }

    /**
     * Handles all delegated click events inside the application.
     * This is the full, complete version of the method.
     * @private
     */
    async _onClick(event) {
        event.preventDefault();
        const target = event.target;
        
        const tabButton = target.closest(".marketplace-tab");
        if (tabButton) {
            this.changeTab(tabButton.closest(".marketplace-tabs").dataset.group, tabButton.dataset.tab);
            return;
        }

        let actionTaken = false;
        
        const cartButton = target.closest("button.add-to-cart");
        const sendRequestButton = target.closest("#send-request-button");
        const approveAllButton = target.closest(".approve-all-btn"); // Note: This logic needs updating for multi-requests
        const rejectAllButton = target.closest(".reject-all-btn");   // Note: This logic needs updating for multi-requests

        if (cartButton) {
            await this.basketService.addToBasket(cartButton.dataset.itemId);
            // This forces the UI to switch to the shopping cart after adding an item.
            this.tabGroups.main = "shoppingCart";
            actionTaken = true;
        } else if (sendRequestButton) {
            if (game.settings.get("sr5-marketplace", "approvalWorkflow")) {
                // The new service method correctly moves the active cart to the pending array.
                await PurchaseService.submitForReview(game.user);
            } else {
                // This logic is for direct purchase and remains the same.
                const basket = await this.basketService.getBasket();
                const actor = basket.createdForActor ? await fromUuid(basket.createdForActor) : null;
                if (actor) {
                    await PurchaseService.directPurchase(actor, basket);
                    await this.basketService.saveBasket(null); 
                }
            }
            actionTaken = true;
        } else if (approveAllButton) {
            // This button now needs to know which user and which specific basket to approve.
            const userId = approveAllButton.dataset.userId;
            const basketUUID = approveAllButton.closest(".pending-request-block").dataset.basketUuid;
            await PurchaseService.approveBasket(userId, basketUUID);
            actionTaken = true;
        } else if (rejectAllButton) {
            const userId = rejectAllButton.dataset.userId;
            const basketUUID = rejectAllButton.closest(".pending-request-block").dataset.basketUuid;
            await PurchaseService.rejectBasket(userId, basketUUID);
            actionTaken = true;
        } else if (approveItemButton) {
            const userId = approveItemButton.closest(".pending-request-block").dataset.userId;
            const basketItemId = approveItemButton.closest("[data-basket-item-id]").dataset.basketItemId;
            await PurchaseService.approveSingleItem(userId, basketItemId);
            actionTaken = true;
        } else if (rejectItemButton) {
            const userId = rejectItemButton.closest(".pending-request-block").dataset.userId;
            const basketItemId = rejectItemButton.closest("[data-basket-item-id]").dataset.basketItemId;
            await PurchaseService.rejectSingleItem(userId, basketItemId);
            actionTaken = true;
        }

        if (actionTaken) {
            this.render(false);
        }
    }
    
    async _onChange(event) {
        const target = event.target;
        let actionTaken = false;
        
        if (target.matches(".item-rating-select")) {
            const basketItemId = target.dataset.basketItemId;
            const newRating = parseInt(target.value, 10);
            if (basketItemId) await this.basketService.updateItemRating(basketItemId, newRating);
            actionTaken = true;
        } else if (target.matches("#item-type-selector")) {
            this.selectedKey = target.value;
            actionTaken = true;
        } else if (target.matches(".gm-review-input")) {
            const itemRow = target.closest(".item-row");
            const userId = target.closest(".pending-request-block").dataset.userId;
            const basketItemId = itemRow.dataset.basketItemId;
            const property = target.dataset.property;
            const value = (target.type === "number") ? Number(target.value) : target.value;
            await PurchaseService.updatePendingItem(userId, basketItemId, property, value);
            return; 
        }

        if (actionTaken) {
            this.render(false);
        }
    }
    
    async _onDrop(event) {
        const data = TextEditor.getDragEventData(event);
        if (data.type === "Actor") {
            const actor = game.actors.get(data.id);
            // This is a placeholder for actor drop logic, which can be expanded later
        }
    }
}