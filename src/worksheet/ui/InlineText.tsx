/** Worksheet text markup: [[...]] is underlined (e.g. "밑줄 친 부분"). Everything else prints as is. */
export default function InlineText({ text }: { readonly text: string }) {
  return text.split(/\[\[(.+?)\]\]/g).map((part, index) => index % 2 ? <u key={index}>{part}</u> : part);
}
