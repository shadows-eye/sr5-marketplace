import ItemDataServices from '../services/ItemDataServices.mjs';
import { AppDialogBuilder } from '../services/AppDialogBuilder.mjs';
import { ItemPreviewApp } from "./documents/items/ItemPreviewApp.mjs"; 
import { BasketService } from '../services/basketService.mjs';
import { PurchaseService } from '../services/purchaseService.mjs';
import { SearchService } from '../services/searchTag.mjs';
import { DialogModifierService } from '../services/DialogModifierService.mjs';
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
        
        this.activeDialogId = null;
        this.activeTestState = this.activeDialogId ? testStates[this.activeDialogId] : null;
        //this.itemData = new ItemDataServices();
        this.skill = null;
        this.attribute = null;
        this.modifier = null;
        this.itemData = game.sr5marketplace.itemData;
        this.basketService = new BasketService();
        this.tabGroups = { main: "shop" };
        this.purchasingActor = null;
        this.searchService = null;
        // Handle passed-in shop context ---
        this.shopActorUuid = options.shopActorUuid ?? null;
        this.selectedSource = this.shopActorUuid ?? "global"; // Default to the specific shop if provided

        this.selectedKey = null;

        const itemsByType = this.itemData.itemsByType ?? {}; //Might need to go because of ItemDataService.mjs
        let defaultKey = null;

        // 1. Prioritize "rangedWeapons" if it has items.
        if (itemsByType.rangedWeapons && itemsByType.rangedWeapons.items.length > 0) {
            defaultKey = "rangedWeapons";
        } 
        // 2. Otherwise, find the first category that has items.
        else {
            const firstAvailableCategory = Object.entries(itemsByType).find(([, data]) => data.items.length > 0);
            if (firstAvailableCategory) {
                defaultKey = firstAvailableCategory[0];
            }
        }
        
        // 3. Set the selected key based on the logic above.
        this.selectedKey = defaultKey;
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
            return this.itemData.itemsByType;
        }
        // --- UPDATED: Call the new method on the service ---
        return this.itemData.getShopItems(this.selectedSource);
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);

        if (this.tabGroups.main === "shop") {
            this.searchService = new SearchService(this.element);
            this.searchService.initialize();
            
            const categorySelector = this.element.querySelector("#item-type-selector");
            if (categorySelector) {
                categorySelector.addEventListener("change", this.onChangeCategory.bind(this));
            }

            // --- NEW: Add a dedicated listener for the source toggle checkbox ---
            const sourceToggle = this.element.querySelector("#marketplace-source-toggle");
            if (sourceToggle) {
                sourceToggle.addEventListener("change", this.onSourceChange.bind(this));
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
                if (activeTestState?.status === 'initial') {
                    console.log("LOG: Building 'initial' dialog context...");
                    const builder = new AppDialogBuilder(activeTestState);
                    const dialogContext = await builder.buildInitialTestDialogContext({
                        actorUuid: activeTestState.actorUuid,
                        itemUuids: activeTestState.itemUuids,
                        connectionUuid: activeTestState.connectionUuid,
                        skill: this.skill,
                        attribute: this.attribute
                    });
                    if (dialogContext) {
                        foundry.utils.mergeObject(partialContext, dialogContext);
                    }
                } else if (activeTestState?.status === 'result') {
                    console.log("LOG: Building 'result' (resist) dialog context...");
                    const builder = new AppDialogBuilder(activeTestState);
                    const dialogContext = await builder.buildResultDialogContext({
                        dialogId: this.activeDialogId, 
                        userId: AppUserId,
                        result: activeTestState.result,
                        availabilityStr: activeTestState.availabilityStr,
                        status: activeTestState.status
                    });
                    //console.log(dialogContext);
                     if (dialogContext) {
                        foundry.utils.mergeObject(partialContext, dialogContext);
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
                partialContext.selectedItems = this.selectedKey ? (itemsByType[this.selectedKey]?.items || []) : [];
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

        // --- NEW: Calculate Availability Here ---
        const items = (await Promise.all(basket.shoppingCartItems.map(i => fromUuid(i.itemUuid)))).filter(i => i);
        const totalAvailabilityRating = items.reduce((total, item) => {
            const availStr = item.system.technology?.availability?.value || "0";
            return total + (parseInt(availStr.match(/^(\d+)/)?.[1] || "0", 10));
        }, 0);

        const initialData = {
            actorUuid: actorForTestUuid,
            itemUuids: basket.shoppingCartItems.map(i => i.itemUuid),
            connectionUuid: basket.selectedContactUuid,
            availabilityStr: `${totalAvailabilityRating}R`
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
        const currentModifiers = this.activeTestState.modifiers ?? [];

        // 3. Use the DialogModifierService to calculate the new, correct list.
        //    FIX: Call the static method directly, without 'new'.
        const newModifiers = DialogModifierService.calculateNewModifierList(currentModifiers, clickedModifier);

        // 4. Update the state on the instance for the next re-render.
        this.activeTestState.modifiers = newModifiers;
        
        // 5. Save the complete, updated list of modifiers back to the flag.
        //    FIX: Pass the 'newModifiers' array under the 'modifier' key.
        await AppTestFlagService.updateTest(this.activeTestState.id, { modifiers: newModifiers });

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
     * results of the initial test from the user flag, then instantiates and executes a silent
     * AvailabilityResistTest. The pool for this test is the item's availability rating, and the
     * threshold is the net hits from the first roll.
     * @private
     */
    static async #onRollResist(event, target) {
        // 1. Guard Clause: Ensure we have an active test that is waiting for the resist roll.
        if (!this.activeTestState || this.activeTestState.status !== 'result') return;

        console.log("%c--- Action: Roll Item Resistance ---", "color: blue; font-weight: bold;");

        // 2. Get required data from the active test state saved in the flag.
        const initialTestResult = this.activeTestState.result; // This holds the 'values' from the first test.
        let extraData = {
            type: this.activeTestState.type,
            categories: []
        };
        const TestObject = foundry.utils.mergeObject(initialTestResult,  extraData )
        const availabilityStr = this.activeTestState.availabilityStr;

        // 3. The threshold for the resist roll is the net hits from the player's initial roll.
        const threshold = initialTestResult.values.netHits.value;

        // 4. The dice pool is the numeric part of the availability string (e.g., 12 from "12R").
        const parsedAvail = game.shadowrun5e.tests.AvailabilityTest.parseAvailability(availabilityStr);
        const pool = Math.max(parsedAvail.rating, 1);

        // 5. Construct the 'data' object for the AvailabilityResistTest.
        const data = {
            against: TestObject,
            action:{
                categories:["social"]
            },
            // --- THIS IS THE CORRECTED FIX ---
            // Create a pool object with a base of 0 and add the availability
            // rating as a single named part in the 'mod' array.
            pool: {
                base: 0,
                mod: [
                    { name: game.i18n.localize("SR5.Labels.Availability"), value: pool }
                ]
            },
            // The threshold just needs a base value and an empty mod array
            // to be a valid data object and prevent the error.
            threshold: {
                base: threshold,
                mod: []
            },
        };

        // 6. Set options for a silent roll (no dialog, no chat message).
        const options = { showDialog: false, showMessage: false };

        try {
            // 7. Instantiate and execute the AvailabilityResist test.
            const test = new game.shadowrun5e.tests.AvailabilityResist(data, {}, options);
            await test.execute();

            // 8. Clean the result object for storing in the flag.
            // The 'success' property tells us if the item *resisted* the purchase.
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

    static async #onRunAvailabilityTest(event, target) {
        if (!this.activeTestState) return;

        // --- ACTOR SELECTION LOGIC ---
        // 1. Start with the purchasing actor's UUID as the default.
        let actorForTestUuid = this.activeTestState.actorUuid;

        // 2. Check if a connection is selected in the current test state.
        if (this.activeTestState.connectionUuid) {
            const contactItem = await fromUuid(this.activeTestState.connectionUuid);
            
            // 3. If that connection item exists and has a linked actor, use that actor's UUID instead.
            if (contactItem?.system?.linkedActor) {
                actorForTestUuid = contactItem.system.linkedActor;
                console.log(`LOG: Using linked actor from contact: ${actorForTestUuid}`);
            }
        }
        
        // 4. Fetch the final actor document using the determined UUID.
        const actor = await fromUuid(actorForTestUuid);

        // 5. Final check to ensure we have a valid actor before proceeding.
        if (!actor) {
            ui.notifications.error(`Could not find a valid actor to perform the test (UUID: ${actorForTestUuid}).`);
            return;
        }
        // --- END OFActor Check ---

        // 2. Prepare the 'data' object for the constructor.
        // This contains the core parameters for the test action.
        const data = {
            action: {
                skill: this.activeTestState.skill,
                attribute: this.activeTestState.attribute,
                modifiers: this.activeTestState.modifiers, // Pass the full array of modifier objects
                categories: ["social"],
                itemUuids: this.activeTestState.itemUuids,
                connectionUuid: this.activeTestState.connectionUuid,
                availabilityStr: this.activeTestState.availabilityStr,
                opposed: {test: "AvailabilityResist"},
                dialogId: this.activeDialogId //Should be the dialog instance
            },
            
        };

        // 3. Prepare the 'options' object for the constructor.
        const options = {
            showDialog: false, // Don't show the pop-up dialog
            showMessage: false  // Show the result in chat
        };

        try {
            // 4. Instantiate the test directly, passing the ACTOR OBJECT, not the UUID string.
            const test = new game.shadowrun5e.tests.AvailabilityTest(
                data,
                { actor }, // The actor must be in this 'documents' object
                options
            );

            // 5. Execute the test.
            await test.execute();

        // --- THIS IS THE FIX ---
        // 4. Extract the specific data points you need from the completed test object.
        const dialogIdToUpdate = test.data.action.dialogId;
        console.log(dialogIdToUpdate);
        
        // As seen in your data object, the path is rolls[0].terms[0].results
        const diceResults = test.rolls?.[0]?.terms[0]?.results || []; 
        const values = test.data.values;

        // 5. Construct the new, clean result object.
        const resultForFlag = {
            diceResults: diceResults,
            values: values
        };
        
        console.log("--- Marketplace | Availability Test Result to be Saved ---", resultForFlag);
        let userId = await game.user.id
        // 6. Update the flag with the new result object and the new status.
            if (dialogIdToUpdate) {
                await AppTestFlagService.updateTest(dialogIdToUpdate, { 
                    result: resultForFlag, 
                    status: 'result',
                    type: "AvailabilityTest"
                }, userId);
            } else {
                console.error("Marketplace | Could not find dialogId in test result to update the flag.");
            }
            
            // 7. Re-render the app to show the result view.
            this.render();

        } catch(e) {
            console.error("Marketplace | AvailabilityTest failed to run:", e);
        }
    }
}