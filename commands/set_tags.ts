import { MessageEmbed } from 'discord.js';
import { ICommand } from "wokcommands";
import { exec } from 'child_process';
import path from 'path';
import { getFileName, getImageMetatags, getLastFile, getLastTags, normalize } from '../utils';
import { image_args, image_args_arr, image_args_types } from '..';
import img_tags from '../image_tags.json';

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

        if (interaction.options.data.length == 0) {
            let lastTagsFrom_get_sauce = getLastTags();
            if (lastTagsFrom_get_sauce.file == getLastFile()) {
                confString += ` -xmp-xmp:character='${lastTagsFrom_get_sauce.character}'`;
                confString += ` -xmp-xmp:author='${lastTagsFrom_get_sauce.author}'`;
                confString += ` -xmp-xmp:copyright='${lastTagsFrom_get_sauce.copyright}'`;
                confString += ` -xmp-xmp:tags='${lastTagsFrom_get_sauce.tags}'`;
                confString += ` -xmp-xmp:sourcepost='${lastTagsFrom_get_sauce.post}'`;
            } else {
                return "No tags provided"
            }
        }

        const embed = new MessageEmbed();
        embed.setTitle("New metatags");
        embed.setDescription(getFileName(getLastFile()));

        let index;

        for (let i = 0; i < interaction.options.data.length; i++) {
            index = image_args_arr.indexOf(interaction.options.data[i].name);
            if (index != -1) {
                confString += ` -xmp-xmp:${img_tags[index].xmpName}='${normalize(interaction.options.data[i].value?.toString())}'`;
            } else {
                console.log("No such parameter: " + interaction.options.data[i].name);
            }
        }

        exec((`exiftool -config ${path.join(__dirname, "../exiftoolConfig.conf")} ${confString} -overwrite_original '${getLastFile()}'`), () => {
            getImageMetatags(getLastFile(), channel);
        });

        return 'new tags';
    }
} as ICommand