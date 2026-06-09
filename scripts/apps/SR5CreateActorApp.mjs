const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A custom actor creation application that replaces the default Foundry creation dialog.
 * Adapts to a shop creation form if the 'sr5-marketplace.shop' type is chosen,
 * allowing GMs to dynamically populate the shop's inventory from Compendiums and World items.
 */
export class SR5CreateActorApp extends HandlebarsApplicationMixin(ApplicationV2) {
    /**
     * @param {object} options Application configuration options.
     * @param {Function} options.resolve Promise resolver to yield the created Actor or null.
     * @param {string|null} options.folder Default parent folder for the created Actor.
     */
    constructor(options = {}) {
        const themeClass = SR5CreateActorApp._getThemeFromSetting();
        options.classes = [
            ...(options.classes || []),
            "sr5",
            "themed",
            "sr5-marketplace",
            "create-actor-app-window",
            themeClass
        ];
        super(options);

        this.resolve = options.resolve || null;
        this.folder = options.folder || null;

        // Form settings & filters
        this.actorName = "";
        this.actorImg = "icons/svg/mystery-man.svg";
        this.selectedActorType = "character";
        this.shopMarkup = 0;
        this.shopRadius = 1;
        this.shopDescription = "";
        
        // Collapsible sections state tracking (Shop details open by default)
        this.expandedSections = new Set(["shop-details"]);
        
        // Host & Employees Selections
        this.selectedHostUuid = null;
        this.selectedEmployeeUuids = new Set();

        // Inventory Seeding filters
        this.activeSource = "both";
        this.maxRating = "";
        this.searchQuery = "";
        this.filterTags = []; // Array of string tags for filtering
        this._searchFocused = false; // Input focus tracking

        // Seed all types by default
        this.selectedItemTypes = new Set([
            "weapon", "armor", "equipment", "device", 
            "cyberware", "bioware", "spell", "program", 
            "modification", "adept_power", "complex_form"
        ]);
        this.selectedItemUuids = new Set();
        this.totalCount = 0;
    }

    /** @override */
    static PARTS = {
        main: {
            id: "body",
            template: "modules/sr5-marketplace/templates/apps/create-actor.html"
        }
    };

