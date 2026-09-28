/**
 * @fileoverview Quench unit tests for game.sr5marketplace.api.factory
 */

export function registerFactoryBatch(quench) {
    quench.registerBatch(
        "sr5marketplace.api.factory",
        function (context) {
            const { describe, it, assert, expect, before, after, beforeEach, afterEach } = context;

            describe("Factory API Container", () => {
                it("is accessible via game.sr5marketplace.api.factory", () => {
                    assert.isOk(game.sr5marketplace, "game.sr5marketplace should exist");
                    assert.isOk(game.sr5marketplace.api, "game.sr5marketplace.api should exist");
                    assert.isOk(game.sr5marketplace.api.factory, "game.sr5marketplace.api.factory should exist");
                });

                it("exposes expected factory methods", () => {
                    const api = game.sr5marketplace.api.factory;
                    const expectedMethods = [
                        "getVirtualModifications",
                        "saveVirtualModifications",
                        "addVirtualModification",
                        "updateVirtualModification",
                        "removeVirtualModification",
                        "checkInventoryStock",
                        "getEligiblePurchasers",
                        "getBuilderState",
                        "updateBuilderState",
                        "setBuilderBaseItem",
                        "addBuilderModification",
                        "addBuilderChange",
                        "removeBuilderChange",
                        "startBuilderEffectCreation",
                        "updateBuilderDraftEffect",
                        "saveBuilderDraftEffect",
                        "cancelBuilderEffectCreation",
                        "deleteBuilderEffect"
                    ];

                    for (const method of expectedMethods) {
                        assert.isFunction(api[method], `Method ${method} should be a function`);
                    }
                });
            });

            describe("Builder State Lifecycle", () => {
                let originalState;

                before(async () => {
                    originalState = await game.sr5marketplace.api.factory.getBuilderState();
                });

                after(async () => {
                    // Restore original state
                    if (originalState) {
                        await game.sr5marketplace.api.factory.updateBuilderState(originalState);
                    }
                });

                it("retrieves the current builder state object", async () => {
                    const api = game.sr5marketplace.api.factory;
                    const state = await api.getBuilderState();
                    assert.isObject(state, "Builder state should be an object");
                });

                it("updates and retrieves modified builder state properties", async () => {
                    const api = game.sr5marketplace.api.factory;
                    const testKey = `test_prop_${Date.now()}`;
                    await api.updateBuilderState({ [testKey]: 42 });

                    const updatedState = await api.getBuilderState();
                    assert.strictEqual(updatedState[testKey], 42, "Updated property should be persisted in builder state");
                });
            });

            describe("Virtual Modification Calculations on Vehicles", () => {
                let testVehicle;

                before(async () => {
                    // Create an in-memory vehicle actor for non-destructive testing
                    testVehicle = await Actor.implementation.create({
                        name: "Quench Test Vehicle",
                        type: "vehicle",
                        system: {
                            vehicleType: "ground",
                            handling: 3,
                            speed: 4,
                            acceleration: 2
                        }
                    }, { temporary: true });
                });

                it("returns an array of virtual modifications from a vehicle document", () => {
                    const api = game.sr5marketplace.api.factory;
                    const mods = api.getVirtualModifications(testVehicle);
                    assert.isArray(mods, "Virtual modifications should return an array");
                });

                it("checks inventory stock status safely", () => {
                    const api = game.sr5marketplace.api.factory;
                    assert.doesNotThrow(() => {
                        const stock = api.checkInventoryStock(testVehicle, null, null);
                        assert.isOk(stock, "Stock calculation should return a result object");
                    });
                });
            });
        },
        { displayName: "SR5 Marketplace: Factory API" }
    );
}
