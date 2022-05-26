import { MessageEmbed } from 'discord.js';
import { ICommand } from "wokcommands";
import { exec } from 'child_process';
import path from 'path';
import { getFileName, getImageMetatags, getLastFile } from '../utils';
import { image_args, image_args_arr, image_args_types, xpm_image_args } from '..';

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

        if (interaction.options.data.length == 0) {
            return "No tags provided"
        }

        const embed = new MessageEmbed();
        embed.setTitle("New metatags");
        embed.setDescription(getFileName(getLastFile()));

        let confString = "";
        let index;

        for (let i = 0; i < interaction.options.data.length; i++) {
            index = image_args_arr.indexOf(interaction.options.data[i].name);
            if (index != -1) {
                confString += ` ${xpm_image_args[index]}'${interaction.options.data[i].value}'`;
            } else {
                console.log("No such parameter: " + interaction.options.data[i].name);
            }

        }

        exec((`exiftool -config ${path.join(__dirname, "../exiftoolConfig.conf")} ${confString} '${getLastFile()}' && rm '${getLastFile()}'_original`), () => {
            getImageMetatags(getLastFile(), channel);
        });

        return 'new tags';
    }
} as ICommand