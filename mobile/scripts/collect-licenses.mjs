// 앱에 들어가는 오픈소스의 라이선스 고지문을 모아 src/legal/licenses.json을 만든다.
// JS는 출시 번들 소스맵에 실제로 들어간 패키지만, 네이티브는 Podfile.lock의 로컬 경로(node_modules)에서 찾는다.
// React Native가 미리 빌드해 넣는 C++ 라이브러리와 Hermes는 scripts/native-licenses에 둔 고지문을 쓴다.
//
// 사용:
//   npx expo export --platform ios --source-maps --output-dir <폴더>
//   node scripts/collect-licenses.mjs <폴더>/_expo/static/js/ios/<번들>.hbc.map
// 패키지를 더하거나 판을 올리면 다시 만든다.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mapPath = process.argv[2];
if (!mapPath) {
  console.error("소스맵 경로가 필요해요. 파일 맨 위 사용법을 보세요.");
  process.exit(1);
}

// 앱 바이너리 안에 미리 빌드돼 들어가는 네이티브 라이브러리. 판은 react-native 0.86.3의 podspec 기준.
const NATIVE = [
  { name: "folly", version: "2024.11.18.00", license: "Apache-2.0", file: "folly.txt" },
  { name: "glog", version: "0.3.5", license: "BSD-3-Clause", file: "glog.txt" },
  { name: "double-conversion", version: "1.1.6", license: "BSD-3-Clause", file: "double-conversion.txt" },
  { name: "fmt", version: "12.1.0", license: "MIT", file: "fmt.txt" },
  { name: "fast_float", version: "8.0.0", license: "Apache-2.0", file: "fast_float.txt" },
  { name: "boost", version: "1.84.0", license: "BSL-1.0", file: "boost.txt" },
  { name: "SocketRocket", version: "0.7.1", license: "BSD-3-Clause", file: "SocketRocket.txt" },
  { name: "hermes", version: "0.17.0", license: "MIT", file: "hermes.txt" },
];

const LICENSE_FILE = /^(licen[cs]e|copying|notice)([-_.].*)?$/i;

/** 경로 안에서 가장 안쪽 node_modules 패키지의 폴더. 패키지 밖이면 null. */
function packageRoot(path) {
  const parts = path.split(sep);
  const at = parts.lastIndexOf("node_modules");
  if (at < 0 || at + 1 >= parts.length) return null;
  const length = parts[at + 1].startsWith("@") ? at + 3 : at + 2;
  return parts.slice(0, length).join(sep);
}

const roots = new Set();

const map = JSON.parse(readFileSync(mapPath, "utf8"));
// Expo 소스맵의 경로는 프로젝트 기준이고 "/"로 시작한다. 예: "/node_modules/react/index.js"
for (const source of map.sources) {
  const absolute = resolve(root, source.replace(/^\//, ""));
  const pkg = packageRoot(absolute);
  if (pkg) roots.add(pkg);
}

const podfileLock = join(root, "ios", "Podfile.lock");
if (existsSync(podfileLock)) {
  for (const match of readFileSync(podfileLock, "utf8").matchAll(/:path: "?([^"\n]+)"?/g)) {
    const pkg = packageRoot(resolve(root, "ios", match[1]));
    if (pkg) roots.add(pkg);
  }
} else {
  console.warn("ios/Podfile.lock이 없어 네이티브 패키지는 빼고 만들어요. expo prebuild 뒤에 다시 실행하세요.");
}

function licenseOf(json) {
  if (typeof json.license === "string") return json.license;
  if (json.license?.type) return json.license.type;
  if (Array.isArray(json.licenses)) return json.licenses.map((l) => l.type ?? l).join(" OR ");
  return "UNKNOWN";
}

const texts = [];
const textIndex = new Map();
function addText(text) {
  const key = text.trim();
  if (!textIndex.has(key)) {
    textIndex.set(key, texts.length);
    texts.push(key);
  }
  return textIndex.get(key);
}

const packages = [];
const missing = [];
const seen = new Set();
for (const dir of [...roots].sort()) {
  const manifest = join(dir, "package.json");
  if (!existsSync(manifest)) continue;
  const json = JSON.parse(readFileSync(manifest, "utf8"));
  if (!json.name || seen.has(`${json.name}@${json.version}`)) continue;
  seen.add(`${json.name}@${json.version}`);
  const files = readdirSync(dir).filter((f) => LICENSE_FILE.test(f)).sort();
  let text = files.map((f) => readFileSync(join(dir, f), "utf8").trim()).join("\n\n");
  // @react-native/* 패키지는 react-native 저장소(MIT)의 일부인데 npm 묶음에 LICENSE가 빠져 있다.
  if (!text && json.name.startsWith("@react-native/") && existsSync(join(root, "node_modules", "react-native", "LICENSE")))
    text = readFileSync(join(root, "node_modules", "react-native", "LICENSE"), "utf8").trim();
  if (!text) {
    missing.push(`${json.name}@${json.version} (${relative(root, dir)})`);
    text = `${licenseOf(json)} License\n\n${json.name} ${json.version}${json.author ? ` · ${typeof json.author === "string" ? json.author : json.author.name}` : ""}\n${json.repository?.url ?? json.repository ?? json.homepage ?? ""}`.trim();
  }
  packages.push({ name: json.name, version: json.version, license: licenseOf(json), text: addText(text) });
}

for (const lib of NATIVE) {
  const text = readFileSync(join(root, "scripts", "native-licenses", lib.file), "utf8");
  packages.push({ name: lib.name, version: lib.version, license: lib.license, text: addText(text) });
}


packages.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(root, "src", "legal", "licenses.json"), `${JSON.stringify({ packages, texts })}\n`);
console.log(`${packages.length}개 패키지, 고지문 ${texts.length}종을 src/legal/licenses.json에 썼어요.`);
if (missing.length) console.log(`라이선스 파일이 없는 패키지 ${missing.length}개(이름·라이선스·저장소만 적음):\n  ${missing.join("\n  ")}`);
