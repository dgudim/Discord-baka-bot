import { ICommand } from "wokcommands";
import fs from "fs";
import { config } from "../index"
import { changeSavedDirectory } from "../utils";

let indexUpToDate = false;
let index: Array<string> = [];

let walk = function (dir: string) {
    let results: Array<string> = [];
    var list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = dir + '/' + file;
        var stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if ((file.endsWith(".jpg") || file.endsWith(".png"))) {
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
    ownerOnly: true,
    hidden: true,

    expectedArgs: '<directory path>',
    expectedArgsTypes: ['STRING'],
    minArgs: 0,
    maxArgs: 1,

    callback: ({ interaction, message, args }) => {

        const channel = interaction ? interaction.channel : message.channel;

        if(changeSavedDirectory(channel, 'image', args[0], 'img_dir')){
            indexUpToDate = false;
        }

        try {
            if(!indexUpToDate){
                index = walk(config.get('img_dir'));
                channel?.send({
                    content: `constructing image database index, loaded ${index.length} images`
                });
            }

            let file = index[Math.floor(Math.random() * index.length)];

            channel?.send({
                files: [{
                    attachment: file,
                    name: file.substring(file.lastIndexOf('/') + 1)
                }]
            });

            return "Here is your image"
        } catch (err) {
            return "Unknown error: " + err;
        }

    }
} as ICommand