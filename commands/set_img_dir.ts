import { ICommand } from "dkrcommands";
import { combinedReply } from "discord_bots_common";
import { changeSavedDirectory } from "../sauce_utils";

export default {
    category: 'Administration',
    description: 'Set image database directory',

    slash: 'both',
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    expectedArgs: '<img-dir>',
    expectedArgsTypes: ['STRING'],
    minArgs: 1,
    maxArgs: 1,

    callback: async ({ interaction, message, channel, args }) => {

        if (!args[0]) {
            await combinedReply(interaction, message, "no directory provided");
        }

        changeSavedDirectory(channel, "IMAGE", args[0]);        
    }
} as ICommand