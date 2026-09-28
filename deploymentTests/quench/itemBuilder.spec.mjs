/**
 * @fileoverview Quench unit tests for game.sr5marketplace.api.itemBuilder
 */

export function registerItemBuilderBatch(quench) {
    quench.registerBatch(
        "sr5marketplace.api.itemBuilder",
        function (context) {
            const { describe, it, assert, expect, before, after, beforeEach, afterEach } = context;

            describe("ItemBuilder API Container", () => {
                it("is accessible via game.sr5marketplace.api.itemBuilder", () => {
                    assert.isOk(game.sr5marketplace, "game.sr5marketplace should exist");
                    assert.isOk(game.sr5marketplace.api, "game.sr5marketplace.api should exist");
                    assert.isOk(game.sr5marketplace.api.itemBuilder, "game.sr5marketplace.api.itemBuilder should exist");
                });

                it("exposes expected ItemBuilder methods", () => {
                    const api = game.sr5marketplace.api.itemBuilder;
                    const expectedMethods = [
                        "setBaseItem",
                        "getBaseItem",
                        "open",
                        "clear",
                        "close"
                    ];

                    for (const method of expectedMethods) {
                        assert.isFunction(api[method], `Method ${method} should be a function`);
                    }
                });
            });

            describe("ItemBuilder State and Clearing", () => {
                it("clears builder state and retrieves null base item when empty", async () => {
                    const api = game.sr5marketplace.api.itemBuilder;
                    await api.clear();
                    const baseItem = await api.getBaseItem();
                    assert.isNull(baseItem, "Base item should be null after clearing state");
                });

                it("handles invalid setBaseItem parameters gracefully", async () => {
                    const api = game.sr5marketplace.api.itemBuilder;
                    assert.doesNotThrow(async () => {
                        await api.setBaseItem(null);
                    }, "Calling setBaseItem(null) should handle empty input safely");
                });
            });
        },
        { displayName: "SR5 Marketplace: Item Builder API" }
    );
}