    /** @override */
    static get DEFAULT_OPTIONS() {
        return foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
            id: "sr5-marketplace-create-actor-dialog",
            position: { width: 800, height: 750 },
            window: {
                title: "SR5Marketplace.UI.CreateActor", 
                resizable: true,
                minimizable: true
            }
        }, { inplace: false });
    }

    /**
     * Helper to read the current UI application theme setting from core settings.
     * @returns {string} The theme class name.
     */
    static _getThemeFromSetting() {
        if (typeof game === "undefined" || !game.settings) return "theme-light";
        try {
            const uiConfig = game.settings.get("core", "uiConfig");
            const themeValue = uiConfig?.colorScheme?.applications || "light";
            return `theme-${themeValue}`;
        } catch (err) {
            console.warn("SR5CreateActorApp | Failed to read theme from settings:", err);
            return "theme-light";
        }
    }

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        // 1. Gather all actor types
        const types = {};
        const typeList = game.documentTypes?.Actor || Object.keys(CONFIG.Actor.dataModels || {});
        for (const type of typeList) {
            if (type === "base") continue;
            const labelKey = CONFIG.Actor.typeLabels?.[type] || `TYPES.Actor.${type}`;
            types[type] = {
                label: game.i18n.localize(labelKey) || type,
                selected: type === this.selectedActorType
            };
        }

        // 2. Gather parent folders
        const folders = game.folders.filter(f => f.type === "Actor").map(f => ({
            id: f.id,
            name: f.name,
            selected: f.id === this.folder
        }));

        // 3. Populate default name and labels
        const typeLabel = game.i18n.localize(CONFIG.Actor.typeLabels?.[this.selectedActorType] || `TYPES.Actor.${this.selectedActorType}`) || this.selectedActorType;
        const newPrefix = game.i18n.localize("SR5Marketplace.UI.New");
        const defaultName = this.actorName || `${newPrefix} ${typeLabel}`;
        const createLabel = game.i18n.format("SR5Marketplace.UI.CreateType", { type: typeLabel });

        context.defaultName = defaultName;
        context.createLabel = createLabel;
        context.actorImg = this.actorImg;

        // 4. Shop specific configuration
        if (this.selectedActorType === "sr5-marketplace.shop") {
            // Pass collapsed/expanded section flags
            context.shopDetailsExpanded = this.expandedSections.has("shop-details");
            context.hostEmployeesExpanded = this.expandedSections.has("host-employees");
            context.populateInventoryExpanded = this.expandedSections.has("populate-inventory");

            // World Hosts
            const worldHosts = game.items.filter(i => i.type === "host").map(h => ({
                uuid: h.uuid,
                name: h.name,
                selected: h.uuid === this.selectedHostUuid
            }));
            worldHosts.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));

            // World sidebar actors for employee selection
            const worldActors = game.actors.contents.map(a => ({
                uuid: a.uuid,
                name: a.name,
                img: a.img || "icons/svg/mystery-man.svg",
                checked: this.selectedEmployeeUuids.has(a.uuid)
            }));
            worldActors.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));

            const itemTypes = [
                { key: "weapon", label: "TYPES.Item.weapon" },
                { key: "armor", label: "TYPES.Item.armor" },
                { key: "equipment", label: "TYPES.Item.equipment" },
                { key: "device", label: "TYPES.Item.device" },
                { key: "cyberware", label: "TYPES.Item.cyberware" },
                { key: "bioware", label: "TYPES.Item.bioware" },
                { key: "spell", label: "TYPES.Item.spell" },
                { key: "program", label: "TYPES.Item.program" },
                { key: "modification", label: "TYPES.Item.modification" },
                { key: "adept_power", label: "TYPES.Item.adept_power" },
                { key: "complex_form", label: "TYPES.Item.complex_form" }
            ].map(t => ({
                key: t.key,
                label: game.i18n.localize(t.label) || t.key,
                checked: this.selectedItemTypes.has(t.key)
            }));

            // Check if item index is loaded
            const allItems = game.sr5marketplace.api.itemData.getItems();
            const isLoaded = allItems && allItems.length > 0;

            context.itemsLoading = !isLoaded;

            if (!isLoaded) {
                // Pre-fetch in background without halting render
                if (!this._indexLoadingPromise) {
                    this._indexLoadingPromise = game.sr5marketplace.api.itemData.buildIndex().then(() => {
                        this._indexLoadingPromise = null;
                        this.render(false);
                    });
                }
            } else {
                const matchingItems = [];
                const seenUuids = new Set();

                for (const item of allItems) {
                    if (seenUuids.has(item.uuid)) continue;
                    if (!this.selectedItemTypes.has(item.type)) continue;

                    // Source check
                    const isCompendium = item.uuid?.startsWith("Compendium.");
                    if (this.activeSource === "world" && isCompendium) continue;
                    if (this.activeSource === "compendium" && !isCompendium) continue;

                    // Localize type
                    let localizedType = game.i18n.localize(`TYPES.Item.${item.type}`) || item.type;

                    // Tags filter
                    const matchesTags = this.filterTags.every(tag => {
                        return item.name.toLowerCase().includes(tag) || localizedType.toLowerCase().includes(tag);
                    });
                    if (!matchesTags) continue;

                    // Rating check
                    let rating = item.system?.rating;
                    if (rating && typeof rating === "object") rating = rating.value;
                    if (!rating) rating = item.system?.technology?.rating;
                    if (rating && typeof rating === "object") rating = rating.value;
                    const itemRating = Number(rating) || 0;

                    if (this.maxRating !== "" && !isNaN(this.maxRating) && itemRating > Number(this.maxRating)) continue;

                    // Search query filter
                    if (this.searchQuery && !item.name.toLowerCase().includes(this.searchQuery.toLowerCase())) continue;

                    seenUuids.add(item.uuid);

                    // Source label
                    let sourceName = "World";
                    if (isCompendium) {
                        const parts = item.uuid.split(".");
                        const packCollection = `${parts[1]}.${parts[2]}`;
                        const pack = game.packs.get(packCollection);
                        sourceName = pack ? pack.metadata.label : "Compendium";
                    }

                    matchingItems.push({
                        uuid: item.uuid,
                        name: item.name,
                        img: item.img || "icons/svg/item-bag.svg",
                        type: localizedType,
                        rating: itemRating,
                        sourceName: sourceName
                    });
                }

                // Alpha sort matching items
                matchingItems.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));

                this.totalCount = matchingItems.length;

                // Map checked state to matching items
                for (const item of matchingItems) {
                    item.checked = this.selectedItemUuids.has(item.uuid);
                }

                // Compile right-column selected items list
                const selectedItems = [];
                for (const uuid of this.selectedItemUuids) {
                    const item = allItems.find(i => i.uuid === uuid);
                    if (item) {
                        let localizedType = game.i18n.localize(`TYPES.Item.${item.type}`) || item.type;
                        selectedItems.push({
                            uuid: item.uuid,
                            name: item.name,
                            img: item.img || "icons/svg/item-bag.svg",
                            type: localizedType
                        });
                    }
                }
                selectedItems.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));

                Object.assign(context, {
                    isShopActor: true,
                    defaultName,
                    types,
                    folders,
                    itemTypes,
                    worldHosts,
                    worldActors,
                    activeSource: this.activeSource,
                    maxRating: this.maxRating,
                    searchQuery: this.searchQuery,
                    filterTags: this.filterTags,
                    matchingItems,
                    selectedItems,
                    totalCount: this.totalCount,
                    selectedCount: this.selectedItemUuids.size,
                    shopMarkup: this.shopMarkup,
                    shopRadius: this.shopRadius,
                    shopDescription: this.shopDescription
                });
            }
        } else {
            Object.assign(context, {
                isShopActor: false,
                defaultName,
                types,
                folders
            });
        }

        return context;
    }

    _onRender(context, options) {
        super._onRender(context, options);

        // Apply theme color
        const themeClass = SR5CreateActorApp._getThemeFromSetting();
        this.element.classList.add(themeClass);

        // 0. Listen for Image Picker click
        const imgPicker = this.element.querySelector(".actor-img-picker");
        if (imgPicker) {
            imgPicker.addEventListener("click", () => {
                new FilePicker({
                    type: "image",
                    current: this.actorImg,
                    callback: (path) => {
                        this.actorImg = path;
                        const img = imgPicker.querySelector("img");
                        if (img) img.src = path;
                    }
                }).browse();
            });
        }

        // 1. Listen for Actor Type selection
        const typeSelect = this.element.querySelector(".type-select");
        if (typeSelect) {
            typeSelect.addEventListener("change", (e) => {
                this.selectedActorType = e.target.value;
                this.selectedItemUuids.clear();
                this.selectedEmployeeUuids.clear();
                this.selectedHostUuid = null;
                this.filterTags = [];
                this.searchQuery = "";
                this.actorName = ""; // Reset custom name to trigger the new type's default name
                this.render(false);
            });
        }

        // 2. Listen for Folder selection
        const folderSelect = this.element.querySelector(".folder-select");
        if (folderSelect) {
            folderSelect.addEventListener("change", (e) => {
                this.folder = e.target.value || null;
            });
        }

        // 3. Listen for Actor Name
        const nameInput = this.element.querySelector(".name-input");
        if (nameInput) {
            nameInput.addEventListener("input", (e) => {
                this.actorName = e.target.value;
            });
        }

        // 4. Shop Seeding controls
        if (this.selectedActorType === "sr5-marketplace.shop") {
            // Collapsible header toggling with state preservation
            const collapsibleHeaders = this.element.querySelectorAll(".actor-creator-collapsible-header");
            for (const header of collapsibleHeaders) {
                header.addEventListener("click", () => {
                    const section = header.closest(".actor-creator-collapsible-section");
                    const sectionId = section?.dataset.section;
                    if (section && sectionId) {
                        const isCurrentlyCollapsed = section.classList.contains("collapsed");
                        if (isCurrentlyCollapsed) {
                            section.classList.remove("collapsed");
                            this.expandedSections.add(sectionId);
                        } else {
                            section.classList.add("collapsed");
                            this.expandedSections.delete(sectionId);
                        }
                    }
                });
            }

            const radiusInput = this.element.querySelector(".shop-radius-input");
            if (radiusInput) {
                radiusInput.addEventListener("input", (e) => {
                    this.shopRadius = Number(e.target.value) || 1;
                });
            }

            const markupInput = this.element.querySelector(".shop-markup-input");
            if (markupInput) {
                markupInput.addEventListener("input", (e) => {
                    this.shopMarkup = Number(e.target.value) || 0;
                });
            }

            const descTextarea = this.element.querySelector(".shop-description-textarea");
            if (descTextarea) {
                descTextarea.addEventListener("input", (e) => {
                    this.shopDescription = e.target.value;
                });
            }

            // Host Dropdown Selection
            const hostSelect = this.element.querySelector(".shop-host-select");
            if (hostSelect) {
                hostSelect.addEventListener("change", (e) => {
                    this.selectedHostUuid = e.target.value || null;
                });
            }

            // Employee Checkboxes Selection
            const employeeCbs = this.element.querySelectorAll(".employee-checkbox");
            for (const cb of employeeCbs) {
                cb.addEventListener("change", (e) => {
                    const uuid = e.target.dataset.uuid;
                    if (e.target.checked) {
                        this.selectedEmployeeUuids.add(uuid);
                    } else {
                        this.selectedEmployeeUuids.delete(uuid);
                    }
                });
            }

            // Seeding Filters
            const sourceSelect = this.element.querySelector(".item-source-select");
            if (sourceSelect) {
                sourceSelect.addEventListener("change", (e) => {
                    this.activeSource = e.target.value;
                    this.render(false);
                });
            }

            const maxRatingInput = this.element.querySelector(".max-rating-input");
            if (maxRatingInput) {
                maxRatingInput.addEventListener("change", (e) => {
                    this.maxRating = e.target.value === "" ? "" : Number(e.target.value);
                    this.render(false);
                });
            }

            // Checkboxes for type filters
            const typeFilterCbs = this.element.querySelectorAll(".type-filter-checkbox");
            for (const cb of typeFilterCbs) {
                cb.addEventListener("change", (e) => {
                    const type = e.target.dataset.type;
                    if (e.target.checked) {
                        this.selectedItemTypes.add(type);
                    } else {
                        this.selectedItemTypes.delete(type);
                    }
                    this.render(false);
                });
            }

            // Quick actions for types
            const selectAllTypes = this.element.querySelector(".select-all-types");
            if (selectAllTypes) {
                selectAllTypes.addEventListener("click", () => {
                    const allAvailableTypes = [
                        "weapon", "armor", "equipment", "device", 
                        "cyberware", "bioware", "spell", "program", 
                        "modification", "adept_power", "complex_form"
                    ];
                    this.selectedItemTypes = new Set(allAvailableTypes);
                    this.render(false);
                });
            }

            const clearAllTypes = this.element.querySelector(".clear-all-types");
            if (clearAllTypes) {
                clearAllTypes.addEventListener("click", () => {
                    this.selectedItemTypes.clear();
                    this.render(false);
                });
            }

            // Search filtering with ENTER tag support
            const searchInput = this.element.querySelector(".items-search-input");
            if (searchInput) {
                searchInput.addEventListener("focus", () => this._searchFocused = true);
                searchInput.addEventListener("blur", () => this._searchFocused = false);

                searchInput.addEventListener("keydown", (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        const q = e.target.value.trim().toLowerCase();
                        if (q && !this.filterTags.includes(q)) {
                            this.filterTags.push(q);
                            this.searchQuery = "";
                            this.render(false);
                        }
                    }
                });

                searchInput.addEventListener("input", (e) => {
                    this.searchQuery = e.target.value;
                    const query = this.searchQuery.toLowerCase().trim();
                    const cards = this.element.querySelectorAll(".matching-item-card");
                    for (const card of cards) {
                        const name = card.querySelector(".matching-item-name")?.textContent.toLowerCase() || "";
                        const type = card.querySelector(".matching-item-type")?.textContent.toLowerCase() || "";
                        if (name.includes(query) || type.includes(query)) {
                            card.style.display = "";
                        } else {
                            card.style.display = "none";
                        }
                    }
                });
            }

            // Tag removal click listener
            const tagsContainer = this.element.querySelector("#filter-tags-container");
            if (tagsContainer) {
                tagsContainer.addEventListener("click", (e) => {
                    const removeBtn = e.target.closest(".remove-tag");
                    if (removeBtn) {
                        const tagToRemove = removeBtn.closest(".filter-tag")?.dataset.tag;
                        if (tagToRemove) {
                            this.filterTags = this.filterTags.filter(t => t !== tagToRemove);
                            this.render(false);
                        }
                    }
                });
            }

            // Item Selection Checkboxes
            const itemCbs = this.element.querySelectorAll(".item-checkbox");
            for (const cb of itemCbs) {
                cb.addEventListener("change", (e) => {
                    const uuid = e.target.dataset.uuid;
                    if (e.target.checked) {
                        this.selectedItemUuids.add(uuid);
                    } else {
                        this.selectedItemUuids.delete(uuid);
                    }
                    this.render(false);
                });
            }

            // Quick actions for items list
            const selectAllItems = this.element.querySelector(".select-all-items");
            if (selectAllItems) {
                selectAllItems.addEventListener("click", () => {
                    const visibleCards = this.element.querySelectorAll(".matching-item-card");
                    for (const card of visibleCards) {
                        if (card.style.display !== "none") {
                            const uuid = card.dataset.uuid;
                            this.selectedItemUuids.add(uuid);
                        }
                    }
                    this.render(false);
                });
            }

            const clearAllItems = this.element.querySelector(".clear-all-items");
            if (clearAllItems) {
                clearAllItems.addEventListener("click", () => {
                    const visibleCards = this.element.querySelectorAll(".matching-item-card");
                    for (const card of visibleCards) {
                        if (card.style.display !== "none") {
                            const uuid = card.dataset.uuid;
                            this.selectedItemUuids.delete(uuid);
                        }
                    }
                    this.render(false);
                });
            }

            // Selected column: Remove individual item
            const selectedContainer = this.element.querySelector(".selected-items-scrollable");
            if (selectedContainer) {
                selectedContainer.addEventListener("click", (e) => {
                    const removeBtn = e.target.closest(".selected-item-remove-btn");
                    if (removeBtn) {
                        const uuid = removeBtn.dataset.uuid;
                        this.selectedItemUuids.delete(uuid);
                        this.render(false);
                    }
                });
            }

            // Selected column: Clear all selections
            const clearAllSelections = this.element.querySelector(".clear-all-selections");
            if (clearAllSelections) {
                clearAllSelections.addEventListener("click", () => {
                    this.selectedItemUuids.clear();
                    this.render(false);
                });
            }
        }

        // Cancel button
        const cancelBtn = this.element.querySelector('.cancel-btn-custom');
        if (cancelBtn) {
            cancelBtn.addEventListener("click", () => this.close());
        }

        // Create button
        const createBtn = this.element.querySelector('.create-btn');
        if (createBtn) {
            createBtn.addEventListener("click", () => this._onCreate());
        }

        // Focus restoration for search box
        if (this._searchFocused && this.selectedActorType === "sr5-marketplace.shop") {
            const input = this.element.querySelector(".items-search-input");
            if (input) {
                input.focus();
                const val = input.value;
                input.value = "";
                input.value = val;
            }
        }
    }

    /**
     * Triggers the actual Actor document creation and seeding.
     */
    async _onCreate() {
        const nameInput = this.element.querySelector(".name-input");
        const name = nameInput?.value?.trim() || "Unknown";

        // 1. Build initial document creation payload
        const createData = {
            name: name,
            type: this.selectedActorType,
            folder: this.folder || null,
            img: this.actorImg
        };

        // If it is a shop actor, initialize basic values
        if (this.selectedActorType === "sr5-marketplace.shop") {
            createData.system = {
                shop: {
                    itemMarkup: this.shopMarkup,
                    shopRadius: {
                        value: this.shopRadius,
                        base: this.shopRadius
                    },
                    employees: Array.from(this.selectedEmployeeUuids),
                    owner: "",
                    connection: "",
                    servingEmployee: "",
                    inventory: {}
                },
                description: {
                    value: this.shopDescription
                }
            };
        }

        try {
            // 2. Create the document in the database
            const actor = await Actor.create(createData, { renderSheet: true });
            
            if (this.selectedActorType === "sr5-marketplace.shop") {
                // 3. Clone Matrix Host item into the newly created Shop Actor
                if (this.selectedHostUuid) {
                    const hostItem = await fromUuid(this.selectedHostUuid);
                    if (hostItem) {
                        const hostData = hostItem.toObject();
                        delete hostData._id; // Ensure clean ID creation
                        await actor.createEmbeddedDocuments("Item", [hostData]);
                        console.log(`SR5 Marketplace | Host "${hostItem.name}" cloned into "${actor.name}".`);
                    }
                }

                // 4. Batch seed inventory using fast synchronous index calculations
                if (this.selectedItemUuids.size > 0) {
                    ui.notifications.info(`Seeding ${this.selectedItemUuids.size} items into shop inventory...`);
                    
                    const updates = {};
                    const allItems = game.sr5marketplace.api.itemData.getItems();

                    for (const uuid of this.selectedItemUuids) {
                        const entry = allItems.find(i => i.uuid === uuid);
                        if (entry) {
                            if (entry.type === "skill" || entry.type === "contact") continue;

                            // Extract cost
                            let baseCost = entry.system?.technology?.cost;
                            if (baseCost && typeof baseCost === "object") baseCost = baseCost.value;
                            baseCost = Number(baseCost) || 0;

                            if (baseCost === 0) {
                                let altCost = entry.system?.cost;
                                if (altCost && typeof altCost === "object") altCost = altCost.value;
                                baseCost = Number(altCost) || 0;
                            }
                            if (baseCost === 0) {
                                baseCost = Number(entry.system?.technology?.calculated?.cost?.value) || 0;
                            }

                            // Extract availability
                            let baseAvailability = entry.system?.technology?.availability;
                            if (baseAvailability && typeof baseAvailability === "object") baseAvailability = baseAvailability.value;
                            if (!baseAvailability) {
                                baseAvailability = entry.system?.availability;
                                if (baseAvailability && typeof baseAvailability === "object") baseAvailability = baseAvailability.value;
                            }
                            if (!baseAvailability) {
                                baseAvailability = entry.system?.technology?.calculated?.availability?.value;
                            }
                            baseAvailability = String(baseAvailability || "1R").trim();

                            // Dynamic delivery times
                            let buyTimeValue = 24;
                            let buyTimeUnit = "hours";
                            if (baseCost > 10000) {
                                buyTimeValue = 1;
                                buyTimeUnit = "months";
                            } else if (baseCost > 5000) {
                                buyTimeValue = 1;
                                buyTimeUnit = "weeks";
                            } else if (baseCost > 1000) {
                                buyTimeValue = 1;
                                buyTimeUnit = "days";
                            }

                            const markedUpSellPrice = Math.round(baseCost * (1 + this.shopMarkup / 100));
                            const newItemId = foundry.utils.randomID();

                            updates[`system.shop.inventory.${newItemId}`] = {
                                itemUuid: entry.uuid,
                                qty: entry.system?.quantity ?? 1,
                                itemPrice: { value: baseCost, base: baseCost },
                                sellPrice: { value: markedUpSellPrice, base: baseCost },
                                buyPrice: { value: baseCost, base: baseCost },
                                availability: { value: baseAvailability, base: baseAvailability },
                                buyTime: { value: buyTimeValue, unit: buyTimeUnit },
                                comments: ""
                            };
                        }
                    }

                    if (Object.keys(updates).length > 0) {
                        await actor.update(updates);
                        console.log(`SR5 Marketplace | Seeding completed synchronously on "${actor.name}".`);
                    }
                }
            }

            // 5. Resolve the creation promise so Foundry UI updates properly
            if (this.resolve) {
                this.resolve(actor);
                this.resolve = null;
            }

            this.close();
        } catch (err) {
            console.error("SR5 Marketplace | Failed to create Actor:", err);
            ui.notifications.error("Failed to create Actor. See console for details.");
        }
    }

    /** @override */
    async close(options = {}) {
        if (this.resolve) {
            this.resolve(null);
            this.resolve = null;
        }
        return super.close(options);
    }
}
