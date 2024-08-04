import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";
import { existsSync } from "https://deno.land/std@0.224.0/fs/exists.ts";
import { join, dirname } from "https://deno.land/std@0.224.0/path/mod.ts";

// ファイルリストを読み込む関数
async function readFileList(filePath: string): Promise<Set<string>> {
  const data = await Deno.readTextFile(filePath);
  const dirPath = Deno.cwd();
  return new Set(data.split("\n").map(line => join(dirPath, line.trim())).filter(line => line !== ""));
}

// リストに含まれるディレクトリかどうかを確認する関数
function isDirectoryInFileList(directory: string, fileList: Set<string>): boolean {
  for (const filePath of fileList) {
    if (dirname(filePath).startsWith(directory)) {
      return true;
    }
  }
  return false;
}

// ディレクトリを再帰的にチェックして、リストにないファイルを削除する関数
async function cleanDirectory(directory: string, fileList: Set<string>) {
  for await (const entry of walk(directory, { includeDirs: false, followSymlinks: false })) {
    if (!fileList.has(entry.path) && entry.name !== 'cleanup.ts' && entry.name !== 'file_list.txt') {
      console.log(`Deleting: ${entry.path}`);
      await Deno.remove(entry.path);
    }
  }

  // 空のディレクトリも削除するが、リストに含まれるファイルがあるディレクトリは削除しない
  for await (const entry of walk(directory, { includeDirs: true, followSymlinks: false })) {
    if (existsSync(entry.path)) {
      const stat = await Deno.stat(entry.path);
      if (stat.isDirectory) {
        const files = [...Deno.readDirSync(entry.path)];
        if (files.length === 0 && !isDirectoryInFileList(entry.path, fileList)) {
          console.log(`Deleting empty directory: ${entry.path}`);
          await Deno.remove(entry.path);
        }
      }
    }
  }
}

// メイン関数
async function main() {
  try {
    const execDir = dirname(Deno.execPath());
    const fileListPath = join(execDir, "file_list.txt");
    
    if (!existsSync(fileListPath)) {
      throw new Error(`file_list.txt が ${execDir} に見つかりません。`);
    }

    console.log("ファイルリストを読み込んでいます...");
    const fileList = await readFileList(fileListPath);
    console.log(`${fileList.size} 個のファイルがリストに含まれています。`);

    const targetDirs = [];
    for (const entry of Deno.readDirSync(execDir)) {
      if (entry.isDirectory && entry.name !== "." && entry.name !== "..") {
        targetDirs.push(join(execDir, entry.name));
      }
    }

    if (targetDirs.length === 0) {
      console.log("対象ディレクトリが見つかりません。");
      return;
    }

    for (const targetDir of targetDirs) {
      console.log(`対象ディレクトリ: ${targetDir}`);
      console.log("クリーンアップを開始します...");
      await cleanDirectory(targetDir, fileList);
      console.log(`${targetDir} のクリーンアップが完了しました。`);
    }

    console.log("すべての処理が完了しました。");
  } catch (error) {
    console.error(`エラーが発生しました: ${error.message}`);
    Deno.exit(1);
  }
}

// スクリプトの実行
if (import.meta.main) {
  await main();
}