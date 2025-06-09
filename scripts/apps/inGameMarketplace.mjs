import { BasketService } from '../services/basketService.mjs';
import { PurchaseService } from '../services/purchaseService.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * The main application window for the SR5 Marketplace.
 * This class handles all UI rendering and user interaction.
 */
export class inGameMarketplace extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        // Use the single, globally initialized instance of ItemDataServices
        this.itemData = game.sr5marketplace.itemData;
        this.tabGroups = { main: "shop" };
        this.basketService = new BasketService();
        this.purchasingActor = null;
        // The selectedContactId is now loaded as part of the basket state in _prepareContext.
        this.selectedContactId = null; 
        
        this._onClick = this._onClick.bind(this);
        this._onChange = this._onChange.bind(this);
        this._onDrop = this._onDrop.bind(this);
    }

    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "inGameMarketplace",
            title: game.i18n.localize("SR5.Marketplace.Title"),
            classes: ["sr5-marketplace", "sr5-market"],
            position: { width: 910, height: 800, top: 50, left: 120 },
            resizable: true,
            reactive: false
        });
    }

    static PARTS = {
        main: { template: "modules/sr5-marketplace/templates/apps/inGameMarketplace/inGameMarketplace.html" },
    };

    async _prepareContext(options = {}) {
        const itemsByType = this.itemData.itemsByType;
        const basket = await this.basketService.getBasket();
        const basketItemCount = basket.shoppingCartItems.length;
        this.selectedContactId = basket.selectedContactId;

        const tabs = [{ 
            id: "shop", 
            label: game.i18n.localize("SR5.Marketplace.Tab.Shop"), 
            icon: "fa-store", 
            cssClass: this.tabGroups.main === "shop" ? "active" : "" 
        }];

        if (game.user.isGM) {
            const pendingCount = PurchaseService.getPendingRequestCount();
            tabs.push({ 
                id: "orderReview", 
                label: game.i18n.localize("SR5.Marketplace.Tab.OrderReview"), 
                icon: "fa-list-check", 
                cssClass: this.tabGroups.main === "orderReview" ? "active" : "",
                count: pendingCount 
            });
        }

        if (basketItemCount > 0) {
            // This is the corrected object for the Shopping Cart tab.
            tabs.push({ 
                id: "shoppingCart",
                label: "", // Label is empty to hide the text.
                icon: "fa-shopping-cart", 
                cssClass: this.tabGroups.main === "shoppingCart" ? "active" : "", 
                count: basketItemCount, // The count data is still provided for the badge.
                tooltip: game.i18n.localize("SR5.Marketplace.ShoppingBasket") // The full name is now the tooltip.
            });
        }
        
        if (this.tabGroups.main === "shoppingCart" && basketItemCount === 0) {
            this.tabGroups.main = "shop";
        }

        let tabContent;
        const partialContext = { basket, isGM: game.user.isGM };

        if (this.tabGroups.main === "shoppingCart") {
            partialContext.items = basket.basketItems;
            const actor = basket.createdForActor ? await fromUuid(basket.createdForActor) : null;
            if (actor) {
                this.purchasingActor = partialContext.purchasingActor = {
                    doc: actor, name: actor.name, img: actor.img, uuid: actor.uuid,
                    nuyen: actor.system.nuyen, karma: actor.system.karma.value,
                    nuyenAfterPurchase: actor.system.nuyen - (basket.totalCost || 0),
                    karmaAfterPurchase: actor.system.karma.value - (basket.totalKarma || 0)
                };
                partialContext.contacts = actor.items.filter(i => i.type === "contact").map(c => ({...c.toObject(false), isSelected: c.id === this.selectedContactId}));
            }
            tabContent = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shoppingCart.html", partialContext);
        
        } else if (this.tabGroups.main === "orderReview" && game.user.isGM) {
            const allPendingRequests = [];
            for (const user of game.users) {
                const basketState = await user.getFlag("sr5-marketplace", "basket");
                if (basketState?.orderReviewItems?.length > 0) {
                    for (const request of basketState.orderReviewItems) {
                        const actor = request.createdForActor ? await fromUuid(request.createdForActor) : null;
                        allPendingRequests.push({ 
                            user: user.toJSON(), 
                            basket: request,
                            actor: actor ? { name: actor.name, nuyen: actor.system.nuyen, karma: actor.system.karma.value } : null 
                        });
                    }
                }
            }
            partialContext.pendingRequests = allPendingRequests;
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
     * This is the final, complete version with all fixes implemented.
     * @private
     */
    async _onClick(event) {
        event.preventDefault();
        const target = event.target;
        
        // --- Tab Navigation & Link Handling ---
        const tabButton = target.closest(".marketplace-tab");
        if (tabButton) {
            this.changeTab(tabButton.closest(".marketplace-tabs").dataset.group, tabButton.dataset.tab);
            return;
        }
        const entityLink = target.closest("a[data-entity-link]");
        if (entityLink) {
            const uuid = entityLink.dataset.uuid;
            if (uuid) fromUuid(uuid).then(doc => doc?.sheet.render(true));
            return;
        }
        const contactCard = target.closest(".contact-card");
        if (contactCard) {
            const clickedId = contactCard.dataset.contactId;
            const basket = await this.basketService.getBasket();
            basket.selectedContactId = (basket.selectedContactId === clickedId) ? null : clickedId;
            await this.basketService.saveBasket(basket);
            this.render(false);
            return;
        }

        let actionTaken = false;
        
        // --- Button Handlers ---
        const cartButton = target.closest("button.add-to-cart");
        const removeButton = target.closest(".remove-from-basket-btn");
        const plusButton = target.closest(".plus");
        const minusButton = target.closest(".minus");
        const sendRequestButton = target.closest("#send-request-button");
        const approveAllButton = target.closest(".approve-all-btn");
        const rejectAllButton = target.closest(".reject-all-btn");

        if (cartButton) {
            await this.basketService.addToBasket(cartButton.dataset.itemId);
            this.tabGroups.main = "shoppingCart";
            actionTaken = true;
        } else if (removeButton) {
            await this.basketService.removeFromBasket(removeButton.closest("[data-basket-item-id]")?.dataset.basketItemId);
            actionTaken = true;
        } else if (plusButton) {
            await this.basketService.updateItemQuantity(plusButton.closest("[data-basket-item-id]")?.dataset.basketItemId, 1);
            actionTaken = true;
        } else if (minusButton) {
            await this.basketService.updateItemQuantity(minusButton.closest("[data-basket-item-id]")?.dataset.basketItemId, -1);
            actionTaken = true;
        } else if (sendRequestButton) {
            if (game.settings.get("sr5-marketplace", "approvalWorkflow")) {
                // This now correctly passes the user's ID string instead of the whole object.
                let userId = game.user._id;
                console.log(`SR5 Marketplace | Submitting purchase request for user ID: ${userId}`);
                await PurchaseService.submitForReview(userId);
            } else {
                const basket = await this.basketService.getBasket();
                const actor = basket.createdForActor ? await fromUuid(basket.createdForActor) : null;
                if (actor) {
                    await PurchaseService.directPurchase(actor, basket);
                    await this.basketService.saveBasket({ shoppingCartItems: [] });
                }
            }
            actionTaken = true;
        } else if (approveAllButton) {
            const requestBlock = approveAllButton.closest(".pending-request-block");
            await PurchaseService.approveBasket(requestBlock.dataset.userId, requestBlock.dataset.basketUuid);
            actionTaken = true;
        } else if (rejectAllButton) {
            const requestBlock = rejectAllButton.closest(".pending-request-block");
            await PurchaseService.rejectBasket(requestBlock.dataset.userId, requestBlock.dataset.basketUuid);
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
            if (basketItemId) {
                const state = await this.basketService.getFullBasketState();
                const item = state.shoppingCartItems.find(i => i.basketItemId === basketItemId);
                if (item) item.selectedRating = newRating;
                await this.basketService.saveFullBasketState(state);
                actionTaken = true;
            }
        } else if (target.matches("#item-type-selector")) {
            this.selectedKey = target.value;
            actionTaken = true;
        } else if (target.matches(".gm-review-input")) {
            const requestBlock = target.closest(".pending-request-block");
            const itemRow = target.closest(".item-row");
            
            const userId = requestBlock.dataset.userId;
            const basketUUID = requestBlock.dataset.basketUuid;
            const basketItemId = itemRow.dataset.basketItemId;
            const property = target.dataset.property;
            const value = (target.type === "number") ? Number(target.value) : target.value;

            await PurchaseService.updatePendingItem(userId, basketUUID, basketItemId, property, value);
            
            actionTaken = true; 
        }

        if (actionTaken) {
            this.render(false);
        }
    }
    
    async _onDrop(event) {
        const data = TextEditor.getDragEventData(event);
        if (data.type === "Actor") {
            const actor = game.actors.get(data.id);
        }
    }
}