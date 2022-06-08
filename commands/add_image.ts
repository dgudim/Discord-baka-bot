import { ICommand } from "wokcommands";
import fs from "fs";
import path from "path";
import https from 'https';
import { changeSavedDirectory, combinedReply, ensureTagsInDB, getFileName, getImgDir, isUrl, sendToChannel, writeTagsToFile } from "../utils";
import { findSauce, getPostInfoFromUrl, grabImageUrl } from "../sauce_utils";
import sharp from "sharp";
import { getSauceConfString } from "../config";

export default {
    category: 'Misc',
    description: 'Download an image, tag it and save it to the database',

    slash: 'both',
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    expectedArgs: '<url> <directory-path>',
    expectedArgsTypes: ['STRING', 'STRING'],
    minArgs: 1,
    maxArgs: 2,

    callback: async ({ message, interaction, channel, args }) => {

        changeSavedDirectory(channel, 'IMAGE', args[1]);

        if (isUrl(args[0])) {
            let input_url = args[0];

            const res = await fetch(input_url);

            if (res.ok) {
                const buff = await res.blob();

                const is_plain_image = buff.type.startsWith('image/');
                const img_url = is_plain_image ? input_url : await grabImageUrl(input_url);

                if (img_url) {
                    let fileName = getFileName(img_url);
                    await combinedReply(interaction, message, `saving as ${fileName}`);
                    if (fs.existsSync(fileName)) {
                        await combinedReply(interaction, message, 'file exists');
                        return;
                    }
                    const file_path = path.join(getImgDir(), fileName);
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
                                postInfo = getPostInfoFromUrl(img_url);
                            }
                            if (!postInfo) {
                                const sauce = await findSauce(img_url, channel, 85);
                                if (sauce && sauce.post.similarity >= 85) {
                                    writeTagsToFile(getSauceConfString(sauce.postInfo), file_path, channel, () => {
                                        sendToChannel(channel, `wrote tags`);
                                        ensureTagsInDB(file_path);
                                    });
                                }
                            }
                        });
                    });
                } else {
                    await combinedReply(interaction, message, 'could not get image url from page');
                }

            } else {
                await combinedReply(interaction, message, 'url does not exist');
            }
        } else {
            await combinedReply(interaction, message, 'invalid url');
        }
    }
} as ICommand