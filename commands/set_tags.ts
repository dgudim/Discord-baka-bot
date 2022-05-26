import { MessageEmbed } from 'discord.js';
import { ICommand } from "wokcommands";
import { exec } from 'child_process';
import path from 'path';
import { getFileName, getImageMetatags, getLastFile } from '../utils';
import { image_args, image_args_types, xpm_image_args } from '..';

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
    maxArgs: 6,

    callback: ({ args, channel }) => {

        if (!getLastFile()) {
            return "No image selected"
        }

        if (args.length == 0) {
            return "No tags provided"
        }

        const embed = new MessageEmbed();
        embed.setTitle("New metatags");
        embed.setDescription(getFileName(getLastFile()));

        let confString = "";

        for (let i = 0; i < xpm_image_args.length; i++) {
            if (args.length > i) {
                confString += ` ${xpm_image_args[i]}'${args[i]}'`;
            }
        }

        exec((`exiftool -config ${path.join(__dirname, "../exiftoolConfig.conf")} ${confString} '${getLastFile()}' && rm '${getLastFile()}'_original`), () => {
            getImageMetatags(getLastFile(), channel);
        });

        return 'new tags';
    }
} as ICommand