export declare type StyleSpec = {
    [propOrSelector: string]: string | number | StyleSpec | null;
};
export declare class StyleModule {
    rules: any;
    constructor(spec: {
        [selector: string]: StyleSpec;
    }, options?: {
        finish?(sel: string): string;
    });
    getRules(): string;
    static mount(root: any, modules: StyleModule | ReadonlyArray<StyleModule>): void;
    static newName(): string;
}
