/**
 * Handle registration of custom tests with the Shadowrun5e system.
 * All test implemenations need to be imported here, and not within main.mjs, to ensure
 * load order between system and module as tests and this code relies on the system having
 * been loaded first and having setup system globals and test registry.
 */
import { AvailabilityTest } from "../tests/AvailabilityTest.mjs";
import { AvailabilityResist } from "../tests/AvailabilityResist.mjs";


export class TestRegistrationError extends Error {}

/**
 * Register the given test implementation into the system test registry.
 * --- FIX: Added 'testName' parameter to prevent minification bugs ---
 */
export function registerTest(testClass, testName, types = ["activeTests"]) {
    console.debug(`SR5 Marketplace | Registering test: ${testName}`);

    if (game.shadowrun5e.tests[testName])
        throw new TestRegistrationError(`Test ${testName} already exists`);

    game.shadowrun5e.tests[testName] = testClass;

    for (const testType of types) {
        if (game.shadowrun5e[testType][testName])
            throw new TestRegistrationError(`Test ${testName} already exists as ${testType}`);

        game.shadowrun5e[testType][testName] = testClass;
    }
}

/**
 * Registers all custom test classes with the Shadowrun 5e system.
 */
export function registerTests() {
    console.debug("SR5 Marketplace | Registering tests");

    try {
        // --- FIX: Pass the exact string names so Vite can't break them ---
        registerTest(AvailabilityTest, "AvailabilityTest");
        registerTest(AvailabilityResist, "AvailabilityResist"); 
        
    } catch (error) {
        ui.notifications.error(
            "SR5 Marketplace | Module failed to register test implementation with Shadowrun5e system."
        );
        console.error(
            "SR5 Marketplace | Module failed to register test implementation with Shadowrun5e system.",
            error
        );
    }
}
