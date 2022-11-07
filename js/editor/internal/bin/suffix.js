#!/usr/bin/env node
import { readdir, stat, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { cwd, env } from "node:process";

const regexpNames = /(?:export|import)(?:\s)*?(?:\{)??.*?(?:\})??(?:\s)*?from(?:\s)*?"(.+?)"/gm;

void async function () {
    try {
        let base = resolve(cwd(), env["FILTER_PATH"].trim()), paths = await readdir(base);
        let stack = [... paths];

        console.log(`Base Path: ${base} \n`);

        while (stack.length) {
            let top = stack.pop();
            let path = resolve(base, top);
            if ((await stat(path)).isDirectory()) {
                let temp = await readdir(path);
                if (temp) {
                    for (let i of temp) {
                        stack.push(join(top, i));
                    }
                }
            } else {
                console.log(`> Resolve ${path}`);

                let codeData = await readFile(path, { encoding: "utf8" });
                let match = codeData.matchAll(regexpNames), count = 0;

                for (let item of match) {
                    if (/.js$/.test(item[1])) continue;
                    let temp = item[0], allocator = item.index + count;
                    let suffixed = temp.replace(item[1], `${item[1]}.js`);
                    let previous = codeData.slice(0, allocator);
                    let after = codeData.slice(allocator + temp.length, codeData.length);
                    codeData = `${previous}${suffixed}${after}`;
                    count = count + 3;
                }

                await writeFile(path, codeData, { encoding: "utf8" });
            }
        }
    } catch (error) { console.error(error); }
}();
