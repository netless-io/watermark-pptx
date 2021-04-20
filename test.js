// usage: node test.js a.pptx

const rimraf = require("rimraf");
const dw = require("digital-watermarking");
const { opendir } = require("fs/promises");
const { spawnSync } = require("child_process");
const { join } = require("path");

function system(cmd, stdio = "pipe") {
    return spawnSync(cmd, { stdio, shell: true }).stdout?.toString();
}

const file = process.argv[2];
if (!file || !file.endsWith(".pptx")) {
    console.log("expect a.modified.pptx");
    process.exit();
}

function unzip(filename, dir) {
    return system(`unzip ${filename} -d ${dir}`);
}

async function* walk(dir) {
    for await (const d of await opendir(dir)) {
        const entry = join(dir, d.name);
        if (d.isDirectory()) yield* walk(entry);
        else if (d.isFile()) yield entry;
    }
}

async function main() {
    unzip(file, "temp");
    const images = [];
    const supportedExts = "jpg jpeg png bmp tiff".split(" ");
    for await (const p of walk("temp")) {
        if (supportedExts.some((e) => p.endsWith("." + e))) {
            images.push(p);
        }
    }
    const p = images[(Math.random() * images.length) | 0];
    console.log("test", p);
    await dw.getTextFormImage(p, "test.png");
    rimraf.sync("temp");
}

main().catch(console.error.bind(console));
