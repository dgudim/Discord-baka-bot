import { EmbedBuilder, Snowflake, TextBasedChannel } from "discord.js";
import { TagContainer } from "./sauce_utils";
import {
    getFileHash, getFileName, getValueIfExists, limitLength, normalize, sendToChannel, trimStringArray,
    debug, error, info, normalizeTags
} from "discord_bots_common";

import img_tags from "./image_tags.json";

import path from "path";
import { exec } from "child_process";
import util from "util";
const execPromise = util.promisify(exec);

import { db, image_args, xpm_image_args_grep } from ".";

const lastTags: Map<Snowflake, TagContainer> = new Map<Snowflake, TagContainer>();

export function checkTag(tag_name: string, tag_content: string): string {
    return tag_content != "-" ? ` -xmp-xmp:${tag_name}='${normalizeTags(tag_content)}'` : "";
}

export function setLastTags(channel: TextBasedChannel, tags: TagContainer): void {
    lastTags.set(channel.id, tags);
}

export function getLastTags(channel: TextBasedChannel): TagContainer {
    return lastTags.get(channel.id) || { postInfo: { author: "-", character: "-", copyright: "-", tags: "-", url: "-" }, file: "-" };
}

export function getImageTag(file: string, arg: string): Promise<string> {
    return getValueIfExists(db, `^${file}^tags^${mapArgToXmp(arg)}`);
}

export function mapXmpToName(xmp_tag: string): string {
    const index = img_tags.findIndex((element) => {
        return element.xmpName == normalize(xmp_tag);
    });
    if (index != -1) {
        return img_tags[index].name;
    }
    error(`❌ Can't map xmp tag: ${xmp_tag} to name`);
    return xmp_tag;
}

export function mapArgToXmp(arg: string): string {
    const index = image_args.indexOf(arg);
    if (index != -1) {
        return img_tags[index].xmpName;
    }
    error(`❌ Can't map arg: ${arg} to xmp tag`);
    return arg;
}

export async function writeTagsToFile(confString: string, file: string, channel: TextBasedChannel, callback: { (): Promise<void>; (): void }): Promise<void> {

    debug(`📝 Writing tags to file: ${file}`);

    try {
        const { stdout, stderr } = await execPromise((`${process.env.EXIFTOOL_PATH} -config ${path.join(__dirname, "./exiftoolConfig.conf")} ${confString} -overwrite_original '${file}'`));
        debug(stdout);
        if (stderr) {
            error(`❌ Exiftool stderr: ${stderr}`);
        }
        await callback();
    } catch (err) {
        await sendToChannel(channel, `❌ Xmp tagging error: ${err}`, true);
    }
}

async function writeTagsToDB(file: string, hash: string): Promise<void> {

    debug(`📝 Writing tags of ${file} to database`);

    try {
        const { stdout } = await execPromise((`${process.env.EXIFTOOL_PATH} -xmp:all '${file}' | grep -i ${xpm_image_args_grep}`));

        const pushCallsAsync = [];

        if (stdout) {
            const fields = stdout.toLowerCase().split("\n");
            for (let i = 0; i < fields.length - 1; i++) {
                const split = trimStringArray(fields.at(i)!.split(":"));
                pushCallsAsync.push(db.push(`^${file}^tags^${split[0]}`, split[1], true));
            }
        }

        pushCallsAsync.push(db.push(`^${file}^hash`, hash, true));

        await Promise.all(pushCallsAsync);

        info("📄 Wrote tags to db");
    } catch (err) {
        error(`❌ Error writing tags to db: ${err}`);
    }
}

export async function ensureTagsInDB(file: string): Promise<void> {

    const real_hash = await getFileHash(file);
    const database_hash = await getValueIfExists(db, `^${file}^hash`);

    debug(`⛓ Calling ensureTagsInDB on ${file}, \nreal_hash: ${real_hash}, \ndatabase_hash: ${database_hash}`);

    if (real_hash != database_hash) {
        await writeTagsToDB(file, real_hash);
    }
}

export async function getImageMetatags(file: string): Promise<EmbedBuilder> {

    const embed = new EmbedBuilder();
    embed.setTitle("🖼 Image metadata");
    embed.setDescription(getFileName(file));
    embed.setColor("Green");

    await ensureTagsInDB(file);

    for (const img_tag of img_tags) {
        const tag_path = `^${file}^tags^${img_tag.xmpName}`;

        embed.addFields([{
            name: mapXmpToName(img_tag.xmpName),
            value: limitLength(await getValueIfExists(db, tag_path), 1024),
            inline: true
        }]);
    }

    return embed;
}
