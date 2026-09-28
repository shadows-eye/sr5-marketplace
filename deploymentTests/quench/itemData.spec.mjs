/**
 * @fileoverview Quench unit tests for game.sr5marketplace.api.itemData
 */

export function registerItemDataBatch(quench) {
    quench.registerBatch(
        "sr5marketplace.api.itemData",
        function (context) {
            const { describe, it, assert, expect, before, after, beforeEach, afterEach } = context;

            describe("ItemData Service API Container", () => {
                it("is accessible via game.sr5marketplace.api.itemData", () => {
                    assert.isOk(game.sr5marketplace, "game.sr5marketplace should exist");
                    assert.isOk(game.sr5marketplace.api, "game.sr5marketplace.api should exist");
                    assert.isOk(game.sr5marketplace.api.itemData, "game.sr5marketplace.api.itemData should exist");
                });

                it("exposes expected item data query methods", () => {
                    const api = game.sr5marketplace.api.itemData;
                    assert.isFunction(api.getItems, "getItems should be a function");
                    assert.isFunction(api.invalidateCache, "invalidateCache should be a function");
                    assert.isFunction(api.buildIndex, "buildIndex should be a function");
                });
            });

            describe("Item Cache and Queries", () => {
                it("returns an array from getItems()", () => {
                    const api = game.sr5marketplace.api.itemData;
                    const items = api.getItems();
                    assert.isArray(items, "getItems should return an array of cached items");
                });

                it("handles invalidating cache safely", () => {
                    const api = game.sr5marketplace.api.itemData;
                    assert.doesNotThrow(() => {
                        api.invalidateCache();
                    }, "Invalidating cache should execute cleanly");
                });
            });
        },
        { displayName: "SR5 Marketplace: ItemData Service API" }
    );
}
