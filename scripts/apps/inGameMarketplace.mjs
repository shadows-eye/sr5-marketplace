import ItemDataServices from '../services/ItemDataServices.mjs';
import { AppDialogBuilder } from './documents/dialog/AppDialogBuilder.mjs';
import { ItemPreviewApp } from "./documents/items/ItemPreviewApp.mjs"; 
import { BasketService } from '../services/basketService.mjs';
import { PurchaseService } from '../services/purchaseService.mjs';
import { SearchService } from '../services/searchTag.mjs';
import { DialogTestModifierService as DialogModifierService } from '../apps/documents/dialog/DialogModifierService.mjs'; // Builder for Dialog For inline-Dialog in Apps
import { AppTestFlagService } from '../services/AppTestFlagService.mjs';
import{ MODULE_ID } from '../lib/constants.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const FLAG_SCOPE = MODULE_ID // "sr5-marketplace"
const FLAG_KEY_SELECTED_ACTOR = "selectedActorUuid";

export class inGameMarketplace extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        // 1. Get the current theme from our helper function.
        const currentTheme = inGameMarketplace._getThemeFromSetting();
        // 2. Add all required classes, including the detected theme, to the options.
        options.classes = [
            ...(options.classes || []),
            "sr5-marketplace",
            "sr5-market",
            "themed",
            currentTheme // Add the detected theme here
        ];
        super(options);
        this.testType = null;
        this.activeDialogId = null;
        this.activeTestState = this.activeDialogId ? testStates[this.activeDialogId] : null;
        //this.itemData = new ItemDataServices();
        this.skill = null;
        this.attribute = null;
        this.modifier = null;
        this.availabilityStr = null;
        // --- Services & App State ---
        this.itemData = game.sr5marketplace.api.itemData;
        this.basketService = new BasketService();
        this.tabGroups = { main: "shop" };
        this.purchasingActor = null;
        this.searchService = null;

        // --- Handle passed-in shop context ---
        this.shopActorUuid = options.shopActorUuid ?? null;
        this.selectedSource = this.shopActorUuid ?? "global"; // Default to global or specific shop

        // --- FIX: Leave this null! The _prepareContext method will handle picking the first category ---
        this.selectedKey = null;
        this.scrollState = {
            throttle: false,
            itemHeight: 60, // Estimate of how tall your item card is in pixels
            entries: []     // The full list of items we want to render
        };
        this.currentCategoryItems = [];
    }

    /** @override */
    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "inGameMarketplace",
            position: { width: 910, height: 800, top: 50, left: 120 },
            window: { title: "SR5.PurchaseScreen", resizable: true },
            actions: {
                changeTab: this.#onChangeTab,
                toggleActorList: this.#onToggleActorList,
                selectActor: this.#onSelectActor,
                clearActor: this.#onClearActor,
                openDocumentLink: this.#onOpenDocumentLink,
                addToCart: this.#onAddToCart,
                removeFromCart: this.#onRemoveFromCart,
                increaseQuantity: this.#onUpdateQuantity,
                decreaseQuantity: this.#onUpdateQuantity,
                sendRequest: this.#onSendRequest,
                cancelRequest: this.#onCancelRequest,
                approveAll: this.#onApproveRejectAll,
                rejectAll: this.#onApproveRejectAll,
                approveItem: this.#onApproveRejectItem,
                rejectItem: this.#onApproveRejectItem,
                // DIALOG Changes
                applyModifier: this.#onApplyModifier, //adds and removes
                changeTestParameter: this._onChangeTestParameter, //changes what skill or attribute is used
                //changeCategory: this.onChangeCategory, Is moved to _onRender
                updateRating: this.#onUpdateRating,
                updatePendingItem: this.#onUpdatePendingItem,
                runResistTest: this.#onRollResist,
                continueExtendedTest: this.#onContinueExtendedTest,
                runAvailabilityTest: this.#onRunAvailabilityTest,
                showAvailabilityDialog: this.#onShowAvailabilityDialog,
                selectContact: this.#onSelectContact
            }
        });
    }
    
    /**
     * Determines whether to get all items or just a specific shop's items.
     * @returns {Promise<object>}
     */
    async #getItemsForSource() {
        if (this.selectedSource === "global") {
            return await this.itemData.fetchGlobalItems();
        }
        return await this.itemData.getShopItems(this.selectedSource);
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);

        if (this.tabGroups.main === "shop") {
            this.searchService = new SearchService(this.element, this._applySearchFilter.bind(this));
            this.searchService.initialize();
            
            const categorySelector = this.element.querySelector("#item-type-selector");
            if (categorySelector) categorySelector.addEventListener("change", this.onChangeCategory.bind(this));

            const sourceToggle = this.element.querySelector("#marketplace-source-toggle");
            if (sourceToggle) sourceToggle.addEventListener("change", this.onSourceChange.bind(this));

            // --- NEW: Initialize Virtual Scroller ---
            const itemsContainer = this.element.querySelector("#marketplace-items");
            if (itemsContainer) {
                // Attach the scroll listener
                itemsContainer.addEventListener("scroll", this._onScrollItems.bind(this), { passive: true });
                // Trigger the first draw (items 0 to 50)
                this._renderItemSlice(0, 50);
            }
        } else {
            this.searchService = null;
        }
        // If we are on the shopping cart tab, find the dropdowns and attach listeners.
        if (this.tabGroups.main === "shoppingCart") {
            const parameterSelects = this.element.querySelectorAll('select[data-action="changeTestParameter"]');
            for ( const select of parameterSelects ) {
                select.addEventListener("change", (event) => {
                    // We manually call the handler, passing the correct `this` context.
                    this._onChangeTestParameter(event, select);
                });
            }
        }
    }

    /**
     * Handles the change event for the item source toggle. 
     * With event listener Attached in _onRender
     */
    async onSourceChange(event) {
        const isChecked = event.currentTarget.checked;
        this.selectedSource = isChecked ? this.shopActorUuid : "global";
        await this.render();
    }

    /** @override */
    static PARTS = {
        main: { template: "modules/sr5-marketplace/templates/apps/inGameMarketplace/inGameMarketplace.html" },
    };

    /** @override */
    async _prepareContext(options = {}) {
        const AppUserId = await game.user.id;
        //console.log(AppUserId);
        const selectedActorUuid = game.user.getFlag(FLAG_SCOPE, FLAG_KEY_SELECTED_ACTOR);
        let actorForDisplay = selectedActorUuid ? await fromUuid(selectedActorUuid) : null;
        if (!actorForDisplay) {
            actorForDisplay = game.user.character || canvas.tokens.controlled[0]?.actor || null;
        }
        this.purchasingActor = actorForDisplay;
        
        let purchasingActorData = null;
        if (this.purchasingActor) {
            purchasingActorData = {
                uuid: this.purchasingActor.uuid, name: this.purchasingActor.name, img: this.purchasingActor.img,
                nuyen: this.purchasingActor.system.nuyen, karma: this.purchasingActor.system.karma.value
            };
        }

        const ownedActors = game.actors.filter(a => a.isOwner).map(a => ({ uuid: a.uuid, name: a.name, img: a.img }));
        const itemsByType = this.itemData.itemsByType;
        const basket = await this.basketService.getBasket();
        console.log(basket);
        const basketItemCount = basket.shoppingCartItems.length;
        //Initial Dialog States
        const testStates = await AppTestFlagService.readState(AppUserId);
        console.log(testStates);
        const unresolvedTest = Object.values(testStates).find(t => !t.resolved);
        this.activeDialogId = unresolvedTest?.id || null;
        console.log(this.activeDialogId);
        // Use the variable we just defined, not a separate one

        const activeTestState = this.activeDialogId ? testStates[this.activeDialogId] : null;
        // Only perform the merge if an active test state actually exists.
        if(activeTestState){
            this.testType = activeTestState.testType;
            this.availabilityStr = basket.totalAvailability;
            this.skill = activeTestState.skill;
            this.attribute = activeTestState.attribute;
            this.modifiers = activeTestState.modifiers;
            this.activeTestState = activeTestState;
        }

        const tabs = [{ 
            id: "shop", label: game.i18n.localize("SR5Marketplace.Marketplace.Tab.Shop"), icon: "fa-store",
            cssClass: this.tabGroups.main === "shop" ? "active" : "" 
        }];

        if (game.user.isGM) {
            tabs.push({ 
                id: "orderReview", label: game.i18n.localize("SR5Marketplace.Marketplace.Tab.OrderReview"),
                icon: "fa-list-check", cssClass: this.tabGroups.main === "orderReview" ? "active" : "",
                count: PurchaseService.getPendingRequestCount() 
            });
        }
        if (basketItemCount > 0) {
            tabs.push({ 
                id: "shoppingCart", label: "", icon: "fa-shopping-cart",
                cssClass: this.tabGroups.main === "shoppingCart" ? "active" : "",
                count: basketItemCount, tooltip: game.i18n.localize("SR5Marketplace.Marketplace.ShoppingBasket")
            });
        }
        
        if (this.tabGroups.main === "shoppingCart" && basketItemCount === 0) {
            this.tabGroups.main = "shop";
        }
    
    let tabContent;
    let partialContext = { basket, isGM: game.user.isGM, purchasingActor: purchasingActorData, activeTestState };
    const render = foundry.applications.handlebars.renderTemplate;

    switch (this.tabGroups.main) {
            case "shoppingCart":
                // Prepare standard shopping cart data (contacts)
                if (this.purchasingActor) {
                    // 1. Determine the correct source for items.
                    //    Prioritize the actor from a single controlled token, if one exists.
                    //    This correctly handles unlinked tokens with their own inventories.
                    const controlledToken = canvas.tokens.controlled[0];
                    const itemSource = (controlledToken && controlledToken.actor.id === this.purchasingActor.id) 
                        ? controlledToken.actor 
                        : this.purchasingActor;

                    // 2. Get contacts from the determined source (either the token's actor or the base actor).
                    partialContext.contacts = itemSource.items
                        .filter(i => i.type === "contact")
                        .map(c => {
                            const contactData = c.toObject(false);
                            contactData.uuid = c.uuid;
                            contactData.isSelected = c.uuid === basket.selectedContactUuid;
                            return contactData;
                        });
                }

                // --- FLAG-BASED WORKFLOW ---
                if (activeTestState) {
                    const builder = new AppDialogBuilder();
                    const dialogContext = await builder.buildTestDialogContext(activeTestState, basket);
                    
                    // --- THIS IS THE FIX (Part 2) ---
                    // Merge the results directly INTO the 'activeTestState' object.
                    if (dialogContext) {
                        foundry.utils.mergeObject(partialContext.activeTestState, dialogContext);
                    }
                }
                // --- END NEW FLAG-BASED WORKFLOW ---
            console.log("LOG: Final context object passed to shoppingCart.html:", partialContext);
            tabContent = await render("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shoppingCart.html", partialContext);
            break;
        case "orderReview":
                partialContext.pendingRequests = await PurchaseService.getAllPendingRequests();
                tabContent = await render("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/orderReview.html", partialContext);
                break;
        default:
                // --- ADDED DEBUG LOG ---
                //console.log(`%cRendering View:`, "color: green; font-weight: bold;", { selectedKey_for_render: this.selectedKey });
                // --- END DEBUG LOG ---
                this.tabGroups.main = "shop";
                const itemsByType = await this.#getItemsForSource();
                
                if (!this.selectedKey || !itemsByType[this.selectedKey] || itemsByType[this.selectedKey].items.length === 0) {
                    const firstAvailableCategory = Object.entries(itemsByType).find(([, data]) => data.items.length > 0);
                    this.selectedKey = firstAvailableCategory ? firstAvailableCategory[0] : null;
                }
                
                // --- UPDATED: Prepare data for the toggle switch ---
                partialContext.shopActorUuid = this.shopActorUuid;
                partialContext.isShopView = this.selectedSource !== "global";
                if (this.shopActorUuid) {
                    const shopActor = await fromUuid(this.shopActorUuid);
                    partialContext.shopName = shopActor?.name ?? "Shop";
                }
                
                partialContext.itemsByType = itemsByType;
                partialContext.selectedKey = this.selectedKey;
                
                // --- NEW: Save the items to the Virtual Scroller instead of Handlebars ---
                const itemsToRender = this.selectedKey ? (itemsByType[this.selectedKey]?.items || []) : [];
                this.currentCategoryItems = itemsToRender; 
                this.scrollState.entries = itemsToRender; // Scroller reads from this one!
                
                partialContext.selectedItems = []; // Let the scroller draw the HTML
                tabContent = await foundry.applications.handlebars.renderTemplate("modules/sr5-marketplace/templates/apps/inGameMarketplace/partials/shop.html", partialContext);
            break;
        }

        return { tabs, tabContent, actor: purchasingActorData, ownedActors };
    }
    //-- Static Helpers -- //
    /**
     * A static helper to determine the current UI theme from the main Foundry interface.
     * It checks the Actors tab for either 'theme-dark' or 'theme-light'.
     * @returns {string} The detected theme class name ('theme-dark' or 'theme-light').
     * @private
     */
    static _getThemeFromSetting() {
        // 1. Get the entire UI configuration object from the core settings.
        const uiConfig = game.settings.get("core", "uiConfig");
        
        // 2. Access the 'applications' property within that object.
        
        const themeValue = uiConfig?.colorScheme.applications;
        console.log(themeValue);
        if (themeValue === "dark") {
            return "theme-dark";
        }
        return "theme-light"; // Default to light theme
    }
    // --- ACTION HANDLERS ---
    static #onChangeTab(event, target) {
        const tabId = target.dataset.tab;
        if (this.tabGroups.main !== tabId) {
            this.tabGroups.main = tabId;
            this.render();
        }
    }
    
    static #onToggleActorList(event, target) {
        target.closest(".marketplace-user-actor")?.classList.toggle("expanded");
    }

    static async #onSelectActor(event, target) {
        await game.user.setFlag(FLAG_SCOPE, FLAG_KEY_SELECTED_ACTOR, target.dataset.actorUuid);
        target.closest(".marketplace-user-actor")?.classList.remove("expanded");
        this.render();
    }

    static async #onClearActor(event, target) {
        event.stopPropagation();
        await game.user.unsetFlag(FLAG_SCOPE, FLAG_KEY_SELECTED_ACTOR);
        this.render();
    }

    /**
     * Passes only the item's UUID to the ItemPreviewApp.
     */
    static async #onOpenDocumentLink(event, target) {
        const uuid = target.dataset.uuid;
        if (!uuid) return;
        const item = await fromUuid(uuid);
        if (!item) return;

        if (item.isOwner) {
            item.sheet.render(true);
        } else {
            // The call is now simpler, pointing to the standalone app
            new ItemPreviewApp(item.uuid).render(true);
        }
    }

    static async #onAddToCart(event, target) {
        if (!this.purchasingActor) {
            ui.notifications.warn("SR5Marketplace.Marketplace.selectActorTooltip", { localize: true });
            return;
        }
        await this.basketService.addToBasket(target.dataset.itemId, this.purchasingActor.uuid);
        this.tabGroups.main = "shoppingCart";
        this.render();
    }

    /**
     * @summary Removes an item from the shopping cart.
     * @description If removing the item results in an empty basket, this handler
     * will also call the AppTestFlagService to delete any in-progress test states.
     * @private
     */
    static async #onRemoveFromCart(event, target) {
        // 1. Remove the item from the basket as before.
        const itemUuid = target.closest("[data-basket-item-uuid]")?.dataset.basketItemUuid;
        await this.basketService.removeFromBasket(itemUuid);

        // --- THIS IS THE FIX ---
        // 2. Get the updated basket state.
        const basket = await this.basketService.getBasket();

        // 3. If the basket is now empty, clear any associated test flags.
        if (basket.shoppingCartItems.length === 0) {
            console.log("LOG: Basket is now empty, clearing any active test state flag.");
            await AppTestFlagService.deleteState(); // This will clear the flag for the current user.
            
            // Also clear the local instance state to prevent issues until the next render.
            this.activeTestState = null;
            this.activeDialogId = null;
        }

        // 4. Re-render the application.
        this.render();
    }

    static async #onUpdateQuantity(event, target) {
        const itemUuid = target.closest("[data-basket-item-uuid]")?.dataset.basketItemUuid;
        const amount = target.dataset.action === "increaseQuantity" ? 1 : -1;
        await this.basketService.updateItemQuantity(itemUuid, this.purchasingActor.uuid, amount);
        this.render();
    }

    static async #onSendRequest(event, target) {
        const isApprovalWorkflow = game.settings.get("sr5-marketplace", "approvalWorkflow");
        if (isApprovalWorkflow) {
            await PurchaseService.submitForReview(game.user.id);
        } else {
            const basket = await this.basketService.getBasket();
            const actor = await fromUuid(basket.createdForActor);
            if (actor) {
                await PurchaseService.directPurchase(actor, basket);
                await this.basketService.clearBasket();
            }
        }
        this.render();
    }
    
    static async #onCancelRequest(event, target) {
        await this.basketService.clearBasket();
        this.render();
    }
    
    static async #onApproveRejectAll(event, target) {
        const requestBlock = target.closest(".pending-request-block");
        const userId = requestBlock.dataset.userId;
        const basketUuid = requestBlock.dataset.basketUuid;
        if (target.dataset.action === "approveAll") {
            await PurchaseService.approveBasket(userId, basketUuid);
        } else {
            await PurchaseService.rejectBasket(userId, basketUuid);
        }
        this.render();
    }

    static async #onApproveRejectItem(event, target) {
        if (target.dataset.action === "rejectItem") {
            const requestBlock = target.closest(".pending-request-block");
            const itemRow = target.closest(".item-row");
            await PurchaseService.rejectItemFromRequest(requestBlock.dataset.userId, requestBlock.dataset.basketUuid, itemRow.dataset.basketItemId);
            this.render();
        } else {
            ui.notifications.info("Items are approved by default. Use 'Reject' to remove an item from the request.");
        }
    }
    
    /**
     * Handles the change event for the item category dropdown.
     * With event listener Attached in _onRender
     * @param {Event} event The `change` event.
     */
    async onChangeCategory(event) {
        // `event.currentTarget.value` will now always be the new, correct value.
        this.selectedKey = event.currentTarget.value;
        this.searchService?.clearAllFilters();
        await this.render();
    }

    static async #onUpdateRating(event, target) {
        const itemUuid = target.dataset.basketItemUuid;
        const newRating = parseInt(target.value, 10);
        await this.basketService.updateItemProperty(itemUuid, "selectedRating", newRating);
        this.render();
    }
    
    static async #onUpdatePendingItem(event, target) {
        const requestBlock = target.closest(".pending-request-block");
        const itemRow = target.closest(".item-row");
        const property = target.dataset.property;
        const value = (target.type === "number") ? Number(target.value) : target.value;
        await PurchaseService.updatePendingItem(requestBlock.dataset.userId, requestBlock.dataset.basketUuid, itemRow.dataset.basketItemId, property, value);
        this.render();
    }

    /**
     * @summary Handles selecting or deselecting a contact.
     * @description Updates the selected contact in the basket. If an availability test is
     * active, it also re-evaluates the actor to be used for the test (prioritizing the
     * contact's linked actor) and updates the persistent test state in the flag.
     * @private
     */
    static async #onSelectContact(event, target) {
        const clickedContactUuid = target.dataset.contactUuid;
        const basket = await this.basketService.getBasket();

        // 1. Toggle the selected contact in the basket.
        const newSelectedUuid = basket.selectedContactUuid === clickedContactUuid ? null : clickedContactUuid;
        await this.basketService.setSelectedContact(newSelectedUuid);

        // --- THIS IS THE NEW LOGIC ---
        // 2. If a test is currently active, we must update its state as well.
        if (this.activeTestState) {
            console.log("LOG: Active test found, updating contact and actor information...");

            // 3. Determine the new actor UUID for the test. Default to the purchasing actor.
            let newActorForTestUuid = this.purchasingActor.uuid; 
            
            // If a contact is now selected, check for a linked actor.
            if (newSelectedUuid) {
                const contactItem = await fromUuid(newSelectedUuid);
                if (contactItem?.system?.linkedActor) {
                    newActorForTestUuid = contactItem.system.linkedActor;
                }
            }

            // 4. Prepare the data to be saved to the flag.
            const updateData = {
                connectionUuid: newSelectedUuid,
                actorUuid: newActorForTestUuid
            };
            
            // 5. Update the flag with the new information.
            await AppTestFlagService.updateTest(this.activeTestState.id, updateData);
        }
        // --- END OF NEW LOGIC ---

        // 6. Re-render the application to show all changes.
        this.render();
    }

    /**
     * @summary Initiates the test workflow by creating the initial test state in a user flag.
     * @description This handler gathers the necessary actor and item UUIDs from the current
     * basket, uses the AppTestFlagService to create a new persistent test record with a
     * status of 'initial', and then triggers a re-render of the application.
     * @param {Event} event - The triggering click event.
     * @param {HTMLElement} target - The button element that was clicked.
     * @private
     */
    static async #onShowAvailabilityDialog(event, target) {
        console.log("%c--- Action: Show Availability Dialog ---", "color: green; font-weight: bold;");
        const CurrentUserId = await game.user.id;
        const basket = await this.basketService.getBasket(CurrentUserId);
        
        if (basket.shoppingCartItems.length === 0) {
            return ui.notifications.warn("Your shopping cart is empty.");
        }
        this.availabilityStr=basket.totalAvailabilityRating;
        // --- Check The Actor---
        // 1. Start with the purchasing actor's UUID as the default.
        let actorForTestUuid = this.purchasingActor.uuid;

        // 2. Check if a connection (contact) is selected in the basket.
        if (basket.selectedContactUuid) {
            const contactItem = await fromUuid(basket.selectedContactUuid);
            
            // 3. If that connection item exists and has a linked actor, use that actor's UUID instead.
            if (contactItem?.system?.linkedActor) {
                console.log(contactItem.system.linkedActor)
                actorForTestUuid = contactItem.system.linkedActor;
                console.log(`LOG: Prioritizing linked actor from contact: ${actorForTestUuid}`);
            }
        }
        // --- END OF Actor Check ---
        const initialData = {
            actorUuid: actorForTestUuid,
            itemUuids: basket.shoppingCartItems.map(i => i.itemUuid),
            connectionUuid: basket.selectedContactUuid,
            availabilityStr: basket.totalAvailability
        };

        // Create the test record in the flag. This returns the new test's ID.
        this.activeDialogId = await AppTestFlagService.createTest(initialData);
        console.log(`LOG: Created new test state with ID: ${this.activeDialogId}`);
        
        this.render();
    }

    /**
     * @summary Toggles a situational modifier for the active test.
     * @description This handler reads modifier data from the clicked button, uses the
     * DialogModifierService to calculate the new state of the modifier list, saves the
     * result to the flag, and re-renders the application.
     * @private
     */
    static async #onApplyModifier(event, target) {
        if (!this.activeTestState) return;

        // 1. Get the modifier data from the UI.
        const clickedModifier = {
            label: target.dataset.label,
            value: parseInt(target.dataset.value, 10)
        };
        
        // 2. Get the current list of modifiers from the state.
        const currentModifiers = this.activeTestState.appliedModifiers ?? [];

        // 3. Use the DialogModifierService to calculate the new, correct list.
        //    FIX: Call the static method directly, without 'new'.
        const newModifiers = DialogModifierService.calculateNewModifierList(currentModifiers, clickedModifier);

        // 4. Update the state on the instance for the next re-render.
        this.activeTestState.modifiers = newModifiers;
        
        // 5. Save the complete, updated list of modifiers back to the flag.
        //    FIX: Pass the 'newModifiers' array under the 'modifier' key.
        await AppTestFlagService.updateTest(this.activeTestState.id, { appliedModifiers: newModifiers });

        // 6. Re-render the UI to reflect the change.
        this.render();
    }

    /**
     * @summary Handles changes to the skill or attribute dropdowns.
     * @description Updates the active test state in the flag when a new skill or attribute is
     * selected, then re-renders the application to reflect the change.
     * @param {Event} event - The triggering change event.
     * @param {HTMLSelectElement} target - The select element that was changed.
     * @private
     */
    async _onChangeTestParameter(event, target) {
        if (!this.activeTestState) return;

        const key = target.name;   // This will be "skill" or "attribute"
        const value = target.value; 
        
        // Update the state on the instance for immediate feedback
        this.activeTestState[key] = value;
        console.log(this.activeTestState)
        // Save the change to the flag for persistence
        await AppTestFlagService.updateTest(this.activeTestState.id, { [key]: value });
        
        // Re-render the UI
        this.render(false);
    }

    /**
     * @summary Manually triggers the second stage of the availability check: the item's resistance roll.
     * @description This handler is called when the user clicks "Roll Item Resistance". It reads the
     * results of the initial player test from the user flag (`activeTestState`), then instantiates
     * and executes a silent `AvailabilityResistTest`. The dice pool for this test is derived from the
     * item's availability string, and the threshold is the net hits from the first roll.
     *
     * After the resist roll is executed, its results (dice, values, and success state) are
     * captured. The handler then updates the flag again via `AppTestFlagService`, saving the
     * resist result and setting the overall test status to 'resolved'. Finally, it re-renders
     * the application to display the final outcome of the purchase attempt.
     *
     * @param {PointerEvent} event    The originating click event.
     * @param {HTMLElement} target    The capturing HTML element which defined a [data-action].
     * @private
     *
     * @param {object} this.activeTestState - The current state of the test, read from the user flag.
     * @param {string} this.activeTestState.status - The current status of the test, expected to be 'result'.
     * @param {object} this.activeTestState.result - The stored result from the initial `AvailabilityTest`.
     * @param {object} this.activeTestState.result.values - The calculated values from the initial test.
     * @param {number} this.activeTestState.result.values.netHits.value - The net hits from the player's roll, used as the threshold for this test.
     * @param {string} this.activeTestState.type - The original test type (e.g., 'AvailabilityTest').
     * @param {string} this.activeTestState.availabilityStr - The availability string (e.g., "12R") used to determine the dice pool.
     * @param {string} this.activeTestState.id - The unique ID for the active test, used to update the flag.
     *
     * @fires AppTestFlagService.updateTest
     * @param {string} testId - The ID of the test flag to update, from `this.activeTestState.id`.
     * @param {object} updatePayload - The data to save to the flag.
     * @param {object} updatePayload.resistResult - The results of the item's resistance test.
     * @param {Array<number>} updatePayload.resistResult.diceResults - The individual dice results of the resistance roll.
     * @param {object} updatePayload.resistResult.values - The calculated values from the resistance roll.
     * @param {boolean} updatePayload.resistResult.success - Whether the item successfully resisted the purchase.
     * @param {string} updatePayload.status - The new status of the test, set to 'resolved'.
     */
    static async #onRollResist(event, target) {
        // Guard Clause: Ensure we have an active test that is waiting for the resist roll.
        if (!this.activeTestState || this.activeTestState.status !== 'result') return;

        console.log("%c--- Action: Roll Item Resistance ---", "color: blue; font-weight: bold;");

        // Get required data from the active test state saved in the flag.
        const initialTestResult = this.activeTestState.result; // This holds the 'values' from the first test.
        let extraData = {
            type: this.activeTestState.type,
            categories: []
        };
        const TestObject = foundry.utils.mergeObject(initialTestResult,  extraData )
        const availabilityStr = this.activeTestState.availabilityStr;

        // The threshold for the resist roll is the net hits from the player's initial roll.
        const threshold = initialTestResult.values.netHits.value;

        // The dice pool is the numeric part of the availability string (e.g., 12 from "12R").
        const parsedAvail = game.shadowrun5e.tests.AvailabilityTest.parseAvailability(availabilityStr);
        const pool = Math.max(parsedAvail.rating, 1);

        // Construct the 'data' object for the AvailabilityResistTest.
        const data = {
            against: TestObject,
            action:{
                categories:["social"]
            },
            pool: {
                base: 0,
                mod: [
                    { name: game.i18n.localize("SR5.Labels.Availability"), value: pool }
                ]
            },
            threshold: {
                base: threshold,
                mod: []
            },
        };

        //Set options for a silent roll (no standard dialog but appDialog, no chat message but App message).
        const options = { 
            showDialog: false, 
            showMessage: false 
        };

        try {
            
            const test = new game.shadowrun5e.tests.AvailabilityResist(data, {}, options);
            await test.execute();

            // The 'success' property tells us if the item *resisted* the purchase. false means success for the purchase
            const resistResultForFlag = {
                diceResults: test.rolls?.[0]?.terms[0]?.results || [],
                values: test.data.values,
                success: test.success
            };

            console.log("--- Marketplace | Availability Resist Result to be Saved ---", resistResultForFlag);

            // 9. Update the flag with the resist result and set the status to 'resolved'.
            await AppTestFlagService.updateTest(this.activeTestState.id, {
                resistResult: resistResultForFlag,
                status: 'resolved'
            });

            // 10. Re-render the app to show the final result view.
            this.render();

        } catch(e) {
            console.error("Marketplace | AvailabilityResistTest failed to run:", e);
        }
    }

    /**
     * @summary Runs the primary Availability Test.
     * @description This is the main handler for initiating the player's roll in the availability
     * test sequence. It gathers all necessary data from the current `activeTestState` (including
     * the actor, skill, attribute, modifiers, and item details), constructs the data object for
     * the `AvailabilityTest`, and then executes it silently (without a dialog or chat message).
     *
     * After the test is executed, it captures the dice results and calculated values
     * (like hits, net hits, etc.). It then uses `AppTestFlagService` to update the
     * persistent state in the user's flag, setting the status to 'result' and storing the
     * outcome. This triggers the UI to advance to the second stage, where the user can roll
     * for item resistance.
     *
     * @param {PointerEvent} event    The originating click event.
     * @param {HTMLElement} target    The capturing HTML element which defined a [data-action].
     * @private
     *
     * @param {object} this.activeTestState - The current state of the test, read from the user flag.
     * @param {string} this.activeTestState.actorUuid - The UUID of the actor performing the test. This
     *   may be the player's character or a linked actor from a selected contact.
     * @param {string|null} this.activeTestState.connectionUuid - The UUID of the selected 'contact'
     *   item, if any. Used to determine if a linked actor should be used for the roll.
     * @param {string} this.activeTestState.skill - The key of the skill being used for the test (e.g., 'etiquette').
     * @param {string} this.activeTestState.attribute - The key of the attribute being used (e.g., 'charisma').
     * @param {Array<object>} this.activeTestState.modifiers - An array of modifier objects, each with 'label' and 'value' properties.
     * @param {Array<string>} this.activeTestState.itemUuids - An array of UUIDs for the items in the shopping basket.
     * @param {string} this.activeTestState.availabilityStr - The calculated availability string for the items (e.g., "12R").
     * @param {string} this.activeDialogId - The unique ID for the active test dialog instance.
     *
     * @fires AppTestFlagService.updateTest
     * @param {string} dialogIdToUpdate - The ID of the test flag to update.
     * @param {object} updatePayload - The data to save to the flag.
     * @param {object} updatePayload.result - The results of the test.
     * @param {Array<number>} updatePayload.result.diceResults - The individual results of the dice rolled.
     * @param {object} updatePayload.result.values - The calculated values from the test (hits, netHits, etc.).
     * @param {string} updatePayload.status - The new status of the test, set to 'result'.
     * @param {string} updatePayload.type - The type of test, set to 'AvailabilityTest'.
     * @param {string} userId - The ID of the current user.
     */
    static async #onRunAvailabilityTest(event, target) {
        if (!this.activeTestState) return;

        // --- Actor Selection Logic ---
        let actorForTestUuid = this.activeTestState.actorUuid;
        if (this.activeTestState.connectionUuid) {
            const contactItem = await fromUuid(this.activeTestState.connectionUuid);
            if (contactItem?.system?.linkedActor) {
                actorForTestUuid = contactItem.system.linkedActor;
            }
        }
        const actor = await fromUuid(actorForTestUuid);
        if (!actor) return;

        // The 'opposed' key is removed. The AvailabilityTest class handles this internally now.
        const data = {
            action: {
                skill: this.activeTestState.skill,
                attribute: this.activeTestState.attribute,
                modifiers: this.activeTestState.modifiers,
                itemUuids: this.activeTestState.itemUuids,
                connectionUuid: this.activeTestState.connectionUuid,
                availabilityStr: this.activeTestState.availabilityStr,
                dialogId: this.activeDialogId
            }
        };

        const options = { showDialog: false, showMessage: false };

        try {
            const test = new game.shadowrun5e.tests.AvailabilityTest(data, { actor }, options);
            await test.execute();

            const rule = game.settings.get("sr5-marketplace", "availabilityTestRule");
            let finalStatus;

            // --- THIS IS THE UPDATED LOGIC ---
            if (rule === 'extended') {
                // For an extended test, check if it succeeded on the first roll.
                // If not, it's 'in-progress'. Otherwise, it's 'resolved'.
                finalStatus = test.success ? 'resolved' : 'extended-inprogress';
            } else if (rule === 'opposed') {
                finalStatus = 'result';
            } else {
                finalStatus = 'resolved';
            }

            // Complete Test Data
            const resultForFlag = test.data
            
            const dialogIdToUpdate = test.data.action.dialogId;
            let userId = game.user.id;

            if (dialogIdToUpdate) {
                await AppTestFlagService.updateTest(dialogIdToUpdate, { 
                    result: resultForFlag,
                    rolls: test.rolls, 
                    status: finalStatus, // Use the correct status
                    type: "AvailabilityTest", // Keep the separate type for the resist roll
                    rollCount: 1,
                    connectionUsed: this.activeTestState.connectionUsed
                }, userId);
            } else {
                console.log("Marketplace | Could not find dialogId in test result to update the flag.");
            }

            this.render();
        } catch(e) {
            console.log("Marketplace | AvailabilityTest failed to run:", e);
        }
    }

    /**
     * @summary Continues an in-progress extended availability test.
     * @description This handler re-creates the test from the stored flag state, calls the
     * system's built-in `executeAsExtended` method to perform the next roll, and then
     * determines if the test has succeeded, failed (pool exhausted), or should continue.
     * @private
     */
    static async #onContinueExtendedTest(event, target) {
        if (!this.activeTestState || this.activeTestState.status !== 'extended-inprogress') return;
        console.log("%c--- Action: Continue Extended Test ---", "color: orange; font-weight: bold;");

        try {
            const actor = await fromUuid(this.activeTestState.actorUuid);
            if (!actor) return;

            const rollCount = (this.activeTestState.rollCount || 0) + 1;
            const penalty = { label: "Extended Test", value: (rollCount - 1) * -1 };
            const newAppliedModifiers = [...(this.activeTestState.appliedModifiers || []), penalty];

            const data = {
                action: {
                    skill: this.activeTestState.skill,
                    attribute: this.activeTestState.attribute,
                    modifiers: newAppliedModifiers,
                    connectionUuid: this.activeTestState.connectionUuid,
                    availabilityStr: this.activeTestState.availabilityStr,
                    dialogId: this.activeDialogId
                }
            };
            
            // --- THIS IS THE FIX ---
            // Add the options object to ensure a silent roll.
            const options = { showDialog: false, showMessage: false };

            // Pass the options to the test constructor.
            const test = new game.shadowrun5e.tests.AvailabilityTest(data, { actor }, options);
            await test.execute();

            // 5. Accumulate hits from the previous total.
            const previousHits = this.activeTestState.result.values.extendedHits.value;
            test.data.values.extendedHits.value += previousHits;
            test.data.values.extendedHits.mod.push({ name: "Previous Hits", value: previousHits });

            // 6. Check if the test is now resolved.
            let finalStatus = 'extended-inprogress';
            if (test.data.values.extendedHits.value >= test.data.threshold.value || test.pool.value <= 0) {
                finalStatus = 'resolved';
            }
            
            // 7. Save everything back to the flag.
            await AppTestFlagService.updateTest(this.activeTestState.id, {
                result: test.data,
                rolls: test.rolls,
                status: finalStatus,
                rollCount: rollCount, // Save the updated roll count
                appliedModifiers: newAppliedModifiers // Save the updated modifiers
            });

            this.render();

        } catch(e) {
            console.error("Marketplace | Failed to continue extended test:", e);
        }
    }

    /**
     * Renders a specific slice of the item array, padding the top and bottom 
     * to maintain the illusion of a massive scrollable list.
     */
    async _renderItemSlice(indexStart, indexEnd) {
        if (this.scrollState.throttle) return;
        this.scrollState.throttle = true;

        const container = this.element.querySelector("#marketplace-items");
        if (!container) {
            this.scrollState.throttle = false;
            return;
        }

        const toRender = [];

        // 1. Calculate Top Padding
        const topPad = document.createElement("div");
        topPad.style.height = `${indexStart * this.scrollState.itemHeight}px`;
        topPad.style.gridColumn = "1 / -1"; // Ensures it spans full width if using CSS grid
        toRender.push(topPad);

        // 2. Render the Visible Items in one Handlebars pass
        indexStart = Math.max(0, indexStart);
        indexEnd = Math.min(this.scrollState.entries.length, indexEnd);
        const itemSlice = this.scrollState.entries.slice(indexStart, indexEnd);

        const html = await foundry.applications.handlebars.renderTemplate(
            "modules/sr5-marketplace/templates/documents/items/libraryItem.html",
            { items: itemSlice, purchasingActor: this.purchasingActor }
        );

        const template = document.createElement("template");
        template.innerHTML = html;
        toRender.push(...template.content.children);

        // 3. Calculate Bottom Padding
        const bottomPad = document.createElement("div");
        bottomPad.style.height = `${(this.scrollState.entries.length - indexEnd) * this.scrollState.itemHeight}px`;
        bottomPad.style.gridColumn = "1 / -1";
        toRender.push(bottomPad);

        // Instantly swap the DOM elements
        container.replaceChildren(...toRender);
        this.scrollState.throttle = false;
    }

    /**
     * Calculates which items should be visible based on scroll position.
     */
    async _onScrollItems(event) {
        if (this.scrollState.throttle) return;
        const target = event.currentTarget;
        const { scrollTop, clientHeight } = target;

        const itemsPerScreen = Math.ceil(clientHeight / this.scrollState.itemHeight);
        // Load a buffer of 2 screens above, and 5 screens below for smooth scrolling
        const startIndex = Math.max(0, Math.floor(scrollTop / this.scrollState.itemHeight) - (2 * itemsPerScreen));
        const endIndex = Math.min(this.scrollState.entries.length, startIndex + (5 * itemsPerScreen));

        await this._renderItemSlice(startIndex, endIndex);
    }

    /**
     * Triggered by the SearchService. Filters the master data list based on tags
     * and search text, then instantly redraws the Virtual Scroller.
     */
    _applySearchFilter(tags, searchTerm) {
        // 1. Start with the full, unfiltered list of items for this category
        let filtered = this.currentCategoryItems;

        // 2. Filter the data array
        if (tags.length > 0 || searchTerm) {
            filtered = filtered.filter(item => {
                const itemName = item.name.toLowerCase();
                const matchesTags = tags.every(tag => itemName.includes(tag));
                const matchesLive = searchTerm ? itemName.includes(searchTerm) : true;
                return matchesTags && matchesLive;
            });
        }

        // 3. Update the scroller's active entries
        this.scrollState.entries = filtered;

        // 4. Reset the scrollbar to the top and redraw!
        const itemsContainer = this.element.querySelector("#marketplace-items");
        if (itemsContainer) {
            itemsContainer.scrollTop = 0;
        }
        this._renderItemSlice(0, 50);
    }
}