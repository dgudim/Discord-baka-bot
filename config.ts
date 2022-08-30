import { PostInfo, TagContainer } from "./sauce_utils";
import { normalizeTags, stripUrlScheme } from "./utils";

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
            return content.join() == search_term.join();
            // strict equals
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

function checkTag(tag_name: string, tag_content: string): string {
    return tag_content != '-' ? ` -xmp-xmp:${tag_name}='${normalizeTags(tag_content)}'` : '';
}

export function getSauceConfString(lastTagsFrom_get_sauce: TagContainer | PostInfo) {
    if ('postInfo' in lastTagsFrom_get_sauce) {
        lastTagsFrom_get_sauce = lastTagsFrom_get_sauce.postInfo;
    }
    return checkTag('character', lastTagsFrom_get_sauce.character) +
        checkTag('author', lastTagsFrom_get_sauce.author) +
        checkTag('copyright', lastTagsFrom_get_sauce.copyright) +
        checkTag('tags', lastTagsFrom_get_sauce.tags) +
        ` -xmp-xmp:sourcepost='${stripUrlScheme(lastTagsFrom_get_sauce.url)}'`;
}

export const sourcePrecedence = ['danbooru', 'gelbooru', 'sankakucomplex', 'konachan', 'yande.re']