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

export function trimStringArray(arr: string[]) {
    return arr.map(element => {
        return element.trim();
    }).filter(element => {
        return element.length != 0;
    });
}

export function getImageMetatags(file: string, channel: TextBasedChannel | null) {
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

export function getImageTag(img: string, tag: string): string {
    return "";
}

export function walk(dir: string) {
    let results: Array<string> = [];
    let list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = dir + '/' + file;
        let stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.toLowerCase().endsWith(".jpg")
                || file.toLowerCase().endsWith(".jpeg")
                || file.toLowerCase().endsWith(".png")) {
                results.push(file);
            }
        }
    });
    return results;
}
