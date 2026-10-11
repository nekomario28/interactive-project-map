// Bounds for the controlled circle/ellipse/rect/line/text markup emitted by the
// Galaxy renderers. Animated translations replace the base transform; their
// keyframe extrema bound every linearly interpolated position, including
// nested category and repository motion.
function union(a, b) {
  if (!a) return b;
  if (!b) return a;
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/gu)].map((m) => [m[1], m[2]]));
}
function numbers(value = "") { return value.trim().split(/[\s,]+/u).map(Number); }
function translate(box, x, y) { return [box[0] + x, box[1] + y, box[2] + x, box[3] + y]; }
function rotate(box, angle, cx = 0, cy = 0) {
  const cos = Math.cos(angle * Math.PI / 180), sin = Math.sin(angle * Math.PI / 180);
  const points = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]]
    .map(([x, y]) => [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos]);
  return [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1])), Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))];
}
function transformed(box, node) {
  if (!box) return box;
  if (node.motion?.type === "translate") {
    const positions = node.motion.values.split(";").map(numbers);
    return positions.reduce((result, [x, y = 0]) => union(result, translate(box, x, y)), null);
  }
  if (node.motion?.type === "rotate") {
    const [, cx = 0, cy = 0] = numbers(node.motion.from);
    const radius = Math.max(...[[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
    return [cx - radius, cy - radius, cx + radius, cy + radius];
  }
  const transforms = [...(node.attrs.transform || "").matchAll(/(translate|rotate)\(([^)]+)\)/gu)];
  for (const [, type, args] of transforms.reverse()) {
    const values = numbers(args);
    box = type === "translate" ? translate(box, values[0], values[1] || 0) : rotate(box, ...values);
  }
  return box;
}
function primitive(node) {
  const a = node.attrs, x = Number(a.cx ?? a.x ?? 0), y = Number(a.cy ?? a.y ?? 0);
  const stroke = Number(a["stroke-width"] || 0) / 2 + 2;
  let box;
  if (node.name === "circle" || node.name === "ellipse") {
    const rx = Number(a.r ?? a.rx), ry = Number(a.r ?? a.ry);
    box = [x - rx, y - ry, x + rx, y + ry];
  } else if (node.name === "rect") {
    box = [x, y, x + Number(a.width), y + Number(a.height)];
  } else if (node.name === "line") {
    box = [Math.min(Number(a.x1), Number(a.x2)), Math.min(Number(a.y1), Number(a.y2)), Math.max(Number(a.x1), Number(a.x2)), Math.max(Number(a.y1), Number(a.y2))];
  } else if (node.name === "text") {
    const size = Number(a["font-size"] || 16);
    // A deliberately conservative one-em advance per character, rather than
    // pretending to measure the consumer's platform-dependent system font.
    const count = [...node.text.replace(/&(?:amp|lt|gt|quot|#39);/gu, "_")].length;
    const width = count * size;
    const left = x - (a["text-anchor"] === "middle" ? width / 2 : a["text-anchor"] === "end" ? width : 0);
    box = [left, y - size * 1.2, left + width, y + size * 0.4];
  }
  return box ? [box[0] - stroke, box[1] - stroke, box[2] + stroke, box[3] + stroke] : null;
}

export function galaxyGraphBounds(markup) {
  const stack = [{ name: "root", attrs: {}, box: null, text: "" }];
  const finish = () => {
    const node = stack.pop();
    const box = transformed(union(node.box, primitive(node)), node);
    stack.at(-1).box = union(stack.at(-1).box, box);
  };
  for (const token of markup.match(/<[^>]+>|[^<]+/gu) || []) {
    if (!token.startsWith("<")) { stack.at(-1).text += token; continue; }
    if (token.startsWith("</")) { finish(); continue; }
    const name = token.match(/^<([\w]+)/u)?.[1];
    const attrs = attributes(token);
    if (name === "animateTransform") { stack.at(-1).motion = attrs; continue; }
    stack.push({ name, attrs, box: null, text: "" });
    if (token.endsWith("/>")) finish();
  }
  return stack[0].box;
}

export function galaxyFrame(markup, width, layoutHeight, { height = layoutHeight, padding = 24 } = {}) {
  const bounds = galaxyGraphBounds(markup);
  if (!bounds) return { height: layoutHeight, markup };
  const sourceWidth = Math.max(1, bounds[2] - bounds[0]), sourceHeight = Math.max(1, bounds[3] - bounds[1]);
  const legendHeight = 26;
  const widthScale = Math.min(1, Math.max(1, width - padding * 2) / sourceWidth);
  const frameHeight = height === "auto" ? Math.max(260, Math.ceil(sourceHeight * widthScale + padding * 2 + legendHeight)) : height;
  const availableHeight = Math.max(1, frameHeight - padding * 2 - legendHeight);
  const scale = Math.min(widthScale, availableHeight / sourceHeight);
  const tx = width / 2 - (bounds[0] + bounds[2]) / 2 * scale;
  const ty = padding + availableHeight / 2 - (bounds[1] + bounds[3]) / 2 * scale;
  return { height: frameHeight, markup: `<g data-galaxy-fit="true" transform="translate(${tx.toFixed(4)} ${ty.toFixed(4)}) scale(${scale.toFixed(6)})">${markup}</g>` };
}
