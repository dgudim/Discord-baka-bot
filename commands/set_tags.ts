import { ICommand } from "wokcommands";
import { getImageMetatags, getLastImgPath, getLastImgUrl, normalize, safeReply, sendToChannel, writeTagsToFile } from '../utils';
import { image_args, image_args_arr, image_args_types } from '..';
import img_tags from '../image_tags.json';
import { getSauceConfString } from "../config";
import { getLastTags } from "../sauce_utils";

export default {
    category: 'Admin image management',
    description: 'Set last image (random_img) metatags',
    
    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    expectedArgs: image_args,
    expectedArgsTypes: image_args_types,
    minArgs: 0,
    maxArgs: image_args_types.length,

    callback: async ({ channel, interaction }) => {

        if (!getLastImgPath(channel)) {
            await safeReply(interaction, "No image selected");
            return;
        }

        let confString = "";

        for (let i = 0; i < interaction.options.data.length; i++) {
            let index = image_args_arr.indexOf(interaction.options.data[i].name);
            if (index != -1) {
                confString += ` -xmp-xmp:${img_tags[index].xmpName}='${normalize(interaction.options.data[i].value?.toString())}'`;
            } else {
                await sendToChannel(channel, `No such parameter: ${interaction.options.data[i].name}`);
            }
        }

        if (interaction.options.data.length == 0) {
            let lastTagsFrom_get_sauce = getLastTags(channel);
            if (lastTagsFrom_get_sauce.file == getLastImgUrl(channel)) {
                confString = getSauceConfString(lastTagsFrom_get_sauce);
            } else {
                await safeReply(interaction, "No tags provided");
                return;
            }
        }

        writeTagsToFile(confString, getLastImgPath(channel), channel, async () => {
            await sendToChannel(channel, await getImageMetatags(getLastImgPath(channel)));
        });
        
        await safeReply(interaction, "new tags");
    }
} as ICommand