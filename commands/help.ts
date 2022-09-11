import { EmbedBuilder } from "discord.js";
import { ICommand } from "dkrcommands";
import { prefix } from "..";
import { combinedReply } from "discord_bots_common";

export default {

    category: 'Help',
    description: 'Display help',

    expectedArgs: '<command>',
    expectedArgsTypes: ['STRING'],
    minArgs: 0,
    maxArgs: 1,

    slash: 'both',
    testOnly: true,
    ownerOnly: false,
    hidden: false,

    callback: async ({ interaction, message, args }) => {

        const embed = new EmbedBuilder();

        let title = args[0];

        switch(args[0]) {
            case 'random_img':
                embed.addFields([{
                    name: `${title} command`,
                    value: `Just displays a random image, nothing to add, has no parameters`
                }]);
                break;
            case 'search_img':
                embed.addFields([{
                    name: `${title} command`,
                    value: `search the database for a particular image, has 2 parameters \`<search-query>\` and \`<index>\`
                          \`<index>\` basically specifies image index to go to (i.e. 100 images were found, so max image index is 99)
                          \`<search-query>\` is your search query, the format is as follows:
                          \`<xmp-tag-name>\`\`<comparison-sign>\`\`<value>\`;more statements with the same syntax
                          \`<xmp-tag-name>\` is any tag foung in the image metadata (sourcepost, tags, character, etc...)
                          \`comparison-sign\` is one of the following: = / @= / &= / *= / #= / != / @&= / @*=
                          \`content value - value after spilitting value from the xmp value (tags: test,test2,test3 becomes an array of values [test, test2, test3])\`
                          \`search value - the same as content value, but applies to search term\``
                          
                    }, 
                    {
                        name: "=",
                        value: `
                             \`=\` content must include every search value
                              == == == (tags: tag1, tag2 | search string: tags=tag1,tag2 will match) ✅
                              == == == (tags: tag1, tag2 | search string: tags=tag1,tag3 wont match) ❌`
                    },
                    {
                        name: "@=",
                        value: `
                         \`@=\` any content value must include any search value
                          == == == (tags: tag1, tag2 | search string: tags=tag1,tag3 will match) ✅
                          == == == (tags: tag1, tag2 | search string: tags=tag1,tag2 will match) ✅
                          == == == (tags: tag1, tag2 | search string: tags=tag4,tag5 wont match) ❌`
                    },
                    {
                        name: "&=",
                        value: `
                         \`&=\` every content value must end with one of the search values
                          == == == (tags: tag1, testtag1 | search string: tags=tag1,tag3 will match) ✅
                          == == == (tags: tag1, tag2     | search string: tags=tag1,tag2 will match) ✅
                          == == == (tags: tag1, tag2     | search string: tags=tag1,tag2,tag3 will match) ✅
                          == == == (tags: tag1, tag3     | search string: tags=tag1 wont match) ❌`
                    },
                    {
                        name: "@&=",
                        value: `
                         \`@&=\` any content value must end with one of the search values
                          == == == (tags: tag1, testtag1 | search string: tags=tag1,tag3 will match) ✅
                          == == == (tags: tag1, tag3     | search string: tags=tag1 will match) ✅
                          == == == (tags: tag1, tag3     | search string: tags=tag2 wont match) ❌`
                    },
                    {
                        name: "*=",
                        value: `\`*=\` every content value must start with one of the search values`
                    },
                    {
                        name: "@*=",
                        value: `\`@*=\` any content value must start with one of the search values`
                    },
                    {
                        name: "#=",
                        value: `
                         \`#=\` strict equals
                          == == == (tags: tag1, tag2 | search string: tags=tag1, tag2 will match) ✅
                          == == == (tags: tag1, tag2 | search string: tags=tag1 wont match) ❌`
                    },
                    {
                        name: "!=",
                        value: `
                         \`!=\` no content value can include any one of the search values
                          == == == (tags: tag1, tag2 | search string: tags=tag3, tag4 will match) ✅
                          == == == (tags: tag1, tag2 | search string: tags=tag1, tag3 wont match) ❌`
                    }]);
                break;
            case 'send_file':
                embed.addFields([{
                    name: `${title} command`,
                    value: `Send file(s) to the server, <save path> changes the save directory, if it's empty, the file will be saved to the previous directory`
                }]);
                break;
            case 'get_sauce':
                embed.addFields([{
                    name: `${title} command`,
                    value: `Get sause of an image, the image can be provided by url or by file (use with prefix), 
                            the command will process all provided urls and files. 
                            Has one optional argument <min-similarity> which specifies minimum image similarity to consider it as sauce (0-100)`
                }]);
                break;
            default:
                title = "Sussy Baka's";
                embed.setDescription('(get more info by doing /help <command>)');
                if (args[0]) {
                    embed.setDescription(`${embed.data.description} / unknown command: ${args[0]}`);
                }
                embed.addFields([
                    {
                        name: "Current prefix is",
                        value: prefix
                    },
                    {
                        name: "⚙️ User commands",
                        value:
                            `\`/random_img   \` > Displays a random image from specified directory. (can be executed with prefix)
                             \`/search_img   \` > Searches images by a search query.
                             \`/send_file    \` > Send file to a specified directory on the server. (use with prefix)
                             \`/get_sauce    \` > Get sauce of an image.`
                    },
                    {
                        name: "⚡️ Admin commands",
                        value:
                            `\`/set_tags    \` > Sets tags for the last image displayed by _img commands.
                             \`/add_image   \` > Download an image, tag it and save it to the database. (can be executed with prefix)
                             \`/dedupe      \` > Dedupe image database. (can be executed with prefix)
                             \`/set_img_dir \` > Set image database directory. (can be executed with prefix)
                             \`/auto_tag    \` > Autotag images matching search query.
                             \`/exec        \` > Execute any command on the server.
                             \`/get_file    \` > Get any file from the server < 8Mb.
                             \`/terminal    \` > Toggle terminal mode in this channel (message = command). (can be executed with prefix)`
                    }]);
                break;
        }
        

        embed.setTitle(`${title} help page`);
        embed.setColor('Aqua');

        await combinedReply(interaction, message, embed);
    }
} as ICommand