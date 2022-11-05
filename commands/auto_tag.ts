import { ApplicationCommandOptionType, Snowflake, TextBasedChannel } from "discord.js";
import { error } from "discord_bots_common/dist/utils/logger";
import { getFileName, safeReply, sendToChannel } from "discord_bots_common/dist/utils/utils";
import { ICommand } from "dkrcommands";
import { findSauce, getLastImgUrl, getSauceConfString, searchImages, sendImgToChannel } from "../utils/sauce_utils";
import { ensureTagsInDB, writeTagsToFile } from "../utils/tagging_utils";

const imagesPerChannel: Map<Snowflake, string[]> = new Map<Snowflake, string[]>();
const armedPerChannel: Map<Snowflake, boolean> = new Map<Snowflake, boolean>();
const activePerChannel: Map<Snowflake, boolean> = new Map<Snowflake, boolean>();
const stopPerChannel: Map<Snowflake, boolean> = new Map<Snowflake, boolean>();

async function autotag(accept_from: string, min_similarity: number, index: number, channel: TextBasedChannel) {
    let tagged = 0, skipped = 0;
    const images = imagesPerChannel.get(channel.id) || [];

    for (let i = index; i < images.length; i++) {
        try {
            if (stopPerChannel.get(channel.id)) {
                stopPerChannel.set(channel.id, false);
                activePerChannel.set(channel.id, false);
                break;
            }
            const filename = getFileName(images[i]);
            await sendToChannel(channel, `Tagging image at index ${i}, name: ${filename}`);
            await sendImgToChannel(channel, images[i], true);
            const sauce = await findSauce(getLastImgUrl(channel), channel, min_similarity, accept_from);
            if (!sauce.embed) {
                await sendToChannel(channel, `Skipped ${filename}`);
                skipped++;
                continue;
            }
            await sendToChannel(channel, sauce.embed);
            await writeTagsToFile(getSauceConfString(sauce.postInfo), images[i], channel, async () => {
                await ensureTagsInDB(images[i]);
                await sendToChannel(channel, `tagged image at index ${i}, name: ${filename}`);
                tagged++;
            });
        } catch (err) {
            error(err);
            await sendToChannel(channel, `Error tagging image at index ${i}`);
        }
        await sendToChannel(channel, `Tagging finished: ${tagged} tagged, ${skipped} skipped (${tagged + skipped} total, ${((tagged + skipped) / (images.length - index) * 100.0).toFixed(2)}%)`);
        stopPerChannel.set(channel.id, false);
        activePerChannel.set(channel.id, false);
    }
}

export default {
    category: "Admin image management",
    description: "Autotag images matching search query",

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    options: [
        {
            name: "min-similarity",
            description: "Minimum similarity of the image (1-100)",
            type: ApplicationCommandOptionType.Integer,
            required: false
        }, {
            name: "accept-from",
            description: "What websites are acceptable (e.g: booru, sankakucomplex)",
            type: ApplicationCommandOptionType.String,
            required: false
        }, {
            name: "search-query",
            description: "Autotag images matching this query",
            type: ApplicationCommandOptionType.String,
            required: false
        }, {
            name: "index",
            description: "Image index to start from",
            type: ApplicationCommandOptionType.Integer,
            required: false
        }
    ],
    
    callback: async ({ channel, interaction }) => {

        const accept_from = interaction?.options.getString("accept-from") || "booru,sankakucomplex";
        const min_similarity = interaction?.options.getInteger("min-similarity") || 90;
        const search_query = interaction?.options.getString("search-query");
        const startingIndex = interaction?.options.getInteger("index") || 0;

        let images = imagesPerChannel.get(channel.id) || [];

        if (stopPerChannel.get(channel.id)) {
            await safeReply(interaction, "autotagger still stopping, wait...");
            return;
        }

        if (activePerChannel.get(channel.id)) {
            stopPerChannel.set(channel.id, true);
            await safeReply(interaction, "stopping autotagger...");
            return;
        }

        if (armedPerChannel.get(channel.id) && !search_query) {
            await safeReply(interaction, `autotagging ${images.length} images starting at index ${startingIndex}`);
            activePerChannel.set(channel.id, true);
            armedPerChannel.set(channel.id, false);
            autotag(accept_from, min_similarity, startingIndex, channel);
            return;
        }

        await safeReply(interaction, "searching...");
        images = await searchImages(search_query || "source-post#=-", channel);
        imagesPerChannel.set(channel.id, images);
        await sendToChannel(channel, "use the command again without the search query to start tagging, use the command third time to stop tagging");
        armedPerChannel.set(channel.id, true);
    }
} as ICommand;