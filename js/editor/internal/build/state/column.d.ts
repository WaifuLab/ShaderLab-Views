/**
 * Count the column position at the given offset into the string, taking extending characters and
 * tab size into account.
 */
export declare function countColumn(string: string, tabSize: number, to?: number): number;
/**
 * Find the offset that corresponds to the given column position in a string, taking extending characters
 * and tab size into account. By default, the string length is returned when it is too short to reach the
 * column. Pass `strict` true to make it return -1 in that situation.
 */
export declare function findColumn(string: string, col: number, tabSize: number, strict?: boolean): number;
