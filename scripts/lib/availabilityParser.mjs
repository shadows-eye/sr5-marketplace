/**
 * @summary Parses a Shadowrun 5e availability string.
 * @description Takes a string like "12R" and separates it into its numeric
 * rating and alphabetic tag.
 * @param {string} str - The availability string to parse.
 * @returns {{rating: number, tag: string}} An object with the numeric rating and the tag.
 */
export default function parseAvailability(str) {
    const m = String(str ?? "").trim().match(/^(\d+)\s*([A-Za-z]*)$/);
    return {
        rating: m ? Number(m[1]) : 0,
        tag: m && m[2] ? m[2].toUpperCase() : ""
    };
}