import { BufferResolvable, ColorResolvable, CommandInteraction, Message, MessageEmbed, MessageOptions, MessagePayload, Snowflake, TextBasedChannel } from "discord.js";
import { image_args_arr, xpm_image_args_grep, db } from "./index"
import fs from "fs";
import path from "path";
import { exec } from 'child_process';
import util from "util";
const execPromise = util.promisify(exec);
import img_tags from './image_tags.json';

import { hash } from 'blake3';

import sharp from "sharp";
import { colors } from "./colors";

export type saveDirType =
    | 'IMAGE'
    | 'SAVE'

export function getKeyByDirType(dir_type: saveDirType): string {
    let key;
    switch (dir_type) {
        case 'SAVE':
            key = 'send_file_dir'
            break;
        case 'IMAGE':
            key = 'img_dir'
            break;
    }
    return key;
}

export function isDirectory(path: string): boolean {
    return fs.existsSync(path) && fs.statSync(path).isDirectory()
}

export function changeSavedDirectory(channel: TextBasedChannel, dir_type: saveDirType, dir: string | null): boolean | undefined {
    if (dir) {
        let key = getKeyByDirType(dir_type);
        if (isDirectory(dir)) {
            sendToChannel(channel, `Changed ${dir_type.toLowerCase()} directory to ${dir}`);
            db.push(`^${key}`, dir.endsWith('/') ? dir.substring(0, dir.length - 1) : dir, true);
            return true;
        } else {
            sendToChannel(channel, `Invalid ${dir_type} directory, will use previous`);
            return false;
        }
    }
}

export function getImgDir() {
    return db.getData(`^${getKeyByDirType('IMAGE')}`);
}

export function getSendDir() {
    return db.getData(`^${getKeyByDirType('SAVE')}`);
}

let lastFiles: Map<Snowflake, string> = new Map<Snowflake, string>();
let lastFileUrls: Map<Snowflake, string> = new Map<Snowflake, string>();

export function setLastImg(channel: TextBasedChannel, file: string, fileUrl: string): void {
    lastFiles.set(channel.id, file);
    lastFileUrls.set(channel.id, fileUrl);
}

export function getLastImgUrl(channel: TextBasedChannel): string {
    return lastFileUrls.get(channel.id) || '';
}

export function getLastImgPath(channel: TextBasedChannel): string {
    return lastFiles.get(channel.id) || '';
}

export function getFileName(file: string): string {
    return file.substring(file.lastIndexOf('/') + 1);
}

export function normalize(str: string | undefined | null): string {
    return str ? str.toLowerCase().trim() : '';
}

export function trimStringArray(arr: string[]): string[] {
    return arr.map(element => {
        return normalize(element);
    }).filter(element => {
        return element.length != 0;
    });
}

export async function isUrl(url: string): Promise<boolean> {
    return (await fetch(url)).ok;
}

export function mapXmpToName(xmp_tag: string): string {
    let index = img_tags.findIndex((element) => {
        return element.xmpName == normalize(xmp_tag);
    });
    if (index != -1) {
        return img_tags[index].name;
    }
    console.log(`Can't map xmp tag: ${xmp_tag} to name`);
    return xmp_tag;
}

export function mapArgToXmp(arg: string): string {
    let index = image_args_arr.indexOf(arg);
    if (index != -1) {
        return img_tags[index].xmpName;
    }
    console.log(`Can't map arg: ${arg} to xmp tag`);
    return arg;
}

function getFileHash(file: string): string {
    return hash(file).toString('hex');
}

export async function writeTagsToFile(confString: string, file: string, channel: TextBasedChannel, callback: Function): Promise<void> {
    try {
        const { stderr } = await execPromise((`exiftool -config ${path.join(__dirname, "./exiftoolConfig.conf")} ${confString} -overwrite_original '${file}'`));
        callback();
        if (stderr) {
            console.log(`exiftool stderr: ${stderr}`);
        }
    } catch (err) {
        await sendToChannel(channel, `xmp tagging error: ${err}`);
    }
}

async function writeTagsToDB(file: string, hash: string): Promise<void> {

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
    } catch (err) {
        console.error(`error writing tags to db: ${err}`);
    }
}

export async function ensureTagsInDB(file: string): Promise<void> {

    let exists = db.exists(`^${file}`);

    let real_hash = getFileHash(file);
    let database_hash = exists ? db.getData(`^${file}^hash`) : "";

    if (!exists || real_hash != database_hash) {
        await writeTagsToDB(file, real_hash);
    }
}

export function limitLength(str: string, max_length: number): string {
    if (str.length > max_length) {
        str = str.slice(0, max_length - 3) + '...';
    }
    return str;
}

export async function getImageMetatags(file: string): Promise<MessageEmbed> {

    const embed = new MessageEmbed();
    embed.setTitle("Image metadata");
    embed.setDescription(getFileName(file));
    embed.setColor('GREEN');

    await ensureTagsInDB(file);

    for (let i = 0; i < img_tags.length; i++) {
        let path = `^${file}^tags^${img_tags[i].xmpName}`;

        embed.addFields([{
            name: mapXmpToName(img_tags[i].xmpName),
            value: limitLength(db.exists(path) ? db.getData(path) : "-", 1024),
            inline: true
        }]);
    }

    return embed;
}

export async function getImageTag(file: string, arg: string): Promise<string> {
    let path = `^${file}^tags^${mapArgToXmp(arg)}`;
    return db.exists(path) ? db.getData(path) : "-";
}

