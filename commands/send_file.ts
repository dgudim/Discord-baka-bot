import { ICommand } from "dkrcommands";
import fs from "fs";
import path from "path";
import https from "https";
import { changeSavedDirectory, getSendDir } from "../sauce_utils";
import { ApplicationCommandOptionType } from "discord.js";
import { getAllUrlFileAttachements, safeReply, getFileName, sendToChannel } from "discord_bots_common/dist/utils/utils";

export default {
    category: "Administration",
    description: "Send a file to the server",

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

        const urls = await getAllUrlFileAttachements(interaction, "url", "file");

        changeSavedDirectory(channel, "SAVE", interaction!.options.getString("save-path"));

        if (!urls.length) {
            await safeReply(interaction, `🚫 No files so save`);
            return;
        } else {
            await safeReply(interaction, "📥 Saving file(s)");
        }

        const sendDir = await getSendDir();

        for (const url of urls) {
            const fileName = getFileName(url);
            const filePath = path.join(sendDir, fileName);
            if (fs.existsSync(filePath)) {
                await sendToChannel(channel, `❌ File ${filePath} aleady exists`, true);
                continue;
            }
            const file = fs.createWriteStream(filePath);
            https.get(url, (response) => {
                response.pipe(file);

                file.on("finish", () => {
                    file.close();
                    sendToChannel(channel, `💾 Saved ${fileName}`);
                });
            });

            await sendToChannel(channel, `📥 Saving ${fileName} to ${sendDir}`);
        }
    }
} as ICommand;