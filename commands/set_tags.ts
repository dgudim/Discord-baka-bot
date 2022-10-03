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

        if (!getLastImgPath(channel)) {
            return safeReply(interaction, "🚫 No image selected");
        }

        let confString = "";

        for (const interraction_option of interaction!.options.data) {
            const index = image_args.indexOf(interraction_option.name);
            if (index != -1) {
                confString += ` -xmp-xmp:${img_tags[index].xmpName}='${normalize(interraction_option.value?.toString())}'`;
            } else {
                await sendToChannel(channel, `🚫 No such parameter: ${interraction_option.name}`, true);
            }
        }

        if (!interaction!.options.data.length) {
            const lastTagsFrom_get_sauce = getLastTags(channel);
            if (lastTagsFrom_get_sauce && lastTagsFrom_get_sauce.image_url == getLastImgUrl(channel)) {
                confString = getSauceConfString(lastTagsFrom_get_sauce);
            } else {
                return safeReply(interaction, "🚫 No tags provided");
            }
        }

        writeTagsToFile(confString, getLastImgPath(channel), channel, async () => {
            await sendToChannel(channel, await getImageMetatags(getLastImgPath(channel)));
        });

        await safeReply(interaction, "🪧 New tags");
    }
} as ICommand;