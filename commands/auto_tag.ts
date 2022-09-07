import { Snowflake, TextBasedChannel } from "discord.js";
import { ICommand } from "dkrcommands";
import { getSauceConfString } from "../config";
import { findSauce, searchImages } from "../sauce_utils";
import { changeSavedDirectory, ensureTagsInDB, getFileName, getLastImgUrl, safeReply, sendImgToChannel, sendToChannel, writeTagsToFile } from "../utils";

let imagesPerChannel: Map<Snowflake, string[]> = new Map<Snowflake, string[]>();
let armedPerChannel: Map<Snowflake, boolean> = new Map<Snowflake, boolean>();
let activePerChannel: Map<Snowflake, boolean> = new Map<Snowflake, boolean>();
let stopPerChannel: Map<Snowflake, boolean> = new Map<Snowflake, boolean>();

async function autotag(accept_from: string, min_similarity: number, index: number, channel: TextBasedChannel) {
    let tagged = 0, skipped = 0;
    let images = imagesPerChannel.get(channel.id) || [];

    for (let i = index; i < images.length; i++) {
        try {
            if (stopPerChannel.get(channel.id)) {
                stopPerChannel.set(channel.id, false);
                activePerChannel.set(channel.id, false);
                break;
            }
            await sendToChannel(channel, `tagging image at index ${i}, name: ${getFileName(images[i])}`);
            await sendImgToChannel(channel, images[i], true);
            const sauce = await findSauce(getLastImgUrl(channel), channel, min_similarity, accept_from, false);
            if (!sauce || (sauce && sauce.post.similarity < min_similarity)) {
                await sendToChannel(channel, `skipped ${getFileName(images[i])}`);
                skipped++;
                continue;
            }
            await sendToChannel(channel, sauce.embed);
            await writeTagsToFile(getSauceConfString(sauce.postInfo), images[i], channel, () => { });
            await ensureTagsInDB(images[i]);
            await sendToChannel(channel, `tagged image at index ${i}, name: ${getFileName(images[i])}`);
            tagged++;

        } catch (err) {
            await sendToChannel(channel, `error: ${err}`);
            i--;
        }
    }
    await sendToChannel(channel, `tagging finished: ${tagged} tagged, ${skipped} skipped (${tagged + skipped} total, ${((tagged + skipped) / (images.length - index) * 100.0).toFixed(2)}%)`);
    stopPerChannel.set(channel.id, false);
    activePerChannel.set(channel.id, false);
}

export default {
    category: 'Admin image management',
    description: 'Autotag images matching search query',

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    expectedArgs: '<min-similarity> <accept-from> <search-query> <index> <directory-path>',
    expectedArgsTypes: ['NUMBER', 'STRING', 'STRING', 'INTEGER', 'STRING'],
    minArgs: 0,
    maxArgs: 5,

    callback: async ({ channel, interaction }) => {

        let interaction_nn = interaction!;

        let accept_from = interaction_nn.options.getString('accept-from') || 'booru,sankakucomplex';
        let min_similarity = interaction_nn.options.getNumber('min-similarity') || 90;
        let search_query = interaction_nn.options.getString('search-query');
        let startingIndex = interaction_nn.options.getInteger('index') || 0;

        changeSavedDirectory(channel, 'IMAGE', interaction_nn.options.getString("directory-path"));

        let images = imagesPerChannel.get(channel.id) || [];

        if (stopPerChannel.get(channel.id)) {
            await safeReply(interaction_nn, 'autotagger still stopping, wait...');
            return;
        }

        if (activePerChannel.get(channel.id)) {
            stopPerChannel.set(channel.id, true);
            await safeReply(interaction_nn, 'stopping autotagger...');
            return;
        }

        if (armedPerChannel.get(channel.id) && !search_query) {
            await safeReply(interaction_nn, `autotagging ${images.length} images starting at index ${startingIndex}`);
            activePerChannel.set(channel.id, true);
            armedPerChannel.set(channel.id, false);
            autotag(accept_from, min_similarity, startingIndex, channel);
            return;
        }

        await safeReply(interaction_nn, 'searching...');
        images = await searchImages(search_query || 'source-post#=-', channel);
        imagesPerChannel.set(channel.id, images);
        await sendToChannel(channel, 'use the command again without the search query to start tagging, use the command third time to stop tagging');
        armedPerChannel.set(channel.id, true);
    }
} as ICommand