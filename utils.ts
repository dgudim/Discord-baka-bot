import { MessageEmbed, TextBasedChannel } from "discord.js";
import { config, xpm_image_args_grep } from "./index"
import fs from "fs";
import { exec } from 'child_process';

export function changeSavedDirectory(channel: TextBasedChannel | null, dir_type: string, dir: string, key: string) {
    if (dir) {
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
            channel?.send({
                content: `Changed ${dir_type} directory to ${dir}`
            });
            config.set(key, dir.endsWith('/') ? dir.substring(0, dir.length - 1) : dir);
            config.save();
            return true;
        } else {
            channel?.send({
                content: `Invalid ${dir_type} directory, will use previous`
            });
            return false;
        }
    }
}

let lastFile: string;

export function getLastFile() {
    return lastFile;
}

export function setLastFile(file: string) {
    lastFile = file;
}

export function getFileName(file: string) {
    return file.substring(file.lastIndexOf('/') + 1);
}

export function getImageMetatags(file: string, channel: TextBasedChannel | null){
    exec((`exiftool -xmp:all '${file}' | grep -i ${xpm_image_args_grep}`),
        (error, stdout, stderr) => {

            const embed = new MessageEmbed();
            embed.setTitle("Image metadata");
            embed.setDescription(getFileName(file));

            if (stdout) {
                embed.setColor('GREEN');
                const fields = stdout.split("\n");
                for (let i = 0; i < fields.length - 1; i++) {
                    const split = fields.at(i)!.split(':');
                    embed.addFields([{
                        name: split[0].trim(),
                        value: split[1].trim(),
                        inline: true
                    }]);
                }
            } else {
                embed.setColor('YELLOW');
                embed.addFields([{
                    name: "no metatags",
                    value: ":("
                }]);
            }

            channel?.send({
                embeds: [embed]
            });

        });
}