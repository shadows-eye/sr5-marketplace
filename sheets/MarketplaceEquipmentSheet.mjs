import { CredstickService } from "../scripts/services/credstickService.mjs";
import { MODULE_ID } from "../scripts/lib/constants.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

let cachedMarketplaceEquipmentSheetClass = null;

/**
 * Resolves the exact Shadowrun 5e system item sheet class (SR5ItemSheet).
 * NEVER falls back to base core ItemSheet!
 * @returns {typeof ApplicationV2|null}
 */
export function getSystemItemSheetClass() {
    // 1. Direct check on equipment sheetClasses for shadowrun5e.SR5ItemSheet
    const equipEntry = CONFIG.Item?.sheetClasses?.equipment?.["shadowrun5e.SR5ItemSheet"];
    if (equipEntry?.cls) {
        console.log("SR5 Marketplace | Resolved system sheet from CONFIG.Item.sheetClasses.equipment:", equipEntry.cls.name);
        return equipEntry.cls;
    }

    // 2. Direct check on base sheetClasses for shadowrun5e.SR5ItemSheet
    const baseEntry = CONFIG.Item?.sheetClasses?.base?.["shadowrun5e.SR5ItemSheet"];
    if (baseEntry?.cls) {
        console.log("SR5 Marketplace | Resolved system sheet from CONFIG.Item.sheetClasses.base:", baseEntry.cls.name);
        return baseEntry.cls;
    }

    // 3. Loop through categories in CONFIG.Item.sheetClasses
    if (CONFIG.Item?.sheetClasses) {
        for (const catKey of Object.keys(CONFIG.Item.sheetClasses)) {
            const cat = CONFIG.Item.sheetClasses[catKey];
            if (!cat) continue;
            for (const sheetKey of Object.keys(cat)) {
                const cls = cat[sheetKey]?.cls;
                if (cls && cls.name === "SR5ItemSheet") {
                    console.log(`SR5 Marketplace | Resolved system sheet under [${catKey}][${sheetKey}]:`, cls.name);
                    return cls;
                }
            }
        }
    }

    // 4. Check Items.registeredSheets
    const registeredArray = foundry.documents.collections.Items?.registeredSheets;
    if (Array.isArray(registeredArray)) {
        for (const sheetCls of registeredArray) {
            if (sheetCls.name === "SR5ItemSheet") {
                console.log("SR5 Marketplace | Resolved system sheet from Items.registeredSheets:", sheetCls.name);
                return sheetCls;
            }
        }
    }

    // 5. Check game.shadowrun5e
    if (game.shadowrun5e?.SR5ItemSheet) {
        console.log("SR5 Marketplace | Resolved system sheet from game.shadowrun5e.SR5ItemSheet");
        return game.shadowrun5e.SR5ItemSheet;
    }

    console.warn("SR5 Marketplace | System SR5ItemSheet not found in CONFIG or registeredSheets yet.");
    return null;
}

/**
 * Dynamically constructs MarketplaceEquipmentSheet extending the system's SR5ItemSheet.
 * Returns null if SR5ItemSheet is not yet loaded (never extends base core ItemSheet).
 * @param {boolean} [forceRefresh=false]
 * @returns {typeof ApplicationV2|null}
 */
