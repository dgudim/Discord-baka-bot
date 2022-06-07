import { ICommand } from "wokcommands";
import { db, getImgDir } from "..";
import fs from "fs";
import { changeSavedDirectory, safeReply, sendToChannel, walk } from "../utils";

export default {
    category: 'Misc',
    description: 'Dedupe image database',

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    expectedArgs: '<directory path>',
    expectedArgsTypes: ['STRING'],
    minArgs: 0,
    maxArgs: 1,

    callback: async ({ channel, interaction, args }) => {
        await safeReply(interaction, "Deduping databse...");

        changeSavedDirectory(channel, 'save', args[0], 'send_file_dir');

        let images = walk(getImgDir());
        let hashMap = new Map<string, string>();
        let deleted = 0;
        for (let i = 0; i < images.length; i++) {
            let sourcePost;
            if (db.exists(`^${images[i]}^tags^sourcepost`)) {
                sourcePost = db.getData(`^${images[i]}^tags^sourcepost`);
                if (sourcePost != '-' && hashMap.has(sourcePost)) {
                    try {
                        fs.unlinkSync(images[i]);
                        deleted++;
                        sendToChannel(channel, `deleted ${images[i]}`);
                    } catch (err) {
                        sendToChannel(channel, `error deleting ${images[i]}`);
                    }
                } else {
                    hashMap.set(sourcePost, images[i]);
                }
            }
        }
        await safeReply(interaction, `Dedupe finished, ${deleted} images deleted`);
    }
} as ICommand