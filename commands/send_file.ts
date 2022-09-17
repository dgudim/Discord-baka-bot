import { ICommand } from "dkrcommands";
import fs from "fs";
import path from "path";
import https from 'https';
import { getAllUrlFileAttachements, getFileName, safeReply, sendToChannel } from "discord_bots_common";
import { changeSavedDirectory, getSendDir } from "../sauce_utils";
import { ApplicationCommandOptionType } from "discord.js";

export default {
    category: 'Administration',
    description: 'Send a file to the server',

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    options: [{
        name: "url",
        description: "File url",
        type: ApplicationCommandOptionType.String,
        required: false,
    }, {
        name: "file",
        description: "The file itself",
        type: ApplicationCommandOptionType.Attachment,
        required: false
    }, {
        name: "save-path",
        description: "Where to save the file to",
        type: ApplicationCommandOptionType.String,
        required: false
    }
    ],

    callback: async ({ interaction, channel }) => {

        let interaction_nn = interaction!;

        let urls = await getAllUrlFileAttachements(interaction_nn, "url", "file");

        changeSavedDirectory(channel, 'SAVE', interaction_nn.options.getString("save-path"));

        if (!urls.length) {
            await safeReply(interaction_nn, `No files so save`);
            return;
        } else {
            await safeReply(interaction_nn, 'Saving file(s)');
        }

        const send_dir = await getSendDir();

        for (const url of urls) {
            const fileName = getFileName(url);
            const file = fs.createWriteStream(path.join(send_dir, fileName));
            https.get(url, (response) => {
                response.pipe(file);

                file.on("finish", () => {
                    file.close();
                    sendToChannel(channel, `Saved ${fileName}`);
                });
            });

            await sendToChannel(channel, `Saving ${fileName} to ${send_dir}`);
        }
    }
} as ICommand