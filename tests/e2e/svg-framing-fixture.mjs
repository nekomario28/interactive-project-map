import { mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { renderGalaxyClassicSvg } from "../../scripts/galaxy-svg-classic.mjs";
import { renderGalaxySystemsSvg } from "../../scripts/galaxy-svg-systems.mjs";
import { renderGalaxyHybridSvg } from "../../scripts/galaxy-svg-hybrid.mjs";
import { finalizeSvgForTheme } from "../../scripts/finalize-svg.mjs";

function graph(repositoryCount = 19) {
  const nodes = [{ id: "owner:example", type: "owner", label: "example" }];
  for (let i = 0; i < 7; i += 1) nodes.push({ id: `group:g${i}`, type: "group", label: i === 0 ? "Robotics & Automation" : `Category ${i}` });
  for (let i = 0; i < repositoryCount; i += 1) {
    nodes.push({ id: `repository:repo${i}`, type: "repository", label: i % 3 === 0 ? "WWWWWWWWWWWWWWWWWWWWWWWWWWW" : i % 3 === 1 ? "日本語のリポジトリと可視化の長い名前" : `project-${i}`, stars: i % 4, archived: i % 7 === 0, ...(i < 2 ? { relation: "contributed" } : { groupId: `g${i % 7}` }) });
  }
  return { owner: "example", repositoryCount, nodes, edges: [] };
}

export function framingTests() {
  for (const [style, render] of [["classic", renderGalaxyClassicSvg], ["systems", renderGalaxySystemsSvg], ["hybrid", renderGalaxyHybridSvg]]) {
    for (const theme of ["dark", "light"]) {
      test(`${style} ${theme}: complete motion fits auto, fixed and dense frames`, async ({ page }, testInfo) => {
        await mkdir(".tmp/playwright-visual/svg-framing", { recursive: true });
        for (const [variant, width, height, padding, count] of [["auto", 740, "auto", 24, 19], ["fixed", 420, 260, 32, 19], ["dense", 740, "auto", 24, 81]]) {
          const svg = finalizeSvgForTheme(render(graph(count), theme, width, height === "auto" ? 420 : height, { height, padding }), theme);
          await page.setContent(`<style>body{margin:0}svg{display:block;max-width:100%;height:auto}</style>${svg}`);
          for (const seconds of [0, 113, 450, 900, 1350, 1800, 2400]) {
            const violations = await page.evaluate(({ seconds, padding }) => {
              const svg = document.querySelector("svg");
              svg.pauseAnimations();
              svg.setCurrentTime(seconds);
              const root = svg.getBoundingClientRect();
              const ratio = root.width / svg.viewBox.baseVal.width;
              return [...svg.querySelectorAll('[data-galaxy-fit] circle,[data-galaxy-fit] ellipse,[data-galaxy-fit] line,[data-galaxy-fit] text')].flatMap((element) => {
                const r = element.getBoundingClientRect();
                return r.left < root.left + padding * ratio - 0.5 || r.right > root.right - padding * ratio + 0.5 || r.top < root.top + padding * ratio - 0.5 || r.bottom > root.bottom - (padding + 26) * ratio + 0.5 ? [element.outerHTML.slice(0, 180)] : [];
              });
            }, { seconds, padding });
            expect(violations, `${variant}, t=${seconds}`).toEqual([]);
          }
          expect(await page.locator('[data-galaxy-fit="true"]').count()).toBe(1);
          expect(await page.locator('[data-galaxy-orbit="contributed"]').count()).toBe(2);
          await page.locator("svg").screenshot({ path: `.tmp/playwright-visual/svg-framing/${testInfo.project.name}-${style}-${theme}-${variant}.png` });
        }
      });
    }
  }
}
