import { ICommand } from "dkrcommands";
import fs from "fs";
import { eight_mb, safeReply, sendToChannel } from "@discord_bots_common/utils";

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

        let interaction_nn = interaction!;

        if (!fs.existsSync(args[0])){
            await safeReply(interaction_nn, "File does not exist");
            return;
        }

        if (fs.statSync(args[0]).isDirectory()) {
            await safeReply(interaction_nn, "Can't send directories");
            return;
        }

        if (fs.statSync(args[0]).size > eight_mb){
            await safeReply(interaction_nn, "File too big ( > 8mb)");
            return;
        }

        try {
            await safeReply(interaction_nn, "Here is your file");
            await sendToChannel(channel, {
                files: [{
                    attachment: args[0],
                    name: args[0].substring(args[0].lastIndexOf('/') + 1)
                }]
            })
        } catch (err) {
            await safeReply(interaction_nn, `Error: ${err}`);
        }

    }
} as ICommand