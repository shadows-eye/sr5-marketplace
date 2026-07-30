import { BUILDS, RANKS, SCHOOLS, SOCIETIES, ARCHETYPES, METATYPES, LABELS } from "./NPCTemplate.enc.mjs";
import { MAPPING } from "./chummer-corp-mapping.enc.mjs";

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
        this.selectedCorp = "";
        this.selectedLevel = 3;
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

    /**
     * Checks if the character importer API is available.
     * @returns {boolean}
     */
    static isImporterAvailable() {
        return typeof game !== "undefined" && typeof game.shadowrun5e?.CharacterImporter?.import === "function";
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
                extraCtx.isCharacterActor = SR5CreateActorApp.isImporterAvailable();
                extraCtx.archetypes = archetypes;
                extraCtx.selectedCorp = this.selectedCorp;
                extraCtx.selectedLevel = this.selectedLevel;
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
                this.selectedCorp = "";
                this.selectedLevel = 3;
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
            const corpSelect = this.element.querySelector(".corp-select");
            if (corpSelect) {
                corpSelect.addEventListener("change", (e) => {
                    this.selectedCorp = e.target.value;
                });
            }
            const levelSelect = this.element.querySelector(".level-select");
            if (levelSelect) {
                levelSelect.addEventListener("change", (e) => {
                    this.selectedLevel = Number(e.target.value);
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
        if (this.selectedActorType === "character" && this.selectedArchetype && SR5CreateActorApp.isImporterAvailable()) {
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
        const lang = game.i18n.lang === "de" ? "de" : "en";

        const FIRST_NAMES = ["Ash", "Rook", "Mika", "Jax", "Echo", "Vex", "Kestrel", "Nova", "Grimm", "Cipher", "Knox", "Talon", "Wren", "Ghost", "Hex", "Raven", "Torque", "Zero"];
        const LAST_NAMES = ["Black", "Stone", "Cross", "Crow", "Wells", "Frost", "Vale", "Mason", "Reed", "Wolf", "Chrome", "Spire", "Knight", "Rain", "Wire", "Hawk"];

        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const randomName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

        const build = BUILDS[this.selectedArchetype];
        const archetypeLabel = ARCHETYPES[lang]?.[this.selectedArchetype] || this.selectedArchetype;

        let metatype = this.selectedMetatype;
        if (metatype === "random") {
            metatype = pick(build.metatypes);
        }
        const metaLabel = METATYPES[lang]?.[metatype] || metatype.charAt(0).toUpperCase() + metatype.slice(1);

        const level = this.selectedLevel || 3;
        const corpKey = this.selectedCorp || "none";
        let rankRole = "combat";
        if (this.selectedArchetype === "decker" || this.selectedArchetype === "technomancer") {
            rankRole = "matrix";
        } else if (this.selectedArchetype === "magician" || this.selectedArchetype === "aspected") {
            rankRole = "magic";
        }
        const corpRanks = RANKS[corpKey] || RANKS.none;
        const roleRanks = corpRanks[rankRole] || RANKS.none[rankRole];
        const localizedRank = roleRanks?.[lang]?.[String(level)] || archetypeLabel;

        const defaultCharName = game.i18n.localize("SR5Marketplace.UI.New") + " " + (game.i18n.localize("TYPES.Actor.character") || "character");
        const finalName = name === defaultCharName || name === "Unknown" || !name ? `${randomName} (${localizedRank})` : name;

        // Level scaling modifiers
        const attrMults = { 1: 0.7, 2: 0.85, 3: 1.0, 4: 1.1, 5: 1.25, 6: 1.4 };
        const skillMults = { 1: 0.5, 2: 0.75, 3: 1.0, 4: 1.2, 5: 1.4, 6: 1.6 };
        const nuyenMults = { 1: 0.5, 2: 0.75, 3: 1.0, 4: 1.3, 5: 1.7, 6: 2.2 };

        const attrMult = attrMults[level];
        const skillMult = skillMults[level];
        const nuyenMult = nuyenMults[level];

        const scaleAttr = (baseVal) => {
            if (!baseVal || baseVal === 0) return 0;
            return Math.max(1, Math.round(baseVal * attrMult));
        };

        const scaleSkill = (rating) => {
            return Math.max(1, Math.round(rating * skillMult));
        };

        let magicSchool = SCHOOLS.corps[corpKey] || "hermetic";
        const schoolKeys = Object.keys(SCHOOLS.labels);
        if (corpKey === "none") {
            magicSchool = schoolKeys[Math.floor(Math.random() * schoolKeys.length)];
        } else {
            // 80% chance of standard corporate tradition, 20% chance of a random other tradition
            if (Math.random() < 0.20) {
                const otherSchools = schoolKeys.filter(s => s !== magicSchool);
                magicSchool = otherSchools[Math.floor(Math.random() * otherSchools.length)];
            }
        }
        const localizedSchool = SCHOOLS.labels[magicSchool]?.[lang] || magicSchool;
        const paradigm = SCHOOLS.paradigms[magicSchool] || "hermetic";

        let localizedSociety = "";
        if (build.magicType === "magician" || build.magicType === "aspected") {
            if (Math.random() < 0.60) {
                let eligible = [];
                if (this.selectedCorp && this.selectedCorp !== "none") {
                    eligible = SOCIETIES.filter(s => s.type === "corporate" && s.corps && s.corps.includes(this.selectedCorp));
                }
                if (eligible.length === 0 || Math.random() < 0.50) {
                    const byTradition = SOCIETIES.filter(s => s.traditions && s.traditions.includes(magicSchool));
                    if (byTradition.length > 0) {
                        eligible = byTradition;
                    }
                }
                const chosenSoc = eligible.length > 0 ? pick(eligible) : null;
                if (chosenSoc) {
                    localizedSociety = chosenSoc.name[lang] || chosenSoc.name.en;
                }
            }
        }

        // Dynamic Resolver: find mapping item by generic mapping key, level, and selected corporation flavor
        const getMappingItemByKey = (key) => {
            // 1. First choice: matches key, level range, selected magic paradigm (if spell), and selected corp flavor (if any)
            let choices = MAPPING.items.filter(item => {
                if (!item.mappingKeys.includes(key)) return false;
                if (level < item.minLevel || level > item.maxLevel) return false;
                if (item.type === "spell" && item.schools && !item.schools.includes(paradigm)) return false;
                if (this.selectedCorp) return item.corporations.includes(this.selectedCorp);
                return true;
            });
            // 2. Fallback: match key, level range, and paradigm (if spell) - ignore corp flavor
            if (choices.length === 0) {
                choices = MAPPING.items.filter(item => {
                    if (!item.mappingKeys.includes(key)) return false;
                    if (level < item.minLevel || level > item.maxLevel) return false;
                    if (item.type === "spell" && item.schools && !item.schools.includes(paradigm)) return false;
                    return true;
                });
            }
            // 3. Secondary fallback: match key and level range only (ignore magic school and corp flavor)
            if (choices.length === 0) {
                choices = MAPPING.items.filter(item => {
                    return item.mappingKeys.includes(key) && level >= item.minLevel && level <= item.maxLevel;
                });
            }
            // 4. Tertiary fallback: match key only (ignore level range, magic school, and corp flavor)
            if (choices.length === 0) {
                choices = MAPPING.items.filter(item => item.mappingKeys.includes(key));
            }
            return choices.length > 0 ? pick(choices) : null;
        };

        // Quality selector with logical randomness
        const selectedQualities = [];
        if (build.qualities) {
            const pickRandomUnique = (arr, count) => {
                const shuffled = [...arr].sort(() => 0.5 - Math.random());
                return shuffled.slice(0, count);
            };

            if (build.qualities.mandatory) {
                selectedQualities.push(...build.qualities.mandatory);
            }
            if (build.qualities.optionalPositive && build.qualities.maxOptionalPositive) {
                selectedQualities.push(...pickRandomUnique(build.qualities.optionalPositive, build.qualities.maxOptionalPositive));
            }
            if (build.qualities.optionalNegative && build.qualities.maxOptionalNegative) {
                selectedQualities.push(...pickRandomUnique(build.qualities.optionalNegative, build.qualities.maxOptionalNegative));
            }
        }

        const tableHeader = LABELS[lang]?.overview || "Character Overview";
        const labelArchetype = LABELS[lang]?.archetype || "Archetype";
        const labelMetatype = LABELS[lang]?.metatype || "Metatype";
        const labelCorp = LABELS[lang]?.corp || "Corporation";
        const labelRank = LABELS[lang]?.rank || "Corporate Rank";
        const labelSchool = LABELS[lang]?.school || "Magic School";
        const labelSociety = LABELS[lang]?.society || "Magical Society";
        const labelLevel = LABELS[lang]?.level || "Professional Level";

        const displayCorp = this.selectedCorp ? this.selectedCorp.toUpperCase() : (lang === "de" ? "KEINE/STANDARD" : "NONE/STANDARD");

        let magicRowHtml = "";
        if (build.magicType === "magician" || build.magicType === "aspected") {
            magicRowHtml = `
        <tr>
            <td>
                <p><strong>${labelSchool}</strong></p>
            </td>
            <td>
                <p>${localizedSchool}</p>
            </td>
            <td>
                <p><strong>${labelSociety}</strong></p>
            </td>
            <td>
                <p>${localizedSociety || "-"}</p>
            </td>
        </tr>`;
        }

        const descriptionHtml = `
<table>
    <tbody>
        <tr>
            <th colspan="4">
                <h1>${tableHeader}</h1>
            </th>
        </tr>
        <tr>
            <td>
                <p>${labelArchetype}</p>
            </td>
            <td>
                <p>${archetypeLabel}</p>
            </td>
            <td>
                <p>${labelMetatype}</p>
            </td>
            <td>
                <p>${metaLabel}</p>
            </td>
        </tr>
        <tr>
            <td>
                <p>${labelCorp}</p>
            </td>
            <td>
                <p>${displayCorp}</p>
            </td>
            <td>
                <p>${labelRank}</p>
            </td>
            <td>
                <p>${localizedRank}</p>
            </td>
        </tr>${magicRowHtml}
        <tr>
            <td>
                <p><strong>${labelLevel}</strong></p>
            </td>
            <td>
                <p>${level}</p>
            </td>
            <td>
                <p></p>
            </td>
            <td>
                <p></p>
            </td>
        </tr>
    </tbody>
</table>
<p><br></p>
`;

        const chummerCharacter = {
            alias: finalName,
            name: finalName,
            critter: "False",
            metatype: metatype,
            metatype_english: metatype.charAt(0).toUpperCase() + metatype.slice(1),
            karma: "0",
            totalkarma: "0",
            nuyen: String(Math.round(build.nuyen * nuyenMult)),
            technomancer: build.magicType === "technomancer" ? "True" : "False",
            magician: build.magicType === "magician" ? "True" : "False",
            adept: build.magicType === "adept" ? "True" : "False",
            description: descriptionHtml,
            background: "",
            concept: "",
            notes: "",
            attributes: [
                null,
                {
                    attribute: [
                        { name_english: "bod", name: "bod", base: String(scaleAttr(build.attrs.body)), total: String(scaleAttr(build.attrs.body)) },
                        { name_english: "agi", name: "agi", base: String(scaleAttr(build.attrs.agility)), total: String(scaleAttr(build.attrs.agility)) },
                        { name_english: "rea", name: "rea", base: String(scaleAttr(build.attrs.reaction)), total: String(scaleAttr(build.attrs.reaction)) },
                        { name_english: "str", name: "str", base: String(scaleAttr(build.attrs.strength)), total: String(scaleAttr(build.attrs.strength)) },
                        { name_english: "wil", name: "wil", base: String(scaleAttr(build.attrs.willpower)), total: String(scaleAttr(build.attrs.willpower)) },
                        { name_english: "log", name: "log", base: String(scaleAttr(build.attrs.logic)), total: String(scaleAttr(build.attrs.logic)) },
                        { name_english: "int", name: "int", base: String(scaleAttr(build.attrs.intuition)), total: String(scaleAttr(build.attrs.intuition)) },
                        { name_english: "cha", name: "cha", base: String(scaleAttr(build.attrs.charisma)), total: String(scaleAttr(build.attrs.charisma)) },
                        { name_english: "edg", name: "edg", base: String(scaleAttr(build.attrs.edge)), total: String(scaleAttr(build.attrs.edge)) },
                        { name_english: "mag", name: "mag", base: String(scaleAttr(build.attrs.magic)), total: String(scaleAttr(build.attrs.magic)) },
                        { name_english: "res", name: "res", base: String(scaleAttr(build.attrs.resonance)), total: String(scaleAttr(build.attrs.resonance)) }
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
                        rating: String(scaleSkill(rating)),
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
                quality: selectedQualities.map(([qname, qtype, karma, suid]) => ({
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
            const resolvedSpellNames = new Set();
            for (const key of build.spells) {
                let itemChoices = MAPPING.items.filter(item => {
                    if (!item.mappingKeys.includes(key)) return false;
                    if (item.type !== "spell") return false;
                    if (item.schools && !item.schools.includes(paradigm)) return false;
                    if (resolvedSpellNames.has(item.chummerData.name)) return false;
                    if (this.selectedCorp) return item.corporations.includes(this.selectedCorp);
                    return true;
                });
                if (itemChoices.length === 0) {
                    itemChoices = MAPPING.items.filter(item => {
                        if (!item.mappingKeys.includes(key)) return false;
                        if (item.type !== "spell") return false;
                        if (item.schools && !item.schools.includes(paradigm)) return false;
                        if (resolvedSpellNames.has(item.chummerData.name)) return false;
                        return true;
                    });
                }
                if (itemChoices.length === 0) {
                    itemChoices = MAPPING.items.filter(item => {
                        if (!item.mappingKeys.includes(key)) return false;
                        if (item.type !== "spell") return false;
                        if (resolvedSpellNames.has(item.chummerData.name)) return false;
                        return true;
                    });
                }
                const chosenSpell = itemChoices.length > 0 ? pick(itemChoices) : null;
                if (chosenSpell) {
                    chummerCharacter.spells.spell.push(chosenSpell.chummerData);
                    resolvedSpellNames.add(chosenSpell.chummerData.name);
                }
            }
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

        // Cyberware & Bioware selection/scaling
        const grade = level <= 2 ? "standard" : (level <= 4 ? "alpha" : (level === 5 ? "beta" : "delta"));
        const gradeMults = {
            standard: { ess: 1.0, cost: 1.0 },
            alpha: { ess: 0.8, cost: 1.2 },
            beta: { ess: 0.7, cost: 1.5 },
            delta: { ess: 0.5, cost: 2.5 }
        };
        const mults = gradeMults[grade] || { ess: 1.0, cost: 1.0 };

        if (build.cyber) {
            for (const key of build.cyber) {
                const item = getMappingItemByKey(key);
                if (!item) continue;
                
                const rawEss = Number(item.chummerData.ess) || 0;
                const rawCost = Number(item.chummerData.cost) || 0;
                
                chummerCharacter.cyberwares.cyberware.push({
                    name: item.chummerData.name,
                    name_english: item.chummerData.name_english,
                    ess: String(rawEss * mults.ess),
                    cost: String(rawCost * mults.cost),
                    rating: item.chummerData.rating || "1",
                    grade: grade,
                    improvementsource: item.chummerData.improvementsource || "Cyberware",
                    suid: item.chummerData.suid
                });
            }
        }

        // Equipment / Gear selection
        if (build.equipment) {
            for (const key of build.equipment) {
                const item = getMappingItemByKey(key);
                if (!item) continue;
                
                const chData = { ...item.chummerData };
                
                if (item.type === "armor") {
                    chummerCharacter.armors.armor.push(chData);
                } else if (item.type === "weapon") {
                    chummerCharacter.weapons.weapon.push(chData);
                } else if (item.type === "commlink" || item.type === "deck" || item.type === "gear") {
                    chummerCharacter.gears.gear.push(chData);
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
