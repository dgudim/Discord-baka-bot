import { ICommand } from "dkrcommands";
import { db } from "..";
import { getImgDir } from "../utils/sauce_utils";
import { ensureTagsInDB } from "../utils/tagging_utils";

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

        await safeReply(interaction, "🗃 Deduping databse...");

        const images = walk(await getImgDir());
        const sourcePostMap = new Map<string, string[]>();
        const phashMap = new Map<string, string[]>();
        for (const image of images) {
            await ensureTagsInDB(image);
            const sourcePost = await getValueIfExists(db, `^${image}^tags^sourcepost`);
            const phash = await getValueIfExists(db, `^${image}^phash`);

            if (sourcePost != "-") {
                setOrAppendToMap(sourcePostMap, sourcePost, image);
            }

            if (phash != "-") {
                let found = false;
                for (const [fingerprint, similar] of phashMap) {
                    if (phash_dist(fingerprint, phash) < 5) {
                        similar.push(phash);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    phashMap.set(phash, [phash]);
                }
            }
        }
    
        
        for (const [source_post, images] of sourcePostMap) {
            if (images.length > 1) {
                await sendToChannel(channel, `${source_post}: ${images}`);
            }
        }

        for (const [source, images] of phashMap) {
            if (images.length > 1) {
                await sendToChannel(channel, `(90% similarity) ${source}: ${images}`);
            }
        }

        await safeReply(interaction, `🟩 Dedupe finished`);
    }
} as ICommand;