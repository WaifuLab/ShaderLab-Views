/**
 * Utility function for combining behaviors to fill in a config object from an array of
 * provided configs. `defaults` should hold default values for all optional fields in `Config`.
 *
 * The function will, by default, error when a field gets two values that aren't `===`-equal,
 * but you can provide combine functions per field to do something else.
 */
export declare function combineConfig<Config extends object>(configs: readonly Partial<Config>[], defaults: Partial<Config>, // Should hold only the optional properties of Config, but I haven't managed to express that
combine?: {
    [P in keyof Config]?: (first: Config[P], second: Config[P]) => Config[P];
}): Config;
