import { TextBasedChannel } from "discord.js";
import { ICommand } from "wokcommands";
import { getSauceConfString } from "../config";
import { findSauce, searchImages } from "../sauce_utils";
import { ensureTagsInDB, getFileName, getImageMetatags, getLastFile, getLastFileUrl, getLastTags, isUrl, sendImgToChannel, sendToChannel, writeTagsToFile } from "../utils";

let images: string[] = [];
let armed = false;
let active = false;
let stop = false;

async function autotag(accept_from: string, min_similarity: number, channel: TextBasedChannel) {
    let tagged = 0, skipped = 0;
    for (let i = 0; i < images.length; i++) {
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
    sendToChannel(channel, `tagging finished: ${tagged} tagged, ${skipped} skipped (${tagged + skipped} total, ${((tagged + skipped) / images.length * 100.0).toFixed(2)}%)`);
}

export default {
    category: 'Misc',
    description: 'Autotag images matching search query',

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    expectedArgs: '<min-similarity> <accept-from> <search-query>',
    expectedArgsTypes: ['NUMBER', 'STRING', 'STRING'],
    minArgs: 0,
    maxArgs: 3,

    callback: async ({ channel, interaction }) => {

        let accept_from = interaction.options.getString('accept-from') || 'booru';
        let min_similarity = interaction.options.getNumber('min-similarity') || 90;
        let search_query = interaction.options.getString('search-query') || 'source-post#=-';

        if (stop) {
            interaction.reply({
                content: `autotagger still stopping, wait...`
            });
            return;
        }

        if (active) {
            stop = true;
            interaction.reply({
                content: `stopping autotagger...`
            });
            return;
        }

        if (armed && !interaction.options.data.length) {
            interaction.reply({
                content: `autotagging ${images.length} images`
            });
            active = true;
            armed = false;
            autotag(accept_from, min_similarity, channel);
            return;
        }

        interaction.reply({
            content: 'searching...'
        });
        images = await searchImages(search_query, channel);
        sendToChannel(channel, 'use the command again to start tagging, use the command third time to stop tagging');
        armed = true;
        return;
    }
} as ICommand