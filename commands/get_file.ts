import { ICommand } from "wokcommands";
import fs from "fs";
import { eight_mb, safeReply, sendToChannel } from "../utils";

export default {
    category: 'Administration',
    description: 'Get any file from the server',

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    expectedArgs: '<file path>',
    expectedArgsTypes: ['STRING'],
    minArgs: 1,
    maxArgs: 1,

    callback: async ({ interaction, args, channel }) => {

        if (!fs.existsSync(args[0])){
            await safeReply(interaction, "File does not exist");
            return;
        }

        if (fs.statSync(args[0]).isDirectory()) {
            await safeReply(interaction, "Can't send directories");
            return;
        }

        if (fs.statSync(args[0]).size > eight_mb){
            await safeReply(interaction, "File too big ( > 8mb)");
            return;
        }

        try {
            await safeReply(interaction, "Here is your file");
            await sendToChannel(channel, {
                files: [{
                    attachment: args[0],
                    name: args[0].substring(args[0].lastIndexOf('/') + 1)
                }]
            })
        } catch (err) {
            await safeReply(interaction, `Error: ${err}`);
        }

    }
} as ICommand