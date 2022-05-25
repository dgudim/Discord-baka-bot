import { MessageEmbed } from 'discord.js';
import { ICommand } from "wokcommands";
import { exec } from 'child_process';
import path from 'path';
import { getFileName, getImageMetatags, getLastFile } from '../utils';

export default {
    category: 'Misc',
    description: 'Set last image (random_img) metatags',

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    expectedArgs: '<A_lvl> <H_lvl> <D_lvl> <Author> <Character> <Tags>',
    expectedArgsTypes: ['INTEGER', 'INTEGER', 'INTEGER', 'STRING', 'STRING', 'STRING'],
    minArgs: 0,
    maxArgs: 6,

    callback: ({ args, channel }) => {

        if (!getLastFile()) {
            return "No image selected"
        }

        if(args.length == 0){
            return "No tags provided"
        }

        const embed = new MessageEmbed();
        embed.setTitle("New metatags");
        embed.setDescription(getFileName(getLastFile()));

        const confString =
            (args.length > 0 ? ` -xmp-xmp:alvl='${args[0]}'` : "") +
            (args.length > 1 ? ` -xmp-xmp:hlvl='${args[1]}'` : "") +
            (args.length > 2 ? ` -xmp-xmp:dlvl='${args[2]}'` : "") +
            (args.length > 3 ? ` -xmp-xmp:author='${args[3]}'` : "") +
            (args.length > 4 ? ` -xmp-xmp:character='${args[4]}'` : "") +
            (args.length > 5 ? ` -xmp-xmp:tags='${args[5]}'` : "");

        exec((`exiftool -config ${path.join(__dirname, "../exiftoolConfig.conf")} ${confString} '${getLastFile()}'`), () => {
            getImageMetatags(getLastFile(), channel);
        });

        return 'new tags';
    }
} as ICommand