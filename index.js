const rimraf = require("rimraf");
const imagemin = require("imagemin");
const jpg = require("imagemin-mozjpeg");
const png = require("imagemin-pngquant");
const dw = require("digital-watermarking");
const { spawnSync } = require("child_process");
const { renameSync } = require("fs");
const { opendir, rename, unlink } = require("fs/promises");
const { join, extname, resolve } = require("path");

let watermarkText = "Hello, world!";
let fontSize = 1;

function system(cmd, stdio = "pipe") {
    return spawnSync(cmd, { stdio, shell: true }).stdout?.toString();
}

try {
    system("zip");
    system("unzip");
} catch {
    console.error("need `zip` and `unzip` to run this script");
    if (process.platform === "darwin") {
        console.info("try: brew install zip unzip");
        console.info("you can find brew here: https://brew.sh");
    }
    if (process.platform === "win32") {
        console.info("try: scoop install zip unzip");
        console.info("you can find scoop here: https://scoop.sh");
    }
}

function isSupported(filename) {
    return "pptx ppt".split(" ").some((ext) => filename.endsWith("." + ext));
}

const args = process.argv.slice(2);
const files = args.filter(isSupported);

if (!files.length) {
    console.info(
        `usage: node ${process.argv[1]} file1.pptx --text="Hello, world!" --size=1.1`
    );
    process.exit();
}

for (const arg of args) {
    if (arg.startsWith("--text=")) {
        watermarkText = arg.substring("--text=".length);
    }
    if (arg.startsWith("--size=")) {
        fontSize = Number(arg.substring("--size=".length)) || 1;
    }
}

console.log("info:");
console.log("watermarkText =", watermarkText);
console.log("fontSize =", fontSize);
console.log();

function inspect(str) {
    return JSON.stringify(str);
}

function unzip(filename, dir) {
    return system(`unzip ${filename} -d ${dir}`);
}

function zip(dir, filename) {
    const cwd = process.cwd();
    process.chdir(resolve(dir));
    const stdout = system(`zip -r ${inspect(filename)} *`);
    renameSync(filename, join(cwd, filename));
    process.chdir(cwd);
    return stdout;
}

async function* walk(dir) {
    for await (const d of await opendir(dir)) {
        const entry = join(dir, d.name);
        if (d.isDirectory()) yield* walk(entry);
        else if (d.isFile()) yield entry;
    }
}

const delay = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    await delay(800);
    const tempfilename = "_t3mPfiLe";
    const supportedExts = "jpg jpeg png bmp tiff".split(" ");
    for (const file of files) {
        console.log("working on", file);
        unzip(file, "temp");
        console.log("adding watermark...");
        const tasks = [];
        for await (const p of walk("temp")) {
            if (supportedExts.some((e) => p.endsWith("." + e))) {
                tasks.push(p);
            }
        }
        let index = 0;
        for (const p of tasks) {
            const ext = extname(p);
            const tempfile = tempfilename + ext;
            await dw.transformImageWithText(
                p,
                watermarkText,
                fontSize,
                tempfile
            );
            const [{ destinationPath }] = await imagemin([tempfile], {
                destination: 'imagemin',
                plugins: [
                    jpg({ quality: 70 }),
                    png({ quality: [0.5, 0.8] }),
                ]
            });
            await unlink(tempfile);
            await rename(destinationPath, p);
            console.log("marked", p, `(${(index += 1)}/${tasks.length})`);
        }
        const ext = extname(file);
        const before = file.substring(0, file.length - ext.length);
        console.log("zipping", before + ".modified" + ext);
        zip("temp", before + ".modified" + ext);
        rimraf.sync("temp");
    }
}

main().catch(console.error.bind(console));
