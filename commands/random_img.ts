import { ICommand } from "dkrcommands";
import { changeSavedDirectory, getImgDir, sendImgToChannel } from "../sauce_utils";
import { combinedReply, walk } from "@discord_bots_common/utils";

let indexUpToDate = false;
let index: string[] = [];
let currImg = 0;

export default {

    category: 'Image management',
    description: 'Get random image from the directory',

    slash: 'both',
    testOnly: true,
    ownerOnly: false,
    hidden: false,

    expectedArgs: '<directory path>',
    expectedArgsTypes: ['STRING'],
    minArgs: 0,
    maxArgs: 1,

    callback: async ({ channel, args, interaction, message }) => {

        if (changeSavedDirectory(channel, 'IMAGE', args[0])) {
            indexUpToDate = false;
        }

        try {
            currImg++;

            if (!indexUpToDate || currImg == index.length) {
                index = walk(await getImgDir());
                index = index
                    .map(value => ({ value, sort: Math.random() }))
                    .sort((a, b) => a.sort - b.sort)
                    .map(({ value }) => value);
                currImg = 0;
                await combinedReply(interaction, message, `loaded ${index.length} images`);
                indexUpToDate = true;
            }
            await combinedReply(interaction, message, "Here is your image");
            
            await sendImgToChannel(channel, index[currImg], true);

        } catch (err) {
            await combinedReply(interaction, message, `Error: ${err}`);
        }
    }
} as ICommand