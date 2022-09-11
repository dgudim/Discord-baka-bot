import { ICommand } from "dkrcommands";
import fs from "fs";
import path from "path";
import https from 'https';
import { sendToChannel } from "discord_bots_common";
import { changeSavedDirectory, getSendDir } from "../sauce_utils";

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

        let message_nn = message!;

        changeSavedDirectory(message_nn.channel, 'SAVE', args[0]);

        if (message_nn.attachments.size) {

            const send_dir = await getSendDir();

            for (let i = 0; i < message_nn.attachments.size; i++) {
                const file = fs.createWriteStream(path.join(send_dir, message_nn.attachments.at(i)?.name || "undefined"));
                https.get(message_nn.attachments.at(i)?.url + "", (response) => {
                    response.pipe(file);

                    file.on("finish", () => {
                        file.close();
                        sendToChannel(channel, `saved ${message_nn.attachments.at(i)?.name}`);
                    });
                });
            }

            await sendToChannel(channel, `saving ${message_nn.attachments.size} file(s) to ${send_dir}`)
        } else {
            await sendToChannel(channel, 'please provide at least one attachment');
        }

    }
} as ICommand