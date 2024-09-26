/**
 * Handle registration of custom tests with the Shadowrun5e system.
 * All test implemenations need to be imported here, and not within main.mjs, to ensure
 * load order between system and module as tests and this code relies on the system having
 * been loaded first and having setup system globals and test registry.
 */
import { AvailabilityTest } from "../tests/AvailabilityTest.mjs";

export class TestRegistrationError extends Error {}

/**
 * Register the given test implementation into the system test registry.
 *
 * Should a test implementation with this name already exist, fail with an exception.
 * @param {*} testClass
 * @param {string[]} types What type of test is registered? Active? Opposed? Resist? Followup?
 * @throws {TestRegistrationError} if a test implementation with the same name already exists
 */
export function registerTest(testClass, types = ["activeTests"]) {
    console.debug("SR5 Marketplace | Registering test", testClass);

    // Register test in general registry so it can be called when executing the action.
    if (game.shadowrun5e.tests[testClass.name])
        throw new TestRegistrationError(
            `Test ${testClass.name} already exists`
        );

    game.shadowrun5e.tests[testClass.name] = testClass;

    // Register test in specific test type registry so it can be shown in the action item sheet selection.
    for (const testType of types) {
        if (game.shadowrun5e[testType][testClass.name])
            throw new TestRegistrationError(
                `Test ${testClass.name} already exists as ${testType}`
            );

        game.shadowrun5e[testType][testClass.name] = testClass;
    }
}

export function registerTests() {
    console.debug("SR5 Marketplace | Registering tests");

    // Register module test into system test registry
    try {
        registerTest(AvailabilityTest);
    } catch (error) {
        ui.notifications.error(
            "SR5 Marketplace | Module failed to register test implementation with Shadowrun5e system. This makes the module incompatible until it is updated."
        );
        console.error(
            "SR5 Marketplace | Module failed to register test implementation with Shadowrun5e system.",
            error
        );
    }
}
