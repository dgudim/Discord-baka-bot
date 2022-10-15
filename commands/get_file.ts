import { ICommand } from "dkrcommands";
import fs from "fs";
import { ApplicationCommandOptionType } from "discord.js";
import { safeReply, eight_mb, sendToChannel } from "discord_bots_common/dist/utils/utils";

export default {
    category: "Administration",
    description: "Get any file from the server",

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    options: [
        {
            name: "file-path",
            description: "Where to get the file from",
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ],

    callback: async ({ interaction, channel }) => {

        const file_path = interaction!.options.getString("file-path")!;

        if (!fs.existsSync(file_path)) {
            return safeReply(interaction, "❌ File does not exist");
        }

        if (fs.statSync(file_path).isDirectory()) {
            return safeReply(interaction, "❌ Can't send directories");
        }

        if (fs.statSync(file_path).size > eight_mb) {
            return safeReply(interaction, "❌ File too big ( > 8mb)");
        }

        try {
            await safeReply(interaction, "📄 Here is your file");
            await sendToChannel(channel, {
                files: [{
                    attachment: file_path,
                    name: file_path.substring(file_path.lastIndexOf("/") + 1)
                }]
            });
        } catch (err) {
            await safeReply(interaction, `❌ Error: ${err}`);
        }

    }
} as ICommand;