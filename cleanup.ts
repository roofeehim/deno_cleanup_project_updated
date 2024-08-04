import { existsSync } from "https://deno.land/std@0.224.0/fs/exists.ts";
import { join, dirname, relative, normalize } from "https://deno.land/std@0.224.0/path/mod.ts";

async function readFileList(filePath: string): Promise<Set<string>> {
  const data = await Deno.readTextFile(filePath);
  return new Set(data.split("\n").map(line => normalize(line.trim())).filter(line => line !== ""));
}

function isFileInList(filePath: string, fileList: Set<string>, baseDir: string): boolean {
  const relativePath = normalize(relative(baseDir, filePath));
  const fileName = relativePath.split("/").pop() || "";
  const isInList = fileList.has(fileName);
  console.log(`Checking file: ${filePath}`);
  console.log(`Relative path: ${relativePath}`);
  console.log(`File name: ${fileName}`);
  console.log(`Is in list: ${isInList}`);
  return isInList;
}

function isDirectoryInFileList(directory: string, fileList: Set<string>, baseDir: string): boolean {
  const relativeDir = normalize(relative(baseDir, directory));
  for (const filePath of fileList) {
    if (relativeDir.endsWith(dirname(filePath))) {
      return true;
    }
  }
  return false;
}

async function cleanDirectory(dir: string, fileList: Set<string>, baseDir: string) {
  for await (const entry of Deno.readDir(dir)) {
    const fullPath = join(dir, entry.name);
    if (entry.isFile && !isFileInList(fullPath, fileList, baseDir)) {
      await Deno.remove(fullPath);
      console.log(`削除されたファイル: ${fullPath}`);
    } else if (entry.isDirectory) {
      if (!isDirectoryInFileList(fullPath, fileList, baseDir)) {
        await Deno.remove(fullPath, { recursive: true });
        console.log(`削除されたディレクトリ: ${fullPath}`);
      } else {
        await cleanDirectory(fullPath, fileList, baseDir);
      }
    }
  }
}

async function main() {
  try {
    const execDir = Deno.cwd();
    const fileListPath = "./file_list.txt";
    const targetDir = join(execDir, "target");
    
    if (!existsSync(fileListPath)) {
      throw new Error(`file_list.txt が ${execDir} に見つかりません。`);
    }

    if (!existsSync(targetDir)) {
      throw new Error(`target ディレクトリが ${execDir} に見つかりません。`);
    }

    console.log("ファイルリストを読み込んでいます...");
    const fileList = await readFileList(fileListPath);
    console.log(`${fileList.size} 個のファイルがリストに含まれています。`);
    console.log("ファイルリストの内容:");
    fileList.forEach(file => console.log(file));

    const targetDirs = [];
    for (const entry of Deno.readDirSync(targetDir)) {
      if (entry.isDirectory) {
        targetDirs.push(join(targetDir, entry.name));
      }
    }

    if (targetDirs.length === 0) {
      console.log("target ディレクトリ内に対象ディレクトリが見つかりません。");
      return;
    }

    for (const dir of targetDirs) {
      console.log(`対象ディレクトリ: ${dir}`);
      console.log("クリーンアップを開始します...");
      await cleanDirectory(dir, fileList, targetDir);
      console.log(`${dir} のクリーンアップが完了しました。`);
    }

    console.log("すべての処理が完了しました。");
  } catch (error) {
    console.error(`エラーが発生しました: ${error.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}