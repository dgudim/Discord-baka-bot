import { ICommand } from "dkrcommands";
import { changeSavedDirectory } from "../utils/sauce_utils";
import { ApplicationCommandOptionType } from "discord.js";
import { safeReply } from "discord_bots_common/dist/utils/utils";

export default {
    category: "Administration",
    description: "Set image database directory",

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    options: [{
        name: "img-dir",
        description: "Image database directory",
        type: ApplicationCommandOptionType.String,
        required: true
    }],

    callback: async ({ interaction, channel }) => {
        await safeReply(interaction, "Changing image directory");
        changeSavedDirectory(channel, "IMAGE", interaction!.options.getString("img-dir"));
    }
} as ICommand;