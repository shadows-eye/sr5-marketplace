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
        this.selectedArchetype = "";
        this.selectedMetatype = "random";
        this.shopMarkup = 0;
        this.shopRadius = 1;
        this.shopDescription = "";

        this.isFactory = false;
        this.factoryRating = 5;
        this.existingActorUuid = null;

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
            template: "modules/sr5-marketplace/templates/apps/createActor/create-actor.html"
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
        types["sr5-marketplace.workshop"] = {
            label: game.i18n.localize("SR5Marketplace.ItemBuilder.nav.workshop") || "Workshop",
            selected: this.selectedActorType === "sr5-marketplace.workshop"
        };

        // 2. Gather parent folders
        const folders = game.folders.filter(f => f.type === "Actor").map(f => ({
            id: f.id,
            name: f.name,
            selected: f.id === this.folder
        }));

        // 3. Populate default name and labels
        let typeLabel = "";
        if (this.selectedActorType === "sr5-marketplace.workshop") {
            typeLabel = game.i18n.localize("SR5Marketplace.ItemBuilder.nav.workshop") || "Workshop";
        } else {
            typeLabel = game.i18n.localize(CONFIG.Actor.typeLabels?.[this.selectedActorType] || `TYPES.Actor.${this.selectedActorType}`) || this.selectedActorType;
        }
        const newPrefix = game.i18n.localize("SR5Marketplace.UI.New");
        const defaultName = this.actorName || `${newPrefix} ${typeLabel}`;
        let createLabel = game.i18n.format("SR5Marketplace.UI.CreateType", { type: typeLabel });
        if (this.existingActorUuid) {
            createLabel = game.i18n.localize("SR5Marketplace.UI.ActorCreator.UpgradeShop");
        }

        context.defaultName = defaultName;
        context.createLabel = createLabel;
        context.actorImg = this.actorImg;

        const isShopActor = this.selectedActorType === "sr5-marketplace.shop" || this.selectedActorType === "sr5-marketplace.workshop";
        if (this.selectedActorType === "sr5-marketplace.workshop") {
            this.isFactory = true;
        }

        // 4. Shop specific configuration
        if (isShopActor) {
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
                // Pro-fetch in background without halting render
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
                    shopDescription: this.shopDescription,
                    isFactory: this.isFactory,
                    factoryRating: this.factoryRating,
                    existingActorUuid: this.existingActorUuid,
                    actorName: this.actorName
                });
            }
        } else {
            const extraCtx = {
                isShopActor: false,
                defaultName,
                types,
                folders
            };
            if (this.selectedActorType === "character") {
                const archetypes = {
                    streetSamurai: { label: "Street Samurai", selected: this.selectedArchetype === "streetSamurai" },
                    decker: { label: "Decker", selected: this.selectedArchetype === "decker" },
                    technomancer: { label: "Technomancer", selected: this.selectedArchetype === "technomancer" },
                    magician: { label: "Magician", selected: this.selectedArchetype === "magician" },
                    aspected: { label: "Aspected Magician", selected: this.selectedArchetype === "aspected" },
                    adept: { label: "Adept", selected: this.selectedArchetype === "adept" }
                };
                extraCtx.isCharacterActor = true;
                extraCtx.archetypes = archetypes;
            }
            Object.assign(context, extraCtx);
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
                this.selectedArchetype = "";
                this.selectedMetatype = "random";
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

        // character quick build archetype listeners
        if (this.selectedActorType === "character") {
            const archetypeSelect = this.element.querySelector(".archetype-select");
            if (archetypeSelect) {
                archetypeSelect.addEventListener("change", (e) => {
                    this.selectedArchetype = e.target.value;
                });
            }
            const metatypeSelect = this.element.querySelector(".metatype-select");
            if (metatypeSelect) {
                metatypeSelect.addEventListener("change", (e) => {
                    this.selectedMetatype = e.target.value;
                });
            }
        }

        const isShopOrWorkshop = this.selectedActorType === "sr5-marketplace.shop" || this.selectedActorType === "sr5-marketplace.workshop";

        // 4. Shop Seeding controls
        if (isShopOrWorkshop) {
            const loadExistingBtn = this.element.querySelector('.load-existing-shop-btn');
            if (loadExistingBtn) {
                loadExistingBtn.addEventListener("click", () => this._onLoadExistingShop());
            }

            const clearExistingBtn = this.element.querySelector('.clear-existing-shop-btn');
            if (clearExistingBtn) {
                clearExistingBtn.addEventListener("click", () => {
                    this.existingActorUuid = null;
                    this.actorName = "";
                    this.actorImg = "icons/svg/mystery-man.svg";
                    this.shopMarkup = 0;
                    this.shopRadius = 1;
                    this.shopDescription = "";
                    this.isFactory = false;
                    this.factoryRating = 5;
                    this.selectedEmployeeUuids.clear();
                    this.selectedHostUuid = null;
                    this.render();
                });
            }

            const isFactoryCb = this.element.querySelector(".shop-is-factory-cb");
            if (isFactoryCb) {
                isFactoryCb.addEventListener("change", (e) => {
                    this.isFactory = e.target.checked;
                    const ratingContainer = this.element.querySelector(".factory-rating-container");
                    if (ratingContainer) {
                        ratingContainer.style.display = this.isFactory ? "block" : "none";
                    }
                });
            }

            const ratingInput = this.element.querySelector(".factory-rating-input");
            if (ratingInput) {
                ratingInput.addEventListener("input", (e) => {
                    this.factoryRating = Number(e.target.value) || 5;
                });
            }

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
    /**
     * Triggers the actual Actor document creation and seeding.
     */
    async _onCreate() {
        const nameInput = this.element.querySelector(".name-input");
        const name = nameInput?.value?.trim() || "Unknown";

        // Check if character archetype is chosen
        if (this.selectedActorType === "character" && this.selectedArchetype) {
            try {
                ui.notifications.info(`Building character template for archetype: ${this.selectedArchetype}...`);
                const actor = await this._buildArchetypeCharacter(name);
                if (this.resolve) {
                    this.resolve(actor);
                    this.resolve = null;
                }
                this.close();
                return;
            } catch (err) {
                console.error("SR5 Marketplace | Failed to build archetype character:", err);
                ui.notifications.error("Failed to build archetype character. See console for details.");
                return;
            }
        }

        const isShopOrWorkshop = this.selectedActorType === "sr5-marketplace.shop" || this.selectedActorType === "sr5-marketplace.workshop";
        const actualActorType = isShopOrWorkshop ? "sr5-marketplace.shop" : this.selectedActorType;

        // 1. Build initial document creation payload
        const createData = {
            name: name,
            type: actualActorType,
            folder: this.folder || null,
            img: this.actorImg
        };

        // If it is a shop actor, initialize basic values
        if (isShopOrWorkshop) {
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
                    isFactory: this.isFactory,
                    factoryRating: this.factoryRating,
                    inventory: {}
                },
                description: {
                    value: this.shopDescription
                }
            };
        }

        try {
            let actor;
            if (this.existingActorUuid) {
                actor = await fromUuid(this.existingActorUuid);
                if (!actor) throw new Error("Existing actor not found.");

                const updateData = {
                    name: name,
                    img: this.actorImg,
                    folder: this.folder || null,
                    "system.shop.itemMarkup": this.shopMarkup,
                    "system.shop.shopRadius.value": this.shopRadius,
                    "system.shop.shopRadius.base": this.shopRadius,
                    "system.shop.employees": Array.from(this.selectedEmployeeUuids),
                    "system.shop.isFactory": this.isFactory,
                    "system.shop.factoryRating": this.factoryRating,
                    "system.description.value": this.shopDescription
                };
                await actor.update(updateData);

                if (isShopOrWorkshop) {
                    const currentHostItem = actor.hostItem;
                    if (this.selectedHostUuid) {
                        const selectedHostItem = await fromUuid(this.selectedHostUuid);
                        if (selectedHostItem) {
                            const currentSourceId = currentHostItem?.getFlag("core", "sourceId") || currentHostItem?.uuid;
                            if (!currentHostItem || currentSourceId !== this.selectedHostUuid) {
                                if (currentHostItem) {
                                    await actor.deleteEmbeddedDocuments("Item", [currentHostItem.id]);
                                }
                                const hostData = selectedHostItem.toObject();
                                delete hostData._id;
                                await actor.createEmbeddedDocuments("Item", [hostData]);
                                console.log(`SR5 Marketplace | Host "${selectedHostItem.name}" cloned into "${actor.name}" (upgrade).`);
                            }
                        }
                    } else if (currentHostItem) {
                        await actor.deleteEmbeddedDocuments("Item", [currentHostItem.id]);
                    }
                }
                if (actor.sheet) actor.sheet.render(true);
            } else {
                // 2. Create the document in the database
                actor = await Actor.create(createData, { renderSheet: true });

                if (isShopOrWorkshop) {
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
                }
            }

            if (isShopOrWorkshop) {
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

    /**
     * Builds a character using Chummer attributes and system CharacterImporter
     */
    async _buildArchetypeCharacter(name) {
        const ARCHETYPES = {
            streetSamurai: "Street Samurai",
            decker: "Decker",
            technomancer: "Technomancer",
            magician: "Magician",
            aspected: "Aspected Magician",
            adept: "Adept"
        };

        const METATYPES = {
            human: { label: "Human" },
            elf: { label: "Elf" },
            dwarf: { label: "Dwarf" },
            ork: { label: "Ork" },
            troll: { label: "Troll" }
        };

        const FIRST_NAMES = ["Ash", "Rook", "Mika", "Jax", "Echo", "Vex", "Kestrel", "Nova", "Grimm", "Cipher", "Knox", "Talon", "Wren", "Ghost", "Hex", "Raven", "Torque", "Zero"];
        const LAST_NAMES = ["Black", "Stone", "Cross", "Crow", "Wells", "Frost", "Vale", "Mason", "Reed", "Wolf", "Chrome", "Spire", "Knight", "Rain", "Wire", "Hawk"];

        const BUILDS = {
            streetSamurai: {
                magicType: "mundane", metatypes: ["human", "ork", "dwarf"], nuyen: 140000,
                attrs: { body: 5, agility: 6, reaction: 5, strength: 4, willpower: 3, logic: 2, intuition: 4, charisma: 2, edge: 3, magic: 0, resonance: 0 },
                skills: [["automatics", "Automatics", 6, "Submachine Guns"], ["pistols", "Pistols", 4, "Semi-Automatics"], ["blades", "Blades", 4, "Knives"], ["unarmed_combat", "Unarmed Combat", 3, "Cyber Implants"], ["sneaking", "Sneaking", 4, "Urban"], ["perception", "Perception", 4, "Visual"], ["gymnastics", "Gymnastics", 3, ""], ["etiquette", "Etiquette", 2, "Street"]],
                qualities: [
                    ["Toughness", "positive", 9, "00cc6499-db13-447e-8116-278d317a9e31"],
                    ["Distinctive Style", "negative", -5, "a030d7e2-755b-4f71-b848-ad9772fba242"],
                    ["Code of Honor", "negative", -15, "dda02333-10e3-4295-9392-691ff3a7bd4a"]
                ],
                equipment: ["armor-jacket", "ares-predator", "smg", "commlink", "fake-sin", "licenses", "medkit"],
                cyber: [
                    ["Wired Reflexes", 2.0, 39000, 1, "bea0ded3-821f-449c-9507-815088f68b86"],
                    ["Smartlink", 0.2, 4000, 1, "35dba0e2-1d3d-4386-a657-17fedca4622d"],
                    ["Cybereyes Basic System", 0.3, 6000, 2, "8e414ade-2764-4dc7-bdc4-83bb4a086034"],
                    ["Muscle Replacement", 1.0, 25000, 1, "46f80a44-80ae-41d7-a7c8-a119c4cff70f"]
                ]
            },
            decker: {
                magicType: "mundane", metatypes: ["human", "elf", "dwarf"], nuyen: 275000,
                attrs: { body: 3, agility: 3, reaction: 4, strength: 2, willpower: 4, logic: 6, intuition: 5, charisma: 2, edge: 3, magic: 0, resonance: 0 },
                skills: [["hacking", "Hacking", 6, "Hosts"], ["cybercombat", "Cybercombat", 5, "Devices"], ["computer", "Computer", 6, "Matrix Search"], ["electronic_warfare", "Electronic Warfare", 5, "Encryption"], ["hardware", "Hardware", 4, "Cyberdecks"], ["software", "Software", 4, "Edit File"], ["pistols", "Pistols", 3, "Semi-Automatics"], ["sneaking", "Sneaking", 3, "Urban"], ["perception", "Perception", 3, "Matrix"]],
                qualities: [
                    ["Codeslinger", "positive", 10, "41cc3e26-ae55-4e28-bd6a-b08866c21424"],
                    ["Analytical Mind", "positive", 5, "5b19dbcd-fb69-4a02-a25a-7ac5342ca576"],
                    ["Records on File", "negative", -10, "ce01db25-465b-4d13-b091-055496f3a5c4"]
                ],
                equipment: ["armor-clothes", "ares-predator", "cyberdeck", "commlink", "fake-sin", "licenses", "toolkit"]
            },
            technomancer: {
                magicType: "technomancer", metatypes: ["human", "elf", "dwarf"], nuyen: 50000,
                attrs: { body: 3, agility: 3, reaction: 4, strength: 2, willpower: 5, logic: 5, intuition: 5, charisma: 4, edge: 3, magic: 0, resonance: 6 },
                skills: [["compiling", "Compiling", 6, "Fault Sprites"], ["registering", "Registering", 5, "Machine Sprites"], ["decompiling", "Decompiling", 4, ""], ["computer", "Computer", 5, "Matrix Search"], ["hacking", "Hacking", 5, "Hosts"], ["software", "Software", 5, "Complex Forms"], ["electronic_warfare", "Electronic Warfare", 4, ""], ["pistols", "Pistols", 2, ""], ["perception", "Perception", 3, ""]],
                qualities: [
                    ["Analytical Mind", "positive", 5, "5b19dbcd-fb69-4a02-a25a-7ac5342ca576"],
                    ["Codeslinger", "positive", 10, "41cc3e26-ae55-4e28-bd6a-b08866c21424"],
                    ["Distinctive Style", "negative", -5, "a030d7e2-755b-4f71-b848-ad9772fba242"]
                ],
                equipment: ["armor-clothes", "ares-predator", "commlink", "fake-sin", "licenses"]
            },
            magician: {
                magicType: "magician", metatypes: ["human", "elf", "dwarf"], nuyen: 50000,
                attrs: { body: 3, agility: 3, reaction: 4, strength: 2, willpower: 5, logic: 3, intuition: 5, charisma: 6, edge: 2, magic: 6, resonance: 0 },
                skills: [["spellcasting", "Spellcasting", 6, "Combat"], ["counterspelling", "Counterspelling", 5, "Combat"], ["summoning", "Summoning", 5, "Spirits of Man"], ["binding", "Binding", 4, ""], ["banishing", "Banishing", 3, ""], ["assensing", "Assensing", 5, "Auras"], ["arcana", "Arcana", 3, ""], ["perception", "Perception", 3, ""], ["etiquette", "Etiquette", 3, "Magical"]],
                qualities: [
                    ["Magician", "positive", 15, "0e741331-d776-4be8-abc5-4101228abdef"],
                    ["Mentor Spirit", "positive", 5, "ced3fecf-2277-4b20-b1e0-894162ca9ae2"],
                    ["Spirit Bane", "negative", -7, "40c06974-a85b-4f2b-9558-51c140c16d87"]
                ],
                spells: [
                    ["Stunbolt", "combat", "mana", "los", "instant", -3, "direct", "47423962-6b73-4cc3-ad4e-e8d037cf9507"],
                    ["Manabolt", "combat", "mana", "los", "instant", -3, "direct", "85c12bae-3954-483c-a211-d8ee43a1c65e"],
                    ["Heal", "health", "mana", "touch", "permanent", -4, "", "c09e8bb5-4bed-44f9-a41c-bed6a4deb871"],
                    ["Increase Reflexes", "health", "physical", "touch", "sustained", -2, "", "37b3d6ac-624a-42d4-bd6e-a12142dc5725"],
                    ["Improved Invisibility", "illusion", "physical", "touch", "sustained", -1, "", "1d9430e9-3ae9-4c0a-ba60-ee92c245ee08"],
                    ["Detect Enemies", "detection", "mana", "los", "sustained", -2, "", "e343f716-a5b6-46a7-8bff-60b6c175db60"]
                ],
                equipment: ["armor-clothes", "ares-predator", "commlink", "fake-sin", "licenses", "lodge", "reagents", "fetish"]
            },
            aspected: {
                magicType: "aspected", metatypes: ["human", "elf", "ork"], nuyen: 50000,
                attrs: { body: 3, agility: 3, reaction: 4, strength: 2, willpower: 5, logic: 3, intuition: 5, charisma: 6, edge: 3, magic: 5, resonance: 0 },
                skills: [["summoning", "Summoning", 6, "Spirits of Air"], ["binding", "Binding", 5, "Spirits of Man"], ["banishing", "Banishing", 4, ""], ["assensing", "Assensing", 5, "Auras"], ["arcana", "Arcana", 3, ""], ["perception", "Perception", 4, "Astral"], ["etiquette", "Etiquette", 3, "Magical"], ["pistols", "Pistols", 2, ""]],
                qualities: [
                    ["Aspected Magician", "positive", 5, "4adeb2d4-e42e-4b7a-9a5d-3df325ae59a5"],
                    ["Mentor Spirit", "positive", 5, "ced3fecf-2277-4b20-b1e0-894162ca9ae2"],
                    ["Spirit Bane", "negative", -7, "40c06974-a85b-4f2b-9558-51c140c16d87"]
                ],
                equipment: ["armor-clothes", "ares-predator", "commlink", "fake-sin", "licenses", "lodge", "reagents"]
            },
            adept: {
                magicType: "adept", metatypes: ["human", "elf", "ork"], nuyen: 50000,
                attrs: { body: 4, agility: 6, reaction: 5, strength: 4, willpower: 4, logic: 2, intuition: 5, charisma: 3, edge: 3, magic: 6, resonance: 0 },
                skills: [["unarmed_combat", "Unarmed Combat", 6, "Martial Arts"], ["blades", "Blades", 5, "Swords"], ["gymnastics", "Gymnastics", 5, "Parkour"], ["sneaking", "Sneaking", 5, "Urban"], ["perception", "Perception", 4, "Visual"], ["running", "Running", 3, ""], ["etiquette", "Etiquette", 2, "Street"], ["pistols", "Pistols", 2, ""]],
                qualities: [
                    ["Adept", "positive", 5, "55247bdc-c313-4614-ae15-5012308096ff"],
                    ["Agile Defender", "positive", 3, "1d0c4278-501d-456f-ab63-69afee6fbf95"],
                    ["Distinctive Style", "negative", -5, "a030d7e2-755b-4f71-b848-ad9772fba242"]
                ],
                powers: [
                    ["Improved Reflexes 2", 2, 2.5, "fea9e769-5f2c-4bae-9610-56c0825e145a", "Improved Reflexes"],
                    ["Combat Sense 2", 2, 1.0, "76337564-7688-497f-84f9-302c6ece10fe", "Combat Sense"],
                    ["Improved Ability: Unarmed Combat", 2, 1.0, "75821fb7-a180-4012-aa16-daa92ac3bb63", "Improved Ability (skill)"],
                    ["Killing Hands", 1, 0.5, "23636777-44df-44f1-8742-db29dc3c4fdf", "Killing Hands"],
                    ["Improved Physical Attribute: Agility", 1, 1.0, "901d2af5-246a-447a-a8e2-b2e8c10593df", "Improved Physical Attribute"]
                ],
                equipment: ["armor-jacket", "katana", "ares-predator", "commlink", "fake-sin", "licenses"]
            }
        };

        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const randomName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

        const build = BUILDS[this.selectedArchetype];
        const archetypeLabel = ARCHETYPES[this.selectedArchetype];

        let metatype = this.selectedMetatype;
        if (metatype === "random") {
            metatype = pick(build.metatypes);
        }
        const metaLabel = METATYPES[metatype]?.label || metatype.charAt(0).toUpperCase() + metatype.slice(1);

        const defaultCharName = game.i18n.localize("SR5Marketplace.UI.New") + " " + (game.i18n.localize("TYPES.Actor.character") || "character");
        const finalName = name === defaultCharName || name === "Unknown" || !name ? `${randomName} (${archetypeLabel})` : name;

        // Map equipment keys to Chummer format
        const mapEquipmentToChummerGear = (key) => {
            if (key === "armor-jacket") {
                return { type: "armor", data: { name: "Armor Jacket", name_english: "Armor Jacket", armor: "12", suid: "36a4cd30-c32c-44d0-847a-0c15fb51072a" } };
            }
            if (key === "armor-clothes") {
                return { type: "armor", data: { name: "Actioneer Business Clothes", name_english: "Actioneer Business Clothes", armor: "8", suid: "5a650844-8f24-48e7-829f-0443d9ff5cf7" } };
            }
            if (key === "ares-predator") {
                return { type: "weapon", data: { name: "Ares Predator V", name_english: "Ares Predator V", type: "Ranged", rawap: "-1", rawaccuracy: "5", ammo_english: "15", damage_noammo_english: "8P", rawrc: "0", mode: "SA", mode_noammo: "SA", mode_english_noammo: "SA", availableammo: "15", currentammo: "15", suid: "971c711b-db32-4339-9203-865ef38f350e" } };
            }
            if (key === "smg") {
                return { type: "weapon", data: { name: "HK-227", name_english: "HK-227", type: "Ranged", rawap: "0", rawaccuracy: "5", ammo_english: "28", damage_noammo_english: "7P", rawrc: "0", mode: "SA/BF/FA", mode_noammo: "SA/BF/FA", mode_english_noammo: "SA/BF/FA", availableammo: "28", currentammo: "28", suid: "f9ff7bf6-3ed4-41bd-b934-34e751ecf266" } };
            }
            if (key === "katana") {
                return { type: "weapon", data: { name: "Katana", name_english: "Katana", type: "Melee", rawap: "-3", rawaccuracy: "7", rawreach: "1", damage_noammo_english: "3P", rawrc: "0", suid: "8f266b4c-4035-4ba3-aa89-3289d0f42ce1" } };
            }
            if (key === "commlink") {
                return { type: "gear", data: { name: "Hermes Ikon", name_english: "Hermes Ikon", iscommlink: "True", category_english: "Commlinks", devicerating: "5", qty: "1", suid: "6de5a1b0-30e2-4c74-8646-971f698cb231" } };
            }
            if (key === "cyberdeck") {
                return { type: "gear", data: { name: "Renraku Tsurugi", name_english: "Renraku Tsurugi", iscommlink: "True", category_english: "Cyberdecks", devicerating: "3", attack: "6", sleaze: "5", dataprocessing: "5", firewall: "3", qty: "1", suid: "5f4c41eb-abaa-4725-86ce-62fe11eeee0b" } };
            }
            if (key === "fake-sin") {
                return { type: "gear", data: { name: "Fake SIN", name_english: "Fake SIN", issin: "True", rating: "4", qty: "1", suid: "0c800bca-e6ff-475b-a014-c2069f5e364c" } };
            }
            if (key === "licenses") {
                return { type: "gear", data: { name: "Fake License", name_english: "Fake License", rating: "4", qty: "1", suid: "8a16bbb2-8028-4c74-b22b-7aad9d001073" } };
            }
            if (key === "medkit") {
                return { type: "gear", data: { name: "Medkit", name_english: "Medkit", rating: "6", qty: "1", suid: "ae9c37df-6d82-44c1-aa21-6c87e45e2dc1" } };
            }
            if (key === "toolkit") {
                return { type: "gear", data: { name: "Hardware Toolkit", name_english: "Hardware Toolkit", qty: "1", suid: "64fa5212-1d58-4e94-9cc1-9e3eb10773ed" } };
            }
            if (key === "lodge") {
                return { type: "gear", data: { name: "Magical Lodge Materials", name_english: "Magical Lodge Materials", rating: "6", qty: "1", suid: "f8151303-b838-4af1-ba9d-d43ff0892b40" } };
            }
            if (key === "reagents") {
                return { type: "gear", data: { name: "Reagents", name_english: "Reagents", qty: "50", suid: "ef37af30-1204-4918-af66-dfbdd33cd045" } };
            }
            if (key === "fetish") {
                return { type: "gear", data: { name: "Fetish", name_english: "Fetish", qty: "1", suid: "dfb20beb-a64c-4d75-b606-9e4f24622e02" } };
            }
            return null;
        };

        const chummerCharacter = {
            alias: finalName,
            name: finalName,
            critter: "False",
            metatype: metatype,
            metatype_english: metatype.charAt(0).toUpperCase() + metatype.slice(1),
            karma: "0",
            totalkarma: "0",
            nuyen: String(build.nuyen),
            technomancer: build.magicType === "technomancer" ? "True" : "False",
            magician: build.magicType === "magician" ? "True" : "False",
            adept: build.magicType === "adept" ? "True" : "False",
            description: `
              <h2>Random Character Builder</h2>
              <p><strong>Archetype:</strong> ${archetypeLabel}</p>
              <p><strong>Metatype:</strong> ${metaLabel}</p>
              <p><strong>Build Note:</strong> This is a fast random archetype build, intended as a playable starting template or NPC-quality PC draft. Review gear legality, priorities, karma totals, contacts, lifestyle, and final derived values before play.</p>
            `,
            background: "",
            concept: "",
            notes: "",
            attributes: [
                null,
                {
                    attribute: [
                        { name_english: "bod", name: "bod", base: String(build.attrs.body), total: String(build.attrs.body) },
                        { name_english: "agi", name: "agi", base: String(build.attrs.agility), total: String(build.attrs.agility) },
                        { name_english: "rea", name: "rea", base: String(build.attrs.reaction), total: String(build.attrs.reaction) },
                        { name_english: "str", name: "str", base: String(build.attrs.strength), total: String(build.attrs.strength) },
                        { name_english: "wil", name: "wil", base: String(build.attrs.willpower), total: String(build.attrs.willpower) },
                        { name_english: "log", name: "log", base: String(build.attrs.logic), total: String(build.attrs.logic) },
                        { name_english: "int", name: "int", base: String(build.attrs.intuition), total: String(build.attrs.intuition) },
                        { name_english: "cha", name: "cha", base: String(build.attrs.charisma), total: String(build.attrs.charisma) },
                        { name_english: "edg", name: "edg", base: String(build.attrs.edge), total: String(build.attrs.edge) },
                        { name_english: "mag", name: "mag", base: String(build.attrs.magic), total: String(build.attrs.magic) },
                        { name_english: "res", name: "res", base: String(build.attrs.resonance), total: String(build.attrs.resonance) }
                    ]
                }
            ],
            initbonus: "0",
            initdice: "1",
            astralinitdice: "2",
            matrixarinitdice: "3",
            skills: {
                skill: (build.skills || []).map(([id, label, rating, spec]) => {
                    const skillData = {
                        name: label,
                        name_english: label,
                        rating: String(rating),
                        attribute: id === "unarmed_combat" ? "agi" : (id === "hacking" || id === "electronic_warfare" || id === "hardware" || id === "software" || id === "cybercombat" ? "log" : (id === "spellcasting" || id === "counterspelling" || id === "summoning" || id === "binding" || id === "banishing" || id === "compiling" || id === "registering" || id === "decompiling" ? "mag" : "agi")),
                        default: "True",
                        islanguage: "False",
                        knowledge: "False"
                    };
                    if (spec) {
                        skillData.skillspecializations = {
                            skillspecialization: [
                                { name: spec }
                            ]
                        };
                    }
                    return skillData;
                })
            },
            qualities: {
                quality: (build.qualities || []).map(([qname, qtype, karma, suid]) => ({
                    name: qname,
                    name_english: qname,
                    qualitytype_english: qtype,
                    extra: "0",
                    bp: String(karma),
                    suid: suid
                }))
            },
            weapons: {
                weapon: []
            },
            armors: {
                armor: []
            },
            cyberwares: {
                cyberware: []
            },
            powers: {
                power: []
            },
            spells: {
                spell: []
            },
            gears: {
                gear: []
            }
        };

        if (build.spells) {
            chummerCharacter.spells.spell = build.spells.map(([sname, category, spellType, range, duration, drain, combatType, suid]) => ({
                name: sname,
                name_english: sname,
                category_english: category.charAt(0).toUpperCase() + category.slice(1),
                type_english: spellType === "mana" ? "M" : "P",
                range_english: range === "los" ? "LOS" : (range === "touch" ? "T" : "LOS"),
                duration_english: duration === "sustained" ? "S" : (duration === "instant" ? "I" : (duration === "permanent" ? "P" : "S")),
                dv_english: String(drain),
                alchemy: "False",
                descriptors_english: combatType || "",
                damage_english: "0",
                suid: suid
            }));
        }

        if (build.powers) {
            chummerCharacter.powers.power = build.powers.map(([pname, rating, totalpoints, suid, chummerName]) => ({
                name: chummerName,
                name_english: chummerName,
                fullname: pname,
                fullname_english: pname,
                rating: String(rating),
                totalpoints: String(totalpoints),
                suid: suid
            }));
        }

        if (build.cyber) {
            chummerCharacter.cyberwares.cyberware = build.cyber.map(([cname, ess, cost, rating, suid]) => ({
                name: cname,
                name_english: cname,
                ess: String(ess),
                cost: String(cost),
                rating: String(rating),
                grade: "standard",
                improvementsource: "Cyberware",
                suid: suid
            }));
        }

        if (build.equipment) {
            for (const eqKey of build.equipment) {
                const mapped = mapEquipmentToChummerGear(eqKey);
                if (!mapped) continue;
                if (mapped.type === "armor") {
                    chummerCharacter.armors.armor.push(mapped.data);
                } else if (mapped.type === "weapon") {
                    chummerCharacter.weapons.weapon.push(mapped.data);
                } else if (mapped.type === "gear") {
                    chummerCharacter.gears.gear.push(mapped.data);
                }
            }
        }

        const importOptions = {
            folderId: this.folder || null,
            armor: true,
            contacts: true,
            cyberware: true,
            equipment: true,
            lifestyles: true,
            metamagics: true,
            powers: true,
            qualities: true,
            rituals: true,
            spells: true,
            vehicles: true,
            weapons: true,
            mugshots: false
        };

        // Temporarily configure compendium search order so the importer searches all item compendiums
        const originalOrder = game.settings.get("shadowrun5e", "ImporterCompendiumOrder") || [];
        const itemPacks = game.packs.filter(p => p.metadata.type === "Item").map(p => p.collection);
        if (itemPacks.length > 0) {
            await game.settings.set("shadowrun5e", "ImporterCompendiumOrder", itemPacks);
        }

        let actor;
        try {
            const [importedActor] = await game.shadowrun5e.CharacterImporter.import(chummerCharacter, importOptions);
            actor = importedActor;
        } finally {
            if (itemPacks.length > 0) {
                await game.settings.set("shadowrun5e", "ImporterCompendiumOrder", originalOrder);
            }
        }

        actor.sheet?.render(true);

        const attrRows = Object.entries(build.attrs)
            .filter(([k]) => ["body", "agility", "reaction", "strength", "willpower", "logic", "intuition", "charisma", "edge", "magic", "resonance"].includes(k))
            .map(([k, v]) => `<tr><td>${k[0].toUpperCase() + k.slice(1)}</td><td>${v}</td></tr>`).join("");

        const itemRows = actor.items.map(i => `<tr><td>${i.name}</td><td>${game.i18n.localize("TYPES.Item." + i.type) || i.type}</td></tr>`).join("");

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `
        <div style="background:#0b0a13;color:#efe6d8;border:1px solid #5d142b;border-radius:4px;padding:8px;font-family:Signika, sans-serif;">
          <div style="color:#f3d58a;font-size:14px;font-weight:bold;border-bottom:1px solid #5d142b;margin-bottom:6px;padding-bottom:4px;">Random SR5 Character Created</div>
          <p><strong>Actor:</strong> ${actor.name}</p>
          <p><strong>Archetype:</strong> ${archetypeLabel}</p>
          <p><strong>Metatype:</strong> ${metaLabel}</p>
          <p><strong>Starting Nuyen:</strong> ${Number(build.nuyen).toLocaleString()}¥</p>
          <h3 style="color:#f3d58a;font-size:11px;">Attributes</h3>
          <table style="width:100%;border-collapse:collapse;"><tr><th>Attribute</th><th>Rating</th></tr>${attrRows}</table>
          <h3 style="color:#f3d58a;font-size:11px;">Created Items</h3>
          <table style="width:100%;border-collapse:collapse;"><tr><th>Name</th><th>Type</th></tr>${itemRows}</table>
          <p><em>Review the sheet before play. This is a generated template, not a rules-audited final legal character.</em></p>
        </div>`
        });

        return actor;
    }

    /** @override */
    async close(options = {}) {
        if (this.resolve) {
            this.resolve(null);
            this.resolve = null;
        }
        return super.close(options);
    }

    async _onLoadExistingShop() {
        const shops = game.actors.filter(a => a.type === "sr5-marketplace.shop");
        if (shops.length === 0) {
            ui.notifications.warn("No Shop Actors found in this World.");
            return;
        }

        const optionsHtml = shops.map(s => `<option value="${s.uuid}">${s.name}</option>`).join("");
        const content = `
            <div class="form-group" style="padding: 10px; display: flex; flex-direction: column; gap: 8px;">
                <label style="font-weight: bold;">Select Shop to Upgrade:</label>
                <select name="selectedShopUuid" class="form-select-custom" style="padding: 6px;">
                    ${optionsHtml}
                </select>
            </div>
        `;

        const choice = await foundry.applications.api.DialogV2.wait({
            window: { title: "Load Shop for Upgrade" },
            content: content,
            buttons: [
                { label: "Load", action: "load", icon: "fa-solid fa-file-import" },
                { label: "Cancel", action: "cancel", icon: "fa-solid fa-times" }
            ],
            default: "cancel"
        });

        if (choice === "load") {
            const selectEl = document.querySelector('select[name="selectedShopUuid"]');
            const uuid = selectEl?.value;
            if (uuid) {
                const actor = await fromUuid(uuid);
                if (actor) {
                    this.existingActorUuid = actor.uuid;
                    this.actorName = actor.name;
                    this.actorImg = actor.img;
                    this.shopMarkup = actor.system.shop?.itemMarkup ?? 0;
                    this.shopRadius = actor.system.shop?.shopRadius?.value ?? 1;
                    this.shopDescription = actor.system.description?.value ?? "";
                    this.isFactory = actor.system.shop?.isFactory ?? false;
                    this.factoryRating = actor.system.shop?.factoryRating ?? 5;
                    this.selectedEmployeeUuids = new Set(actor.system.shop?.employees || []);

                    const hostItem = actor.hostItem;
                    this.selectedHostUuid = hostItem ? hostItem.uuid : null;

                    // Re-render
                    this.render(false);
                }
            }
        }
    }
}