export function getMarketplaceEquipmentSheetClass(forceRefresh = false) {
    if (cachedMarketplaceEquipmentSheetClass && !forceRefresh) {
        return cachedMarketplaceEquipmentSheetClass;
    }

    const BaseSheet = getSystemItemSheetClass();
    if (!BaseSheet) {
        console.warn("SR5 Marketplace | Skipping MarketplaceEquipmentSheet creation: System SR5ItemSheet not available.");
        return null;
    }

    console.log(`SR5 Marketplace | Constructing MarketplaceEquipmentSheet extending system class "${BaseSheet.name}"`);

    cachedMarketplaceEquipmentSheetClass = class MarketplaceEquipmentSheet extends BaseSheet {

        constructor(options, ...args) {
            super(options, ...args);
            console.log(`SR5 Marketplace | MarketplaceEquipmentSheet instantiated for item "${this.item?.name}" [type: ${this.item?.type}] [${this.item?.uuid}]`);
        }

        /** @override */
        async _prepareContext(options) {
            // Guard: Non-equipment items get standard system context cleanly
            if (this.item?.type !== "equipment") {
                return super._prepareContext(options);
            }

            // Ensure credstick flags are initialized for equipment items
            await CredstickService.ensureCredstickFlags(this.item);

            const context = await super._prepareContext(options);
            
            // Resolve isEditMode and isPlayMode from system sheet getter
            context.isEditMode = this.isEditMode ?? context.isEditMode ?? true;
            context.isPlayMode = !context.isEditMode;

            context.credstickData = CredstickService.getCredstickData(this.item);
            return context;
        }

        /** @override */
        async _onRender(context, options) {
            await super._onRender(context, options);

            // Guard: STRICTLY ONLY run custom header/footer additions for equipment items
            if (this.item?.type !== "equipment") {
                return;
            }

            await this._renderCredstickAdditions(context);
        }

        /**
         * Renders custom Handlebars partial templates and appends them into the sheet header/footer.
         * ONLY called for equipment items.
         * @param {object} context
         * @private
         */
        async _renderCredstickAdditions(context) {
            if (!this.element || this.item?.type !== "equipment") {
                return;
            }

            const render = foundry.applications.handlebars?.renderTemplate || globalThis.renderTemplate;

            // 1. Render and insert header partial
            try {
                const headerHtml = await render("modules/sr5-marketplace/templates/sheets/credstick-header.hbs", context);
                if (headerHtml && headerHtml.trim().length > 0) {
                    const iconsContainer = this.element.querySelector('.list-item-icons') 
                        || this.element.querySelector('.sheet-header-name') 
                        || this.element.querySelector('.sheet-header-labels');
                    if (iconsContainer) {
                        iconsContainer.querySelector('.credstick-header-control')?.remove();
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = headerHtml.trim();
                        const elem = tempDiv.firstElementChild;
                        if (elem) {
                            iconsContainer.appendChild(elem);
                        }
                    }
                }
            } catch (err) {
                console.error("SR5 Marketplace | Error rendering credstick header partial:", err);
            }

            // 2. Render and insert footer partial into the main info row (list-item:last-child)
            try {
                const footerHtml = await render("modules/sr5-marketplace/templates/sheets/credstick-footer.hbs", context);
                if (footerHtml && footerHtml.trim().length > 0) {
                    const footerContainer = this.element.querySelector('.sheet-footer .list-item:last-child') 
                        || this.element.querySelector('.item-footer .list-item:last-child') 
                        || this.element.querySelector('footer .list-item:last-child') 
                        || this.element.querySelector('.sheet-footer');
                    if (footerContainer) {
                        footerContainer.querySelector('.credstick-footer-control')?.remove();
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = footerHtml.trim();
                        const elem = tempDiv.firstElementChild;
                        if (elem) {
                            footerContainer.appendChild(elem);
                        }
                    }
                }
            } catch (err) {
                console.error("SR5 Marketplace | Error rendering credstick footer partial:", err);
            }

            // 3. Hide cost and availability adjustment scaling checkboxes for credstick items
            if (context.credstickData?.credstick) {
                try {
                    const labels = this.element.querySelectorAll('footer.sheet-footer label, .sheet-footer label');
                    labels.forEach(lbl => {
                        const isCostAdjust = lbl.getAttribute('data-tooltip')?.includes('CostAdjustment')
                            || lbl.querySelector('[name*="cost.adjusted"]')
                            || lbl.innerHTML.includes('cost.adjusted');
                        const isAvailAdjust = lbl.getAttribute('data-tooltip')?.includes('AvailabilityAdjustment')
                            || lbl.querySelector('[name*="availability.adjusted"]')
                            || lbl.innerHTML.includes('availability.adjusted');
                        if (isCostAdjust || isAvailAdjust) {
                            lbl.style.display = 'none';
                        }
                    });

                    // If the first list-item row in footer now has no visible children, hide that empty row
                    const firstRow = this.element.querySelector('footer.sheet-footer .list-item:first-child, .sheet-footer .list-item:first-child');
                    const lastRow = this.element.querySelector('footer.sheet-footer .list-item:last-child, .sheet-footer .list-item:last-child');
                    if (firstRow && firstRow !== lastRow) {
                        const visibleChild = Array.from(firstRow.children).find(c => c.style.display !== 'none');
                        if (!visibleChild) {
                            firstRow.style.display = 'none';
                        }
                    }
                } catch (err) {
                    console.error("SR5 Marketplace | Error hiding cost adjustment controls for credstick:", err);
                }
            }

            this._bindCredstickEvents();
        }

        /**
         * Binds change listeners on our credstick form controls.
         * @private
         */
        _bindCredstickEvents() {
            const toggleCb = this.element.querySelector('.credstick-toggle-checkbox');
            if (toggleCb) {
                toggleCb.addEventListener('change', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await CredstickService.updateCredstickConfig(this.item, { credstick: toggleCb.checked });
                    this.render(false);
                });
            }

            const typeSelect = this.element.querySelector('.credstick-type-select');
            if (typeSelect) {
                typeSelect.addEventListener('change', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await CredstickService.updateCredstickConfig(this.item, { credstickType: typeSelect.value });
                    this.render(false);
                });
            }

            const balanceInput = this.element.querySelector('.credstick-balance-input');
            if (balanceInput) {
                balanceInput.addEventListener('change', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const val = Number(balanceInput.value) || 0;
                    await CredstickService.updateCredstickConfig(this.item, { currentValue: val });
                });
            }
        }
    };

    return cachedMarketplaceEquipmentSheetClass;
}
