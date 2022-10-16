import { ICommand } from "dkrcommands";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import https from "https";
import { IncomingMessage } from "http";
import { findSauce, getImgDir, getLastImgUrl, getPostInfoFromUrl, getSauceConfString, ensurePixivLogin, sendImgToChannel, PostInfo, isNSFW, setLastImg } from "../utils/sauce_utils";
import { ensureTagsInDB, getLastTags, postInfoToEmbed, writeTagsToFile } from "../utils/tagging_utils";
import { ApplicationCommandOptionType, TextBasedChannel, TextChannel } from "discord.js";

import { sendToChannel, getAllUrlFileAttachements, safeReply, fetchUrl, isImageUrlType, walk, getStringHash } from "discord_bots_common/dist/utils/utils";

type Metadata = { postInfo?: PostInfo, file: { name: string, path: string } };

async function getFile(raw_path: string, channel: TextChannel) {
    let file_name = await getStringHash(raw_path);
    file_name = file_name.endsWith(".jpeg") ? file_name : file_name + ".jpeg";
    const file_path = path.join(await getImgDir(), file_name);

    if (fs.existsSync(file_path)) {
        await sendToChannel(channel, "❌ File aleady exists", true);
        return undefined;
    }

    return { name: file_name, path: file_path };
}

async function getMetadata(channel: TextChannel, source_url: string, is_plain_image: boolean) {

    let postInfo;
    if (is_plain_image) {
        postInfo = (await findSauce(source_url, channel, 85)).postInfo;
    } else {
        postInfo = await getPostInfoFromUrl(source_url);
        if (!postInfo) {
            return undefined;
        }
    }

    await sendToChannel(channel, postInfo.image_url);

    return postInfo;
}

async function writePostInfoToFile(postInfo: PostInfo | undefined, file_path: string, channel: TextBasedChannel) {
    if (postInfo) {
        await sendToChannel(channel, await postInfoToEmbed(postInfo));
        await writeTagsToFile(getSauceConfString(postInfo), file_path, channel, async () => {
            await ensureTagsInDB(file_path);
            await sendToChannel(channel, `📝 Wrote tags`);
        });
    } else {
        await sendToChannel(channel, `❌ Could not get tags`, true);
    }
}

async function processAndSaveImage(
    source: fs.ReadStream | IncomingMessage,
    metadata: Metadata,
    channel: TextChannel) {

    await sendToChannel(channel, `📥 Saving as ${metadata.file.name}`);

    const target = fs.createWriteStream(metadata.file.path);

    const sharpPipeline = sharp();
    sharpPipeline.jpeg({
        quality: 100
    }).pipe(target);

    source.pipe(sharpPipeline);

    return new Promise<Metadata>(resolve => {

        target.on("finish", async () => {
            target.close();
            await sendToChannel(channel, `💾 Saved`);
            resolve(metadata);
        });

    });
}

export default {
    category: "Admin image management",
    description: "Download an image, tag it and save it to the database",

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    options: [{
        name: "url",
        description: "Image url",
        type: ApplicationCommandOptionType.String,
        required: false,
    }, {
        name: "image",
        description: "Image file",
        type: ApplicationCommandOptionType.Attachment,
        required: false,
    }, {
        name: "lower_limit",
        description: "Lower image index (if post contains several images)",
        type: ApplicationCommandOptionType.Number,
        required: false,
    }, {
        name: "upper_limit",
        description: "Upper image index (if post contains several images)",
        type: ApplicationCommandOptionType.Number,
        required: false,
    }],

    callback: async ({ interaction, channel }) => {

        if (!isNSFW(channel, interaction)) {
            return;
        }

        const urls = await getAllUrlFileAttachements(interaction, "url", "image", true);

        if (!urls.length) {
            const last_image_tags = getLastTags(channel);
            if (last_image_tags) {
                urls.push(last_image_tags.source_url);
            }
        }

        if (!urls.length) {
            return safeReply(interaction, "🚫 No images to add");
        } else {
            await safeReply(interaction, "📥 Adding image(s) to db");
        }

        for (const source_url of urls) {

            const res = await fetchUrl(source_url);

            if (res.ok) {

                const is_plain_image = isImageUrlType(res.type);

                // special treatment for pixiv
                if (!is_plain_image && source_url.includes("pixiv")) {
                    const client = await ensurePixivLogin();
                    if (client) {
                        const img_dir = "./downloaded";
                        await sendToChannel(channel, `📥 Downloading from pixiv`);
                        await client.util.downloadIllust(source_url, img_dir, "original");
                        let images = walk(img_dir);

                        const upper_limit = interaction?.options.getNumber("upper_limit") || 0;
                        const lower_limit = interaction?.options.getNumber("lower_limit") || images.length;

                        images = images.slice(lower_limit, upper_limit);

                        let offset = 0;
                        for (const image of images) {
                            const new_file = await getFile(image, channel);
                            if (new_file) {
                                await processAndSaveImage(fs.createReadStream(image), {
                                    file: new_file
                                }, channel);

                                await sendImgToChannel(channel, new_file.path);

                                let postInfo;
                                const sauce = await findSauce(getLastImgUrl(channel), channel, 85);

                                if (sauce.embed) {
                                    postInfo = sauce.postInfo;
                                } else {
                                    postInfo = await getPostInfoFromUrl(source_url);
                                    if (postInfo) {
                                        postInfo.source_url += postInfo.source_url.includes("?") ? `&` : "?";
                                        postInfo.source_url += `offset=${offset}`;
                                    }
                                }

                                await writePostInfoToFile(postInfo, new_file.path, channel);
                            }
                            fs.unlinkSync(image);
                            offset++;
                        }

                    } else {
                        await safeReply(interaction, "🚫 Can't download from pixiv without token");
                    }
                    return;
                }

                const target_file = await getFile(source_url, channel);
                if (!target_file) {
                    return;
                }

                const postInfo = await getMetadata(channel, source_url, is_plain_image);

                if (postInfo) {
                    https.get(postInfo.image_url, async (response) => {
                        await processAndSaveImage(response, { postInfo: postInfo, file: target_file }, channel);
                        await writePostInfoToFile(postInfo, target_file.path, channel);
                        setLastImg(channel, target_file.path, postInfo.image_url);
                    });
                } else {
                    await sendToChannel(channel, "❌ Don't know how to handle that url", true);
                }
            } else {
                await sendToChannel(channel, `❌ Return code: ${res.status}, ${res.statusText}`, true);
            }
        }

    }
} as ICommand;
