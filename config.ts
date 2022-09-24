import { messageReply } from "discord_bots_common";
import { Message } from "discord.js";

export const search_modifiers = new Map([
    ["@*=",
        (content: string[], search_term: string[]) => {
            return content.some((content_value) =>
                search_term.some((search_value) => content_value.startsWith(search_value)));
            // any content value must start with one of the search values
        }],
    ["@&=",
        (content: string[], search_term: string[]) => {
            return content.some((content_value) =>
                search_term.some((search_value) => content_value.endsWith(search_value)));
            // any content value must end with one of the search values
        }],
    ["!=",
        (content: string[], search_term: string[]) => {
            return search_term.every((value) => !content.includes(value));
            // no content value can include any one of the search values
        }],
    ["#=",
        (content: string[], search_term: string[]) => {
            return search_term.every((value) =>
                content.some((content_value) => content_value == value));
            // strict equals of every search value and any content_value
        }],
    ["*=",
        (content: string[], search_term: string[]) => {
            return content.every((content_value) =>
                search_term.some((search_value) => content_value.startsWith(search_value)));
            // every content value must start with one of the search values
        }],
    ["&=",
        (content: string[], search_term: string[]) => {
            return content.every((content_value) =>
                search_term.some((search_value) => content_value.endsWith(search_value)));
            // every content value must end with one of the search values
        }],
    ["@=",
        (content: string[], search_term: string[]) => {
            return search_term.some((value) =>
                content.some((content_value) => content_value.includes(value)));
            // any content value must include any search value
        }],
    ["=",
        (content: string[], search_term: string[]) => {
            return search_term.every((value) =>
                content.some((content_value) => content_value.includes(value)));
            // content must include every search value
        }]
]);

export const messageReplies = new Map([ // put your message replies here
    ["ping", (message: Message) => { messageReply(message, 'pong'); }],
    ["windows", (message: Message) => { messageReply(message, '🐧 Linux 🐧'); }],
    ["pain and suffering", (message: Message) => { messageReply(message, 'main() and buffering'); }],
    ["понял", (message: Message) => { messageReply(message, 'не поняла'); }],
    ["amogus", (message: Message) => { messageReply(message, 'sus'); }]
]);

export const sourcePrecedence = ['danbooru', 'gelbooru', 'sankakucomplex', 'konachan', 'yande.re']