"use strict";
const dedicatedNavSelect=document.getElementById("style");
const dedicatedNavQuery=new URL(location.href).searchParams;
const DEDICATED_STYLES=new Set(["radial","tree","treemap","timeline","cluster","sunburst"]);
function currentDedicatedStyle(){const match=location.pathname.match(/\/(radial|tree|treemap|timeline|cluster|sunburst)\/?$/);return match?match[1]:null;}
function styleUrl(style){const route=DEDICATED_STYLES.has(style)?`../${style}/`:"../u/";const url=new URL(route,location.href),username=dedicatedNavQuery.get("username");if(username)url.searchParams.set("username",username);url.searchParams.set("style",style);return url;}
if(dedicatedNavSelect)dedicatedNavSelect.addEventListener("change",(event)=>{const style=dedicatedNavSelect.value;if(style===currentDedicatedStyle())return;if(!["radial","galaxy","obsidian","tree","treemap","timeline","cluster","sunburst"].includes(style))return;event.stopImmediatePropagation();location.assign(styleUrl(style).toString());},true);
