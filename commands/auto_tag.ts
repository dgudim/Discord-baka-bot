import { Snowflake, TextBasedChannel } from "discord.js";
import { ICommand } from "wokcommands";
import { getSauceConfString } from "../config";
import { findSauce, searchImages } from "../sauce_utils";
import { changeSavedDirectory, ensureTagsInDB, getFileName, getLastFileUrl, getLastTags, safeReply, sendImgToChannel, sendToChannel, writeTagsToFile } from "../utils";

let imagesPerChannel: Map<Snowflake, string[]> = new Map<Snowflake, string[]>();
let armedPerChannel: Map<Snowflake, boolean> = new Map<Snowflake, boolean>();
let activePerChannel: Map<Snowflake, boolean> = new Map<Snowflake, boolean>();
let stopPerChannel: Map<Snowflake, boolean> = new Map<Snowflake, boolean>();

async function autotag(accept_from: string, min_similarity: number, index: number, channel: TextBasedChannel) {
    let tagged = 0, skipped = 0;
    let images = imagesPerChannel.get(channel.id) || [];

    for (let i = index; i < images.length; i++) {
        try {
            await sendToChannel(channel, `tagging image at index ${i}, name: ${getFileName(images[i])}`);
            await sendImgToChannel(images[i], channel, true);
            let sauce = await findSauce(getLastFileUrl(channel), channel, min_similarity, accept_from);
            if (sauce && sauce.similarity >= min_similarity) {
                await writeTagsToFile(getSauceConfString(getLastTags(channel)), images[i], channel, () => { });
                await sendToChannel(channel, `tagged image at index ${i}, name: ${getFileName(images[i])}`);
                await ensureTagsInDB(images[i]);
                tagged++;
            } else {
                await sendToChannel(channel, `skipped ${getFileName(images[i])}`);
                skipped++;
            }
            if (stopPerChannel.get(channel.id)) {
                stopPerChannel.set(channel.id, false);
                activePerChannel.set(channel.id, false);
                break;
            }
        } catch (err) {
            await sendToChannel(channel, `error: ${err}`);
            i--;
        }
    }
    await sendToChannel(channel, `tagging finished: ${tagged} tagged, ${skipped} skipped (${tagged + skipped} total, ${((tagged + skipped) / (images.length - index) * 100.0).toFixed(2)}%)`);
}

export default {
    category: 'Misc',
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

        let accept_from = interaction.options.getString('accept-from') || 'booru,sankakucomplex';
        let min_similarity = interaction.options.getNumber('min-similarity') || 90;
        let search_query = interaction.options.getString('search-query');
        let startingIndex = interaction.options.getInteger('index') || 0;

        changeSavedDirectory(channel, 'IMAGE', interaction.options.getString("directory-path"));

        let images = imagesPerChannel.get(channel.id) || [];

        if (stopPerChannel.get(channel.id)) {
            await safeReply(interaction, 'autotagger still stopping, wait...');
            return;
        }

        if (activePerChannel.get(channel.id)) {
            stopPerChannel.set(channel.id, true);
            await safeReply(interaction, 'stopping autotagger...');
            return;
        }

        if (armedPerChannel.get(channel.id) && !search_query) {
            await safeReply(interaction, `autotagging ${images.length} images starting at index ${startingIndex}`);
            activePerChannel.set(channel.id, true);
            armedPerChannel.set(channel.id, false);
            autotag(accept_from, min_similarity, startingIndex, channel);
            return;
        }

        await safeReply(interaction, 'searching...');
        images = await searchImages(search_query || 'source-post#=-', channel);
        imagesPerChannel.set(channel.id, images);
        await sendToChannel(channel, 'use the command again without the search query to start tagging, use the command third time to stop tagging');
        armedPerChannel.set(channel.id, true);
        return;
    }
} as ICommand