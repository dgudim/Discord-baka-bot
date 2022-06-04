import { TextBasedChannel } from "discord.js";
import { ICommand } from "wokcommands";
import { db, getImgDir, image_args_arr } from "..";
import { changeSavedDirectory, clamp, ensureTagsInDB, getImageTag, normalize, safeReply, sendImgToChannel, sendToChannel, sleep, trimStringArray, walk } from "../utils";

let images: string[] = [];
let currImg = 0;

const modifiers = new Map([
    ["@*=",
        (content: string[], search_term: string[]) => {
            return content.some((content_value) =>
                search_term.some((search_value) => content_value.startsWith(search_value)));
            // any content value must start with one of the search value
        }],
    ["@&=",
        (content: string[], search_term: string[]) => {
            return content.some((content_value) =>
                search_term.some((search_value) => content_value.endsWith(search_value)));
            // any content value must end with one of the search values
        }],
    ["!=",
        (content: string[], search_term: string[]) => {
            return search_term.every((value) => !content.includes(value));
        }],
    ["#=",
        (content: string[], search_term: string[]) => {
            return content.join() == search_term.join();
        }],
    ["*=",
        (content: string[], search_term: string[]) => {
            return content.every((content_value) =>
                search_term.some((search_value) => content_value.startsWith(search_value)));
            // every content value must start with one of the search value
        }],
    ["&=",
        (content: string[], search_term: string[]) => {
            return content.every((content_value) =>
                search_term.some((search_value) => content_value.endsWith(search_value)));
            // every content value must end with one of the search values
        }],
    ["@=",
        (content: string[], search_term: string[]) => {
            return search_term.some((value) =>
                content.some((content_value) => content_value.includes(value)));
        }],
    ["=",
        (content: string[], search_term: string[]) => {
            return search_term.every((value) =>
                content.some((content_value) => content_value.includes(value)));
        }]
]);

async function searchAndSendImage(searchQuery: string, channel: TextBasedChannel | null) {
    await sleep(500);

    images = walk(getImgDir());

    if (images.length > 0 && !db.exists(`^${images[0]}`)) {
        sendToChannel(channel, "refreshing image tag database, might take a while...");
        await sleep(1000);
        await Promise.all(images.map((value) => {
            ensureTagsInDB(value);
        }));
    }

    let search_terms = trimStringArray(searchQuery.split(';'));
    for (let i = 0; i < search_terms.length; i++) {

        let activeModifier_key = "";
        let activeModifier = (_content: string[], _search_term: string[]) => true;
        for (let [key, func] of modifiers.entries()) {
            if (search_terms[i].indexOf(key) != -1) {
                activeModifier_key = key;
                activeModifier = func;
                break;
            }
        }

        let search_term_split = trimStringArray(search_terms[i].split(activeModifier_key));

        if (search_term_split.length != 2) {
            sendToChannel(channel, `Invalid search term ${search_terms[i]}`);
        } else {
            if (image_args_arr.indexOf(search_term_split[0]) == -1) {
                sendToChannel(channel, `No such xmp tag: ${search_term_split[0]}`);
            } else {
                const results = await Promise.all(images.map((value) => {
                    return getImageTag(value, search_term_split[0]);
                }));
                images = images.filter((_element, index) => {
                    return activeModifier(
                        trimStringArray(results[index].split(',')),
                        trimStringArray(search_term_split[1].split(',')));
                });
            }
        }
    }
    currImg = 0;
    sendToChannel(channel, `Found ${images.length} images`);
}

export default {

    category: 'Misc',
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

        let options = interaction.options;

        let searchQuery = normalize(options.getString("search-query"));
        let index = options.getInteger("index");
        let empty = !searchQuery.length && index == null;

        changeSavedDirectory(channel, 'image', options.getString("directory-path"), 'img_dir');

        if (empty && currImg >= images.length - 1) {
            return 'No more images in list';
        }

        if (searchQuery.length) {
            interaction.followUp
            await safeReply(interaction, 'searching...');
            await searchAndSendImage(searchQuery, channel);
        }

        if (index != null) {
            index = clamp(index, 0, images.length - 1);
            if (index > images.length - 1 || index < 0) {
                await safeReply(interaction, `Index too big or no images in the list, max is ${images.length - 1}`);
                return;
            } else {
                currImg = index;
                await safeReply(interaction, `Set current image index to ${index}`);
            }
        }

        if (!images.length) {
            return;
        }

        let file = images[currImg];
        await safeReply(interaction, `Here is your image (index: ${currImg})`);
        await sendImgToChannel(file, channel, true);
        currImg++;
    }
} as ICommand