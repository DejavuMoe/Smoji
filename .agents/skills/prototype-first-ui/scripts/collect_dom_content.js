/*
 * Prototype-First UI DOM content collector
 *
 * Read-only helper for browser DevTools, Playwright, WebDriver, or any agent
 * capable of evaluating JavaScript in the rendered page. It captures UI-facing
 * strings and their channels so content_audit.py can build a review inventory.
 *
 * Usage in a browser console:
 *   const report = window.__prototypeFirstUICollectDOMContent();
 *   copy(JSON.stringify(report, null, 2));
 *
 * Optional local redaction before returning the report:
 *   window.__prototypeFirstUICollectDOMContent({
 *     redactPatterns: ["customer-[0-9]+", "[^@\\s]+@example\\.com"]
 *   });
 *
 * Injecting this file exposes one function and stores the most recent local
 * report on window. It performs no network requests and does not read ordinary
 * form-control values.
 */
(function installPrototypeFirstUICollector(globalObject) {
  "use strict";

  const VERSION = 1;
  const MAX_STRING_LENGTH = 4000;
  const MAX_JSON_STRINGS = 5000;
  const MAX_REDACTION_PATTERNS = 50;
  const UI_ATTRIBUTES = [
    "aria-label",
    "aria-description",
    "aria-placeholder",
    "aria-roledescription",
    "aria-valuetext",
    "placeholder",
    "title",
    "alt",
    "label",
    "summary",
  ];
  const ARIA_REFERENCE_ATTRIBUTES = [
    "aria-labelledby",
    "aria-describedby",
    "aria-errormessage",
  ];
  const TEXT_META_KEYS = new Set([
    "description",
    "application-name",
    "apple-mobile-web-app-title",
    "og:title",
    "og:description",
    "og:site_name",
    "twitter:title",
    "twitter:description",
  ]);
  const SENSITIVE_KEY = /(?:password|passwd|secret|token|credential|authorization|cookie|session|private[-_]?key|access[-_]?key|api[-_]?key|client[-_]?secret|refresh[-_]?token|email|e-mail|phone|telephone|street[-_]?address|postal[-_]?address|passport|social[-_]?security|ssn|credit[-_]?card|card[-_]?number)/i;
  const SKIP_TEXT_PARENTS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);

  function normalizeText(value) {
    return String(value == null ? "" : value)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function truncate(value) {
    const normalized = normalizeText(value);
    if (normalized.length <= MAX_STRING_LENGTH) return normalized;
    return normalized.slice(0, MAX_STRING_LENGTH) + " …[truncated]";
  }

  function stableHash(value) {
    let hash = 0x811c9dc5;
    const text = String(value);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function escapePart(value) {
    if (globalObject.CSS && typeof globalObject.CSS.escape === "function") {
      return globalObject.CSS.escape(value);
    }
    return String(value).replace(/[^a-zA-Z0-9_-]/g, function replaceUnsafe(character) {
      return "\\" + character.codePointAt(0).toString(16) + " ";
    });
  }

  function elementPath(element) {
    if (!element || element.nodeType !== 1) return "unknown";
    const parts = [];
    let current = element;
    while (current && current.nodeType === 1 && parts.length < 10) {
      let part = current.localName || current.tagName.toLowerCase();
      if (current.id) {
        part += "#" + escapePart(current.id);
        parts.unshift(part);
        break;
      }
      const stableId = current.getAttribute("data-screen-id") || current.getAttribute("data-component-id");
      if (stableId) {
        part += "[data-" + (current.hasAttribute("data-screen-id") ? "screen" : "component") + "-id=\"" +
          String(stableId).replace(/"/g, "\\\"") + "\"]";
      } else if (current.classList && current.classList.length > 0) {
        part += "." + Array.from(current.classList).slice(0, 2).map(escapePart).join(".");
      }
      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children).filter(function sameTag(sibling) {
          return sibling.localName === current.localName;
        });
        if (siblings.length > 1) {
          part += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
        }
      }
      parts.unshift(part);
      current = current.parentElement;
    }
    return parts.join(" > ");
  }

  function viewFor(element) {
    return element && element.ownerDocument && element.ownerDocument.defaultView
      ? element.ownerDocument.defaultView
      : globalObject;
  }

  function computedStyle(element, pseudo) {
    const view = viewFor(element);
    if (!view || typeof view.getComputedStyle !== "function") return null;
    try {
      return view.getComputedStyle(element, pseudo || null);
    } catch (error) {
      return null;
    }
  }

  function visibilityOf(element) {
    if (!element || element.nodeType !== 1) return "unknown";
    if (element.hidden || element.closest("[hidden]")) return "hidden";
    if (element.closest('[aria-hidden="true"]')) return "accessibility-hidden";
    const style = computedStyle(element);
    if (style) {
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
        return "hidden";
      }
      if (Number(style.opacity) === 0) return "visually-hidden";
    }
    const rect = typeof element.getBoundingClientRect === "function" ? element.getBoundingClientRect() : null;
    if (rect && rect.width === 0 && rect.height === 0) return "visually-hidden";
    return "visible";
  }

  function sensitiveAttribute(name) {
    return SENSITIVE_KEY.test(String(name));
  }

  function parsePseudoContent(raw) {
    if (!raw || raw === "none" || raw === "normal" || /^url\(/i.test(raw)) return "";
    let value = raw;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\\A/gi, " ").replace(/\\(["'\\])/g, "$1");
    return normalizeText(value);
  }

  function safePageUrl(value) {
    try {
      const parsed = new globalObject.URL(String(value));
      parsed.username = "";
      parsed.password = "";
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    } catch (error) {
      return null;
    }
  }

  function compileRedactors(rawPatterns, limitations) {
    if (!Array.isArray(rawPatterns)) return [];
    const redactors = [];
    rawPatterns.slice(0, MAX_REDACTION_PATTERNS).forEach(function compile(raw, index) {
      if (typeof raw !== "string" || !raw || raw.length > 500) {
        limitations.push("Ignored invalid redaction pattern at index " + index + ".");
        return;
      }
      try {
        redactors.push(new RegExp(raw, "giu"));
      } catch (error) {
        limitations.push("Ignored invalid redaction regular expression at index " + index + ".");
      }
    });
    if (rawPatterns.length > MAX_REDACTION_PATTERNS) {
      limitations.push("Only the first " + MAX_REDACTION_PATTERNS + " redaction patterns were used.");
    }
    return redactors;
  }

  function redactText(value, redactors) {
    let text = normalizeText(value);
    let redacted = false;
    redactors.forEach(function apply(pattern) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        pattern.lastIndex = 0;
        text = text.replace(pattern, "[redacted]");
        redacted = true;
      }
    });
    return { text: truncate(text), redacted: redacted };
  }

  function collectJsonStrings(value, path, out, state) {
    if (state.count >= MAX_JSON_STRINGS) return;
    if (typeof value === "string") {
      if (!SENSITIVE_KEY.test(path)) {
        const text = truncate(value);
        if (text) {
          out.push({ path: path || "$", text: text });
          state.count += 1;
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(function visitArray(item, index) {
        collectJsonStrings(item, path + "[" + index + "]", out, state);
      });
      return;
    }
    if (value && typeof value === "object") {
      Object.keys(value).forEach(function visitObject(key) {
        if (!SENSITIVE_KEY.test(key)) {
          collectJsonStrings(value[key], path ? path + "." + key : key, out, state);
        }
      });
    }
  }

  function collect(options) {
    if (!globalObject.document || !globalObject.document.documentElement) {
      throw new Error("The DOM content collector must run in a browser document.");
    }
    const settings = Object.assign(
      {
        includeComments: true,
        includeDataAttributes: true,
        includePseudoContent: true,
        includeClientJson: true,
        includeMetaContent: true,
        includeSameOriginFrames: true,
        redactPatterns: [],
      },
      options || {}
    );
    const items = [];
    const limitations = [
      "Closed shadow roots cannot be inspected.",
      "Canvas/WebGL text, cross-origin frame content, native browser chrome, and OS-native dialogs are not captured.",
      "Ordinary input values and sensitive-looking attributes/JSON keys are deliberately omitted.",
      "Only the currently rendered state is captured; exercise other states separately.",
      "Use sanitized test data: arbitrary text nodes or data attributes can still contain private product data.",
    ];
    const redactors = compileRedactors(settings.redactPatterns, limitations);
    const visitedRoots = new Set();

    function addItem(kind, rawText, element, details, contextPrefix) {
      const sanitized = redactText(rawText, redactors);
      if (!sanitized.text) return;
      const location = (contextPrefix || "") + elementPath(element);
      const channel = details && details.channel ? details.channel : kind;
      const key = [kind, channel, location, sanitized.text].join("\u241f");
      items.push({
        id: "dom-" + stableHash(key),
        text: sanitized.text,
        kind: kind,
        channel: channel,
        location: location,
        visibility: visibilityOf(element),
        attribute: details && details.attribute ? details.attribute : null,
        reference: details && details.reference ? details.reference : null,
        jsonPath: details && details.jsonPath ? details.jsonPath : null,
        redacted: sanitized.redacted,
      });
    }

    function collectElement(element, contextPrefix) {
      UI_ATTRIBUTES.forEach(function readAttribute(attribute) {
        if (element.hasAttribute(attribute) && !sensitiveAttribute(attribute)) {
          addItem("attribute", element.getAttribute(attribute), element, {
            channel: attribute,
            attribute: attribute,
          }, contextPrefix);
        }
      });

      const inputType = (element.getAttribute("type") || "").toLowerCase();
      if (element.tagName === "INPUT" && ["button", "submit", "reset"].includes(inputType)) {
        addItem("attribute", element.getAttribute("value"), element, {
          channel: "control-value",
          attribute: "value",
        }, contextPrefix);
      }

      ARIA_REFERENCE_ATTRIBUTES.forEach(function readReference(attribute) {
        const ids = normalizeText(element.getAttribute(attribute)).split(" ").filter(Boolean);
        ids.forEach(function resolveReference(id) {
          const target = element.ownerDocument && element.ownerDocument.getElementById(id);
          if (target) {
            addItem("accessible-reference", target.textContent, element, {
              channel: attribute,
              attribute: attribute,
              reference: id,
            }, contextPrefix);
          }
        });
      });

      if (settings.includeMetaContent && element.tagName === "META") {
        const key = normalizeText(element.getAttribute("name") || element.getAttribute("property") || element.getAttribute("itemprop")).toLowerCase();
        if (TEXT_META_KEYS.has(key) && !sensitiveAttribute(key)) {
          addItem("meta-content", element.getAttribute("content"), element, {
            channel: "meta:" + key,
            attribute: "content",
          }, contextPrefix);
        }
      }

      if (settings.includeDataAttributes && element.attributes) {
        Array.from(element.attributes).forEach(function readDataAttribute(attribute) {
          if (!attribute.name.startsWith("data-") || sensitiveAttribute(attribute.name)) return;
          addItem("data-attribute", attribute.value, element, {
            channel: "data-*",
            attribute: attribute.name,
          }, contextPrefix);
        });
      }

      if (settings.includePseudoContent) {
        ["::before", "::after"].forEach(function readPseudo(pseudo) {
          const style = computedStyle(element, pseudo);
          const content = parsePseudoContent(style && style.content);
          if (content) {
            addItem("pseudo-content", content, element, { channel: pseudo }, contextPrefix);
          }
        });
      }

      if (settings.includeClientJson && element.tagName === "SCRIPT") {
        const type = (element.getAttribute("type") || "").toLowerCase();
        if (type === "application/json" || type === "application/ld+json") {
          try {
            const parsed = JSON.parse(element.textContent || "null");
            const strings = [];
            collectJsonStrings(parsed, "$", strings, { count: 0 });
            strings.forEach(function addJsonString(entry) {
              addItem("client-json", entry.text, element, {
                channel: type,
                jsonPath: entry.path,
              }, contextPrefix);
            });
          } catch (error) {
            limitations.push("Invalid client JSON was skipped at " + (contextPrefix || "") + elementPath(element) + ".");
          }
        }
      }

      if (element.shadowRoot && element.shadowRoot.mode === "open") {
        walkRoot(element.shadowRoot, (contextPrefix || "") + elementPath(element) + " ::shadow >> ");
      }

      if (settings.includeSameOriginFrames && element.tagName === "IFRAME") {
        try {
          const frameDocument = element.contentDocument;
          if (frameDocument && frameDocument.documentElement) {
            walkRoot(frameDocument.documentElement, (contextPrefix || "") + elementPath(element) + " ::frame >> ");
          }
        } catch (error) {
          limitations.push("An inaccessible iframe was skipped at " + (contextPrefix || "") + elementPath(element) + ".");
        }
      }
    }

    function walkRoot(root, contextPrefix) {
      if (!root || visitedRoots.has(root)) return;
      visitedRoots.add(root);
      const ownerDocument = root.ownerDocument || root;
      const ownerView = ownerDocument.defaultView || globalObject;
      const NodeFilterObject = ownerView.NodeFilter || globalObject.NodeFilter;
      const walker = ownerDocument.createTreeWalker(
        root,
        NodeFilterObject.SHOW_ELEMENT | NodeFilterObject.SHOW_TEXT | NodeFilterObject.SHOW_COMMENT
      );
      let node = walker.currentNode;
      while (node) {
        if (node.nodeType === 1) {
          collectElement(node, contextPrefix || "");
        } else if (node.nodeType === 3) {
          const parent = node.parentElement;
          if (parent && !SKIP_TEXT_PARENTS.has(parent.tagName)) {
            addItem("text", node.nodeValue, parent, { channel: "text" }, contextPrefix || "");
          }
        } else if (node.nodeType === 8 && settings.includeComments) {
          const host = node.parentElement || (root.host || ownerDocument.documentElement);
          addItem("comment", node.nodeValue, host, { channel: "html-comment" }, contextPrefix || "");
        }
        node = walker.nextNode();
      }
    }

    walkRoot(globalObject.document.documentElement, "");

    const report = {
      schemaVersion: VERSION,
      generator: "prototype-first-ui/collect_dom_content.js",
      capturedAt: new Date().toISOString(),
      page: {
        url: globalObject.location ? safePageUrl(globalObject.location.href) : null,
        title: globalObject.document ? String(globalObject.document.title || "") : "",
        language: globalObject.document && globalObject.document.documentElement
          ? globalObject.document.documentElement.lang || null
          : null,
        viewport: {
          width: Number(globalObject.innerWidth || 0),
          height: Number(globalObject.innerHeight || 0),
          devicePixelRatio: Number(globalObject.devicePixelRatio || 1),
        },
      },
      options: Object.assign({}, settings, { redactPatterns: settings.redactPatterns.length }),
      items: items,
      limitations: Array.from(new Set(limitations)),
    };
    globalObject.__prototypeFirstUIContentCapture = report;
    return report;
  }

  globalObject.__prototypeFirstUICollectDOMContent = collect;
})(typeof window !== "undefined" ? window : globalThis);
