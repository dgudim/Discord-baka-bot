import { ColorResolvable, CommandInteraction, Message, MessageOptions, MessagePayload, EmbedBuilder, TextBasedChannel } from "discord.js";
import fs from "fs";

import { blake3 } from 'hash-wasm';

import { colors, wrap } from "./colors";
import { info, log, logLevel } from "./logger";
import { db } from ".";

export const eight_mb = 1024 * 1024 * 8;

export function isDirectory(path: string): boolean {
    return fs.existsSync(path) && fs.statSync(path).isDirectory()
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

export async function getFileHash(file: string): Promise<string> {
    return blake3(fs.readFileSync(file));
}

export async function getValueIfExists(search_path: string, get_path: string = search_path){
    return await db.exists(search_path) ? db.getData(get_path) : "-";
}

export function limitLength(str: string, max_length: number): string {
    if (str.length > max_length) {
        str = str.slice(0, max_length - 3) + '...';
    }
    return str;
}

export function perc2color(perc: number): ColorResolvable {
    let r, g, b = 0;
    if (perc < 50) {
        r = 255;
        g = Math.round(5.1 * perc);
    }
    else {
        g = 255;
        r = Math.round(510 - 5.10 * perc);
    }
    let h = r * 0x10000 + g * 0x100 + b * 0x1;
    return ('#' + ('000000' + h.toString(16)).slice(-6)) as ColorResolvable;
}

function embedToString(embed: EmbedBuilder) {
    let str = embed.data.title + "\n" + embed.data.description;
    for (let field of embed.data.fields || []) {
        str += `\n${field.name}: ${field.value}`;
    }
    return str;
}

function payloadToString(payload: MessagePayload) {
    let str: string = payload.options.content || "";
    if(payload.options.files) {
        str += "\nfiles:\n";
        for (let file of payload.options.files) {
            str += `\n${file}`;
        }
    }
    return str;
}

export function getChannelName(channel: TextBasedChannel){
    return channel.lastMessage?.guild?.channels.cache.get(channel.id)?.name || "private " + channel;
}

export async function sendToChannel(channel: TextBasedChannel | null, content: string | EmbedBuilder | MessagePayload | MessageOptions, log_asError?: boolean): Promise<void> {
    if (channel) {
        if (content instanceof EmbedBuilder) {
            info(`channel ${wrap(getChannelName(channel), colors.GREEN)}: ${embedToString(content)}`);
            await channel.send({
                embeds: [content]
            });
        } else if (content instanceof MessagePayload) {
            info(`channel ${wrap(getChannelName(channel), colors.LIGHT_BLUE)}: ${payloadToString(content)}`);
            await channel.send(content);
        } else if (typeof content === 'string') {
            const len = content.length;
            let pos = 0;
            while (pos < len) {
                let slice = content.slice(pos, pos + 1999);
                log(`channel ${wrap(channel, colors.CYAN)}: ${content}`, log_asError ? logLevel.ERROR : logLevel.INFO);
                await channel.send(slice);
                pos += 1999;
            }
        } else {
            info(`channel ${wrap(getChannelName(channel), colors.LIGHTER_BLUE)}: ${content}`);
            await channel.send(content);
        }
    }
}

export async function messageReply(message: Message, content: string): Promise<void> {
    info(`channel ${wrap(getChannelName(message.channel), colors.PURPLE)}: (reply to ${message.content}) -> ${content}`);
    await message.reply(content);
}

export async function safeReply(interaction: CommandInteraction, content: string | EmbedBuilder | MessagePayload): Promise<void> {
    if (interaction.replied) {
        await sendToChannel(interaction.channel, content);
    } else {
        const channel = interaction.channel;
        if (channel) {
            if (content instanceof EmbedBuilder) {
                info(`channel ${wrap(getChannelName(channel), colors.GREEN)}: (reply to /${interaction.command?.name}) -> ${embedToString(content)}`);
                await interaction.reply({
                    embeds: [content]
                });
            } else if (content instanceof MessagePayload) {
                info(`channel ${wrap(getChannelName(channel), colors.LIGHT_BLUE)}: (reply to /${interaction.command?.name}) -> ${payloadToString(content)}`);
                await interaction.reply(content);
            } else {
                info(`channel ${wrap(getChannelName(channel), colors.LIGHTER_BLUE)}: (reply to /${interaction.command?.name}) -> ${content}`);
                await interaction.reply(content);
            }
        }
    }
}

export async function combinedReply(interaction: CommandInteraction | undefined, message: Message | undefined, content: string | EmbedBuilder | MessagePayload): Promise<void> {
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
    const embed = new EmbedBuilder();
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
    if (!res.ok) { return { ok: res.ok, type: '', status: res.status, statusText: res.statusText } }
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