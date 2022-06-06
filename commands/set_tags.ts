import { ICommand } from "wokcommands";
import { exec } from 'child_process';
import path from 'path';
import { getImageMetatags, getLastFile, getLastFileUrl, getLastTags, normalize, sendToChannel, writeTagsToFile } from '../utils';
import { image_args, image_args_arr, image_args_types } from '..';
import img_tags from '../image_tags.json';
import { getSauceConfString } from "../config";

export default {
    category: 'Misc',
    description: 'Set last image (random_img) metatags',

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    expectedArgs: image_args,
    expectedArgsTypes: image_args_types,
    minArgs: 0,
    maxArgs: image_args_types.length,

    callback: ({ channel, interaction }) => {

        if (!getLastFile()) {
            return "No image selected"
        }

        let confString = "";

        for (let i = 0; i < interaction.options.data.length; i++) {
            let index = image_args_arr.indexOf(interaction.options.data[i].name);
            if (index != -1) {
                confString += ` -xmp-xmp:${img_tags[index].xmpName}='${normalize(interaction.options.data[i].value?.toString())}'`;
            } else {
                sendToChannel(channel, `No such parameter: ${interaction.options.data[i].name}`);
            }
        }

        if (interaction.options.data.length == 0) {
            let lastTagsFrom_get_sauce = getLastTags();
            if (lastTagsFrom_get_sauce.file == getLastFileUrl()) {
                confString = getSauceConfString(lastTagsFrom_get_sauce);
            } else {
                return "No tags provided"
            }
        }

        writeTagsToFile(confString, getLastFile(), channel, () => {
            getImageMetatags(getLastFile(), channel, true);
        });
        
        return 'new tags';
    }
} as ICommand