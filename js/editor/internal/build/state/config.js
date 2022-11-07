/**
 * Utility function for combining behaviors to fill in a config object from an array of
 * provided configs. `defaults` should hold default values for all optional fields in `Config`.
 *
 * The function will, by default, error when a field gets two values that aren't `===`-equal,
 * but you can provide combine functions per field to do something else.
 */
export function combineConfig(configs, defaults, // Should hold only the optional properties of Config, but I haven't managed to express that
combine = {}) {
    let result = {};
    for (let config of configs)
        for (let key of Object.keys(config)) {
            let value = config[key], current = result[key];
            if (current === undefined)
                result[key] = value;
            else if (current === value || value === undefined) { } // No conflict
            else if (Object.hasOwnProperty.call(combine, key))
                result[key] = combine[key](current, value);
            else
                throw new Error("Config merge conflict for field " + key);
        }
    for (let key in defaults)
        if (result[key] === undefined)
            result[key] = defaults[key];
    return result;
}
