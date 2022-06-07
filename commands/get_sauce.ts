import { ICommand } from "wokcommands";
import { findSauce } from "../sauce_utils";
import { getFileName, getLastFileUrl, isUrl, safeReply } from "../utils";

export default {
    category: 'Misc',
    description: 'Get sauce of an image',

    slash: true,
    testOnly: true,
    ownerOnly: false,
    hidden: false,

    expectedArgs: '<url> <min-similarity>',
    expectedArgsTypes: ['STRING', 'NUMBER'],
    minArgs: 0,
    maxArgs: 2,

    callback: async ({ channel, interaction }) => {

        let url = interaction.options.getString('url');
        let min_similarity = interaction.options.getNumber('min-similarity') || 75;

        if (!url) {
            const file = getLastFileUrl(channel);
            if (!file) {
                await safeReply(interaction, "No file provided.");
                return;
            }
            findSauce(file, channel, min_similarity);
            await safeReply(interaction, `searching sauce for ${getFileName(file)}`);
            return;
        }

        if (isUrl(url)) {
            findSauce(url, channel, min_similarity);
            await safeReply(interaction, `searching sauce for ${getFileName(url)}`);
            return;
        }

        await safeReply(interaction, "Invalid Url");
    }
} as ICommand