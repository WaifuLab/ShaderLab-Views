#!/usr/bin/env node
const { stdout } = require("node:process");
const { join, resolve, extname, basename } = require("node:path");
const { existsSync, mkdirSync, createReadStream, createWriteStream, stat, readdir, unlink } = require("node:fs");

const param = {
    src: join(__dirname, "../dist/static"),
    dst: join(__dirname, "../dist/views"),
    ext: "html"
}

/**
 * Check directory exist
 * @param {string} dir
 */
const checkDst = dir => {
    if (!existsSync(resolve(dir)))
        mkdirSync(resolve(dir));
}

/**
 * Check file extension
 * @param {string} src
 * @param {string} ext
 * @return {boolean}
 */
const checkExt = (src, ext) => {
    return ext.includes(extname(resolve(src)).slice(1));
}

/**
 * Cut file
 * @param {string} filePath
 */
const cut = filePath => {
    copy(filePath, () => {
        remove(filePath);
    });
};

/**
 * Copy file
 * @param {string} filePath
 * @param {function} callback
 */
const copy = (filePath, callback = () => {}) => {
    if (checkExt(filePath, param.ext)) {
        const file = join(param.dst, basename(filePath));
        const readStream = createReadStream(resolve(filePath));
        const writeStream = createWriteStream(resolve(file));
        readStream.pipe(writeStream);
        writeStream.on("close", callback);
        stdout.write(`> Copy: ${filePath} -> ${file}\n`);
    }
}

/**
 * Remove file
 * @param {string} filePath
 */
const remove = filePath => {
    unlink(filePath, err => {
        if (err) throw err;
        else stdout.write(`> Delete: ${filePath}\n`);
    })
}

/**
 * Collect files
 * @param {string} root
 * @param {function|cut|copy} callback
 */
const collect = (root, callback = cut) => {
    root = resolve(root);
    stat(root, (err, stats) => {
        if (err) throw err;
        if (!stats.isDirectory()) {
            callback(root);
            return;
        }
        readdir(root, (err, files) => {
            if (err) throw err;
            files.forEach((file) => {
                collect(join(root, file), callback);
            });
        });
    });
};

checkDst(param.dst);

collect(param.src);
