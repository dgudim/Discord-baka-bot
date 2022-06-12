import { ICommand } from "wokcommands";
import { findSauce } from "../sauce_utils";
import { getFileName, getLastImgUrl, isUrl, safeReply, sendToChannel } from "../utils";

export default {
    category: 'Image management',
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
            const file = getLastImgUrl(channel);
            if (!file) {
                await safeReply(interaction, "No file provided.");
                return;
            }
            await safeReply(interaction, `searching sauce for ${getFileName(file)}`);
            let sauce = await findSauce(file, channel, min_similarity);
            if(sauce) {
                await sendToChannel(channel, sauce.embed);
            }
            return;
        }

        if (isUrl(url)) {
            await safeReply(interaction, `searching sauce for ${getFileName(url)}`);
            let sauce = await findSauce(url, channel, min_similarity);
            if (sauce) {
                await sendToChannel(channel, sauce.embed);
            }
            return;
        }

        await safeReply(interaction, "Invalid Url");
    }
} as ICommand