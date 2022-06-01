import { ICommand } from "wokcommands";
import { db, getImgDir } from "..";
import { changeSavedDirectory, getImageMetatags, sendImgToChannel, setLastFile, walk } from "../utils";

let indexUpToDate = false;
let index: Array<string> = [];
let currImg = 0;

export default {

    category: 'Misc',
    description: 'Get random image from the directory',

    slash: 'both',
    testOnly: true,
    ownerOnly: false,
    hidden: false,

    expectedArgs: '<directory path>',
    expectedArgsTypes: ['STRING'],
    minArgs: 0,
    maxArgs: 1,

    callback: async ({ channel, args }) => {

        if (changeSavedDirectory(channel, 'image', args[0], 'img_dir')) {
            indexUpToDate = false;
        }

        try {
            currImg ++;

            if (!indexUpToDate || currImg == index.length) {
                index = walk(getImgDir());
                index = index
                    .map(value => ({ value, sort: Math.random() }))
                    .sort((a, b) => a.sort - b.sort)
                    .map(({ value }) => value);
                currImg = 0;
                channel?.send({
                    content: `loaded ${index.length} images`
                });
                indexUpToDate = true;
            }

            let file = index[currImg];
            setLastFile(file);

            sendImgToChannel(file, channel);

            await getImageMetatags(file, channel);

            return "Here is your image"
        } catch (err) {
            return "Error: " + err;
        }

    }
} as ICommand