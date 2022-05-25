import { ICommand } from "wokcommands";
import fs from "fs";
import https from 'https';
import { config } from "../index"
import { changeSavedDirectory } from "../utils";

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

        changeSavedDirectory(message.channel, 'save', args[0], 'send_file_dir');
        
        if (message.attachments.size) {
            for (let i = 0; i < message.attachments.size; i++) {
                const file = fs.createWriteStream(config.get<string>('send_file_dir') + message.attachments.at(i)?.name);
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

            return "saving " + message.attachments.size + " file(s) to " + config.get('send_file_dir');
        }

    }
} as ICommand