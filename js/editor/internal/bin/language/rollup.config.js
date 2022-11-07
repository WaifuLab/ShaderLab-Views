import packageDescriptor from "./package.json" assert { type: "json" };
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { resolve, relative } from "node:path";
import { cwd } from "node:process";

const root = resolve(cwd(), "../.."), dependencies = {};

for (const [module, path] of Object.entries(packageDescriptor.dependencies)) {
    const relativePath = `./${relative(root, resolve(cwd(), path.replace("file:", '')))}/index.js`.replaceAll("\\", "/");
    dependencies[module] = {
        path: relativePath,
        length: relativePath.length - module.length
    };
}

console.log(dependencies);

export default commandLineArgs => {
    const { input } = commandLineArgs;

    delete commandLineArgs.input;

    return {
        input: `${input}/index.ts`,
        output: {
            file: `../../${input}.js`,
            format: "es"
        },
        external: Object.keys(dependencies),
        plugins: [
            nodeResolve(),
            typescript(),
            {
                name: "rename file",
                renderChunk(code) {
                    const regexpNames = /(?:export|import)(?:\s)*?(?:\{)??.*?(?:\})??(?:\s)*?from(?:\s)*?'(.+?)'/gm;

                    let cache = code, match = cache.matchAll(regexpNames), count = 0;

                    for (let item of match) {
                        if (!dependencies[item[1]]) continue;
                        const { path, length } = dependencies[item[1]];
                        let temp = item[0], allocator = item.index + count;
                        let suffixed = temp.replace(item[1], path);
                        let previous = cache.slice(0, allocator);
                        let after = cache.slice(allocator + temp.length, cache.length);
                        cache = `${previous}${suffixed}${after}`;
                        count = count + length;
                    }

                    return cache;
                }
            }
        ]
    }
}
