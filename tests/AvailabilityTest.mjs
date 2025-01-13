/**
 * Extend the default test implementation for a custom test that
 * - alters the default dialog
 * - extends test behavior
 */
export class AvailabilityTest extends game.shadowrun5e.tests.SuccessTest {
    constructor(actor, options) {
        super(actor, options);
    }

    /**
     * Allow other implementations to override what TestDialog template to use.
     */
    get _dialogTemplate() {
        return "modules/sr5-marketplace/templates/tests/availability-test-dialog.html";
    }

    /**
     * Provide custom label
     */
    static get label() {
        return "SR5.Marketplace.Tests.AvailabilityTest";
    }
}
