import { ICommand } from "dkrcommands";
import { normalize, safeReply, sendToChannel } from "discord_bots_common";
import img_tags from "../image_tags.json";
import { getLastImgPath, getLastImgUrl, getSauceConfString } from "../sauce_utils";
import { getImageMetatags, getLastTags, writeTagsToFile } from "../tagging_utils";
import { image_args, image_args_command_options } from "..";

export default {
    category: "Admin image management",
    description: "Set last image (random_img) metatags",

    slash: true,
    testOnly: true,
    ownerOnly: true,
    hidden: true,

    options: image_args_command_options,

    callback: async ({ channel, interaction }) => {

        const interraction_nn = interaction!;

        if (!getLastImgPath(channel)) {
            await safeReply(interraction_nn, "🚫 No image selected");
            return;
        }

        let confString = "";

        for (const interraction_option of interraction_nn.options.data) {
            const index = image_args.indexOf(interraction_option.name);
            if (index != -1) {
                confString += ` -xmp-xmp:${img_tags[index].xmpName}='${normalize(interraction_option.value?.toString())}'`;
            } else {
                await sendToChannel(channel, `🚫 No such parameter: ${interraction_option.name}`, true);
            }
        }

        if (!interraction_nn.options.data.length) {
            const lastTagsFrom_get_sauce = getLastTags(channel);
            if (lastTagsFrom_get_sauce.file == getLastImgUrl(channel)) {
                confString = getSauceConfString(lastTagsFrom_get_sauce);
            } else {
                await safeReply(interraction_nn, "🚫 No tags provided");
                return;
            }
        }

        writeTagsToFile(confString, getLastImgPath(channel), channel, async () => {
            await sendToChannel(channel, await getImageMetatags(getLastImgPath(channel)));
        });

        await safeReply(interraction_nn, "🪧 New tags");
    }
} as ICommand;