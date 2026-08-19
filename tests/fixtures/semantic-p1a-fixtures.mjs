function repo(id, name, language, description = null, overrides = {}) {
  return {
    id,
    name,
    html_url: `https://github.com/nekomario28/${name}`,
    description,
    language,
    topics: [],
    stargazers_count: 0,
    forks_count: 0,
    fork: false,
    archived: false,
    updated_at: "2026-08-19T00:00:00Z",
    ...overrides,
  };
}

export const semanticP1AFixtures = [
  {
    id: "lime_tidyup",
    repo: repo(
      1,
      "lime_tidyup",
      "Python",
      "LimeSimulDemoのfork. 音声認識から行き先を指定、画像認識からルービックキューブの角度を取得、掴む。",
      { fork: true },
    ),
    readme: `# Lime tidyup\n\nTurtleBot3 robot workflow with Jetson GPU, Gazebo simulation, Behavior Tree navigation, Nav2 and MoveIt2 manipulation. Camera analysis is used for perception.`,
    beforeGroupId: "lang-python",
    afterGroupId: "robotics",
  },
  {
    id: "FTBPublicClaims",
    repo: repo(2, "FTBPublicClaims", "Java"),
    readme: `# FTB Public Claims\n\nMinecraft Forge 1.20.1 addon for FTB Chunks public claim management and FTB Teams integration.`,
    beforeGroupId: "lang-java",
    afterGroupId: "minecraft",
  },
  {
    id: "BuyClaimChunks",
    repo: repo(3, "BuyClaimChunks", "Java"),
    readme: `# BuyClaimChunks Continued\n\nMinecraft 1.21.1 server-side economy addon using NeoForge 21.1 and FTB Chunks.`,
    beforeGroupId: "lang-java",
    afterGroupId: "minecraft",
  },
  {
    id: "turing-smart-screen-python-owl",
    repo: repo(
      4,
      "turing-smart-screen-python-owl",
      "Rich Text Format",
      "Unofficial Python system monitor and library for small IPS USB-C displays",
      { fork: true },
    ),
    readme: `# OWL CPU cooler display fork\n\nPython 3 system monitoring for small IPS USB-C displays over a USB serial protocol, including Raspberry Pi support.`,
    beforeGroupId: "lang-rich-u20-text-u20-format",
    afterGroupId: "hardware",
  },
];

export const unicodeNormalizationFixture = {
  input: "Ｌｉｍｅ：音声認識から行き先を指定、画像認識で掴む。Ｃ＋＋／Ｃ＃／ＲＯＳ２",
  expected: "lime 音声認識から行き先を指定 画像認識で掴む c++ c# ros2",
};
