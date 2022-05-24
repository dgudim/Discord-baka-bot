import { ICommand } from "wokcommands";
import fs from "fs";
import https from 'https';
let currentDirectory = "/home/kloud/Downloads/";

export default {
    category: 'Administration',
    description: 'Send any file to the server',

    slash: false,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    expectedArgs: '<save path>',
    expectedArgsTypes: ['STRING'],
    minArgs: 0,
    maxArgs: 1,

    callback: ({ message, args }) => {

        if (args[0]) {
            if (fs.existsSync(args[0]) && fs.statSync(args[0]).isDirectory()) {
                message.channel?.send({
                    content: "Changed save directory to " + args[0]
                });
                currentDirectory = args[0].endsWith('/') ? args[0] : (args[0] + "/");
            } else {
                message.channel?.send({
                    content: "Invalid save directory, will use previous"
                });
            }
        }

        if (message.attachments.size) {
            for (let i = 0; i < message.attachments.size; i++) {
                const file = fs.createWriteStream(currentDirectory + message.attachments.at(i)?.name);
                https.get(message.attachments.at(i)?.url + "", (response) => {
                    response.pipe(file);

                    file.on("finish", () => {
                        file.close();
                        message.channel?.send({
                            content: "saved " + message.attachments.at(i)?.name
                        });
                    });
                });
            }

            return "saving " + message.attachments.size + " file(s) to " + currentDirectory;
        } else {
            return "no files attached"
        }

    }
} as ICommand