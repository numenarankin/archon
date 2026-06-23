import { Node, mergeAttributes } from "@tiptap/core";

/**
 * An inline citation to another document — a "bridge". Rendered as a clickable
 * chip ("@Name") for inline cites, or a superscript marker for footnotes. The
 * data attributes are what `syncBridgesFromContent` reads back out of the saved
 * HTML to persist the bridge rows, so they must round-trip through parse/render.
 */
export interface BridgeMentionAttrs {
  fileId: string;
  label: string;
  kind: "cite" | "footnote";
  anchor: string;
  note?: string | null;
}

export const BridgeMention = Node.create({
  name: "bridgeMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      fileId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-bridge"),
        renderHTML: (attrs) =>
          attrs.fileId ? { "data-bridge": attrs.fileId } : {},
      },
      kind: {
        default: "cite",
        parseHTML: (el) => el.getAttribute("data-bridge-kind") || "cite",
        renderHTML: (attrs) => ({ "data-bridge-kind": attrs.kind }),
      },
      anchor: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-bridge-anchor"),
        renderHTML: (attrs) =>
          attrs.anchor ? { "data-bridge-anchor": attrs.anchor } : {},
      },
      label: {
        default: "",
        parseHTML: (el) =>
          el.getAttribute("data-bridge-label") ||
          el.textContent?.replace(/^@/, "") ||
          "",
        renderHTML: (attrs) => ({ "data-bridge-label": attrs.label }),
      },
      note: {
        default: null,
        parseHTML: (el) => {
          const raw = el.getAttribute("data-bridge-note");
          return raw ? decodeURIComponent(raw) : null;
        },
        renderHTML: (attrs) =>
          attrs.note ? { "data-bridge-note": encodeURIComponent(attrs.note) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-bridge]" }, { tag: "sup[data-bridge]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const isFootnote = node.attrs.kind === "footnote";
    const label = node.attrs.label || "document";
    if (isFootnote) {
      return [
        "sup",
        mergeAttributes(HTMLAttributes, {
          class: "kb-bridge kb-bridge-footnote",
          title: `Footnote: ${label}`,
        }),
        "[ref]",
      ];
    }
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        class: "kb-bridge",
        href: "#",
        title: `Cited document: ${label}`,
      }),
      `@${label}`,
    ];
  },

  renderText({ node }) {
    const label = node.attrs.label || "document";
    return node.attrs.kind === "footnote" ? ` [${label}]` : `@${label}`;
  },
});
