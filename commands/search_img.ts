import { ApplicationCommandOptionType, Snowflake } from "discord.js";
import { ICommand } from "dkrcommands";
import { isNSFW, searchImages, sendImgToChannel } from "../utils/sauce_utils";
import { clamp, normalize, safeReply } from "discord_bots_common/dist/utils/utils";

const currImgs: Map<Snowflake, number> = new Map<Snowflake, number>();
const imagesPerChannel: Map<Snowflake, string[]> = new Map<Snowflake, string[]>();

export default {

    category: "Image management",
    description: "Search image by tags",

    slash: true,
    testOnly: true,
    ownerOnly: false,
    hidden: false,

    options: [{
        name: "search-query",
        description: "Image search query",
        type: ApplicationCommandOptionType.String,
        required: false
    }, {
        name: "index",
        description: "Image index to jump to",
        type: ApplicationCommandOptionType.Integer,
        required: false
    }],

    callback: async ({ channel, interaction }) => {

        if (!isNSFW(channel, interaction)) {
            return;
        }

        let currImg = currImgs.get(channel.id) || 0;
        let images = imagesPerChannel.get(channel.id) || [];

        const options = interaction!.options;

        const searchQuery = normalize(options.getString("search-query"));
        let index = options.getInteger("index");
        const empty = !searchQuery.length && index == null;

        if (empty && currImg > images.length - 1) {
            await safeReply(interaction, `🚫 No more images in list`);
            return;
        }

        if (searchQuery.length) {
            await safeReply(interaction, "🔎 Searching...");
            images = await searchImages(searchQuery, channel);
            imagesPerChannel.set(channel.id, images);
            currImg = 0;
            currImgs.set(channel.id, 0);
        }

        if (index != null) {
            index = clamp(index, 0, images.length - 1);
            if (index > images.length - 1 || index < 0) {
                await safeReply(interaction, `🚫 Index too big or no images in the list, max is ${images.length - 1}`);
                return;
            } else {
                currImg = index;
                currImgs.set(channel.id, index);
                await safeReply(interaction, `📍 Set current image index to ${index}`);
            }
        }

        if (!images.length) {
            return;
        }

        const file = images[currImg];
        await safeReply(interaction, `🖼 Here is your image (index: ${currImg})`);
        await sendImgToChannel(channel, file, true);
        currImgs.set(channel.id, currImg + 1);
    }
} as ICommand;