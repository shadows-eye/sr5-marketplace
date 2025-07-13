import { BasketService } from '../services/basketService.mjs';
import { PurchaseService } from '../services/purchaseService.mjs';
import { SearchService } from '../services/searchTag.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
// --- DEDICATED FLAG FOR UI STATE ---
// This is separate from the 'basket' flag and only tracks the selected actor for the UI.
const FLAG_SCOPE = "sr5-marketplace";
const FLAG_KEY_SELECTED_ACTOR = "selectedActorUuid";
/**
 * The main application window for the SR5 Marketplace.
 * This class handles all UI rendering and user interaction.
 */
export class inGameMarketplace extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        options.classes = [...(options.classes || []), "sr5-marketplace", "sr5-market"];
        super(options);
        // Use the single, globally initialized instance of ItemDataServices
        this.itemData = game.sr5marketplace.itemData;
        this.tabGroups = { main: "shop" };
        this.basketService = new BasketService();
        this.selectedActorUuid = game.user.getFlag(FLAG_SCOPE, FLAG_KEY_SELECTED_ACTOR) || null;
        this.purchasingActor = null;
        this.selectedContactId = null; 
        this.searchService = null;
        
        this._onClick = this._onClick.bind(this);
        this._onChange = this._onChange.bind(this);
        this._onDrop = this._onDrop.bind(this);
    }

    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "inGameMarketplace",
            position: { width: 910, height: 800, top: 50, left: 120 },
            
            // This is the corrected structure for window properties in ApplicationV2
            window: {
                title: "SR5.PurchaseScreen", // The localization key
                resizable: true              // This makes the window resizable
            }
        });
    }

    /**
     * @override
     * This defines the main template for the application.
     */
    static PARTS = {
        main: { template: "modules/sr5-marketplace/templates/apps/inGameMarketplace/inGameMarketplace.html" },
    };

    /**
     * Prepares all data needed for rendering the application template.
     */
    async _prepareContext(options = {}) {
        // --- DEFINITIVE ACTOR LOGIC USING FLAGS ---
        let actorForDisplay = null;
        
        // 1. Read the dedicated flag to see if an actor was previously selected.
        const selectedActorUuid = game.user.getFlag(FLAG_SCOPE, FLAG_KEY_SELECTED_ACTOR);
        if (selectedActorUuid) {
            actorForDisplay = await fromUuid(selectedActorUuid);
        }

        // 2. If no flag is set (e.g., first open), fall back to defaults.
        if (!actorForDisplay) {
            actorForDisplay = game.user.character || canvas.tokens.controlled[0]?.actor || null;
        }
        
        // 3. Set the instance property for use in other methods during this render cycle.
        this.purchasingActor = actorForDisplay;

        let purchasingActorData = null;
        if (this.purchasingActor) {
            purchasingActorData = {
                uuid: this.purchasingActor.uuid,
                name: this.purchasingActor.name,
                img: this.purchasingActor.img,
                nuyen: this.purchasingActor.system.nuyen,
                karma: this.purchasingActor.system.karma.value
            };
        }
        // --- END DEFINITIVE ACTOR LOGIC ---

        const ownedActors = game.actors.filter(a => a.isOwner).map(a => ({
            uuid: a.uuid, name: a.name, img: a.img
        }));

        const itemsByType = this.itemData.itemsByType;
        const basket = await this.basketService.getBasket();
        const basketItemCount = basket.shoppingCartItems.length;
        this.selectedContactId = basket.selectedContactId;

        const tabs = [{ 
            id: "shop", label: game.i18n.localize("SR5.Marketplace.Tab.Shop"), icon: "fa-store", cssClass: this.tabGroups.main === "shop" ? "active" : "" 
        }];

        if (game.user.isGM) {
            const pendingCount = PurchaseService.getPendingRequestCount();
            tabs.push({ 
                id: "orderReview", label: game.i18n.localize("SR5.Marketplace.Tab.OrderReview"), icon: "fa-list-check", cssClass: this.tabGroups.main === "orderReview" ? "active" : "", count: pendingCount 
            });
        }

        if (basketItemCount > 0) {
            tabs.push({ 
                id: "shoppingCart", label: "", icon: "fa-shopping-cart", cssClass: this.tabGroups.main === "shoppingCart" ? "active" : "", count: basketItemCount, tooltip: game.i18n.localize("SR5.Marketplace.ShoppingBasket")
            });
        }
        
        if (this.tabGroups.main === "shoppingCart" && basketItemCount === 0) { this.tabGroups.main = "shop"; }
        
        let tabContent;
        const partialContext = { basket, isGM: game.user.isGM, purchasingActor: purchasingActorData };

        if (this.tabGroups.main === "shoppingCart") {
            const actorForBasket = basket.createdForActor ? await fromUuid(basket.createdForActor) : null;
            if (actorForBasket) {
                partialContext.purchasingActor.nuyenAfterPurchase = actorForBasket.system.nuyen - (basket.totalCost || 0);
                partialContext.purchasingActor.karmaAfterPurchase = actorForBasket.system.karma.value - (basket.totalKarma || 0);
                partialContext.contacts = actorForBasket.items.filter(i => i.type === "contact").map(c => ({...c.toObject(false), isSelected: c.id === this.selectedContactId}));
            }
            tabContent = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shoppingCart.html", partialContext);
        
        } else if (this.tabGroups.main === "orderReview" && game.user.isGM) {
            const allPendingRequests = [];
            for (const user of game.users) {
                const basketState = await user.getFlag(FLAG_SCOPE, "basket");
                if (basketState?.orderReviewItems?.length > 0) {
                    for (const request of basketState.orderReviewItems) {
                        const actor = request.createdForActor ? await fromUuid(request.createdForActor) : null;
                        allPendingRequests.push({ 
                            user: user.toJSON(), basket: request, actor: actor ? { name: actor.name, nuyen: actor.system.nuyen, karma: actor.system.karma.value } : null 
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

        return { 
            tabs, tabContent, tabGroups: this.tabGroups, 
            actor: purchasingActorData,
            ownedActors
        };
    }

    async changeTab(group, tab) {
        this.tabGroups[group] = tab;
        await this.render(false);
    }
    
    /**
     * This method is called after the application is rendered.
     * It's the correct place to add event listeners and initialize helper services.
     */
    _onRender(context, options) {
        const html = this.element;
        // Main application listeners
        html.removeEventListener("click", this._onClick);
        html.removeEventListener("change", this._onChange);
        html.addEventListener("click", this._onClick);
        html.addEventListener("change", this._onChange);
        
        if (this.tabGroups.main === "shop") {
            // We pass 'this.element' which is the application's root HTML element.
            this.searchService = new SearchService(this.element);
            this.searchService.initialize();
        } else {
            // Ensure the service is cleaned up if we switch away from the shop tab.
            this.searchService = null;
        }
    }
    
    /**
     * Handles all delegated click events inside the application.
     * This is the final, complete version with all fixes implemented.
     * @private
     */
    async _onClick(event) {
        event.preventDefault();
        const target = event.target;
        
        // --- HEADER & ACTOR SELECTION LOGIC ---
        // This block handles all clicks within the actor selection dropdown in the header.
        const userActorArea = target.closest(".marketplace-user-actor");
        if (userActorArea) {
            // If a specific actor in the dropdown list is clicked, select it.
            const selectableActor = target.closest(".selectable-actor");
            if (selectableActor) {
                const actorUuid = selectableActor.dataset.actorUuid;
                // Save the explicit selection to a flag for persistence.
                await game.user.setFlag("sr5-marketplace", "selectedActorUuid", actorUuid);
                userActorArea.classList.remove('expanded'); // Close the dropdown.
                this.render(false); // Re-render to show the new selection.
                return;
            }

            // If the 'x' button is clicked, clear the selection.
            const clearButton = target.closest(".remove-selected-actor");
            if (clearButton) {
                await game.user.unsetFlag("sr5-marketplace", "selectedActorUuid");
                this.render(false);
                return;
            }

            // If the main avatar area is clicked, just toggle the dropdown.
            userActorArea.classList.toggle('expanded');
            return;
        }

        // --- TAB NAVIGATION ---
        const tabButton = target.closest(".marketplace-tab");
        if (tabButton) {
            this.changeTab(tabButton.closest(".marketplace-tabs").dataset.group, tabButton.dataset.tab);
            return;
        }

        // --- Document and Contact Link Handling ---
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
        
        // --- All Other Button Handlers ---
        const cartButton = target.closest("button.add-to-cart");
        const removeButton = target.closest(".remove-from-basket-btn");
        const plusButton = target.closest(".plus");
        const minusButton = target.closest(".minus");
        const sendRequestButton = target.closest("#send-request-button");
        const approveAllButton = target.closest(".approve-all-btn");
        const rejectAllButton = target.closest(".reject-all-btn");

        if (cartButton) {
            if (!this.purchasingActor) {
                //ui.notifications.warn("Please select an actor before adding items.");
                this.element.querySelector('.marketplace-user-actor')?.click();
                return;
            }
            await this.basketService.addToBasket(cartButton.dataset.itemId, this.purchasingActor.uuid);
            this.tabGroups.main = "shoppingCart";
            actionTaken = true;
        } else if (removeButton) {
            // This now correctly reads 'data-basket-item-uuid'
            await this.basketService.removeFromBasket(removeButton.closest("[data-basket-item-uuid]")?.dataset.basketItemUuid, this.purchasingActor.uuid);
            actionTaken = true;
        } else if (plusButton) {
            await this.basketService.updateItemQuantity(plusButton.closest("[data-basket-item-uuid]")?.dataset.basketItemUuid, this.purchasingActor.uuid, 1);
            actionTaken = true;
        } else if (minusButton) {
            await this.basketService.updateItemQuantity(minusButton.closest("[data-basket-item-uuid]")?.dataset.basketItemUuid, this.purchasingActor.uuid, -1);
            actionTaken = true;
        } else if (sendRequestButton) {
            if (game.settings.get("sr5-marketplace", "approvalWorkflow")) {
                await PurchaseService.submitForReview(game.user.id);
            } else {
                const basket = await this.basketService.getBasket();
                const actor = basket.createdForActor ? await fromUuid(basket.createdForActor) : null;
                if (actor) {
                    await PurchaseService.directPurchase(actor, basket);
                    await this.basketService.saveBasket(this.basketService._getDefaultBasketState());
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

    
    /**
     * Handles all delegated change events inside the application.
     * This can include changing the item category dropdown, updating an item's rating,
     * or updating values in the GM's order review screen.
     * @param {Event} event The triggering change event from the DOM.
     * @private
     */
    async _onChange(event) {
        const target = event.target;
        let actionTaken = false;
        
        // --- LOGIC RESTORED: Handle changes to the item rating dropdown ---
        if (target.matches(".item-rating-select")) {
            const basketItemId = target.dataset.basketItemId;
            const newRating = parseInt(target.value, 10);
            if (basketItemId) {
                // This logic is from your original file and is now correctly restored.
                // It requires a getFullBasketState method on the basketService.
                const state = await this.basketService.getFullBasketState(); 
                const item = state.shoppingCartItems.find(i => i.basketItemId === basketItemId);
                if (item) item.selectedRating = newRating;
                await this.basketService.saveFullBasketState(state);
                actionTaken = true;
            }
        } else if (target.matches("#item-type-selector")) {
            this.selectedKey = target.value;
            // Use the service to clear filters when changing categories
            if (this.searchService) {
                this.searchService.clearAllFilters();
            }
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