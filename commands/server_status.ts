import { MessageEmbed } from 'discord.js';
import util from 'util';
const exec = util.promisify(require('child_process').exec);
import { ICommand } from "wokcommands";

export default {
    category: 'Status',
    description: 'Get minecraft server status',

    slash: true,
    testOnly: true,

    callback: async ({ }) => {

        const embed = new MessageEmbed();
        embed.setTitle("Minecraft server status");
        embed.setDescription("-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-");

        try {
            const { stdout, stderr } = await exec("minecraftd status");

            if (stderr) {
                embed.setColor('RED');
                embed.addField(stderr, 'error while executing');
            } else if (stdout) {
                embed.setColor('GREEN');
                embed.addField(stdout.toString()
                .replace(/[\x00-\x08\x0E-\x1F\x7F-\uFFFF]/g, '')
                .replace("[39;1m", '')
                .replace("[0m", ''), 
                'execution sucessfull');
            } else {
                embed.setColor('YELLOW');
                embed.addField('Command didn\'t return anything', 'huh');
            }
        } catch (err) {
            embed.setColor('RED');
            embed.addField(err + "", 'error while executing');
        }

        return embed;
    }
} as ICommand