import { BUILDS, RANKS, SCHOOLS, SOCIETIES, ARCHETYPES, METATYPES, LABELS } from "./NPCTemplate.enc.mjs";
import { MAPPING } from "./chummer-corp-mapping.enc.mjs";
import { SKILL_METADATA } from "../lib/constants.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A custom actor creation application that replaces the default Foundry creation dialog.
 * Adapts to a shop creation form if the 'sr5-marketplace.shop' or 'sr5-marketplace.workshop' type is chosen,
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

        this.isNpc = false;

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
            },
            actions: {
                selectActorImage: SR5CreateActorApp.#onSelectActorImage,
                loadExistingShop: SR5CreateActorApp.#onLoadExistingShop,
                clearExistingShop: SR5CreateActorApp.#onClearExistingShop,
                toggleSection: SR5CreateActorApp.#onToggleSection,
                selectAllTypes: SR5CreateActorApp.#onSelectAllTypes,
                clearAllTypes: SR5CreateActorApp.#onClearAllTypes,
                selectAllItems: SR5CreateActorApp.#onSelectAllItems,
                clearAllItems: SR5CreateActorApp.#onClearAllItems,
                toggleItemSelection: SR5CreateActorApp.#onToggleItemSelection,
                removeSelectedItem: SR5CreateActorApp.#onRemoveSelectedItem,
                clearAllSelections: SR5CreateActorApp.#onClearAllSelections,
                removeFilterTag: SR5CreateActorApp.#onRemoveFilterTag,
                create: SR5CreateActorApp.#onCreateAction,
                cancel: SR5CreateActorApp.#onCancelAction
            },
            form: {
                handler: SR5CreateActorApp.#onFormSubmit,
                submitOnChange: false,
                closeOnSubmit: false
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
                isCharacterType: this.selectedActorType === "character",
                isNpc: this.isNpc,
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

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);

        // Apply theme color
        const themeClass = SR5CreateActorApp._getThemeFromSetting();
        this.element.classList.add(themeClass);

        // Form change & input delegation
        this.element.removeEventListener("change", this._onChangeForm);
        this.element.addEventListener("change", this._onChangeForm);

        this.element.removeEventListener("input", this._onInputForm);
        this.element.addEventListener("input", this._onInputForm);

        this.element.removeEventListener("keydown", this._onKeydownForm);
        this.element.addEventListener("keydown", this._onKeydownForm);

        // Focus restoration for search box
        if (this._searchFocused && (this.selectedActorType === "sr5-marketplace.shop" || this.selectedActorType === "sr5-marketplace.workshop")) {
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
     * Handles change events on form elements.
     * @param {Event} event
     * @private
     */
    _onChangeForm = (event) => {
        const target = event.target;
        if (!target) return;

        // 1. Actor Type selection
        if (target.classList.contains("type-select")) {
            this.selectedActorType = target.value;
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
            this.isFactory = target.value === "sr5-marketplace.workshop";
            this.render(false);
            return;
        }

        // 2. Folder selection
        if (target.classList.contains("folder-select")) {
            this.folder = target.value || null;
            return;
        }

        // 3. Character archetype / metatype / corp / level / is_npc
        if (target.classList.contains("is-npc-cb") || target.name === "isNpc") {
            this.isNpc = target.checked;
            return;
        }
        if (target.classList.contains("archetype-select") || target.name === "archetype") {
            this.selectedArchetype = target.value;
            this.isNpc = Boolean(this.selectedArchetype);
            const isNpcCb = this.element.querySelector('input[name="isNpc"], .is-npc-cb');
            if (isNpcCb) isNpcCb.checked = this.isNpc;
            return;
        }
        if (target.classList.contains("metatype-select")) {
            this.selectedMetatype = target.value;
            return;
        }
        if (target.classList.contains("corp-select")) {
            this.selectedCorp = target.value;
            return;
        }
        if (target.classList.contains("level-select")) {
            this.selectedLevel = Number(target.value) || 3;
            return;
        }

        // 4. Shop specific fields
        if (target.classList.contains("shop-is-factory-cb")) {
            this.isFactory = target.checked;
            const container = this.element.querySelector(".factory-rating-container");
            if (container) {
                if (this.isFactory) container.classList.remove("hidden");
                else container.classList.add("hidden");
            }
            return;
        }

        if (target.classList.contains("factory-rating-input")) {
            this.factoryRating = Number(target.value) || 5;
            return;
        }

        if (target.classList.contains("shop-markup-input")) {
            this.shopMarkup = Number(target.value) || 0;
            return;
        }

        if (target.classList.contains("shop-radius-input")) {
            this.shopRadius = Number(target.value) || 1;
            return;
        }

        if (target.classList.contains("shop-description-textarea")) {
            this.shopDescription = target.value;
            return;
        }

        if (target.classList.contains("shop-host-select")) {
            this.selectedHostUuid = target.value || null;
            return;
        }

        if (target.classList.contains("employee-checkbox")) {
            const uuid = target.dataset.uuid;
            if (uuid) {
                if (target.checked) this.selectedEmployeeUuids.add(uuid);
                else this.selectedEmployeeUuids.delete(uuid);
            }
            return;
        }

        // 5. Seeding filters
        if (target.classList.contains("item-source-select")) {
            this.activeSource = target.value;
            this.render(false);
            return;
        }

        if (target.classList.contains("max-rating-input")) {
            this.maxRating = target.value === "" ? "" : Number(target.value);
            this.render(false);
            return;
        }

        if (target.classList.contains("type-filter-checkbox")) {
            const type = target.dataset.type;
            if (type) {
                if (target.checked) this.selectedItemTypes.add(type);
                else this.selectedItemTypes.delete(type);
                this.render(false);
            }
            return;
        }

        if (target.classList.contains("item-checkbox")) {
            const uuid = target.dataset.uuid;
            if (uuid) {
                if (target.checked) this.selectedItemUuids.add(uuid);
                else this.selectedItemUuids.delete(uuid);
                this.render(false);
            }
            return;
        }
    };

    /**
     * Handles live input events on form elements.
     * @param {Event} event
     * @private
     */
    _onInputForm = (event) => {
        const target = event.target;
        if (!target) return;

        if (target.classList.contains("name-input")) {
            this.actorName = target.value;
            return;
        }

        if (target.classList.contains("shop-markup-input")) {
            this.shopMarkup = Number(target.value) || 0;
            return;
        }

        if (target.classList.contains("shop-radius-input")) {
            this.shopRadius = Number(target.value) || 1;
            return;
        }

        if (target.classList.contains("shop-description-textarea")) {
            this.shopDescription = target.value;
            return;
        }

        if (target.classList.contains("factory-rating-input")) {
            this.factoryRating = Number(target.value) || 5;
            return;
        }

        if (target.classList.contains("items-search-input")) {
            this.searchQuery = target.value;
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
        }
    };

    /**
     * Handles keydown events on the form (e.g. Enter on search input).
     * @param {KeyboardEvent} event
     * @private
     */
    _onKeydownForm = (event) => {
        const target = event.target;
        if (!target) return;

        if (target.classList.contains("items-search-input")) {
            this._searchFocused = true;
            if (event.key === "Enter") {
                event.preventDefault();
                const q = target.value.trim().toLowerCase();
                if (q && !this.filterTags.includes(q)) {
                    this.filterTags.push(q);
                    this.searchQuery = "";
                    this.render(false);
                }
            }
        }
    };

    // ========================================================
    // ApplicationV2 Static Action Handlers
    // ========================================================

    static #onSelectActorImage(event, target) {
        new FilePicker({
            type: "image",
            current: this.actorImg,
            callback: (path) => {
                this.actorImg = path;
                this.render(false);
            }
        }).browse();
    }

    static async #onLoadExistingShop(event, target) {
        await this._onLoadExistingShop();
    }

    static #onClearExistingShop(event, target) {
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
        this.render(false);
    }

    static #onToggleSection(event, target) {
        const section = target.closest(".actor-creator-collapsible-section");
        const sectionId = section?.dataset.section || target.dataset.section;
        if (section && sectionId) {
            if (this.expandedSections.has(sectionId)) {
                this.expandedSections.delete(sectionId);
                section.classList.add("collapsed");
            } else {
                this.expandedSections.add(sectionId);
                section.classList.remove("collapsed");
            }
        }
    }

    static #onSelectAllTypes(event, target) {
        const allAvailableTypes = [
            "weapon", "armor", "equipment", "device",
            "cyberware", "bioware", "spell", "program",
            "modification", "adept_power", "complex_form"
        ];
        this.selectedItemTypes = new Set(allAvailableTypes);
        this.render(false);
    }

    static #onClearAllTypes(event, target) {
        this.selectedItemTypes.clear();
        this.render(false);
    }

    static #onSelectAllItems(event, target) {
        const visibleCards = this.element.querySelectorAll(".matching-item-card");
        for (const card of visibleCards) {
            if (card.style.display !== "none") {
                const uuid = card.dataset.uuid;
                if (uuid) this.selectedItemUuids.add(uuid);
            }
        }
        this.render(false);
    }

    static #onClearAllItems(event, target) {
        const visibleCards = this.element.querySelectorAll(".matching-item-card");
        for (const card of visibleCards) {
            if (card.style.display !== "none") {
                const uuid = card.dataset.uuid;
                if (uuid) this.selectedItemUuids.delete(uuid);
            }
        }
        this.render(false);
    }

    static #onToggleItemSelection(event, target) {
        // Ignore if clicking the actual checkbox inside the card (the change event handles that)
        if (event.target.tagName === "INPUT") return;
        const uuid = target.dataset.uuid || target.closest("[data-uuid]")?.dataset.uuid;
        if (!uuid) return;
        if (this.selectedItemUuids.has(uuid)) {
            this.selectedItemUuids.delete(uuid);
        } else {
            this.selectedItemUuids.add(uuid);
        }
        this.render(false);
    }

    static #onRemoveSelectedItem(event, target) {
        const uuid = target.dataset.uuid || target.closest("[data-uuid]")?.dataset.uuid;
        if (uuid) {
            this.selectedItemUuids.delete(uuid);
            this.render(false);
        }
    }

    static #onClearAllSelections(event, target) {
        this.selectedItemUuids.clear();
        this.render(false);
    }

    static #onRemoveFilterTag(event, target) {
        const tag = target.dataset.tag || target.closest("[data-tag]")?.dataset.tag;
        if (tag) {
            this.filterTags = this.filterTags.filter(t => t !== tag);
            this.render(false);
        }
    }

    static async #onCreateAction(event, target) {
        await this._onCreate();
    }

    static #onCancelAction(event, target) {
        this.close();
    }

    static async #onFormSubmit(event, form, formData) {
        event.preventDefault();
        await this._onCreate();
    }

    /**
     * Triggers the actual Actor document creation and seeding.
     */
    async _onCreate() {
        const nameInput = this.element.querySelector(".name-input");
        const name = this.actorName?.trim() || nameInput?.value?.trim() || "Unknown";

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
        } else if (actualActorType === "character") {
            createData.system = {
                is_npc: Boolean(this.isNpc)
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

        const descriptionHtml = await renderTemplate("modules/sr5-marketplace/templates/apps/createActor/partials/character-description.html", {
            tableHeader,
            labelArchetype,
            archetypeLabel,
            labelMetatype,
            metaLabel,
            labelCorp,
            displayCorp,
            labelRank,
            localizedRank,
            labelLevel,
            level,
            isMagic: build.magicType === "magician" || build.magicType === "aspected",
            labelSchool,
            localizedSchool,
            labelSociety,
            localizedSociety
        });

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
                        { name_english: "BOD", name: "BOD", base: String(scaleAttr(build.attrs.body)), total: String(scaleAttr(build.attrs.body)) },
                        { name_english: "AGI", name: "AGI", base: String(scaleAttr(build.attrs.agility)), total: String(scaleAttr(build.attrs.agility)) },
                        { name_english: "REA", name: "REA", base: String(scaleAttr(build.attrs.reaction)), total: String(scaleAttr(build.attrs.reaction)) },
                        { name_english: "STR", name: "STR", base: String(scaleAttr(build.attrs.strength)), total: String(scaleAttr(build.attrs.strength)) },
                        { name_english: "WIL", name: "WIL", base: String(scaleAttr(build.attrs.willpower)), total: String(scaleAttr(build.attrs.willpower)) },
                        { name_english: "LOG", name: "LOG", base: String(scaleAttr(build.attrs.logic)), total: String(scaleAttr(build.attrs.logic)) },
                        { name_english: "INT", name: "INT", base: String(scaleAttr(build.attrs.intuition)), total: String(scaleAttr(build.attrs.intuition)) },
                        { name_english: "CHA", name: "CHA", base: String(scaleAttr(build.attrs.charisma)), total: String(scaleAttr(build.attrs.charisma)) },
                        { name_english: "EDG", name: "EDG", base: String(scaleAttr(build.attrs.edge)), total: String(scaleAttr(build.attrs.edge)) },
                        { name_english: "MAG", name: "MAG", base: String(scaleAttr(build.attrs.magic)), total: String(scaleAttr(build.attrs.magic)) },
                        { name_english: "RES", name: "RES", base: String(scaleAttr(build.attrs.resonance)), total: String(scaleAttr(build.attrs.resonance)) },
                        { name_english: "ESS", name: "ESS", base: "6", total: "6" }
                    ]
                }
            ],
            skills: {
                skill: (build.skills || []).map(entry => {
                    let name, baseRating, spec;
                    let key = "";
                    if (Array.isArray(entry)) {
                        key = String(entry[0] || "");
                        name = entry[1] || entry[0];
                        baseRating = entry[2];
                        spec = entry[3] || "";
                    } else if (typeof entry === "object") {
                        key = String(entry.key || entry.name || "");
                        name = entry.name;
                        baseRating = entry.rating;
                        spec = entry.spec || "";
                    } else {
                        key = String(entry);
                        name = String(entry);
                        baseRating = 1;
                        spec = "";
                    }

                    const normalizedKey = key.toLowerCase().replace(/[\s\-]+/g, "_");
                    const meta = SKILL_METADATA[normalizedKey] || { name: name, attr: "AGI", category: "Technical Active" };
                    const attr = meta.attr || "AGI";
                    const category = meta.category || "Combat Active";

                    const skillObj = {
                        name: name,
                        name_english: name,
                        rating: String(scaleSkill(baseRating)),
                        ratingmax: "12",
                        isgroup: "False",
                        grouped: "False",
                        attribute: attr,
                        attribute_english: attr,
                        skillcategory: category,
                        skillcategory_english: category,
                        base: String(scaleSkill(baseRating)),
                        total: String(scaleSkill(baseRating))
                    };
                    if (spec) {
                        skillObj.spec = spec;
                        skillObj.specialization = spec;
                    }
                    return skillObj;
                })
            },
            qualities: {
                quality: selectedQualities.map(q => {
                    let name, qType;
                    if (Array.isArray(q)) {
                        name = q[0];
                        qType = q[1] === "negative" ? "Negative" : "Positive";
                    } else if (typeof q === "object") {
                        name = q.name;
                        qType = q.qualitytype || (q.type === "negative" ? "Negative" : "Positive");
                    } else {
                        name = String(q);
                        qType = "Positive";
                    }
                    return {
                        name: name,
                        qualitytype: qType
                    };
                })
            },
            spells: {
                spell: (build.spells || []).map(spellKey => {
                    const resolved = getMappingItemByKey(spellKey);
                    return resolved?.chummerData ? foundry.utils.deepClone(resolved.chummerData) : {
                        name: resolved?.name || spellKey,
                        category: "Combat",
                        type: "Physical",
                        range: "LOS",
                        damage: "P",
                        duration: "Instant",
                        dv: "F-3"
                    };
                })
            },
            powers: {
                power: (build.powers || []).map(powerEntry => {
                    let name, rating, points;
                    if (Array.isArray(powerEntry)) {
                        name = powerEntry[0];
                        rating = String(powerEntry[1] ?? 1);
                        points = String(powerEntry[2] ?? 0.5);
                    } else if (typeof powerEntry === "object") {
                        name = powerEntry.name;
                        rating = String(powerEntry.rating ?? 1);
                        points = String(powerEntry.points ?? 0.5);
                    } else {
                        const resolved = getMappingItemByKey(powerEntry);
                        name = resolved?.name || powerEntry;
                        rating = "1";
                        points = "0.5";
                    }
                    return {
                        name: name,
                        rating: rating,
                        points: points
                    };
                })
            },
            cyberwares: {
                cyberware: []
            },
            biowares: {
                bioware: []
            },
            armors: { armor: [] },
            weapons: { weapon: [] },
            gears: { gear: [] }
        };

        // Populate resolved items from mappings (checking equipment, cyber, and items lists)
        const itemKeys = [...(build.equipment || []), ...(build.cyber || []), ...(build.items || [])];
        for (const itemKey of itemKeys) {
            const item = getMappingItemByKey(itemKey);
            if (!item) continue;

            const chData = item.chummerData ? foundry.utils.deepClone(item.chummerData) : {
                name: item.name,
                qty: "1"
            };

            if (item.type === "armor") {
                chummerCharacter.armors.armor.push(chData);
            } else if (item.type === "weapon") {
                chummerCharacter.weapons.weapon.push(chData);
            } else if (item.type === "commlink" || item.type === "deck" || item.type === "gear") {
                chummerCharacter.gears.gear.push(chData);
            } else if (item.type === "cyberware") {
                chummerCharacter.cyberwares.cyberware.push(chData);
            } else if (item.type === "bioware") {
                chummerCharacter.biowares.bioware.push(chData);
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
            await actor.update({ "system.is_npc": Boolean(this.isNpc) });
        } finally {
            if (itemPacks.length > 0) {
                await game.settings.set("shadowrun5e", "ImporterCompendiumOrder", originalOrder);
            }
        }

        actor.sheet?.render(true);

        const attrRows = Object.entries(build.attrs)
            .filter(([k]) => ["body", "agility", "reaction", "strength", "willpower", "logic", "intuition", "charisma", "edge", "magic", "resonance"].includes(k))
            .map(([k, v]) => ({
                label: k[0].toUpperCase() + k.slice(1),
                value: v
            }));

        const itemRows = actor.items.map(i => ({
            name: i.name,
            type: game.i18n.localize("TYPES.Item." + i.type) || i.type
        }));

        const whisperToGM = game.settings.get("sr5-marketplace", "quickBuildWhisperGM");
        if (whisperToGM) {
            const chatCardHtml = await renderTemplate("modules/sr5-marketplace/templates/apps/createActor/partials/character-chat-card.html", {
                lang,
                actor,
                archetypeLabel,
                metaLabel,
                nuyen: Number(build.nuyen).toLocaleString(),
                attrs: attrRows,
                items: itemRows,
                labelArchetype,
                labelMetatype
            });

            const gmUsers = game.users.filter(u => u.isGM).map(u => u.id);
            await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor }),
                content: chatCardHtml,
                whisper: gmUsers.length > 0 ? gmUsers : [game.user.id]
            });
        }

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
            <div class="form-group-custom p-2 flex flex-col gap-2">
                <label class="font-bold">Select Shop to Upgrade:</label>
                <select name="selectedShopUuid" class="form-select-custom p-1.5">
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
