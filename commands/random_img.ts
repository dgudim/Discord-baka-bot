import { ICommand } from "wokcommands";
import fs from "fs";
import { config } from "../index"
import { changeSavedDirectory } from "../utils";
import sharp from "sharp";

let indexUpToDate = false;
let index: Array<string> = [];

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
            if (file.endsWith(".jpg")
                || file.endsWith(".jpeg")
                || file.endsWith(".png")
                || file.endsWith(".webp")) {
                results.push(file);
            }
        }
    });
    return results;
}

export default {
    category: 'Administration',
    description: 'Get random image from the directory',

    slash: 'both',
    testOnly: true,
    ownerOnly: false,
    hidden: false,

    expectedArgs: '<directory path>',
    expectedArgsTypes: ['STRING'],
    minArgs: 0,
    maxArgs: 1,

    callback: ({ interaction, message, args }) => {

        const channel = interaction ? interaction.channel : message.channel;

        if (changeSavedDirectory(channel, 'image', args[0], 'img_dir')) {
            indexUpToDate = false;
        }

        try {
            if (!indexUpToDate) {
                index = walk(config.get('img_dir'));
                channel?.send({
                    content: `constructing image database index, loaded ${index.length} images`
                });
                indexUpToDate = true;
            }

            let file = index[Math.floor(Math.random() * index.length)];

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
                                        name: file.substring(file.lastIndexOf('/') + 1)
                                    }]
                                });
                            }
                        }
                    });
            } else {
                channel?.send({
                    files: [{
                        attachment: file,
                        name: file.substring(file.lastIndexOf('/') + 1)
                    }]
                });
            }
            return "Here is your image"
        } catch (err) {
            return "Unknown error: " + err;
        }

    }
} as ICommand