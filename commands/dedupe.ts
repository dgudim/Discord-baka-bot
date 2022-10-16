import { ICommand } from "dkrcommands";
import { db } from "..";
import { getImgDir } from "../utils/sauce_utils";
import { ensureTagsInDB } from "../utils/tagging_utils";

import fs from "fs";

import { safeReply, walk, getValueIfExists, setOrAppendToMap, sendToChannel } from "discord_bots_common/dist/utils/utils";

const phash_dist = require("sharp-phash/distance");

export default {
    category: "Image management",
    description: "Dedupe image database",

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    callback: async ({ channel, interaction }) => {

        await safeReply(interaction, "🗃 Deduping database...");

        const images = walk(await getImgDir());
        const sourcePostMap = new Map<string, string[]>();
        const phashMap = new Map<string, string[]>();

        await Promise.all(images.map(image => {
            return ensureTagsInDB(image);
        }));

        for (const image of images) {
            const sourcePost = await getValueIfExists(db, `^${image}^tags^sourcepost`);
            const phash = await getValueIfExists(db, `^${image}^phash`);

            let isUnique = true;
            if (sourcePost != "-") {
                isUnique = setOrAppendToMap(sourcePostMap, sourcePost, image);
            }

            if (phash != "-" && !isUnique) {
                let found = false;
                for (const [fingerprint, similar] of phashMap) {
                    if (phash_dist(fingerprint, phash) < 5) {
                        similar.push(image);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    phashMap.set(phash, [image]);
                }
            }
        }
    
        let group = 0;
        for (const [source_post, images] of sourcePostMap) {
            if (images.length > 1) {
                await sendToChannel(channel, `(100% similarity) (group ${group}) (${images[0]} left, ${images.length - 1} deleted)`);
                await sendToChannel(channel, source_post);
                for (let i = 1; i < images.length; i++) {
                    fs.unlinkSync(images[i]);
                }
                group ++;
            }
        }

        group = 0;
        for (const [, images] of phashMap) {
            if (images.length > 1) {
                await sendToChannel(channel, `(90% similarity) (group ${group})`);
                for (const image of images) {
                    await sendToChannel(channel, image);
                }
                group ++;
            }
        }

        await safeReply(interaction, `🟩 Dedupe finished`);
    }
} as ICommand;