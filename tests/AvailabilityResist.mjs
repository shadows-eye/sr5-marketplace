import { parseAvailability } from "../scripts/lib/availabilityParser.mjs";

/**
 * Represents the opposed part of an Availability Test.
 * Its dice pool is simply the numeric rating of the item's availability.
 */
export class AvailabilityResist extends game.shadowrun5e.tests.OpposedTest {

    static get name() {
        return "AvailabilityResist";
    }

    /** @override */
    get type() {
        return "AvailabilityResist";
    }

    constructor(data, documents, options) {
        super(data, documents, options);
    }

    /** @override */
    _prepareData(data, options) {
        data = super._prepareData(data, options);

        // Ensure category and action categories are set correctly
        data.action = data.action || {};
        data.action.categories = ["social"];
        data.action.modifiers = data.action.modifiers || [];

        // The original AvailabilityTest's data is in `againstData` or `data.against`.
        const againstData = data.against || options?.against || {};
        const availabilityStr = againstData.availabilityStr || options?.availability || "";
        const parsed = parseAvailability(availabilityStr);

        // This is the threshold for our resist roll.
        const threshold = againstData.values?.netHits?.value ?? 0;

        // This is the dice pool for our resist roll.
        const pool = Math.max(parsed.rating || 0, 1);

        data.against = againstData;
        data.pool = game.shadowrun5e.data.createData('value_field', { base: pool });
        data.limit = game.shadowrun5e.data.createData('value_field', { base: 0 });
        data.threshold = game.shadowrun5e.data.createData('value_field', { base: threshold });

        data.title = `${game.i18n.localize("SR5.Labels.Availability")} ${game.i18n.localize("SR5.Resist")}`;

        return data;
    }

    /** @override */
    prepareBaseValues() {
        super.prepareBaseValues();

        const againstData = this.data.against || {};
        const availabilityStr = againstData.availabilityStr || "";
        const parsed = parseAvailability(availabilityStr);
        const pool = Math.max(parsed.rating || 0, 1);
        const threshold = againstData.values?.netHits?.value ?? 0;

        this.data.pool = this.data.pool || {};
        this.data.pool.base = pool;
        this.data.pool.changes = [];
        this.data.pool.mod = [
            { name: game.i18n.localize("SR5.Labels.Availability"), value: pool }
        ];

        const modifiers = this.data.action?.modifiers || [];
        const parseModifierValue = (val) => {
            if (typeof val === "number") return val;
            if (typeof val === "string") {
                const clean = val.replace(/[()]/g, "").trim();
                const match = clean.match(/^([+-]?\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            }
            return 0;
        };
        const parsedModifiers = modifiers.map(mod => {
            const labelLocKey = `SR5Marketplace.Marketplace.Modifiers.Labels.${mod.label}`;
            const displayLabel = game.i18n.has(labelLocKey) ? game.i18n.localize(labelLocKey) : (mod.label || "Modifier");
            return {
                label: displayLabel,
                value: parseModifierValue(mod.value)
            };
        });
        parsedModifiers.forEach(mod => {
            this.data.pool.mod.push({ name: mod.label, value: mod.value });
        });

        this.data.pool.value = this.data.pool.mod.reduce((sum, m) => sum + (m.value || 0), 0);

        this.data.threshold = this.data.threshold || {};
        this.data.threshold.base = threshold;
        this.data.threshold.value = threshold;

        this.data.limit = this.data.limit || {};
        this.data.limit.base = 0;
        this.data.limit.value = 0;
    }

    get pool() {
        return this.data.pool;
    }

    /** @override */
    get code() {
        if (!this.data?.pool || !Array.isArray(this.data.pool.mod) || this.data.pool.mod.length === 0) {
            return "";
        }
        const parts = this.data.pool.mod.map(m => `${m.name} ${m.value}`);
        return `(${parts.join(" + ")} = ${this.data.pool.value})`;
    }

    /**
     * Set a custom title for this test.
     */
    get title() {
        return `${game.i18n.localize("SR5.Labels.Availability")} ${game.i18n.localize("SR5.Resist")}`;
    }

    get _dialogTemplate() {
        return "modules/sr5-marketplace/templates/documents/tests/availabilityResist-test-dialog.html";
    }

    _testDialogListeners() {
        return [
            {
                query: '.add-modifier-row-btn',
                on: 'click',
                callback: function(event, dialog) {
                    event.preventDefault();
                    dialog.applyFormData();
                    const mods = this.data.action.modifiers || [];
                    mods.push({ label: "", value: "" });
                    this.data.action.modifiers = mods;
                    this.prepareBaseValues();
                    this.calculateBaseValues();
                    dialog.render();
                }
            },
            {
                query: '.remove-modifier-row-btn',
                on: 'click',
                callback: function(event, dialog) {
                    event.preventDefault();
                    dialog.applyFormData();
                    const index = parseInt(event.currentTarget.dataset.index, 10);
                    const mods = this.data.action.modifiers || [];
                    if (!isNaN(index) && index >= 0 && index < mods.length) {
                        mods.splice(index, 1);
                    }
                    this.data.action.modifiers = mods;
                    this.prepareBaseValues();
                    this.calculateBaseValues();
                    dialog.render();
                }
            }
        ];
    }

    static get label() {
        return "SR5.Marketplace.Tests.AvailabilityTest";
    }
}

Object.defineProperty(AvailabilityResist, 'name', { value: 'AvailabilityResist' });