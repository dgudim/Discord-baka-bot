import { CommandInteraction, TextBasedChannel } from "discord.js";
import { ICommand } from "wokcommands";
import { db, getImgDir, image_args_arr, sendToChannel } from "..";
import { changeSavedDirectory, ensureTagsInDB, getImageMetatags, getImageTag, normalize, sendImgToChannel, setLastFile, trimStringArray, walk } from "../utils";

let images: string[] = [];
let currImg = 0;

const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const modifiers = new Map([ // put your message replies here
    ["!=",
        (content: string, search_term: string) => {
            return !content.includes(search_term);
        }],
    ["#=",
        (content: string, search_term: string) => {
            return content == search_term;
        }],
    ["*=",
        (content: string, search_term: string) => {
            return content.startsWith(search_term);
        }],
    ["&=",
        (content: string, search_term: string) => {
            return content.endsWith(search_term);
        }],
    ["=",
        (content: string, search_term: string) => {
            return content.includes(search_term);
        }]
]);

async function searchAndSendImage(searchQuery: string, channel: TextBasedChannel | null) {
    await sleep(2000);

    images = walk(getImgDir());

    if (images.length > 0 && !db.exists(`^${images[0]}`)) {
        sendToChannel(channel, "refreshing image tag database, might take a while...");
        await sleep(2000);
        await Promise.all(images.map((value) => {
            ensureTagsInDB(value);
        }));
    }

    let search_terms = trimStringArray(searchQuery.split(';'));
    for (let i = 0; i < search_terms.length; i++) {

        let activeModifier_key = "";
        let activeModifier = (_content: string, _search_term: string) => true;
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
                let search_term_condition = trimStringArray(search_term_split[1].split(','));
                for (let c = 0; c < search_term_condition.length; c++) {
                    const results = await Promise.all(images.map((value) => {
                        return getImageTag(value, search_term_split[0]);
                    }));
                    images = images.filter((_element, index) => {
                        return activeModifier(results[index], search_term_condition[c]);
                    });
                }
            }
        }
    }
    currImg = 0;
    sendToChannel(channel, `Found ${images.length} images`);
}

function safeReply(interaction: CommandInteraction, message: string) {
    if (interaction.replied) {
        sendToChannel(interaction.channel, message);
    } else {
        interaction.reply({
            content: message
        });
    }
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
            safeReply(interaction, 'searching...');
            await searchAndSendImage(searchQuery, channel);
        }

        if (index != null) {
            index = clamp(index, 0, images.length - 1);
            if (index > images.length - 1 || index < 0) {
                safeReply(interaction, `Index too big or no images in the list, max is ${images.length - 1}`);
                return;
            } else {
                currImg = index;
                safeReply(interaction, `Set current image index to ${index}`);
            }
        }

        let file = images[currImg];
        sendImgToChannel(file, channel);
        setLastFile(file);
        await getImageMetatags(file, channel);
        currImg++;
        safeReply(interaction, `Here is your image (index: ${currImg - 1})`);
    }
} as ICommand