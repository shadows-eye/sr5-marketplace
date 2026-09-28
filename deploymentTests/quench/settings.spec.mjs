/**
 * @fileoverview Quench unit tests for game.sr5marketplace.api.settings
 */

export function registerSettingsBatch(quench) {
    quench.registerBatch(
        "sr5marketplace.api.settings",
        function (context) {
            const { describe, it, assert, expect, before, after, beforeEach, afterEach } = context;

            describe("Settings Service API Container", () => {
                it("is accessible via game.sr5marketplace.api.settings", () => {
                    assert.isOk(game.sr5marketplace, "game.sr5marketplace should exist");
                    assert.isOk(game.sr5marketplace.api, "game.sr5marketplace.api should exist");
                    assert.isOk(game.sr5marketplace.api.settings, "game.sr5marketplace.api.settings should exist");
                });

                it("exposes expected settings management methods", () => {
                    const api = game.sr5marketplace.api.settings;
                    assert.isFunction(api.getCustomItemCompendium, "getCustomItemCompendium should be a function");
                    assert.isFunction(api.getCustomVehicleCompendium, "getCustomVehicleCompendium should be a function");
                    assert.isFunction(api.getAllowedCompendiums, "getAllowedCompendiums should be a function");
                    assert.isFunction(api.isWorldItemsAllowed, "isWorldItemsAllowed should be a function");
                    assert.isFunction(api.getGlobalDefaultFilterTags, "getGlobalDefaultFilterTags should be a function");
                });
            });

            describe("Settings Read Operations", () => {
                it("reads registered marketplace settings safely", () => {
                    const api = game.sr5marketplace.api.settings;

                    const itemCompendium = api.getCustomItemCompendium();
                    assert.isString(itemCompendium);

                    const vehicleCompendium = api.getCustomVehicleCompendium();
                    assert.isString(vehicleCompendium);

                    const allowedCompendiums = api.getAllowedCompendiums();
                    assert.isOk(allowedCompendiums);

                    const allowWorldItems = api.isWorldItemsAllowed();
                    assert.isBoolean(allowWorldItems);

                    const filterTags = api.getGlobalDefaultFilterTags();
                    assert.isOk(filterTags);
                });
            });
        },
        { displayName: "SR5 Marketplace: Settings API" }
    );
}
