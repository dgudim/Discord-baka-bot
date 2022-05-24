import { ICommand } from "wokcommands";
import fs from "fs";
import path from 'path';
import { config } from "../index"
import { changeSavedDirectory } from "../utils";

let walk = function (dir: string, done: Function) {
    let results: Array<string> = [];
    fs.readdir(dir, function (err, list) {
        if (err) return done(err);
        let i = 0;
        (function next() {
            let file = list[i++];
            if (!file) return done(null, results);
            file = path.resolve(dir, file);
            fs.stat(file, function (err, stat) {
                if (stat && stat.isDirectory()) {
                    walk(file, function (err: string, res: string) {
                        results = results.concat(res);
                        next();
                    });
                } else {
                    if ((file.endsWith(".jpg") || file.endsWith(".png"))){
                        results.push(file);
                    }
                    next();
                }
            });
        })();
    });
};

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

        changeSavedDirectory(channel, 'image', args[0], 'img_dir');

        try {
            walk(config.get('img_dir'), function (err: string, results: Array<string>) {
                if(err) throw err;
                let file = results[Math.floor(Math.random() * results.length)];

                channel?.send({
                    files: [{
                        attachment: file,
                        name: file.substring(file.lastIndexOf('/') + 1)
                    }]
                });
            });

            return "Here is your image"
        } catch (err) {
            return "Unknown error: " + err;
        }

    }
} as ICommand