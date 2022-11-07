/**
 * Encode numbers as groups of printable ascii characters
 * - 0xffff, which is often used as placeholder, is encoded as "~"
 * - The characters from " " (32) to "}" (125), excluding '"' and
 *   "\\", indicate values from 0 to 92
 * - The first bit in a 'digit' is used to indicate whether this is
 *   the end of a number.
 * - That leaves 46 other values, which are actually significant.
 * - The digits in a number are ordered from high to low significance.
 * @param {number} digit
 * @return {string}
 */
function digitToChar(digit) {
    let ch = digit + 32 /* Encode.Start */;
    if (ch >= 34 /* Encode.Gap1 */) ch++;
    if (ch >= 92 /* Encode.Gap2 */) ch++;
    return String.fromCharCode(ch);
}

export function encode(value, max = 0xffff) {
    if (value > max)
        throw new Error("Trying to encode a number that's too big: " + value);
    if (value == 65535 /* Encode.BigVal */)
        return String.fromCharCode(126 /* Encode.BigValCode */);
    let result = "";
    for (let first = 46 /* Encode.Base */;; first = 0) {
        let low = value % 46 /* Encode.Base */, rest = value - low;
        result = digitToChar(low + first) + result;
        if (rest == 0) break;
        value = rest / 46 /* Encode.Base */;
    }
    return result;
}

export function encodeArray(values, max = 0xffff) {
    let result = '"' + encode(values.length, 0xffffffff);
    for (let i = 0; i < values.length; i++)
        result += encode(values[i], max);
    result += '"';
    return result;
}
