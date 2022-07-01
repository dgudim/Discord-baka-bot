import { ICommand } from "wokcommands";
import fs from "fs";
import path from "path";
import https from 'https';
import { changeSavedDirectory, sendToChannel, getSendDir } from "../utils";

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

    callback: async ({ message, args, channel }) => {

        changeSavedDirectory(message.channel, 'SAVE', args[0]);

        if (message.attachments.size) {
            for (let i = 0; i < message.attachments.size; i++) {
                const file = fs.createWriteStream(path.join(getSendDir(), message.attachments.at(i)?.name || "undefined"));
                https.get(message.attachments.at(i)?.url + "", (response) => {
                    response.pipe(file);

                    file.on("finish", () => {
                        file.close();
                        sendToChannel(channel, `saved ${message.attachments.at(i)?.name}`);
                    });
                });
            }

            await sendToChannel(channel, `saving ${message.attachments.size} file(s) to ${getSendDir()}`)
        } else {
            await sendToChannel(channel, 'please provide at least one attachment');
        }

    }
} as ICommand