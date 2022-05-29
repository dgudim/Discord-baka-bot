import { MessageEmbed, TextBasedChannel } from "discord.js";
import { config, image_args_arr, xpm_image_args_grep } from "./index"
import fs from "fs";
import { exec } from 'child_process';
import img_tags from './image_tags.json';

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

export function mapXmpToName(xmp_tag: string) {
    let index = img_tags.findIndex((element) => {
        return element.xmpName == xmp_tag;
    });
    if (index != -1) {
        return img_tags[index].name;
    }
    console.log(`Can't map xmp tag: ${xmp_tag} to name`);
    return xmp_tag;
}

export function mapArgToXmp(arg: string) {
    let index = image_args_arr.indexOf(arg);
    if (index != -1) {
        return img_tags[index].xmpName;
    }
    console.log(`Can't map arg: ${arg} to xmp tag`);
    return arg;
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
                        name: mapXmpToName(split[0].trim()),
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

export function getImageTag(img: string, arg: string): string {
    exec((`exiftool -xmp:all '${img}' | grep -i ${mapArgToXmp(arg)}`),
        (error, stdout, stderr) => {
            console.log(stdout);
            if (stdout) {
                const fields = stdout.split("\n");
                if (fields.length == 2) {
                    console.log(fields.at(1)!.split(':'));
                    return fields.at(1)!.split(':')[1].trim();
                }
            }
        });
    return "";
}

const eight_mb = 1024 * 1024 * 8;
import sharp from "sharp";

export function sendImgToChannel(file: string, channel: TextBasedChannel | null){
    if (fs.statSync(file).size > eight_mb) {
        channel?.send({
            content: `image too large, compressing, wait...`
        });
        sharp(file)
            .resize({ width: 1920 })
            .webp({
                quality: 80
            })
            .toBuffer((err, data, info) => {
                if (err) {
                    channel?.send({
                        content: 'error resizing'
                    });
                } else {
                    if (info.size > eight_mb) {
                        channel?.send({
                            content: 'image still too large, bruh'
                        });
                    } else {
                        channel?.send({
                            files: [{
                                attachment: data,
                                name: getFileName(file)
                            }]
                        });
                    }
                }
            });
    } else {
        channel?.send({
            files: [{
                attachment: file,
                name: getFileName(file)
            }]
        });
    }
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
