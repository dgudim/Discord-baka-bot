import { ICommand } from "dkrcommands";
import fs from "fs";
import path from "path";
import https from 'https';
import { combinedReply, fetchUrl, getFileName, isImageUrlType, isUrl, sendToChannel } from "discord_bots_common";
import { findSauce, getImgDir, getLastImgUrl, getPostInfoFromUrl, grabImageUrl, sendImgToChannel } from "../sauce_utils";
import sharp from "sharp";
import { getSauceConfString } from "../config";
import { ensureTagsInDB, writeTagsToFile } from "../tagging_utils";

export default {
    category: 'Admin image management',
    description: 'Download an image, tag it and save it to the database',

    slash: 'both',
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    expectedArgs: '<url>',
    expectedArgsTypes: ['STRING'],
    minArgs: 1,
    maxArgs: 1,

    callback: async ({ message, interaction, channel, args }) => {

        await combinedReply(interaction, message, 'adding image to db');

        if (await isUrl(args[0])) {
            let input_url = args[0];

            const res = await fetchUrl(input_url);
            
            if (res.ok) {
                
                const is_plain_image = isImageUrlType(res.type);
                const img_url = is_plain_image ? input_url : await grabImageUrl(input_url);

                if (img_url) {

                    let fileName = getFileName(img_url) + '.jpeg';
                    const file_path = path.join(await getImgDir(), fileName);

                    if (fs.existsSync(file_path)) {
                        await sendToChannel(channel, 'file aleady exists');
                        return;
                    }

                    await sendToChannel(channel, `saving as ${fileName}`);

                    const file = fs.createWriteStream(file_path);

                    https.get(img_url, (response) => {

                        const sharpPipeline = sharp();
                        sharpPipeline.jpeg({
                            quality: 100
                        }).pipe(file);

                        response.pipe(sharpPipeline);

                        file.on('finish', async () => {
                            file.close();
                            sendToChannel(channel, `saved ${fileName}, `);
                            let postInfo;
                            if (!is_plain_image) {
                                postInfo = await getPostInfoFromUrl(input_url);
                            }
                            if (!postInfo) {
                                await sendImgToChannel(channel, file_path);
                                const sauce = await findSauce(getLastImgUrl(channel), channel, 85);
                                if (sauce && sauce.post.similarity >= 85) {
                                    postInfo = sauce.postInfo;
                                }
                            } else if (interaction) {
                                await sendToChannel(channel, img_url);
                            }
                            if (postInfo) {
                                writeTagsToFile(getSauceConfString(postInfo), file_path, channel, () => {
                                    sendToChannel(channel, `wrote tags`);
                                    ensureTagsInDB(file_path);
                                });
                            } else {
                                await sendToChannel(channel, `could not get tags`);
                            }
                        });
                    });
                } else {
                    await sendToChannel(channel, 'could not get image url from page');
                }
            } else {
                await sendToChannel(channel, `return code: ${res.status}, ${res.statusText}`);
            }
        } else {
            await sendToChannel(channel, 'invalid url');
        }
    }
} as ICommand