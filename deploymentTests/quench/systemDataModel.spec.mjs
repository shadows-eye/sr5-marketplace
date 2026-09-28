/**
 * @fileoverview Quench unit tests for game.sr5marketplace.api.systemDataModel
 */

export function registerSystemDataModelBatch(quench) {
    quench.registerBatch(
        "sr5marketplace.api.systemDataModel",
        function (context) {
            const { describe, it, assert, expect, before, after, beforeEach, afterEach } = context;

            describe("System DataModel API Container", () => {
                it("is accessible via game.sr5marketplace.api.systemDataModel", () => {
                    assert.isOk(game.sr5marketplace, "game.sr5marketplace should exist");
                    assert.isOk(game.sr5marketplace.api, "game.sr5marketplace.api should exist");
                    assert.isOk(game.sr5marketplace.api.systemDataModel, "game.sr5marketplace.api.systemDataModel should exist");
                });

                it("exposes expected data model inspection methods", () => {
                    const api = game.sr5marketplace.api.systemDataModel;
                    assert.isFunction(api.getItemSchema, "getItemSchema should be a function");
                    assert.isFunction(api.getActorSchema, "getActorSchema should be a function");
                    assert.isFunction(api.hasTechnology, "hasTechnology should be a function");
                    assert.isFunction(api.getQuantityPath, "getQuantityPath should be a function");
                    assert.isFunction(api.getCostPath, "getCostPath should be a function");
                    assert.isFunction(api.getRatingPath, "getRatingPath should be a function");
                    assert.isFunction(api.getAvailabilityPath, "getAvailabilityPath should be a function");
                    assert.isFunction(api.getItemQuantity, "getItemQuantity should be a function");
                    assert.isFunction(api.setItemQuantity, "setItemQuantity should be a function");
                    assert.isFunction(api.getPackQuantity, "getPackQuantity should be a function");
                });
            });

            describe("Shadowrun 5e DataModel Introspection and Field Mapping", () => {
                it("resolves the item schema for valid types from CONFIG", () => {
                    const api = game.sr5marketplace.api.systemDataModel;
                    const weaponSchema = api.getItemSchema("weapon");
                    assert.isOk(weaponSchema, "Weapon schema should be resolved from CONFIG");
                });

                it("resolves the actor schema for character and vehicle from CONFIG", () => {
                    const api = game.sr5marketplace.api.systemDataModel;
                    const charSchema = api.getActorSchema("character");
                    assert.isOk(charSchema, "Character schema should be resolved from CONFIG");

                    const vehicleSchema = api.getActorSchema("vehicle");
                    assert.isOk(vehicleSchema, "Vehicle schema should be resolved from CONFIG");
                });

                it("discovers quantity, cost, and availability paths dynamically", () => {
                    const api = game.sr5marketplace.api.systemDataModel;
                    const qtyPath = api.getQuantityPath("weapon");
                    assert.isString(qtyPath);
                    assert.match(qtyPath, /^system\.(technology\.)?quantity$/);

                    const costPath = api.getCostPath("weapon");
                    assert.isString(costPath);
                    assert.match(costPath, /^system\.(technology\.)?cost$/);

                    const availPath = api.getAvailabilityPath("weapon");
                    assert.isString(availPath);
                    assert.match(availPath, /^system\.(technology\.)?availability$/);
                });

                it("gets and sets item quantities cleanly without mutation errors", () => {
                    const api = game.sr5marketplace.api.systemDataModel;
                    const testItem = {
                        type: "weapon",
                        system: {
                            technology: {
                                quantity: 5
                            }
                        }
                    };

                    assert.strictEqual(api.getItemQuantity(testItem), 5);

                    api.setItemQuantity(testItem, 12);
                    assert.strictEqual(api.getItemQuantity(testItem), 12);
                });

                it("returns pack quantity 10 for ammo by default", () => {
                    const api = game.sr5marketplace.api.systemDataModel;
                    const ammo = {
                        type: "ammo",
                        system: {
                            technology: {
                                quantity: 1
                            }
                        }
                    };
                    assert.strictEqual(api.getPackQuantity(ammo), 10);
                });
            });
        },
        { displayName: "SR5 Marketplace: System DataModel API" }
    );
}
