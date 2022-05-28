import { ICommand } from "wokcommands";
import { config, image_args_arr, sendToChannel } from "..";
import { getImageTag, sendImgToChannel, trimStringArray, walk } from "../utils";

let images: string[] = [];
let currImg = 0;

export default {

    category: 'Misc',
    description: 'Search image by tags',

    slash: true,
    testOnly: true,
    ownerOnly: false,
    hidden: false,

    expectedArgs: '<tags>',
    expectedArgsTypes: ['STRING'],
    minArgs: 0,
    maxArgs: 1,

    callback: ({ channel, args }) => {

        if (args.length == 0 && currImg == images.length - 1) {
            channel?.send({
                content: 'No more images in list'
            });
            return;
        } else if (args.length == 0) {
            sendImgToChannel(images[currImg], channel);
            currImg++;
            return;
        }

        images = walk(config.get('img_dir'));

        let search_terms = trimStringArray(args[0].split(';'));
        for (let i = 0; i < search_terms.length; i++) {
            let search_term_split = trimStringArray(search_terms[i].split('='));
            if (search_term_split.length != 2) {
                sendToChannel(channel, `Invalid search term ${search_terms[i]}`);
            } else {
                if (image_args_arr.indexOf(search_term_split[0]) == -1) {
                    sendToChannel(channel, `No such xmp tag: ${search_term_split[0]}`);
                } else {
                    let search_term_condition = trimStringArray(search_term_split[1].split(','));
                    for (let c = 0; c < search_term_condition.length; c++) {
                        images = images.filter(element => {
                            return getImageTag(element, search_term_split[0]) == search_term_condition[c];
                        });
                    }
                }
            }
        }
        currImg = 0;
        sendToChannel(channel, `Found ${images.length} images`);


    }
} as ICommand