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
        this.selectedContactId = game.user.getFlag("sr5-marketplace", "selectedContactId") || null;
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
        const basketItemCount = basket.basketItems?.length ?? 0;

        const tabs = [{ 
            id: "shop", 
            label: game.i18n.localize("SR5.Marketplace.Tab.Shop"), 
            icon: "fa-store", 
            cssClass: this.tabGroups.main === "shop" ? "active" : "",
            tooltip: game.i18n.localize("SR5.Marketplace.Tab.Shop")
        }];

        if (game.user.isGM) {
            const pendingCount = PurchaseService.getPendingRequestCount();
            tabs.push({ 
                id: "orderReview", 
                label: game.i18n.localize("SR5.Marketplace.Tab.OrderReview"), 
                icon: "fa-list-check", 
                cssClass: this.tabGroups.main === "orderReview" ? "active" : "",
                count: pendingCount,
                tooltip: game.i18n.localize("SR5.Marketplace.Tab.OrderReview")
            });
        }

        if (basketItemCount > 0) {
            // --- This object is now corrected to match your requirement ---
            tabs.push({ 
                id: "shoppingCart", 
                label: "", // The label is now empty to hide the text.
                icon: "fa-shopping-cart", 
                cssClass: this.tabGroups.main === "shoppingCart" ? "active" : "", 
                count: basketItemCount, // The item count is included.
                tooltip: game.i18n.localize("SR5.Marketplace.ShoppingBasket") // The full name is now a tooltip.
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
            const pendingRequests = [];
            for (const user of game.users) {
                const state = user.getFlag("sr5-marketplace", "marketplaceState");
                if (state?.pendingRequests?.length > 0) {
                    for (const request of state.pendingRequests) {
                        const actor = request.createdForActor ? await fromUuid(request.createdForActor) : null;
                        pendingRequests.push({ 
                            user: user.toJSON(), 
                            basket: request,
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
     * This is the full, complete, and corrected version of the method.
     * @private
     */
    async _onClick(event) {
        event.preventDefault();
        const target = event.target;
        
        // --- Tab Navigation ---
        const tabButton = target.closest(".marketplace-tab");
        if (tabButton) {
            this.changeTab(tabButton.closest(".marketplace-tabs").dataset.group, tabButton.dataset.tab);
            return;
        }

        // --- Document Link Handling ---
        const entityLink = target.closest("a[data-entity-link]");
        if (entityLink) {
            const uuid = entityLink.dataset.uuid;
            if (uuid) fromUuid(uuid).then(doc => doc?.sheet.render(true));
            return;
        }
        
        // --- Contact Card Selection & Sheet Opening ---
        const contactCard = target.closest(".contact-card");
        if (contactCard) {
            const clickedId = contactCard.dataset.contactId;
            if (target.matches(".contact-icon")) {
                // If the icon specifically is clicked, open the contact's sheet
                if (this.purchasingActor) {
                    const purchasingActorDoc = await fromUuid(this.purchasingActor.uuid);
                    const contactItem = purchasingActorDoc?.items.get(clickedId);
                    contactItem?.sheet.render(true);
                }
            } else {
                // Otherwise, handle selection/deselection for the whole card
                this.selectedContactId = (this.selectedContactId === clickedId) ? null : clickedId;
                // Save the selection state for persistence
                await game.user.setFlag("sr5-marketplace", "selectedContactId", this.selectedContactId);
                this.render(false);
            }
            return; // Stop further processing after handling the contact card
        }

        let actionTaken = false;
        
        // --- All Button Handlers ---
        const cartButton = target.closest("button.add-to-cart");
        const removeButton = target.closest(".remove-from-basket-btn");
        const plusButton = target.closest(".plus");
        const minusButton = target.closest(".minus");
        const sendRequestButton = target.closest("#send-request-button");
        const approveAllButton = target.closest(".approve-all-btn");
        const rejectAllButton = target.closest(".reject-all-btn");
        const approveItemButton = target.closest(".approve-item-btn");
        const rejectItemButton = target.closest(".reject-item-btn");

        if (cartButton) {
            await this.basketService.addToBasket(cartButton.dataset.itemId);
            this.tabGroups.main = "shoppingCart";
            actionTaken = true;
        } else if (removeButton) {
            const basketItemId = removeButton.closest("[data-basket-item-id]")?.dataset.basketItemId;
            if (basketItemId) await this.basketService.removeFromBasket(basketItemId);
            actionTaken = true;
        } else if (plusButton) {
            const basketItemId = plusButton.closest("[data-basket-item-id]")?.dataset.basketItemId;
            if (basketItemId) await this.basketService.updateItemQuantity(basketItemId, 1);
            actionTaken = true;
        } else if (minusButton) {
            const basketItemId = minusButton.closest("[data-basket-item-id]")?.dataset.basketItemId;
            if (basketItemId) await this.basketService.updateItemQuantity(basketItemId, -1);
            actionTaken = true;
        } else if (sendRequestButton) {
            const basket = await this.basketService.getBasket();
            if (game.settings.get("sr5-marketplace", "approvalWorkflow")) {
                await PurchaseService.submitForReview(game.user, basket);
            } else {
                const actor = basket.createdForActor ? await fromUuid(basket.createdForActor) : null;
                if (actor) {
                    await PurchaseService.directPurchase(actor, basket);
                    await this.basketService.saveBasket(null); 
                }
            }
            actionTaken = true;
        } else if (approveAllButton) {
            const requestBlock = approveAllButton.closest(".pending-request-block");
            const userId = requestBlock.dataset.userId;
            const basketUUID = requestBlock.dataset.basketUuid;
            await PurchaseService.approveBasket(userId, basketUUID);
            actionTaken = true;
        } else if (rejectAllButton) {
            const requestBlock = rejectAllButton.closest(".pending-request-block");
            const userId = requestBlock.dataset.userId;
            const basketUUID = requestBlock.dataset.basketUuid;
            await PurchaseService.rejectBasket(userId, basketUUID);
            actionTaken = true;
        } else if (approveItemButton) {
            const requestBlock = approveItemButton.closest(".pending-request-block");
            const itemRow = approveItemButton.closest(".item-row");
            const userId = requestBlock.dataset.userId;
            const basketUUID = requestBlock.dataset.basketUuid;
            const basketItemId = itemRow.dataset.basketItemId;
            await PurchaseService.approveSingleItem(userId, basketUUID, basketItemId);
            actionTaken = true;
        } else if (rejectItemButton) {
            const requestBlock = rejectItemButton.closest(".pending-request-block");
            const itemRow = rejectItemButton.closest(".item-row");
            const userId = requestBlock.dataset.userId;
            const basketUUID = requestBlock.dataset.basketUuid;
            const basketItemId = itemRow.dataset.basketItemId;
            await PurchaseService.rejectSingleItem(userId, basketUUID, basketItemId);
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
            const requestBlock = target.closest(".pending-request-block");
            const itemRow = target.closest(".item-row");

            // Gather all necessary IDs to find the exact item to update
            const userId = requestBlock.dataset.userId;
            const basketUUID = requestBlock.dataset.basketUuid;
            const basketItemId = itemRow.dataset.basketItemId;
            
            const property = target.dataset.property;
            const value = (target.type === "number") ? Number(target.value) : target.value;

            await PurchaseService.updatePendingItem(userId, basketUUID, basketItemId, property, value);
            
            // Re-render the view so the GM can see updated totals immediately
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