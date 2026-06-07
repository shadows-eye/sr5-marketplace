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
        this.data.pool.value = pool;
        this.data.pool.changes = [];
        this.data.pool.mod = [
            { name: game.i18n.localize("SR5.Labels.Availability"), value: pool }
        ];

        this.data.threshold = this.data.threshold || {};
        this.data.threshold.base = threshold;
        this.data.threshold.value = threshold;

        this.data.limit = this.data.limit || {};
        this.data.limit.base = 0;
        this.data.limit.value = 0;
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

    static get label() {
        return "SR5.Marketplace.Tests.AvailabilityTest";
    }
}

Object.defineProperty(AvailabilityResist, 'name', { value: 'AvailabilityResist' });