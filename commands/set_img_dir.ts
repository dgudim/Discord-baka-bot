import { ICommand } from "dkrcommands";
import { changeSavedDirectory } from "../sauce_utils";
import { ApplicationCommandOptionType } from "discord.js";

export default {
    category: 'Administration',
    description: 'Set image database directory',

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
        changeSavedDirectory(channel, "IMAGE", interaction!.options.getString("img-dir"));        
    }
} as ICommand