export function perc2color(perc: number): ColorResolvable {
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

export const eight_mb = 1024 * 1024 * 8;

export async function sendImgToChannel(channel: TextBasedChannel, file: string, attachMetadata: boolean = false): Promise<void> {
    let attachment: BufferResolvable | undefined = file;
    let message: Promise<Message<boolean>> | undefined;
    let width = (await sharp(file).metadata()).width || 0;
    if (fs.statSync(file).size > eight_mb || width > 3000) {
        sendToChannel(channel, 'image too large, compressing, wait...');
        await sharp(file)
            .resize({ width: 1920 })
            .jpeg({
                quality: 80
            })
            .toBuffer().then(data => {
                if (data.byteLength > eight_mb) {
                    sendToChannel(channel, 'image still too large, bruh');
                    attachment = undefined;
                } else {
                    attachment = data;
                }
            });
    }

    if (attachment) {
        if (attachMetadata) {
            message = channel.send({
                files: [{
                    attachment: attachment,
                    name: getFileName(file)
                }],
                embeds: [await getImageMetatags(file)]
            });
        } else {
            message = channel.send({
                files: [{
                    attachment: attachment,
                    name: getFileName(file)
                }]
            });
        }

        if (message) {
            setLastImg(channel, file, (await message).attachments.at(0)?.url || '');
        }
    }
}

export async function sendToChannel(channel: TextBasedChannel | null, content: string | MessageEmbed | MessagePayload | MessageOptions): Promise<void> {
    if (channel) {
        if (content instanceof MessageEmbed) {
            console.log(`channel ${colors.GREEN}${channel}${colors.DEFAULT}: ${content.title}`);
            await channel.send({
                embeds: [content]
            });
        } else if (content instanceof MessagePayload) {
            console.log(`channel ${colors.LIGHT_BLUE}${channel}${colors.DEFAULT}: ${content.data}`);
            await channel.send(content);
        } else if (typeof content === 'string') {
            const len = content.length;
            let pos = 0;
            while (pos < len) {
                let slice = content.slice(pos, pos + 1999);
                console.log(`channel ${colors.CYAN}${channel}${colors.DEFAULT}: ${slice}`);
                await channel.send(slice);
                pos += 1999;
            }
        } else {
            console.log(`channel ${colors.LIGHTER_BLUE}${channel}${colors.DEFAULT}: ${content}`);
            await channel.send(content);
        }
    }
}

export async function messageReply(message: Message, content: string): Promise<void> {
    console.log(`channel ${colors.PURPLE}${message.channel}${colors.DEFAULT}: ${content}`);
    await message.reply(content);
}

export async function safeReply(interaction: CommandInteraction, content: string | MessageEmbed | MessagePayload): Promise<void> {
    if (interaction.replied) {
        await sendToChannel(interaction.channel, content);
    } else {
        const channel = interaction.channel;
        if (content instanceof MessageEmbed) {
            console.log(`channel ${colors.GREEN}${channel}${colors.DEFAULT}: ${content.title}`);
            await interaction.reply({
                embeds: [content]
            });
        } else if (content instanceof MessagePayload) {
            console.log(`channel ${colors.LIGHT_BLUE}${channel}${colors.DEFAULT}: ${content.data}`);
            await interaction.reply(content);
        } else {
            console.log(`channel ${colors.LIGHTER_BLUE}${channel}${colors.DEFAULT}: ${content}`);
            await interaction.reply(content);
        }
    }
}

export async function combinedReply(interaction: CommandInteraction | undefined, message: Message | undefined, content: string | MessageEmbed | MessagePayload): Promise<void> {
    if (interaction) {
        await safeReply(interaction, content);
    } else if (message) {
        await sendToChannel(message.channel, content);
    }
}

export function walk(dir: string): string[] {
    let results: Array<string> = [];
    let list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = dir + '/' + file;
        let stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (isPngOrJpg(file.toLowerCase())) {
                results.push(file);
            }
        }
    });
    return results;
}

export function getSimpleEmbed(title: string, description: string, color: ColorResolvable) {
    const embed = new MessageEmbed();
    embed.setTitle(title);
    embed.setDescription(description || '-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
    embed.setColor(color);
    return embed;
}

export function getDateTime() {
    const now = new Date();
    const date = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
    const time = now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds();
    return date + ' ' + time;
}

export function clamp(num: number, min: number, max: number): number {
    return Math.min(Math.max(num, min), max)
}

export function sleep(ms: number): Promise<unknown> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function normalizeTags(tags: string): string {
    return tags.replaceAll(' ', ',').replaceAll('_', ' ').replaceAll(':', '_').replaceAll('\'', '');
}

export function stripUrlScheme(url: string) {
    return url.replace("https://", "").replace("http://", "");
}

export async function fetchUrl(url: string) {
    const res = await fetch(url);
    if (!res.ok) { return { ok: res.ok, type: '', status: res.status, statusText: res.statusText } };
    const buff = await res.blob();
    return { ok: res.ok, type: buff.type, status: res.status, statusText: res.statusText };
}

export function isPngOrJpg(name: string | null | undefined) {
    return name ? (name.endsWith('.png') || name.endsWith('.jpeg') || name.endsWith('.jpg')) : false;
}

export function isImageUrlType(type: string) {
    return type.startsWith('image/');
}

export function isPngOrJpgUrlType(type: string) {
    return type == 'image/apng' || type == 'image/png' || type == 'image/jpeg' || type == 'image/jpg';
}