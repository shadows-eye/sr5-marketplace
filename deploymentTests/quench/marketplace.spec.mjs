/**
 * @fileoverview Quench unit tests for game.sr5marketplace.api.marketplace
 */

export function registerMarketplaceBatch(quench) {
    quench.registerBatch(
        "sr5marketplace.api.marketplace",
        function (context) {
            const { describe, it, assert, expect, before, after, beforeEach, afterEach } = context;

            describe("Marketplace API Container", () => {
                it("is accessible via game.sr5marketplace.api.marketplace", () => {
                    assert.isOk(game.sr5marketplace, "game.sr5marketplace should exist");
                    assert.isOk(game.sr5marketplace.api, "game.sr5marketplace.api should exist");
                    assert.isOk(game.sr5marketplace.api.marketplace, "game.sr5marketplace.api.marketplace should exist");
                });

                it("exposes expected API methods", () => {
                    const api = game.sr5marketplace.api.marketplace;
                    const expectedMethods = [
                        "addItem",
                        "addCustom",
                        "combineAvailabilities",
                        "open",
                        "close",
                        "setActor",
                        "clearActor",
                        "getBasket",
                        "remove",
                        "submitForReview",
                        "rejectItemFromRequest",
                        "rejectBasket",
                        "directPurchase",
                        "getPendingRequestCount",
                        "getAllPendingRequests",
                        "approveBasket",
                        "updatePendingItem",
                        "filterItems"
                    ];

                    for (const method of expectedMethods) {
                        assert.isFunction(api[method], `Method ${method} should be a function`);
                    }
                });
            });

            describe("Availability and Filter Calculations", () => {
                it("combines availability ratings correctly", () => {
                    const api = game.sr5marketplace.api.marketplace;

                    const combinedRF = api.combineAvailabilities(["4R", "2F"]);
                    assert.isString(combinedRF);
                    assert.include(combinedRF, "F", "Forbidden (F) should take precedence over Restricted (R)");

                    const combinedStandard = api.combineAvailabilities(["4", "6"]);
                    assert.strictEqual(combinedStandard, "10", "Numerical availabilities should sum together");

                    const combinedR = api.combineAvailabilities(["3", "5R"]);
                    assert.strictEqual(combinedR, "8R", "Restricted flag should be preserved");
                });

                it("filters items by search term and tags", () => {
                    const api = game.sr5marketplace.api.marketplace;
                    const items = [
                        { name: "Ares Predator V" },
                        { name: "Armored Jacket" },
                        { name: "Medkit Rating 6" }
                    ];

                    const filteredTerm = api.filterItems(items, [], "Predator");
                    assert.lengthOf(filteredTerm, 1);
                    assert.strictEqual(filteredTerm[0].name, "Ares Predator V");

                    const filteredEmpty = api.filterItems(items, [], "");
                    assert.lengthOf(filteredEmpty, 3);
                });
            });

            describe("Basket and Actor Selection Operations", () => {
                it("retrieves the active user basket as an array asynchronously", async () => {
                    const basket = await game.sr5marketplace.api.marketplace.getBasket();
                    assert.isArray(basket, "getBasket should resolve to an array");
                });

                it("handles actor selection and clearing safely", async () => {
                    const api = game.sr5marketplace.api.marketplace;
                    await api.clearActor();
                    assert.doesNotThrow(() => {
                        api.clearActor();
                    }, "Clearing actor should not throw");
                });

                it("handles invalid addItem parameters gracefully", async () => {
                    const api = game.sr5marketplace.api.marketplace;
                    const result = await api.addItem(null, null);
                    assert.isUndefined(result, "Calling addItem with nulls should return undefined safely");
                });

                it("reports pending purchase request count", () => {
                    const api = game.sr5marketplace.api.marketplace;
                    const count = api.getPendingRequestCount();
                    assert.isNumber(count, "Pending request count should be a number");
                    assert.isAtLeast(count, 0, "Pending request count should be non-negative");
                });
            });
        },
        { displayName: "SR5 Marketplace: In-Game Marketplace API" }
    );
}
