import { ICommand } from "dkrcommands";
import fs from "fs";
import path from "path";
import https from 'https';
import { sendToChannel } from "discord_bots_common";
import { changeSavedDirectory, getSendDir } from "../sauce_utils";
import { ApplicationCommandOptionType } from "discord.js";

export default {
    category: 'Administration',
    description: 'Send any file to the server',

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    options: [
        {
            name: "file",
            description: "The file itself",
            type: ApplicationCommandOptionType.Attachment,
            required: true
        }, {
            name: "save-path",
            description: "Where to save the file to",
            type: ApplicationCommandOptionType.String,
            required: false
        }
    ],

    callback: async ({ interaction, channel }) => {

        let interaction_nn = interaction!;
        const attachment = interaction_nn.options.getAttachment("file")!;
        const attachment_name = attachment.name || "undefined";

        changeSavedDirectory(channel, 'SAVE', interaction_nn.options.getString("save-path"));

        const send_dir = await getSendDir();

        const file = fs.createWriteStream(path.join(send_dir, attachment_name));
        https.get(attachment.url, (response) => {
            response.pipe(file);

            file.on("finish", () => {
                file.close();
                sendToChannel(channel, `saved ${attachment_name}`);
            });
        });

        await sendToChannel(channel, `saving ${attachment_name} to ${send_dir}`);


    }
} as ICommand