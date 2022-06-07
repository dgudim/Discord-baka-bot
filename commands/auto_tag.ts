import { TextBasedChannel } from "discord.js";
import { ICommand } from "wokcommands";
import { getSauceConfString } from "../config";
import { findSauce, searchImages } from "../sauce_utils";
import { changeSavedDirectory, ensureTagsInDB, getFileName, getImageMetatags, getLastFile, getLastFileUrl, getLastTags, isUrl, safeReply, sendImgToChannel, sendToChannel, writeTagsToFile } from "../utils";

let images: string[] = [];
let armed = false;
let active = false;
let stop = false;

async function autotag(accept_from: string, min_similarity: number, index: number, channel: TextBasedChannel) {
    let tagged = 0, skipped = 0;
    for (let i = index; i < images.length; i++) {
        await sendToChannel(channel, `tagging image at index ${i}, name: ${getFileName(images[i])}`);
        await sendImgToChannel(images[i], channel, true);
        let sauce = await findSauce(getLastFileUrl(), channel, min_similarity, accept_from);
        if (sauce && sauce.similarity >= min_similarity) {
            await writeTagsToFile(getSauceConfString(getLastTags()), images[i], channel, () => { });
            await sendToChannel(channel, `tagged image at index ${i}, name: ${getFileName(images[i])}`);
            await ensureTagsInDB(images[i]);
            tagged++;
        } else {
            await sendToChannel(channel, `skipped ${getFileName(images[i])}`);
            skipped++;
        }
        if (stop) {
            stop = false;
            active = false;
            break;
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

        changeSavedDirectory(channel, 'image', interaction.options.getString("directory-path"), 'img_dir');

        if (stop) {
            await safeReply(interaction, 'autotagger still stopping, wait...');
            return;
        }

        if (active) {
            stop = true;
            await safeReply(interaction, 'stopping autotagger...');
            return;
        }

        if (armed && !search_query) {
            await safeReply(interaction, `autotagging ${images.length} images starting at index ${startingIndex}`);
            active = true;
            armed = false;
            autotag(accept_from, min_similarity, startingIndex, channel);
            return;
        }

        await safeReply(interaction, 'searching...');
        images = await searchImages(search_query || 'source-post#=-', channel);
        await sendToChannel(channel, 'use the command again without the search query to start tagging, use the command third time to stop tagging');
        armed = true;
        return;
    }
} as ICommand