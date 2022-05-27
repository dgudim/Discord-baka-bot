import { ICommand } from "wokcommands";
import fs from "fs";
import { config } from "../index"
import { changeSavedDirectory, getFileName, getImageMetatags, setLastFile } from "../utils";
import sharp from "sharp";

let indexUpToDate = false;
let index: Array<string> = [];
let currImg = 0;

const eight_mb = 1024 * 1024 * 8;

let walk = function (dir: string) {
    let results: Array<string> = [];
    let list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = dir + '/' + file;
        let stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.toLowerCase().endsWith(".jpg")
                || file.toLowerCase().endsWith(".jpeg")
                || file.toLowerCase().endsWith(".png")) {
                results.push(file);
            }
        }
    });
    return results;
}

export default {

    category: 'Misc',
    description: 'Get random image from the directory',

    slash: 'both',
    testOnly: true,
    ownerOnly: false,
    hidden: false,

    expectedArgs: '<directory path>',
    expectedArgsTypes: ['STRING'],
    minArgs: 0,
    maxArgs: 1,

    callback: ({ channel, args }) => {

        if (changeSavedDirectory(channel, 'image', args[0], 'img_dir')) {
            indexUpToDate = false;
        }

        try {
            currImg ++;

            if (!indexUpToDate || currImg == index.length) {
                index = walk(config.get('img_dir'));
                index = index
                    .map(value => ({ value, sort: Math.random() }))
                    .sort((a, b) => a.sort - b.sort)
                    .map(({ value }) => value);
                currImg = 0;
                channel?.send({
                    content: `getting images, loaded ${index.length} images`
                });
                indexUpToDate = true;
            }

            let file = index[currImg];
            setLastFile(file);

            if (fs.statSync(file).size > eight_mb) {
                channel?.send({
                    content: `image too large, compressing, wait...`
                });
                sharp(file)
                    .resize({ width: 1920 })
                    .webp({
                        quality: 80
                    })
                    .toBuffer((err, data, info) => {
                        if (err) {
                            channel?.send({
                                content: 'error resizing'
                            });
                        } else {
                            if (info.size > eight_mb) {
                                channel?.send({
                                    content: 'image still too large, bruh'
                                });
                            } else {
                                channel?.send({
                                    files: [{
                                        attachment: data,
                                        name: getFileName(file)
                                    }]
                                });
                            }
                        }
                    });
            } else {
                channel?.send({
                    files: [{
                        attachment: file,
                        name: getFileName(file)
                    }]
                });
            }

            getImageMetatags(file, channel);

            return "Here is your image"
        } catch (err) {
            return "Unknown error: " + err;
        }

    }
} as ICommand