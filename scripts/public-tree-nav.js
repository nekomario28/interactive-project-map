"use strict";
(() => {
  const select = document.getElementById("style");
  const query = new URL(location.href).searchParams;
  const dedicated = new Set(["radial","tree","treemap","timeline","cluster","sunburst","matrix","sankey"]);
  const all = new Set(["radial","galaxy","obsidian","tree","treemap","timeline","cluster","sunburst","matrix","sankey"]);
  function currentStyle(){const match=location.pathname.match(/\/(radial|tree|treemap|timeline|cluster|sunburst|matrix|sankey)\/?$/);return match?match[1]:null;}
  function styleUrl(style){const route=dedicated.has(style)?`../${style}/`:"../u/";const url=new URL(route,location.href),username=query.get("username");if(username)url.searchParams.set("username",username);url.searchParams.set("style",style);return url;}
  const requested=query.get("style");
  if(all.has(requested)&&requested!==currentStyle()){location.replace(styleUrl(requested).toString());return;}
  if(select)select.addEventListener("change",(event)=>{const style=select.value;if(style===currentStyle()||!all.has(style))return;event.stopImmediatePropagation();location.assign(styleUrl(style).toString());},true);
})();
