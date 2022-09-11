import { Snowflake } from "discord.js";
import { ICommand } from "dkrcommands";
import { searchImages, sendImgToChannel } from "../sauce_utils";
import { clamp, normalize, safeReply } from "discord_bots_common";

let currImgs: Map<Snowflake, number> = new Map<Snowflake, number>();
let imagesPerChannel: Map<Snowflake, string[]> = new Map<Snowflake, string[]>();

export default {

    category: 'Image management',
    description: 'Search image by tags',

    slash: true,
    testOnly: true,
    ownerOnly: false,
    hidden: false,

    expectedArgs: '<search-query> <index>',
    expectedArgsTypes: ['STRING', 'INTEGER', 'STRING'],
    minArgs: 0,
    maxArgs: 3,

    callback: async ({ channel, interaction }) => {

        let interaction_nn = interaction!;

        let currImg = currImgs.get(channel.id) || 0;
        let images = imagesPerChannel.get(channel.id) || [];

        let options = interaction_nn.options;

        let searchQuery = normalize(options.getString("search-query"));
        let index = options.getInteger("index");
        let empty = !searchQuery.length && index == null;

        if (empty && currImg > images.length - 1) {
            await safeReply(interaction_nn, `No more images in list`);
            return;
        }

        if (searchQuery.length) {
            await safeReply(interaction_nn, 'searching...');
            images = await searchImages(searchQuery, channel);
            imagesPerChannel.set(channel.id, images);
            currImg = 0;
            currImgs.set(channel.id, 0);
        }

        if (index != null) {
            index = clamp(index, 0, images.length - 1);
            if (index > images.length - 1 || index < 0) {
                await safeReply(interaction_nn, `Index too big or no images in the list, max is ${images.length - 1}`);
                return;
            } else {
                currImg = index;
                currImgs.set(channel.id, index);
                await safeReply(interaction_nn, `Set current image index to ${index}`);
            }
        }

        if (!images.length) {
            return;
        }

        let file = images[currImg];
        await safeReply(interaction_nn, `Here is your image (index: ${currImg})`);
        await sendImgToChannel(channel, file, true);
        currImgs.set(channel.id, currImg + 1);
    }
} as ICommand