import { Snowflake } from "discord.js";
import { ICommand } from "wokcommands";
import { searchImages } from "../sauce_utils";
import { changeSavedDirectory, clamp, normalize, safeReply, sendImgToChannel, } from "../utils";

let currImgs: Map<Snowflake, number> = new Map<Snowflake, number>();
let imagesPerChannel: Map<Snowflake, string[]> = new Map<Snowflake, string[]>();

export default {

    category: 'Image management',
    description: 'Search image by tags',

    slash: true,
    testOnly: true,
    ownerOnly: false,
    hidden: false,

    expectedArgs: '<search-query> <index> <directory-path>',
    expectedArgsTypes: ['STRING', 'INTEGER', 'STRING'],
    minArgs: 0,
    maxArgs: 3,

    callback: async ({ channel, interaction }) => {

        let currImg = currImgs.get(channel.id) || 0;
        let images = imagesPerChannel.get(channel.id) || [];

        let options = interaction.options;

        let searchQuery = normalize(options.getString("search-query"));
        let index = options.getInteger("index");
        let empty = !searchQuery.length && index == null;

        changeSavedDirectory(channel, 'IMAGE', options.getString("directory-path"));

        if (empty && currImg > images.length - 1) {
            await safeReply(interaction, `No more images in list`);
            return;
        }

        if (searchQuery.length) {
            await safeReply(interaction, 'searching...');
            images = await searchImages(searchQuery, channel);
            imagesPerChannel.set(channel.id, images);
            currImg = 0;
            currImgs.set(channel.id, 0);
        }

        if (index != null) {
            index = clamp(index, 0, images.length - 1);
            if (index > images.length - 1 || index < 0) {
                await safeReply(interaction, `Index too big or no images in the list, max is ${images.length - 1}`);
                return;
            } else {
                currImg = index;
                currImgs.set(channel.id, index);
                await safeReply(interaction, `Set current image index to ${index}`);
            }
        }

        if (!images.length) {
            return;
        }

        let file = images[currImg];
        await safeReply(interaction, `Here is your image (index: ${currImg})`);
        await sendImgToChannel(channel, file, true);
        currImgs.set(channel.id, currImg + 1);
    }
} as ICommand