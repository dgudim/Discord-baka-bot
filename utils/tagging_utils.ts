import { EmbedBuilder, Snowflake, TextBasedChannel } from "discord.js";

import { error, debug, info } from "discord_bots_common/dist/utils/logger";
import { none, getValueIfExists, normalize, sendToChannel, normalizeStringArray, getFileHash, getFileName, limitLength, getStringHash } from "discord_bots_common/dist/utils/utils";

import img_tags from "../image_tags.json";

const phash = require("sharp-phash");

import fs from "fs";

import path from "path";
import { exec } from "child_process";
import util from "util";
const execPromise = util.promisify(exec);

import { db, image_args, xpm_image_args_grep } from "..";
import { PostInfo } from "./sauce_utils";

const lastTags: Map<Snowflake, PostInfo> = new Map<Snowflake, PostInfo>();

export function getXmpTag(tag_name: string, tag_content: string): string {
    return tag_content != "-" ? ` -xmp-xmp:${tag_name}='${normalizeTags(tag_content)}'` : "";
}

export function setLastTags(channel: TextBasedChannel, tags: PostInfo): void {
    lastTags.set(channel.id, tags);
}

export function getLastTags(channel: TextBasedChannel): PostInfo | none {
    return lastTags.get(channel.id);
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
        const { stdout, stderr } = await execPromise((`${process.env.EXIFTOOL_PATH} -config ${path.join(__dirname, "../exiftoolConfig.conf")} ${confString} -overwrite_original '${file}'`));
        debug(stdout);
        if (stderr) {
            error(`❌ Exiftool stderr: ${stderr}`);
        }
        await callback();
    } catch (err) {
        error(err);
        await sendToChannel(channel, `❌ Tagging error`, true);
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
                const split = normalizeStringArray(fields.at(i)!.split(":"));
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

    const p_hash = await getValueIfExists(db, `^${file}^phash`);

    debug(`⛓ Calling ensureTagsInDB on ${file} \nreal_hash: ${real_hash} \ndatabase_hash: ${database_hash} \nperceptual hash: ${p_hash}`);

    if (p_hash == "-" || real_hash != database_hash) {
        await db.push(`^${file}^phash`, await phash(fs.readFileSync(file)), true);
    }

    if (real_hash != database_hash) {
        await writeTagsToDB(file, real_hash);
    }
}

export function normalizeTags(tags: string): string {
    return tags.replaceAll(" ", ",").replaceAll("_", " ").replaceAll(":", "_").replaceAll("'", "");
}

export async function postInfoToEmbed(postInfo: PostInfo) {
    const embed = new EmbedBuilder();
    embed.setTitle("🖼 Image metadata");
    embed.setDescription(await getStringHash(postInfo.source_url));
    embed.setColor("Green");
    appendPostInfoToEmbed(embed, postInfo);
    return embed;
}

export function appendPostInfoToEmbed(embed: EmbedBuilder, postInfo: PostInfo) {
    embed.setURL(postInfo.source_url);
    embed.addFields([{
        name: "Author",
        value: normalizeTags(postInfo.author)
    }, {
        name: "Character",
        value: normalizeTags(postInfo.character)
    }, {
        name: "Tags",
        value: limitLength(normalizeTags(postInfo.tags), 1024)
    }, {
        name: "Copyright",
        value: normalizeTags(postInfo.copyright)
    }, {
        name: "Rating",
        value: normalizeTags(postInfo.rating)
    }]);
}

export async function getImageMetatags(file: string): Promise<EmbedBuilder> {

    const embed = new EmbedBuilder();
    embed.setTitle("🖼 Image metadata");
    embed.setDescription(getFileName(file));
    embed.setColor("Green");

    const sourcepost = await getValueIfExists(db, `^${file}^tags^sourcepost`);
    if (sourcepost != "-") {
        embed.setURL(`https://${sourcepost}`);
    }

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
