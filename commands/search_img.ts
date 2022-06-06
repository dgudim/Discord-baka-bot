import { ICommand } from "wokcommands";
import { searchImages } from "../sauce_utils";
import { changeSavedDirectory, clamp, normalize, safeReply, sendImgToChannel, } from "../utils";

let currImg = 0;
let images:string[] = [];

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

        if (empty && currImg > images.length - 1) {
            return 'No more images in list';
        }

        if (searchQuery.length) {
            await safeReply(interaction, 'searching...');
            images = await searchImages(searchQuery, channel);
            currImg = 0;
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