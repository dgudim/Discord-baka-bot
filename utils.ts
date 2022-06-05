import { ColorResolvable, CommandInteraction, Message, MessageEmbed, TextBasedChannel } from "discord.js";
import { image_args_arr, xpm_image_args_grep, db } from "./index"
import fs from "fs";
import { exec } from 'child_process';
import util from "util";
const execPromise = util.promisify(exec);
import img_tags from './image_tags.json';

import crypto from 'crypto';

export function changeSavedDirectory(channel: TextBasedChannel | null, dir_type: string, dir: string | null, key: string) {
    if (dir) {
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
            channel?.send({
                content: `Changed ${dir_type} directory to ${dir}`
            });
            db.push(`^${key}`, dir.endsWith('/') ? dir.substring(0, dir.length - 1) : dir, true);
            return true;
        } else {
            channel?.send({
                content: `Invalid ${dir_type} directory, will use previous`
            });
            return false;
        }
    }
}

let lastFile: string = "";
let lastFileUrl: string = "";

export function setLastFile(file: string, fileUrl: string) {
    lastFile = file;
    lastFileUrl = fileUrl;
}

export function getLastFileUrl() {
    return lastFileUrl;
}

export function getLastFile() {
    return lastFile;
}

export function getFileName(file: string) {
    return file.substring(file.lastIndexOf('/') + 1);
}

export function normalize(str: string | undefined | null) {
    return str ? str.toLowerCase().trim() : '';
}

export function trimStringArray(arr: string[]) {
    return arr.map(element => {
        return normalize(element);
    }).filter(element => {
        return element.length != 0;
    });
}

export function isUrl(str: string) {
    return str.startsWith('http://') || str.startsWith('https://');
}

export function mapXmpToName(xmp_tag: string) {
    let index = img_tags.findIndex((element) => {
        return element.xmpName == normalize(xmp_tag);
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

function getFileHash(file: string) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('base64');
}

async function writeTagsToDB(file: string, hash: string) {

    db.push(`^${file}^hash`, hash, true);

    try {
        const { stdout } = await execPromise((`exiftool -xmp:all '${file}' | grep -i ${xpm_image_args_grep}`));
        if (stdout) {
            const fields = stdout.toLowerCase().split("\n");
            for (let i = 0; i < fields.length - 1; i++) {
                const split = trimStringArray(fields.at(i)!.split(':'));
                db.push(`^${file}^tags^${split[0]}`, split[1], true);
            }
        }
    } catch (err) { }
}

export async function ensureTagsInDB(file: string) {

    let exists = db.exists(`^${file}`);

    let real_hash = getFileHash(file);
    let database_hash = exists ? db.getData(`^${file}^hash`) : "";

    if (!exists || real_hash != database_hash) {
        await writeTagsToDB(file, real_hash);
    }
}

export async function getImageMetatags(file: string, channel: TextBasedChannel | null, send_to_channel: boolean) {

    const embed = new MessageEmbed();
    embed.setTitle("Image metadata");
    embed.setDescription(getFileName(file));
    embed.setColor('GREEN');

    await ensureTagsInDB(file);

    for (let i = 0; i < img_tags.length; i++) {
        let path = `^${file}^tags^${img_tags[i].xmpName}`;

        embed.addFields([{
            name: mapXmpToName(img_tags[i].xmpName),
            value: db.exists(path) ? db.getData(path) : "-",
            inline: true
        }]);
    }

    if (send_to_channel) {
        channel?.send({
            embeds: [embed]
        });
    }

    return embed;

}

export async function getImageTag(file: string, arg: string): Promise<string> {

    let path = `^${file}^tags^${mapArgToXmp(arg)}`;

    return db.exists(path) ? db.getData(path) : "-";
}

export function perc2color(perc: number) {
    var r, g, b = 0;
    if (perc < 50) {
        r = 255;
        g = Math.round(5.1 * perc);
    }
    else {
        g = 255;
        r = Math.round(510 - 5.10 * perc);
    }
    var h = r * 0x10000 + g * 0x100 + b * 0x1;
    return ('#' + ('000000' + h.toString(16)).slice(-6)) as ColorResolvable;
}

const eight_mb = 1024 * 1024 * 8;
import sharp from "sharp";

export async function sendImgToChannel(file: string, channel: TextBasedChannel | null, attachMetadata: boolean = false) {
    let message: Promise<Message<boolean>> | undefined;
    if (fs.statSync(file).size > eight_mb) {
        sendToChannel(channel, 'image too large, compressing, wait...');
        await sharp(file)
            .resize({ width: 1920 })
            .webp({
                quality: 80
            })
            .toBuffer().then(data => {
                if (data.byteLength > eight_mb) {
                    sendToChannel(channel, 'image still too large, bruh');
                } else {
                    message = channel?.send({
                        files: [{
                            attachment: data,
                            name: `${getFileName(file)}.webp`
                        }]
                    });
                }
            });
    } else {
        if (attachMetadata) {
            message = channel?.send({
                files: [{
                    attachment: file,
                    name: getFileName(file)
                }],
                embeds: [await getImageMetatags(file, channel, false)]
            });
        } else {
            message = channel?.send({
                files: [{
                    attachment: file,
                    name: getFileName(file)
                }]
            });
        }
    }
    if (message) {
        const message_res = await message;
        setLastFile(file, message_res.attachments.at(0)?.url || '');
    }
}

export async function sendToChannel(channel: TextBasedChannel | null, content: string) {
    if (channel) {
        const len = content.length;
        let pos = 0;
        while (pos < len) {
            console.log(content.slice(pos, pos + 1999));
            await channel.send({
                content: content.slice(pos, pos + 1999)
            });
            pos += 1999;
        }
    }
}

export async function safeReply(interaction: CommandInteraction, message: string) {
    if (interaction.replied) {
        sendToChannel(interaction.channel, message);
    } else {
        await interaction.reply({
            content: message
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

export function clamp(num: number, min: number, max: number) {
    return Math.min(Math.max(num, min), max)
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeTags(tags: string) {
    return tags.replaceAll(' ', ',').replaceAll('_', ' ').replace(':', '_').replace('\'', '');
}

export class tagContainer {
    character: string;
    author: string;
    tags: string;
    copyright: string;
    post: string;
    file: string;

    constructor(character: string = '', author: string = '', tags: string = '', copyright: string = '', post: string = '', file: string = '') {
        this.character = normalizeTags(character);
        this.author = normalizeTags(author);
        this.tags = normalizeTags(tags);
        this.copyright = normalizeTags(copyright);
        this.post = post.replace("https://", "").replace("http://", "");
        this.file = file;
    }
}

let last_tags: tagContainer = new tagContainer();

export function setLastTags(tags: tagContainer) {
    last_tags = tags;
}

export function getLastTags() {
    return last_tags;
}