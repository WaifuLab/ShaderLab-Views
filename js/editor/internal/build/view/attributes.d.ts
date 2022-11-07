export declare type Attrs = {
    [name: string]: string;
};
export declare function combineAttrs(source: Attrs, target: Attrs): Attrs;
export declare function attrsEq(a: Attrs | null, b: Attrs | null): boolean;
export declare function updateAttrs(dom: HTMLElement, prev: Attrs | null, attrs: Attrs | null): boolean;