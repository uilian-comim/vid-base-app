import { useMemo } from 'react';
import { FileEntry } from '../contexts/FilesContext';

export interface GroupedDirectoryInfo {
    name: string;
    count: number;
    fileType: string;
}

export function useGroupedFiles(files: FileEntry[], groupByRoot: boolean, rootDirectories: string[]) {
    return useMemo(() => {
        if (groupByRoot && rootDirectories.length > 0) {
            // Group by Root Directory
            const rootMap = new Map<string, GroupedDirectoryInfo>();

            files.forEach(file => {
                // Find which root directory this file belongs to
                const rootDir = rootDirectories.find(dir => file.path.startsWith(dir));

                if (rootDir) {
                    const rootName = rootDir.split(/[\\/]/).pop() || rootDir;
                    if (!rootMap.has(rootDir)) {
                        rootMap.set(rootDir, { name: rootName, count: 0, fileType: file.file_type });
                    }
                    rootMap.get(rootDir)!.count++;
                }
            });

            return Array.from(rootMap.entries())
                .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }));

        } else {
            // Group by immediate parent directory
            return Object.entries(
                files.reduce((acc, file) => {
                    const separator = file.path.includes('/') ? '/' : '\\';
                    const parts = file.path.split(separator);
                    parts.pop(); // Remove filename
                    const parentPath = parts.join(separator);
                    const folderName = parts.pop() || parentPath;

                    if (!acc[parentPath]) {
                        acc[parentPath] = { name: folderName, count: 0, fileType: file.file_type };
                    }
                    acc[parentPath].count++;
                    return acc;
                }, {} as Record<string, GroupedDirectoryInfo>)
            ).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }));
        }
    }, [files, groupByRoot, rootDirectories]);
}
