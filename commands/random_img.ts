import { ICommand } from "wokcommands";
import fs from "fs";
let currentDirectory = "/home/kloud/Documents/JS";

let path = require('path');
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
                    if ((file.endsWith(".jpg") || file.endsWith(".png")) 
                        && stat && stat.size <= 1024 * 8){
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

        if (args[0]) {
            if (fs.existsSync(args[0]) && fs.statSync(args[0]).isDirectory()) {
                channel?.send({
                    content: "Changed image directory to " + args[0]
                });
                currentDirectory = args[0].endsWith('/') ? args[0] : (args[0] + "/");
            } else {
                channel?.send({
                    content: "Invalid image directory, will use previous"
                });
            }
        }

        try {
            walk(currentDirectory, function (err: string, results: Array<string>) {
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